// Pannello amministratore e controllo di salute di Sahbi.
//   GET /api/admin            → numeri, incassi, avvisi, salute (solo per le e-mail in ADMIN_EMAIL)
//   GET /api/admin?health=1   → controllo pubblico (sì/no per ogni servizio, niente dati personali)
//   GET /api/admin?cron=1     → resoconto quotidiano per e-mail (chiamato dal cron di Vercel)
import { json, fail, env, getUser, rpc, openaiHeaders, OPENAI } from './_lib.js';
import { isAdmin, alert, sendMail, adminEmails } from './_alert.js';
import { stripe } from './_pay.js';
import { videoEnabled } from './_video.js';

const timed = (p, ms = 8000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

async function checkDb() {
  try { await timed(rpc('sahbi_today', {})); return { ok: true }; } catch (e) { return { ok: false, detail: e.message }; }
}
// deep = una vera micro-risposta (scopre anche il credito finito); costa una frazione di centesimo.
async function checkOpenAI(deep) {
  if (!env('OPENAI_API_KEY')) return { ok: false, detail: 'clé manquante' };
  try {
    if (!deep) {
      const r = await timed(fetch(`${OPENAI}/models?limit=1`, { headers: openaiHeaders() }));
      return r.ok ? { ok: true } : { ok: false, detail: `HTTP ${r.status}` };
    }
    const model = env('OPENAI_CHAT_MODEL', 'gpt-5-nano');
    const r = await timed(fetch(`${OPENAI}/chat/completions`, {
      method: 'POST',
      headers: openaiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 16, ...(model.startsWith('gpt-5') ? { reasoning_effort: 'minimal' } : {}) }),
    }), 20000);
    if (r.ok) return { ok: true };
    const t = await r.text().catch(() => '');
    let code = ''; try { const e = JSON.parse(t).error || {}; code = `${e.code || e.type || ''} ${e.param || ''}`.trim(); } catch { /* non JSON */ }
    return { ok: false, detail: /quota|billing|insufficient/i.test(t) ? 'crédit épuisé' : `HTTP ${r.status}${code ? ` ${code}` : ''}` };
  } catch (e) { return { ok: false, detail: e.message }; }
}
async function checkStripe() {
  if (!env('STRIPE_SECRET_KEY')) return { ok: null, detail: 'pas encore configuré' };
  try {
    const b = await timed(stripe('balance', null, 'GET'));
    const fmt = (arr) => (arr || []).map((x) => `${(x.amount / 100).toFixed(2)} ${x.currency.toUpperCase()}`).join(', ') || '0';
    return { ok: true, live: !String(env('STRIPE_SECRET_KEY')).startsWith('sk_test'), available: fmt(b.available), pending: fmt(b.pending) };
  } catch (e) { return { ok: false, detail: e.message }; }
}

async function health(deep) {
  const [db, openai] = await Promise.all([checkDb(), checkOpenAI(deep)]);
  return {
    db, openai,
    video: { ok: videoEnabled() ? true : null, detail: videoEnabled() ? '' : 'pas de clé Pruna' },
    email: { ok: env('RESEND_API_KEY') && adminEmails().length ? true : null, detail: env('RESEND_API_KEY') ? '' : 'RESEND_API_KEY manquante (pas d’e-mails d’alerte)' },
    payments: { stripe: !!env('STRIPE_SECRET_KEY'), lemonsqueezy: !!env('LEMONSQUEEZY_API_KEY'), googleplay: !!env('GOOGLE_PLAY_SERVICE_ACCOUNT'), chargily: !!env('CHARGILY_SECRET_KEY') },
  };
}
const allOk = (h) => h.db.ok && h.openai.ok;

const money = (rows) => (rows || []).map((r) => `${r.provider} : ${r.count} paiement(s), ${(r.amount / (r.currency === 'dzd' ? 1 : 100)).toLocaleString('fr-FR')} ${String(r.currency || '').toUpperCase()}`).join('\n') || 'aucun';

export async function GET(request) {
  const q = new URL(request.url).searchParams;

  if (q.get('health')) {
    const [h, visits] = await Promise.all([health(false), rpc('visit_stats', {}).then(() => true).catch(() => false)]);
    return json({ ok: allOk(h), db: h.db.ok, openai: h.openai.ok, video: h.video.ok, visits, at: new Date().toISOString() }, allOk(h) ? 200 : 503);
  }

  if (q.get('cron')) {
    // Resoconto del mattino: al massimo uno ogni 20 ore, anche se qualcuno chiama questo indirizzo.
    // Chiamato ogni ora da GitHub Actions (.github/workflows/surveillance.yml) e ogni mattina da Vercel.
    // Il controllo "vero" di OpenAI (che scopre il credito finito) si fa al massimo ogni 25 minuti.
    let deep = true;
    try { deep = await rpc('admin_alert', { p_kind: 'probe_openai', p_message: 'contrôle automatique', p_every_minutes: 10 }); } catch { /* db giù */ }
    const h = await health(deep);
    if (!h.db.ok) await alert('db_down', `La base de données ne répond pas : ${h.db.detail}`, 60);
    if (!h.openai.ok) {
      if (h.openai.detail === 'crédit épuisé') await alert('openai_quota', 'Le crédit OpenAI est épuisé : Sahbi ne peut plus répondre ni créer d’images. Recharge ici : https://platform.openai.com/settings/organization/billing/overview', 60);
      else await alert('openai_down', `Contrôle automatique : OpenAI ne marche pas (${h.openai.detail}).`, 60);
    }
    let due = false;
    try { due = await rpc('admin_alert', { p_kind: 'daily_report', p_message: 'résumé du jour', p_every_minutes: 1200 }); } catch { /* db giù */ }
    if (due) {
      const s = await rpc('admin_stats', {}).catch(() => null);
      const v = await rpc('visit_stats', {}).catch(() => null);
      const st = await checkStripe();
      const lines = [
        allOk(h) ? '✅ Tout fonctionne.' : '⚠️ Il y a un problème, regarde le panneau.',
        '',
        s ? `Utilisateurs : ${s.users} (+${s.users_today} en 24 h, +${s.users_week} en 7 jours)` : '',
        s ? `Abonnés Pro actifs : ${s.pro}` : '',
        v ? `Visites : ${v.today?.visitors || 0} visiteurs aujourd'hui · ${v.week?.visitors || 0} en 7 jours · ${v.month?.visitors || 0} en 30 jours` : '',
        s ? `Actifs aujourd'hui : ${s.active_today} · messages ${s.usage_today?.chat || 0} · images ${s.usage_today?.image || 0} · vidéos ce mois ${s.videos_month}` : '',
        s ? `\nPaiements ce mois :\n${money(s.payments_month)}` : '',
        st.ok ? `\nStripe : disponible ${st.available} · en attente ${st.pending}${st.live ? '' : ' (mode test)'}` : '',
        s?.alerts?.filter((a) => !/^(daily_report|probe_)/.test(a.kind)).length ? `\nProblèmes des 7 derniers jours :\n${s.alerts.filter((a) => !/^(daily_report|probe_)/.test(a.kind)).map((a) => `- ${a.kind} (${a.count}×) : ${a.message}`).join('\n')}` : '',
        '\nPanneau : https://www.sahbi.bond/admin.html',
      ];
      await sendMail(`Sahbi – résumé du jour${allOk(h) ? '' : ' ⚠️'}`, lines.filter((l) => l !== '').join('\n'));
    }
    return json({ ok: allOk(h), report: due, db: h.db.ok ? 'ok' : 'ko', openai: h.openai.ok ? 'ok' : (h.openai.detail === 'crédit épuisé' ? 'credit' : 'ko'), detail: h.openai.ok ? undefined : String(h.openai.detail || '').slice(0, 80), deep });
  }

  const user = await getUser(request);
  if (!user) return fail('auth', 401, 'Connecte-toi d’abord sur Sahbi.');
  if (!isAdmin(user.email)) return fail('forbidden', 403, adminEmails().length ? `Cette page est réservée à l’administrateur. Tu es connecté avec : ${user.email}` : 'ADMIN_EMAIL n’est pas encore configuré sur Vercel (ou le Redeploy n’a pas été fait).');
  const [stats, h, st, visits] = await Promise.all([rpc('admin_stats', {}).catch((e) => ({ error: e.message })), health(q.get('deep') === '1'), checkStripe(), rpc('visit_stats', {}).catch(() => null)]);
  return json({
    stats, health: h, stripe: st, visits,
    config: {
      adminEmails: adminEmails(),
      alertsByEmail: !!env('RESEND_API_KEY'),
      publicUrl: env('PUBLIC_URL', ''),
      android: !!env('ANDROID_SHA256'),
      adsense: !!env('ADSENSE_CLIENT', 'ca-pub-4750815574904840'),
    },
  });
}

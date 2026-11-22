// Studio "Écrire un livre": 1) struttura del libro (titolo, sottotitolo, capitoli con riassunto),
// 2) scrittura di un capitolo alla volta (in streaming), coerente con i capitoli già scritti.
import { env, fail, json, useCredit, refundCredit, getPlan, openaiHeaders, OPENAI } from './_lib.js';

const S = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const LANGS = { fr: 'français', ar: 'arabe standard (fusha), simple et élégant', darija: 'darija (dialecte maghrébin) en lettres arabes', eg: 'arabe égyptien', en: 'anglais', it: 'italien', es: 'espagnol' };
const model = () => env('OPENAI_BOOK_MODEL', 'gpt-5-mini');

function brief(b) {
  return [
    b.title && `Titre : ${S(b.title, 120)}`,
    `Genre : ${S(b.genre, 60) || 'libre'}`,
    `Public : ${S(b.audience, 40) || 'adultes'}`,
    `Langue d'écriture : ${LANGS[b.lang] || S(b.lang, 40) || 'français'}`,
    b.idea && `Idée de l'auteur : ${S(b.idea, 1500)}`,
  ].filter(Boolean).join('\n');
}

async function outline(b) {
  const n = Math.min(20, Math.max(3, Number(b.chapters) || 8));
  const r = await fetch(`${OPENAI}/chat/completions`, {
    method: 'POST', headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: model(), reasoning_effort: 'low', response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Tu es un éditeur professionnel. Tu construis la STRUCTURE d'un livre à partir de l'idée de l'auteur : un titre accrocheur (garde celui de l'auteur s'il en donne un), un sous-titre, un court résumé (4e de couverture, 3-4 phrases), et exactement ${n} chapitres. Chaque chapitre a un titre et un résumé de 2-3 phrases qui fait avancer l'histoire ou le sujet de façon logique (début, développement, fin). Tout est écrit dans la langue d'écriture demandée. Contenu respectueux : pas de sexe explicite, pas de haine, pas de violence gratuite. Réponds uniquement en JSON : {"title":"","subtitle":"","blurb":"","chapters":[{"title":"","summary":""}]}` },
        { role: 'user', content: brief(b) },
      ],
    }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error('upstream'), { status: r.status });
  const o = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
  const chapters = (Array.isArray(o.chapters) ? o.chapters : []).slice(0, n).map((c) => ({ title: S(c?.title, 140), summary: S(c?.summary, 600) })).filter((c) => c.title);
  if (!chapters.length) throw new Error('empty');
  return { title: S(o.title, 140) || S(b.title, 140), subtitle: S(o.subtitle, 200), blurb: S(o.blurb, 900), chapters };
}

async function chapterStream(b) {
  const list = (Array.isArray(b.toc) ? b.toc : []).slice(0, 20).map((c, i) => `${i + 1}. ${S(c?.title, 140)} — ${S(c?.summary, 400)}`).join('\n');
  const i = Math.max(0, Math.min(19, Number(b.index) || 0));
  const before = S(b.before, 3000);
  return fetch(`${OPENAI}/chat/completions`, {
    method: 'POST', headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: model(), reasoning_effort: 'low', stream: true, max_completion_tokens: 6000,
      messages: [
        { role: 'system', content: `Tu es un écrivain professionnel. Tu écris UN chapitre complet d'un livre, dans la langue d'écriture demandée, avec un vrai style (descriptions, dialogues si c'est une histoire, exemples concrets si c'est un guide). Longueur : environ 1200 à 1800 mots. Respecte le plan, les personnages, les noms et le ton des chapitres précédents. Commence directement par le texte du chapitre, sans répéter son numéro ni son titre, sans introduction du type « Voici le chapitre ». Paragraphes séparés par une ligne vide. Pas de Markdown (ni #, ni **). Contenu respectueux et adapté au public.` },
        { role: 'user', content: `${brief(b)}\n\nPLAN DU LIVRE :\n${list}\n\n${before ? `RÉSUMÉ DE CE QUI EST DÉJÀ ÉCRIT :\n${before}\n\n` : ''}${b.notes ? `Consignes de l'auteur pour ce chapitre : ${S(b.notes, 600)}\n\n` : ''}Écris maintenant le chapitre ${i + 1} : « ${S(b.toc?.[i]?.title, 140)} ».` },
      ],
    }),
  });
}

// "FIN": tutta la chat diventa il libro finale. Formato testo semplice (in streaming), letto dal telefono:
// TITRE: … / SOUS-TITRE: … / ## Titolo del capitolo / paragrafi.
async function compileStream(b) {
  const msgs = (Array.isArray(b.messages) ? b.messages : []).filter((m) => m && typeof m.content === 'string')
    .map((m) => `${m.role === 'user' ? 'AUTEUR' : 'SAHBI'} : ${m.content.slice(0, 4000)}`);
  let convo = msgs.join('\n\n'); if (convo.length > 60000) convo = convo.slice(-60000);
  return fetch(`${OPENAI}/chat/completions`, {
    method: 'POST', headers: openaiHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: model(), reasoning_effort: 'low', stream: true, max_completion_tokens: 16000,
      messages: [
        { role: 'system', content: `Tu es un éditeur et écrivain professionnel. À partir de la CONVERSATION entre l'auteur et Sahbi, rédige le LIVRE FINAL complet, prêt à être imprimé.
- Utilise tout ce que l'auteur a raconté, dans l'ordre du dernier plan validé (ou crée un plan logique s'il n'y en a pas). Garde ses idées, ses personnages, ses noms et ses souvenirs ; améliore le style, ajoute les transitions et les descriptions nécessaires, sans changer le sens.
- Langue : celle que l'auteur a choisie pour le livre ; sinon la langue dans laquelle il écrit le plus (n'importe quelle langue du monde : arabe, darija, turc, anglais, espagnol, italien, russe, ourdou, chinois…). Titres, chapitres et texte dans cette même langue. Seules les étiquettes TITRE/SOUS-TITRE/SOMMAIRE restent en français.
- Chaque chapitre : plusieurs paragraphes bien écrits (environ 600 à 1500 mots selon la matière disponible).
- Contenu respectueux. Pas de Markdown à part le format ci-dessous, pas de commentaires de ta part.
FORMAT EXACT :
TITRE: le titre du livre
SOUS-TITRE: le sous-titre (ou rien)
SOMMAIRE: les mots « Table des matières » traduits dans la langue du livre
## Titre du chapitre 1
paragraphes…
## Titre du chapitre 2
paragraphes…` },
        { role: 'user', content: `CONVERSATION :\n${convo}\n\nRédige maintenant le livre final.` },
      ],
    }),
  });
}

export async function bookHandler(userId, b) {
  if (!b || typeof b !== 'object' || !['outline', 'chapter', 'compile'].includes(b.action)) return fail('bad_request', 400, 'Demande invalide.');
  const { limits } = await getPlan(userId);
  const left = await useCredit(userId, 'chat', limits.chat);
  if (left < 0) return fail('limit', 429, 'Limite de messages atteinte pour aujourd’hui.');
  try {
    if (b.action === 'outline') return json(await outline(b));
    const up = b.action === 'compile' ? await compileStream(b) : await chapterStream(b);
    if (!up.ok || !up.body) throw Object.assign(new Error('upstream'), { status: up.status });
    const enc = new TextEncoder(), dec = new TextDecoder();
    const body = new ReadableStream({
      async start(controller) {
        const reader = up.body.getReader(); let buf = '';
        try {
          for (;;) {
            const { value, done } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); let k;
            while ((k = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
              if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
              try { const t = JSON.parse(line.slice(5)).choices?.[0]?.delta?.content; if (t) controller.enqueue(enc.encode(t)); } catch { /* riga incompleta */ }
            }
          }
        } catch (e) { console.error('book stream', e.message); }
        controller.close();
      },
    });
    return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    await refundCredit(userId, 'chat').catch(() => {});
    console.error('book', e.status, e.message);
    if (e.status && e.status !== 400) { const { openaiAlert } = await import('./_alert.js'); await openaiAlert(e.status, 'book').catch(() => {}); }
    return fail('upstream', 502, 'Sahbi n’a pas pu écrire pour le moment. Réessaie.');
  }
}

// Altri motori di gioco scritti a mano, personalizzati da Sahbi con create_game:
//  - runner: personaggio che corre e salta gli ostacoli (corsa infinita, parallasse, monete, doppio salto)
//  - quiz:   domande a scelta multipla scritte da Sahbi, con tempo, punteggio, serie e record
// Nessuna libreria esterna, funzionano senza internet (anche nell'app Android).
const BASE_CSS = `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;overflow:hidden;touch-action:manipulation;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:#000}
.screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;background:radial-gradient(ellipse at center,rgba(0,0,0,.25),rgba(0,0,0,.8));z-index:5}
.screen h1{margin:0;font-size:clamp(36px,10vw,68px);line-height:1.05;font-weight:900;letter-spacing:-.02em;background:linear-gradient(180deg,#fff,var(--c1));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 20px rgba(0,0,0,.5))}
.screen p{margin:0;max-width:380px;opacity:.92;font-size:16px;line-height:1.45}
.big{border:0;border-radius:999px;padding:16px 44px;font-size:22px;font-weight:900;color:#111;background:linear-gradient(135deg,#fff,var(--c1));box-shadow:0 10px 30px -8px var(--c1);cursor:pointer}
.row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.chip{background:rgba(255,255,255,.14);border-radius:12px;padding:8px 12px;font-weight:700;font-size:14px}
.hidden{display:none!important}
.hud{position:fixed;top:max(10px,env(safe-area-inset-top));left:12px;right:12px;display:flex;justify-content:space-between;pointer-events:none;font-weight:800;text-shadow:0 2px 6px rgba(0,0,0,.5);z-index:3}
.hud .box{background:rgba(0,0,0,.3);backdrop-filter:blur(6px);border-radius:14px;padding:8px 12px;min-width:80px}
.hud small{display:block;font-size:11px;opacity:.8;letter-spacing:.06em;text-transform:uppercase}
.hud b{font-size:22px;font-variant-numeric:tabular-nums}`;

const STORE_JS = `var mem={};function load(k){try{return localStorage.getItem(k)}catch(e){return mem[k]||null}}function save(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}
var AC=null;function beep(f,d,t,v){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();var o=AC.createOscillator(),g=AC.createGain();o.type=t||'sine';o.frequency.value=f;g.gain.value=v||.12;o.connect(g);g.connect(AC.destination);var n=AC.currentTime;g.gain.exponentialRampToValueAtTime(.0001,n+d);o.start(n);o.stop(n+d)}catch(e){}}`;

const TXT = {
  fr: { play: 'JOUER', again: 'REJOUER', score: 'Score', best: 'Record', coins: 'Pièces', over: 'Perdu !', newBest: 'Nouveau record !', tap: 'Touche l’écran pour sauter (2 fois = double saut)', time: 'Temps', streak: 'Série', q: 'Question', right: 'Bravo !', wrong: 'Raté…', result: 'Ton résultat', next: 'Suivante' },
  it: { play: 'GIOCA', again: 'RIGIOCA', score: 'Punti', best: 'Record', coins: 'Monete', over: 'Hai perso!', newBest: 'Nuovo record!', tap: 'Tocca lo schermo per saltare (2 volte = doppio salto)', time: 'Tempo', streak: 'Serie', q: 'Domanda', right: 'Bravo!', wrong: 'Sbagliato…', result: 'Il tuo risultato', next: 'Avanti' },
  en: { play: 'PLAY', again: 'PLAY AGAIN', score: 'Score', best: 'Best', coins: 'Coins', over: 'Game over!', newBest: 'New record!', tap: 'Tap the screen to jump (twice = double jump)', time: 'Time', streak: 'Streak', q: 'Question', right: 'Correct!', wrong: 'Wrong…', result: 'Your result', next: 'Next' },
  ar: { play: 'العب', again: 'أعد اللعب', score: 'النقاط', best: 'الرقم', coins: 'القطع', over: 'خسرت!', newBest: 'رقم قياسي جديد!', tap: 'المس الشاشة للقفز (مرتين = قفزة مزدوجة)', time: 'الوقت', streak: 'سلسلة', q: 'سؤال', right: 'أحسنت!', wrong: 'خطأ…', result: 'نتيجتك', next: 'التالي' },
  es: { play: 'JUGAR', again: 'OTRA VEZ', score: 'Puntos', best: 'Récord', coins: 'Monedas', over: '¡Perdiste!', newBest: '¡Nuevo récord!', tap: 'Toca la pantalla para saltar (2 veces = doble salto)', time: 'Tiempo', streak: 'Racha', q: 'Pregunta', right: '¡Bien!', wrong: 'Fallaste…', result: 'Tu resultado', next: 'Siguiente' },
};

const page = (cfg, css, body, js) => `<!doctype html>
<html lang="${cfg.lang}"${cfg.lang === 'ar' ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${cfg.title}</title>
<style>:root{--c1:${cfg.color1};--c2:${cfg.color2}}${BASE_CSS}${css}</style>
</head>
<body>
${body}
<script>
(function(){'use strict';
var CFG=${JSON.stringify(cfg)};var T=${JSON.stringify(TXT[cfg.lang] || TXT.fr)};
var $=function(i){return document.getElementById(i)};
${STORE_JS}
${js}
})();
</script>
</body>
</html>`;

// ---------- RUNNER ----------
const RUNNER_THEMES = {
  city: { sky: ['#1a1446', '#ff7a59'], far: '#2b2350', near: '#3d3270', ground: '#22223a', top: '#ff7a59' },
  desert: { sky: ['#ffb347', '#ffe9b0'], far: '#d9a35a', near: '#c78b44', ground: '#b9783a', top: '#e8b264' },
  night: { sky: ['#03030f', '#1c1450'], far: '#120d36', near: '#1d1650', ground: '#0d0d1f', top: '#00e5ff' },
  forest: { sky: ['#5fb3ff', '#e6f5ff'], far: '#7fbf7a', near: '#3f8f45', ground: '#5a3d22', top: '#3fae4a' },
  coast: { sky: ['#1e90ff', '#c9ecff'], far: '#7cc4ff', near: '#2f7fd1', ground: '#e9cf98', top: '#f4dfb1' },
};
function runnerGame(cfg) {
  const th = RUNNER_THEMES[cfg.theme] || RUNNER_THEMES.city;
  const css = `canvas{position:fixed;inset:0;width:100%;height:100%;display:block}`;
  const body = `<canvas id="c"></canvas>
<div class="hud hidden" id="hud"><div class="box"><small id="tS"></small><b id="sc">0</b></div><div class="box" style="text-align:center"><small id="tC"></small><b id="co">0</b></div><div class="box" style="text-align:right"><small id="tB"></small><b id="be">0</b></div></div>
<div class="screen" id="start"><div style="font-size:64px">${cfg.hero}</div><h1 id="ti"></h1><p id="su"></p><span class="chip" id="hint"></span><button class="big" id="play"></button><p id="bs" style="opacity:.75"></p></div>
<div class="screen hidden" id="over"><div style="font-size:56px">💥</div><h1 id="ot"></h1><div class="row"><span class="chip" id="os"></span><span class="chip" id="oc"></span><span class="chip" id="ob"></span></div><button class="big" id="again"></button></div>`;
  const js = `var TH=${JSON.stringify(th)};var DIFF={easy:.85,normal:1,hard:1.2}[CFG.difficulty]||1;
$('ti').textContent=CFG.title;$('su').textContent=CFG.subtitle||'';$('hint').textContent=T.tap;$('play').textContent=T.play;$('again').textContent=T.again;$('tS').textContent=T.score;$('tC').textContent=T.coins;$('tB').textContent=T.best;
var KEY='run-best-'+CFG.title,best=parseInt(load(KEY),10)||0;$('be').textContent=best;if(best)$('bs').textContent=T.best+' : '+best;
var cv=$('c'),x=cv.getContext('2d'),W,H,G,DPR;function rs(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;x.setTransform(DPR,0,0,DPR,0,0);G=H*.78}addEventListener('resize',rs);rs();
var p,obs,coins,parts,speed,dist,score,nc,run=false,t=0,shake=0,last=performance.now();
function reset(){p={y:0,vy:0,j:0,sz:Math.max(46,Math.min(W,H)*.11)};obs=[];coins=[];parts=[];speed=Math.max(320,W*.75)*DIFF;dist=0;score=0;nc=0;$('sc').textContent=0;$('co').textContent=0}
reset();
function jump(){if(!run)return;if(p.j<2){p.vy=-Math.max(820,H*1.45)*(p.j?.85:1);p.j++;beep(p.j>1?720:520,.12,'square',.08);for(var i=0;i<8;i++)parts.push({x:W*.22,y:G,vx:Math.random()*-160,vy:Math.random()*-120,l:.4,c:'#fff'})}}
addEventListener('pointerdown',function(e){if(e.target.tagName==='BUTTON')return;jump()});addEventListener('keydown',function(e){if(e.key===' '||e.key==='ArrowUp'){e.preventDefault();if(run)jump();else start()}});
function start(){reset();run=true;$('start').classList.add('hidden');$('over').classList.add('hidden');$('hud').classList.remove('hidden');beep(660,.1,'square',.08);setTimeout(function(){beep(990,.15,'square',.08)},110)}
$('play').onclick=start;$('again').onclick=start;
function die(){run=false;shake=16;beep(110,.5,'sawtooth',.25);var nb=score>best;if(nb){best=score;save(KEY,String(best));$('be').textContent=best}setTimeout(function(){$('ot').textContent=nb?T.newBest:T.over;$('os').textContent=T.score+' : '+score;$('oc').textContent=T.coins+' : '+nc;$('ob').textContent=T.best+' : '+best;$('over').classList.remove('hidden')},600)}
var OB=${JSON.stringify(cfg.obstacles)};
function spawn(){var lastX=obs.length?obs[obs.length-1].x:0;if(lastX>W-Math.max(260,speed*.75))return;var s=p.sz*(.7+Math.random()*.5),fly=Math.random()<.22&&dist>1500;obs.push({x:W+40+Math.random()*120,w:s*.8,h:s,fly:fly,e:OB[Math.floor(Math.random()*OB.length)]});if(Math.random()<.6){var n=3+Math.floor(Math.random()*4),cy=G-p.sz*(1.4+Math.random()*1.6);for(var i=0;i<n;i++)coins.push({x:W+300+i*p.sz*.9,y:cy,got:false})}}
function upd(dt){t+=dt;if(!run){return}speed+=dt*14*DIFF;dist+=speed*dt;score=Math.floor(dist/40)+nc*10;$('sc').textContent=score;
p.vy+=Math.max(2600,H*4.4)*dt;p.y+=p.vy*dt;if(p.y>0){p.y=0;p.vy=0;p.j=0}
spawn();var px=W*.22,py=G+p.y-p.sz,ps=p.sz*.72;
for(var i=obs.length-1;i>=0;i--){var o=obs[i];o.x-=speed*dt;if(o.x<-100){obs.splice(i,1);continue}var oy=o.fly?G-p.sz*1.9:G-o.h;if(px+ps*.5>o.x+o.w*.15&&px-ps*.5<o.x+o.w*.85&&py+ps>oy+o.h*.15&&py<oy+o.h*.9){die();return}}
for(i=coins.length-1;i>=0;i--){var c=coins[i];c.x-=speed*dt;if(c.x<-40){coins.splice(i,1);continue}if(!c.got&&Math.abs(c.x-px)<p.sz*.6&&Math.abs(c.y-(py+p.sz*.4))<p.sz*.7){c.got=true;nc++;$('co').textContent=nc;beep(1300,.08,'triangle',.1);for(var k=0;k<6;k++)parts.push({x:c.x,y:c.y,vx:(Math.random()-.5)*200,vy:(Math.random()-.5)*200,l:.4,c:'#ffd23f'})}}
for(i=parts.length-1;i>=0;i--){var q=parts[i];q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.l<=0)parts.splice(i,1)}}
function hills(col,amp,per,spd,base){x.fillStyle=col;x.beginPath();x.moveTo(0,H);for(var i=0;i<=W+20;i+=20)x.lineTo(i,base-Math.abs(Math.sin((i+dist*spd)/per))*amp);x.lineTo(W,H);x.fill()}
function draw(){x.save();if(shake){x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-1)}
var g=x.createLinearGradient(0,0,0,G);g.addColorStop(0,TH.sky[0]);g.addColorStop(1,TH.sky[1]);x.fillStyle=g;x.fillRect(0,0,W,H);
x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(W*.8,H*.2,Math.min(W,H)*.06,0,6.3);x.fill();
hills(TH.far,H*.16,160,.08,G-H*.06);hills(TH.near,H*.1,90,.25,G);
x.fillStyle=TH.ground;x.fillRect(0,G,W,H-G);x.fillStyle=TH.top;x.fillRect(0,G,W,6);
x.fillStyle='rgba(255,255,255,.08)';for(var i=0;i<W+60;i+=60)x.fillRect((i-dist%60),G+18,30,4);
x.textAlign='center';x.textBaseline='middle';
for(i=0;i<coins.length;i++){var c=coins[i];if(c.got)continue;x.save();x.translate(c.x,c.y);x.scale(Math.abs(Math.cos(t*5))*.7+.3,1);x.fillStyle='#ffd23f';x.beginPath();x.arc(0,0,p.sz*.22,0,6.3);x.fill();x.fillStyle='#fff3b0';x.beginPath();x.arc(0,0,p.sz*.12,0,6.3);x.fill();x.restore()}
for(i=0;i<obs.length;i++){var o=obs[i],oy=o.fly?G-p.sz*1.9:G-o.h;x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.ellipse(o.x+o.w/2,G+4,o.w*.45,5,0,0,6.3);x.fill();x.font=Math.round(o.h)+'px serif';x.fillStyle='#000';x.fillText(o.e,o.x+o.w/2,oy+o.h/2)}
var px=W*.22,py=G+p.y-p.sz;x.fillStyle='rgba(0,0,0,.3)';x.beginPath();x.ellipse(px,G+4,p.sz*.35*(1+p.y/400),6,0,0,6.3);x.fill();
x.save();x.translate(px,py+p.sz/2);x.rotate(p.j?Math.min(.5,-p.vy/3000):Math.sin(t*18)*.06*(run?1:0));x.font=Math.round(p.sz)+'px serif';x.scale(-1,1);x.fillStyle='#000';x.fillText(CFG.hero,0,0);x.restore();
for(i=0;i<parts.length;i++){var q=parts[i];x.globalAlpha=Math.max(0,q.l*2.5);x.fillStyle=q.c;x.fillRect(q.x,q.y,4,4)}x.globalAlpha=1;x.restore()}
function frame(n){var dt=Math.max(0,Math.min(.05,(n-last)/1000));last=n;upd(dt);if(!run&&$('start').classList.contains('hidden')===false){dist+=120*dt}draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);`;
  return page(cfg, css, body, js);
}

// ---------- QUIZ ----------
function quizGame(cfg) {
  const css = `body{background:radial-gradient(ellipse at top,var(--c2),#0b0b1a 70%)}
.wrap{position:fixed;inset:0;display:flex;flex-direction:column;padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));gap:14px;max-width:640px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:center;font-weight:800}
.bar{height:10px;border-radius:9px;background:rgba(255,255,255,.15);overflow:hidden}.bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--c1),#fff);transition:width .1s linear}
.card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:22px;padding:22px;font-size:clamp(20px,5.4vw,28px);font-weight:800;line-height:1.3;text-align:center;min-height:120px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
.ans{display:grid;gap:10px}.ans button{border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:16px;padding:16px;font:700 18px system-ui;text-align:start;cursor:pointer;transition:transform .1s}
.ans button:active{transform:scale(.98)}.ans .ok{background:#22c55e;border-color:#22c55e}.ans .ko{background:#ef4444;border-color:#ef4444}
.fb{text-align:center;font-weight:800;min-height:24px}.pts{font-size:clamp(48px,14vw,80px);font-weight:900}`;
  const body = `<div class="screen" id="start"><div style="font-size:60px">${cfg.hero}</div><h1 id="ti"></h1><p id="su"></p><button class="big" id="play"></button><p id="bs" style="opacity:.75"></p></div>
<div class="wrap hidden" id="game"><div class="top"><span id="qn"></span><span id="st"></span><span id="pt"></span></div><div class="bar"><i id="tb"></i></div><div class="card" id="qq"></div><div class="ans" id="aa"></div><div class="fb" id="fb"></div></div>
<div class="screen hidden" id="over"><h1 id="ot"></h1><div class="pts" id="op"></div><div class="row"><span class="chip" id="oc"></span><span class="chip" id="ob"></span></div><button class="big" id="again"></button></div>`;
  const js = `var Q=${JSON.stringify(cfg.questions)};var SEC={easy:20,normal:15,hard:10}[CFG.difficulty]||15;
$('ti').textContent=CFG.title;$('su').textContent=CFG.subtitle||'';$('play').textContent=T.play;$('again').textContent=T.again;
var KEY='quiz-best-'+CFG.title,best=parseInt(load(KEY),10)||0;if(best)$('bs').textContent=T.best+' : '+best;
var order,i,pts,streak,good,left,timer,lock;
function shuf(a){a=a.slice();for(var k=a.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1)),t=a[k];a[k]=a[j];a[j]=t}return a}
function start(){order=shuf(Q);i=0;pts=0;streak=0;good=0;$('start').classList.add('hidden');$('over').classList.add('hidden');$('game').classList.remove('hidden');ask()}
function ask(){lock=false;var q=order[i];$('qn').textContent=T.q+' '+(i+1)+'/'+order.length;$('pt').textContent=pts+' pts';$('st').textContent=streak>1?'🔥 '+streak:'';$('qq').textContent=q.q;$('fb').textContent='';var box=$('aa');box.innerHTML='';
var opts=shuf(q.a.map(function(t,k){return{t:t,ok:k===q.c}}));opts.forEach(function(o){var b=document.createElement('button');b.textContent=o.t;b.onclick=function(){pick(b,o.ok)};b.dataset.ok=o.ok?'1':'';box.appendChild(b)});
left=SEC;clearInterval(timer);timer=setInterval(function(){left-=.1;$('tb').style.width=Math.max(0,left/SEC*100)+'%';if(left<=0){clearInterval(timer);pick(null,false)}},100)}
function pick(b,ok){if(lock)return;lock=true;clearInterval(timer);var all=$('aa').children;for(var k=0;k<all.length;k++){if(all[k].dataset.ok)all[k].classList.add('ok')}
if(ok){streak++;good++;var gain=100+Math.round(left/SEC*100)+(streak>2?50:0);pts+=gain;$('fb').textContent=T.right+' +'+gain;beep(880,.1,'triangle',.1);setTimeout(function(){beep(1320,.12,'triangle',.1)},90)}
else{streak=0;if(b)b.classList.add('ko');$('fb').textContent=T.wrong+(order[i].e?' — '+order[i].e:'');beep(180,.3,'sawtooth',.12)}
setTimeout(function(){i++;if(i<order.length)ask();else end()},ok?1100:2200)}
function end(){$('game').classList.add('hidden');var nb=pts>best;if(nb){best=pts;save(KEY,String(best))}$('ot').textContent=nb?T.newBest:T.result;$('op').textContent=pts;$('oc').textContent='✅ '+good+'/'+order.length;$('ob').textContent=T.best+' : '+best;$('over').classList.remove('hidden')}
$('play').onclick=start;$('again').onclick=start;`;
  return page(cfg, css, body, js);
}

const SAFE = (s, n) => String(s || '').replace(/[<>&"'`$\\]/g, '').slice(0, n);
const COLOR = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);
const EMOJI = (s, d) => { const v = String(s || '').trim(); return v && v.length <= 8 && !/[<>&"'`$\\a-z0-9]/i.test(v) ? v : d; };
export function moreGame(o = {}) {
  const cfg = {
    title: SAFE(o.title, 30) || (o.kind === 'quiz' ? 'Quiz' : 'Super Run'),
    subtitle: SAFE(o.subtitle, 90),
    color1: COLOR(o.color1, o.kind === 'quiz' ? '#ffd23f' : '#ff6b35'),
    color2: COLOR(o.color2, o.kind === 'quiz' ? '#5b2bd1' : '#ffd23f'),
    theme: ['city', 'desert', 'night', 'forest', 'coast'].includes(o.theme) ? o.theme : 'city',
    difficulty: ['easy', 'normal', 'hard'].includes(o.difficulty) ? o.difficulty : 'normal',
    lang: ['fr', 'it', 'en', 'ar', 'es'].includes(o.lang) ? o.lang : 'fr',
    hero: EMOJI(o.hero, o.kind === 'quiz' ? '🧠' : '🏃'),
  };
  if (o.kind === 'quiz') {
    const qs = (Array.isArray(o.questions) ? o.questions : []).map((q) => ({
      q: SAFE(q?.question || q?.q, 200),
      a: (Array.isArray(q?.answers || q?.a) ? (q.answers || q.a) : []).slice(0, 4).map((x) => SAFE(x, 90)).filter(Boolean),
      c: Math.max(0, Math.min(3, Number(q?.correct ?? q?.c) | 0)),
      e: SAFE(q?.explanation || q?.e, 160),
    })).filter((q) => q.q && q.a.length >= 2 && q.c < q.a.length).slice(0, 30);
    if (qs.length < 3) return null;
    return quizGame({ ...cfg, questions: qs });
  }
  const obstacles = (Array.isArray(o.obstacles) ? o.obstacles : []).map((e) => EMOJI(e, '')).filter(Boolean).slice(0, 6);
  return runnerGame({ ...cfg, obstacles: obstacles.length ? obstacles : ['🌵', '🪨', '📦', '🔥'] });
}

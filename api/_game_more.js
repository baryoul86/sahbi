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
// ---------- BLOCKS (blocchi che cadono, stile puzzle classico) ----------
const BLOCK_TXT = {
  fr: { lines: 'Lignes', level: 'Niveau', next: 'Suivant', hold: 'Réserve', help: 'Glisse ← → pour bouger · touche pour tourner · glisse ↓ pour faire tomber', pause: 'Pause' },
  it: { lines: 'Righe', level: 'Livello', next: 'Prossimo', hold: 'Riserva', help: 'Scorri ← → per muovere · tocca per ruotare · scorri ↓ per far cadere', pause: 'Pausa' },
  en: { lines: 'Lines', level: 'Level', next: 'Next', hold: 'Hold', help: 'Swipe ← → to move · tap to rotate · swipe ↓ to drop', pause: 'Pause' },
  ar: { lines: 'الأسطر', level: 'المستوى', next: 'التالي', hold: 'احتياط', help: 'اسحب ← → للتحريك · المس للتدوير · اسحب ↓ للإسقاط', pause: 'إيقاف' },
  es: { lines: 'Líneas', level: 'Nivel', next: 'Siguiente', hold: 'Reserva', help: 'Desliza ← → para mover · toca para girar · desliza ↓ para soltar', pause: 'Pausa' },
};
function blocksGame(cfg) {
  const css = `body{background:radial-gradient(ellipse at top,var(--c2),#07071a 75%)}
#c{position:fixed;inset:0;width:100%;height:100%;display:block}
.side{position:fixed;top:max(10px,env(safe-area-inset-top));left:10px;right:10px;display:flex;justify-content:space-between;gap:8px;z-index:3;pointer-events:none}
.side .box{background:rgba(0,0,0,.35);backdrop-filter:blur(6px);border-radius:14px;padding:6px 10px;font-weight:800;text-align:center;min-width:64px}
.side small{display:block;font-size:10px;opacity:.75;letter-spacing:.06em;text-transform:uppercase}.side b{font-size:20px;font-variant-numeric:tabular-nums}
.pad{position:fixed;left:0;right:0;bottom:max(10px,env(safe-area-inset-bottom));display:flex;justify-content:center;gap:10px;z-index:4}
.pad button{width:62px;height:62px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font:900 24px system-ui;backdrop-filter:blur(6px)}
.pad button:active{background:var(--c1);color:#111}
#pz{pointer-events:auto;border:0;border-radius:14px;padding:0 14px;background:rgba(0,0,0,.35);color:#fff;font:800 18px system-ui}`;
  const body = `<canvas id="c"></canvas>
<div class="side hidden" id="hud"><div class="box"><small id="l1"></small><b id="sc">0</b></div><div class="box"><small id="l2"></small><b id="li">0</b></div><button id="pz" class="hidden">⏸</button><div class="box"><small id="l3"></small><b id="lv">1</b></div></div>
<div class="pad hidden" id="pad"><button id="bl">◀</button><button id="br">▶</button><button id="bro">⟳</button><button id="bd">▼</button><button id="bh">⇅</button></div>
<div class="screen" id="start"><div style="font-size:60px">${cfg.hero}</div><h1 id="ti"></h1><p id="su"></p><button class="big" id="play"></button><p id="hp" style="opacity:.8;font-size:14px"></p><p id="bs" style="opacity:.75"></p></div>
<div class="screen hidden" id="paused"><h1 id="pt"></h1><button class="big" id="res">▶</button></div>
<div class="screen hidden" id="over"><h1 id="ot"></h1><div class="row"><span class="chip" id="os"></span><span class="chip" id="ol"></span><span class="chip" id="ob"></span></div><button class="big" id="again"></button></div>`;
  const js = `var B=${JSON.stringify(BLOCK_TXT[cfg.lang] || BLOCK_TXT.fr)};
var cv=$('c'),x=cv.getContext('2d'),W,H,DPR,CS,OX,OY;var COLS=10,ROWS=20;
var PAL=['#00e5ff','#ffd23f','#b06bff','#2fd16b','#ff4d5e','#3d7bff','#ff8a3d'];
var SH=[[[0,1],[1,1],[2,1],[3,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[0,1],[1,1],[2,1]],[[2,0],[0,1],[1,1],[2,1]]];
var SPEED={easy:.8,normal:1,hard:1.35}[CFG.difficulty]||1;
var grid,cur,nxt,hold,canHold,bag,score,lines,level,acc,run=false,paused=false,clearing=null,parts=[],shake=0,lock=0;
var KEY='blocks-best-'+CFG.title,best=parseInt(load(KEY),10)||0;
$('ti').textContent=CFG.title;$('su').textContent=CFG.subtitle||'';$('play').textContent=T.play;$('again').textContent=T.again;$('hp').textContent=B.help;$('pt').textContent=B.pause;
$('l1').textContent=T.score;$('l2').textContent=B.lines;$('l3').textContent=B.level;if(best)$('bs').textContent=T.best+' : '+best;
function size(){DPR=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;x.setTransform(DPR,0,0,DPR,0,0);var top=70,bot=90;CS=Math.floor(Math.min((W-110)/COLS,(H-top-bot)/ROWS));CS=Math.max(12,CS);OX=Math.floor((W-CS*COLS)/2)-(W>520?0:28);if(OX<6)OX=6;OY=top+Math.floor((H-top-bot-CS*ROWS)/2)}
addEventListener('resize',size);size();
function newBag(){var b=[0,1,2,3,4,5,6];for(var i=6;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=b[i];b[i]=b[j];b[j]=t}return b}
function take(){if(!bag.length)bag=newBag();var t=bag.pop();return{t:t,c:SH[t].map(function(p){return[p[0],p[1]]}),x:3,y:-1}}
function cells(p){return p.c.map(function(q){return[q[0]+p.x,q[1]+p.y]})}
function fits(p){var cs=cells(p);for(var i=0;i<4;i++){var cx=cs[i][0],cy=cs[i][1];if(cx<0||cx>=COLS||cy>=ROWS)return false;if(cy>=0&&grid[cy][cx]>=0)return false}return true}
function rot(p,d){if(p.t===1)return p;var n={t:p.t,x:p.x,y:p.y,c:p.c.map(function(q){return d>0?[2-q[1]+(p.t===0?1:0),q[0]]:[q[1],2-q[0]+(p.t===0?1:0)]})};var k=[0,-1,1,-2,2];for(var i=0;i<k.length;i++){var m={t:n.t,c:n.c,x:n.x+k[i],y:n.y};if(fits(m))return m;m.y--;if(fits(m))return m}return p}
function reset(){grid=[];for(var r=0;r<ROWS;r++){grid.push([]);for(var c=0;c<COLS;c++)grid[r].push(-1)}bag=[];cur=take();nxt=take();hold=null;canHold=true;score=0;lines=0;level=1;acc=0;parts=[];clearing=null;upd()}
function upd(){$('sc').textContent=score;$('li').textContent=lines;$('lv').textContent=level}
function start(){reset();run=true;paused=false;['start','over','paused'].forEach(function(i){$(i).classList.add('hidden')});['hud','pad','pz'].forEach(function(i){$(i).classList.remove('hidden')});beep(660,.1,'square',.08)}
function over(){run=false;shake=14;beep(110,.6,'sawtooth',.2);var nb=score>best;if(nb){best=score;save(KEY,String(best))}['pad','pz'].forEach(function(i){$(i).classList.add('hidden')});setTimeout(function(){$('ot').textContent=nb?T.newBest:T.over;$('os').textContent=T.score+' : '+score;$('ol').textContent=B.lines+' : '+lines;$('ob').textContent=T.best+' : '+best;$('over').classList.remove('hidden')},500)}
function place(){var cs=cells(cur),top=false;for(var i=0;i<4;i++){if(cs[i][1]<0){top=true;continue}grid[cs[i][1]][cs[i][0]]=cur.t}beep(180,.06,'triangle',.1);if(top){over();return}var full=[];for(var r=0;r<ROWS;r++){if(grid[r].every(function(v){return v>=0}))full.push(r)}if(full.length){clearing={rows:full,t:0};full.forEach(function(r){for(var c=0;c<COLS;c++)for(var k=0;k<3;k++)parts.push({x:OX+(c+.5)*CS,y:OY+(r+.5)*CS,vx:(Math.random()-.5)*420,vy:-Math.random()*360,l:.7,c:PAL[grid[r][c]]})});shake=full.length*3;beep(520+full.length*120,.25,'square',.1)}else next()}
function next(){cur=nxt;nxt=take();canHold=true;lock=0;if(!fits(cur))over()}
function finishClear(){var rows=clearing.rows;rows.forEach(function(r){grid.splice(r,1);var e=[];for(var c=0;c<COLS;c++)e.push(-1);grid.unshift(e)});var n=rows.length;score+=[0,100,300,500,800][n]*level;lines+=n;var lv=1+Math.floor(lines/10);if(lv>level){level=lv;beep(880,.2,'square',.1);setTimeout(function(){beep(1320,.25,'square',.1)},120)}clearing=null;upd();next()}
function move(dx){if(!run||paused||clearing)return;var m={t:cur.t,c:cur.c,x:cur.x+dx,y:cur.y};if(fits(m)){cur=m;lock=0;beep(300,.03,'square',.04)}}
function turn(){if(!run||paused||clearing)return;var r=rot(cur,1);if(r!==cur){cur=r;lock=0;beep(440,.05,'triangle',.06)}}
function soft(){if(!run||paused||clearing)return;var m={t:cur.t,c:cur.c,x:cur.x,y:cur.y+1};if(fits(m)){cur=m;score+=1;upd()}else place()}
function hard(){if(!run||paused||clearing)return;var n=0;while(fits({t:cur.t,c:cur.c,x:cur.x,y:cur.y+1})){cur.y++;n++}score+=n*2;upd();shake=4;place()}
function doHold(){if(!run||paused||clearing||!canHold)return;var t=cur.t;if(hold===null){hold=t;next()}else{var h=hold;hold=t;cur={t:h,c:SH[h].map(function(p){return[p[0],p[1]]}),x:3,y:-1}}canHold=false;beep(600,.06,'sine',.08)}
function ghost(){var g={t:cur.t,c:cur.c,x:cur.x,y:cur.y};while(fits({t:g.t,c:g.c,x:g.x,y:g.y+1}))g.y++;return g}
function shade(hex,a){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;r=Math.max(0,Math.min(255,r+a));g=Math.max(0,Math.min(255,g+a));b=Math.max(0,Math.min(255,b+a));return 'rgb('+r+','+g+','+b+')'}
function cell(px,py,s,col,alpha){x.globalAlpha=alpha==null?1:alpha;var e=Math.max(2,s*.14);x.fillStyle=col;x.fillRect(px,py,s,s);x.fillStyle=shade(col,70);x.beginPath();x.moveTo(px,py);x.lineTo(px+s,py);x.lineTo(px+s-e,py+e);x.lineTo(px+e,py+e);x.lineTo(px+e,py+s-e);x.lineTo(px,py+s);x.fill();x.fillStyle=shade(col,-70);x.beginPath();x.moveTo(px+s,py+s);x.lineTo(px,py+s);x.lineTo(px+e,py+s-e);x.lineTo(px+s-e,py+s-e);x.lineTo(px+s-e,py+e);x.lineTo(px+s,py);x.fill();var gr=x.createLinearGradient(px,py,px+s,py+s);gr.addColorStop(0,'rgba(255,255,255,.28)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(px+e,py+e,s-2*e,s-2*e);x.globalAlpha=1}
function mini(t,px,py,s){if(t===null||t===undefined)return;SH[t].forEach(function(q){cell(px+q[0]*s,py+q[1]*s,s,PAL[t])})}
var bgT=0;
function draw(dt){bgT+=dt;x.clearRect(0,0,W,H);x.save();if(shake){x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-.6)}
for(var i=0;i<26;i++){var sx=(i*137.5+bgT*8*(1+i%3))%W,sy=(i*89.3+bgT*14*(1+i%2))%H;x.fillStyle='rgba(255,255,255,'+(.04+.04*(i%3))+')';x.fillRect(sx,sy,2,2)}
x.fillStyle='rgba(0,0,0,.45)';x.fillRect(OX-6,OY-6,COLS*CS+12,ROWS*CS+12);x.strokeStyle=CFG.color1;x.lineWidth=2;x.shadowColor=CFG.color1;x.shadowBlur=18;x.strokeRect(OX-6,OY-6,COLS*CS+12,ROWS*CS+12);x.shadowBlur=0;
x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=1;for(var c=1;c<COLS;c++){x.beginPath();x.moveTo(OX+c*CS,OY);x.lineTo(OX+c*CS,OY+ROWS*CS);x.stroke()}for(var r=1;r<ROWS;r++){x.beginPath();x.moveTo(OX,OY+r*CS);x.lineTo(OX+COLS*CS,OY+r*CS);x.stroke()}
if(grid){for(var r2=0;r2<ROWS;r2++)for(var c2=0;c2<COLS;c2++){var v=grid[r2][c2];if(v>=0){var fl=clearing&&clearing.rows.indexOf(r2)>=0;cell(OX+c2*CS,OY+r2*CS,CS,fl?(Math.floor(clearing.t*20)%2?'#ffffff':PAL[v]):PAL[v])}}
if(run&&!clearing){var g=ghost();cells(g).forEach(function(q){if(q[1]>=0){x.strokeStyle=PAL[cur.t];x.globalAlpha=.55;x.lineWidth=2;x.strokeRect(OX+q[0]*CS+2,OY+q[1]*CS+2,CS-4,CS-4);x.globalAlpha=1}});cells(cur).forEach(function(q){if(q[1]>=0)cell(OX+q[0]*CS,OY+q[1]*CS,CS,PAL[cur.t])})}
var ms=Math.max(9,Math.floor(CS*.55)),sxp=OX+COLS*CS+14;if(sxp+ms*4>W)sxp=W-ms*4-6;x.fillStyle='rgba(255,255,255,.8)';x.font='800 11px system-ui';x.fillText(B.next.toUpperCase(),sxp,OY+10);mini(nxt&&nxt.t,sxp,OY+18,ms);x.fillStyle='rgba(255,255,255,.8)';x.fillText(B.hold.toUpperCase(),sxp,OY+ms*4+34);x.globalAlpha=canHold?1:.4;mini(hold,sxp,OY+ms*4+42,ms);x.globalAlpha=1}
for(var k=parts.length-1;k>=0;k--){var p=parts[k];p.l-=dt;if(p.l<=0){parts.splice(k,1);continue}p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;x.globalAlpha=Math.min(1,p.l*2);x.fillStyle=p.c;x.fillRect(p.x-3,p.y-3,6,6)}x.globalAlpha=1;x.restore()}
var last=performance.now();
function frame(n){var dt=Math.max(0,Math.min(.05,(n-last)/1000));last=n;
if(run&&!paused){if(clearing){clearing.t+=dt;if(clearing.t>.35)finishClear()}else{acc+=dt;var iv=Math.max(.06,(.85-(level-1)*.07)/SPEED);if(acc>=iv){acc=0;var m={t:cur.t,c:cur.c,x:cur.x,y:cur.y+1};if(fits(m))cur=m;else{lock+=iv;if(lock>=.45)place()}}}}
draw(dt);requestAnimationFrame(frame)}requestAnimationFrame(frame);
$('play').onclick=start;$('again').onclick=start;
$('pz').onclick=function(){if(!run)return;paused=true;$('paused').classList.remove('hidden')};$('res').onclick=function(){paused=false;$('paused').classList.add('hidden')};
function hold_(id,f){var b=$(id),iv=null,to=null;function go(e){e.preventDefault();e.stopPropagation();f();to=setTimeout(function(){iv=setInterval(f,70)},220)}function st(){clearTimeout(to);clearInterval(iv)}b.addEventListener('pointerdown',go);b.addEventListener('pointerup',st);b.addEventListener('pointerleave',st);b.addEventListener('pointercancel',st)}
hold_('bl',function(){move(-1)});hold_('br',function(){move(1)});hold_('bd',soft);
$('bro').addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();turn()});$('bh').addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();doHold()});
var sx0=0,sy0=0,st0=0,movedX=0,swiped=false;
cv.addEventListener('pointerdown',function(e){sx0=e.clientX;sy0=e.clientY;st0=performance.now();movedX=0;swiped=false});
cv.addEventListener('pointermove',function(e){if(!e.buttons&&e.pointerType==='mouse')return;var dx=e.clientX-sx0-movedX*CS;if(Math.abs(dx)>CS*.9){var d=dx>0?1:-1;move(d);movedX+=d;swiped=true}var dy=e.clientY-sy0;if(dy>CS*2.2&&!swiped&&performance.now()-st0<300){hard();swiped=true}else if(dy>CS*1.2&&!swiped){soft();sy0+=CS;}});
cv.addEventListener('pointerup',function(e){if(!swiped&&Math.abs(e.clientX-sx0)<10&&Math.abs(e.clientY-sy0)<10&&performance.now()-st0<300)turn()});
addEventListener('keydown',function(e){var k=e.key;if(k==='ArrowLeft')move(-1);else if(k==='ArrowRight')move(1);else if(k==='ArrowUp'||k==='x')turn();else if(k==='ArrowDown')soft();else if(k===' '){e.preventDefault();hard()}else if(k==='c'||k==='Shift')doHold();else return;e.preventDefault()});`;
  return page(cfg, css, body, js);
}

// ---------- SNAKE ----------
function snakeGame(cfg) {
  const css = `body{background:radial-gradient(ellipse at top,var(--c2),#06140c 75%)}#c{position:fixed;inset:0;width:100%;height:100%;display:block}`;
  const body = `<canvas id="c"></canvas><div class="hud hidden" id="hud"><div class="box"><small id="l1"></small><b id="sc">0</b></div><div class="box"><small id="l2"></small><b id="be">0</b></div></div>
<div class="screen" id="start"><div style="font-size:60px">${cfg.hero}</div><h1 id="ti"></h1><p id="su"></p><button class="big" id="play"></button><p id="hp" style="opacity:.8;font-size:14px"></p></div>
<div class="screen hidden" id="over"><h1 id="ot"></h1><div class="row"><span class="chip" id="os"></span><span class="chip" id="ob"></span></div><button class="big" id="again"></button></div>`;
  const help = { fr: 'Glisse le doigt pour tourner. Mange pour grandir !', it: 'Scorri il dito per girare. Mangia per crescere!', en: 'Swipe to turn. Eat to grow!', ar: 'اسحب للالتفاف. كُل لتكبر!', es: 'Desliza para girar. ¡Come para crecer!' }[cfg.lang] || 'Swipe to turn.';
  const js = `var cv=$('c'),x=cv.getContext('2d'),W,H,DPR,CS,N=18,M,OX,OY;var FOOD=${JSON.stringify(cfg.obstacles)};
var KEY='snake-best-'+CFG.title,best=parseInt(load(KEY),10)||0;$('be').textContent=best;
$('ti').textContent=CFG.title;$('su').textContent=CFG.subtitle||'';$('play').textContent=T.play;$('again').textContent=T.again;$('hp').textContent=${JSON.stringify(help)};$('l1').textContent=T.score;$('l2').textContent=T.best;
function size(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;x.setTransform(DPR,0,0,DPR,0,0);CS=Math.floor(Math.min(W-16,H-110)/N);M=Math.floor((H-110)/CS);OX=Math.floor((W-CS*N)/2);OY=80}addEventListener('resize',size);size();
var sn,dir,nd,food,score,run=false,acc=0,parts=[],SPD={easy:7,normal:9,hard:12}[CFG.difficulty]||9;
function place(){for(;;){var f={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*M),e:FOOD[Math.floor(Math.random()*FOOD.length)]};if(!sn.some(function(s){return s.x===f.x&&s.y===f.y}))return f}}
function start(){sn=[{x:5,y:Math.floor(M/2)},{x:4,y:Math.floor(M/2)},{x:3,y:Math.floor(M/2)}];dir={x:1,y:0};nd=dir;food=place();score=0;$('sc').textContent=0;run=true;$('start').classList.add('hidden');$('over').classList.add('hidden');$('hud').classList.remove('hidden');beep(660,.1,'square',.08)}
function over(){run=false;beep(110,.5,'sawtooth',.2);var nb=score>best;if(nb){best=score;save(KEY,String(best));$('be').textContent=best}setTimeout(function(){$('ot').textContent=nb?T.newBest:T.over;$('os').textContent=T.score+' : '+score;$('ob').textContent=T.best+' : '+best;$('over').classList.remove('hidden')},400)}
function step(){dir=nd;var h={x:sn[0].x+dir.x,y:sn[0].y+dir.y};if(h.x<0||h.y<0||h.x>=N||h.y>=M||sn.some(function(s){return s.x===h.x&&s.y===h.y})){over();return}sn.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;$('sc').textContent=score;beep(880,.08,'square',.08);for(var i=0;i<12;i++)parts.push({x:OX+(h.x+.5)*CS,y:OY+(h.y+.5)*CS,vx:(Math.random()-.5)*300,vy:(Math.random()-.5)*300,l:.5});food=place()}else sn.pop()}
function turn(dx,dy){if(dx===-dir.x&&dy===-dir.y)return;nd={x:dx,y:dy}}
var last=performance.now();function frame(n){var dt=Math.max(0,Math.min(.05,(n-last)/1000));last=n;if(run){acc+=dt;var iv=1/(SPD+score/60);while(acc>=iv&&run){acc-=iv;step()}}
x.clearRect(0,0,W,H);for(var r=0;r<M;r++)for(var c=0;c<N;c++){x.fillStyle=(r+c)%2?'rgba(255,255,255,.04)':'rgba(255,255,255,.08)';x.fillRect(OX+c*CS,OY+r*CS,CS,CS)}x.strokeStyle=CFG.color1;x.lineWidth=2;x.strokeRect(OX,OY,N*CS,M*CS);
if(sn){x.font=Math.floor(CS*.85)+'px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#000';x.fillText(food.e,OX+(food.x+.5)*CS,OY+(food.y+.55)*CS);
for(var i=sn.length-1;i>=0;i--){var s=sn[i],k=1-i/sn.length*.5;var g=x.createRadialGradient(OX+(s.x+.35)*CS,OY+(s.y+.35)*CS,1,OX+(s.x+.5)*CS,OY+(s.y+.5)*CS,CS*.7);g.addColorStop(0,'#fff');g.addColorStop(.25,CFG.color1);g.addColorStop(1,CFG.color2);x.fillStyle=g;x.beginPath();x.arc(OX+(s.x+.5)*CS,OY+(s.y+.5)*CS,CS*.48*k+CS*.04,0,7);x.fill()}
var h=sn[0];x.fillStyle='#111';x.beginPath();x.arc(OX+(h.x+.5+dir.x*.15-dir.y*.18)*CS,OY+(h.y+.5+dir.y*.15+dir.x*.18)*CS,CS*.08,0,7);x.arc(OX+(h.x+.5+dir.x*.15+dir.y*.18)*CS,OY+(h.y+.5+dir.y*.15-dir.x*.18)*CS,CS*.08,0,7);x.fill()}
for(var j=parts.length-1;j>=0;j--){var p=parts[j];p.l-=dt;if(p.l<=0){parts.splice(j,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;x.globalAlpha=p.l*2;x.fillStyle=CFG.color1;x.fillRect(p.x-3,p.y-3,6,6)}x.globalAlpha=1;requestAnimationFrame(frame)}requestAnimationFrame(frame);
$('play').onclick=start;$('again').onclick=start;
var tx=0,ty=0;addEventListener('pointerdown',function(e){tx=e.clientX;ty=e.clientY});addEventListener('pointermove',function(e){if(!e.buttons&&e.pointerType==='mouse')return;var dx=e.clientX-tx,dy=e.clientY-ty;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;if(Math.abs(dx)>Math.abs(dy))turn(dx>0?1:-1,0);else turn(0,dy>0?1:-1);tx=e.clientX;ty=e.clientY});
addEventListener('keydown',function(e){var m={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(m){e.preventDefault();turn(m[0],m[1])}});`;
  return page(cfg, css, body, js);
}

export function moreGame(o = {}) {
  const cfg = {
    title: SAFE(o.title, 30) || ({ quiz: 'Quiz', blocks: 'Block Fall', snake: 'Snake' }[o.kind] || 'Super Run'),
    subtitle: SAFE(o.subtitle, 90),
    color1: COLOR(o.color1, o.kind === 'quiz' ? '#ffd23f' : '#ff6b35'),
    color2: COLOR(o.color2, o.kind === 'quiz' ? '#5b2bd1' : '#ffd23f'),
    theme: ['city', 'desert', 'night', 'forest', 'coast'].includes(o.theme) ? o.theme : 'city',
    difficulty: ['easy', 'normal', 'hard'].includes(o.difficulty) ? o.difficulty : 'normal',
    lang: ['fr', 'it', 'en', 'ar', 'es'].includes(o.lang) ? o.lang : 'fr',
    hero: EMOJI(o.hero, { quiz: '🧠', blocks: '🧱', snake: '🐍' }[o.kind] || '🏃'),
  };
  if (o.kind === 'blocks') return blocksGame({ ...cfg, color2: COLOR(o.color2, '#3b1a7a'), color1: COLOR(o.color1, '#00e5ff') });
  if (o.kind === 'snake') {
    const food = (Array.isArray(o.obstacles) ? o.obstacles : []).map((e) => EMOJI(e, '')).filter(Boolean).slice(0, 6);
    return snakeGame({ ...cfg, color1: COLOR(o.color1, '#2fd16b'), color2: COLOR(o.color2, '#0e5a2c'), obstacles: food.length ? food : ['🍎', '🍓', '🍒', '🍇'] });
  }
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

// Motore di gioco "moto" scritto a mano (strada pseudo-3D con curve e colline, traffico, nitro, monete, suono).
// Sahbi lo personalizza con create_game: titolo, colori, ambientazione, lingua, difficoltà. Nessuna libreria esterna,
// funziona senza internet (anche dentro l'app Android). __CFG__ viene sostituito dalla configurazione.
export const MOTO_TEMPLATE = String.raw`<!doctype html>
<html lang="__LANG__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>__TITLE__</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block}
  .hud{position:fixed;top:max(10px,env(safe-area-inset-top));left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;font-weight:800;text-shadow:0 2px 6px rgba(0,0,0,.6)}
  .hud .box{background:rgba(0,0,0,.35);backdrop-filter:blur(6px);border-radius:14px;padding:8px 12px;min-width:84px}
  .hud small{display:block;font-size:11px;opacity:.75;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .hud b{font-size:22px;font-variant-numeric:tabular-nums}
  .speedo{position:fixed;right:12px;bottom:calc(122px + env(safe-area-inset-bottom));width:96px;height:96px;pointer-events:none}
  .ctrl{position:fixed;left:0;right:0;bottom:max(14px,env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:flex-end;padding:0 14px;pointer-events:none}
  .ctrl button{pointer-events:auto;border:0;border-radius:22px;width:84px;height:84px;font-size:34px;font-weight:900;color:#fff;background:rgba(255,255,255,.14);backdrop-filter:blur(6px);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
  .ctrl button:active,.ctrl button.on{background:rgba(255,255,255,.3);transform:scale(.96)}
  .ctrl .nitro{width:96px;height:96px;border-radius:50%;font-size:15px;letter-spacing:.06em;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 8px 24px -6px var(--c1)}
  .ctrl .nitro small{display:block;font-size:11px;opacity:.85}
  .nbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(112px + env(safe-area-inset-bottom));width:160px;height:8px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden;pointer-events:none}
  .nbar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--c2),var(--c1))}
  .screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;background:radial-gradient(ellipse at center,rgba(0,0,0,.35),rgba(0,0,0,.85))}
  .screen h1{margin:0;font-size:clamp(38px,11vw,72px);line-height:1;font-weight:900;letter-spacing:-.02em;background:linear-gradient(180deg,#fff,var(--c1));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 20px rgba(0,0,0,.6))}
  .screen p{margin:0;max-width:360px;opacity:.9;font-size:16px;line-height:1.4}
  .screen .big{border:0;border-radius:999px;padding:16px 44px;font-size:22px;font-weight:900;color:#111;background:linear-gradient(135deg,#fff,var(--c1));box-shadow:0 10px 30px -8px var(--c1);margin-top:6px}
  .screen .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .screen .chip{background:rgba(255,255,255,.12);border-radius:12px;padding:8px 12px;font-weight:700;font-size:14px}
  .hidden{display:none!important}
  .flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="hud hidden" id="hud">
  <div class="box"><small id="tScore"></small><b id="score">0</b></div>
  <div class="box" style="text-align:center"><small id="tCoins"></small><b id="coins">0</b></div>
  <div class="box" style="text-align:right"><small id="tBest"></small><b id="best">0</b></div>
</div>
<canvas class="speedo hidden" id="speedo" width="220" height="220"></canvas>
<div class="nbar hidden" id="nbar"><i id="nfill"></i></div>
<div class="ctrl hidden" id="ctrl">
  <button id="bl" aria-label="left">◀</button>
  <button class="nitro" id="bn"><span id="tNitro"></span><small>NOS</small></button>
  <button id="br" aria-label="right">▶</button>
</div>
<div class="screen" id="start">
  <h1 id="title"></h1>
  <p id="sub"></p>
  <div class="row"><span class="chip" id="hint1"></span><span class="chip" id="hint2"></span></div>
  <button class="big" id="play"></button>
  <p id="bestStart" style="opacity:.75"></p>
</div>
<div class="screen hidden" id="over">
  <h1 id="overT"></h1>
  <div class="row"><span class="chip" id="oScore"></span><span class="chip" id="oCoins"></span><span class="chip" id="oBest"></span></div>
  <button class="big" id="again"></button>
</div>
<div class="flash" id="flash"></div>
<script>
(function () {
'use strict';
var CFG = __CFG__;
var T = {
  fr: { score: 'Score', coins: 'Pièces', best: 'Record', play: 'JOUER', again: 'REJOUER', over: 'Accident !', newBest: 'Nouveau record !', hint1: '◀ ▶ pour tourner', hint2: 'NITRO pour accélérer', nitro: 'NITRO', bestIs: 'Ton record : ' },
  it: { score: 'Punti', coins: 'Monete', best: 'Record', play: 'GIOCA', again: 'RIGIOCA', over: 'Incidente!', newBest: 'Nuovo record!', hint1: '◀ ▶ per sterzare', hint2: 'NITRO per accelerare', nitro: 'NITRO', bestIs: 'Il tuo record: ' },
  en: { score: 'Score', coins: 'Coins', best: 'Best', play: 'PLAY', again: 'PLAY AGAIN', over: 'Crash!', newBest: 'New record!', hint1: '◀ ▶ to steer', hint2: 'NITRO to boost', nitro: 'NITRO', bestIs: 'Your best: ' },
  ar: { score: 'النقاط', coins: 'القطع', best: 'الرقم', play: 'العب', again: 'أعد اللعب', over: 'حادث!', newBest: 'رقم قياسي جديد!', hint1: '◀ ▶ للتوجيه', hint2: 'نيترو للتسارع', nitro: 'نيترو', bestIs: 'رقمك القياسي: ' },
  es: { score: 'Puntos', coins: 'Monedas', best: 'Récord', play: 'JUGAR', again: 'OTRA VEZ', over: '¡Choque!', newBest: '¡Nuevo récord!', hint1: '◀ ▶ para girar', hint2: 'NITRO para acelerar', nitro: 'NITRO', bestIs: 'Tu récord: ' },
}[CFG.lang] || null;
if (!T) T = { score: 'Score', coins: 'Pièces', best: 'Record', play: 'JOUER', again: 'REJOUER', over: 'Accident !', newBest: 'Nouveau record !', hint1: '◀ ▶', hint2: 'NITRO', nitro: 'NITRO', bestIs: 'Record : ' };
if (CFG.lang === 'ar') document.documentElement.dir = 'rtl';
var $ = function (id) { return document.getElementById(id); };
document.documentElement.style.setProperty('--c1', CFG.color1);
document.documentElement.style.setProperty('--c2', CFG.color2);
$('title').textContent = CFG.title; $('sub').textContent = CFG.subtitle || '';
$('play').textContent = T.play; $('again').textContent = T.again; $('hint1').textContent = T.hint1; $('hint2').textContent = T.hint2;
$('tScore').textContent = T.score; $('tCoins').textContent = T.coins; $('tBest').textContent = T.best; $('tNitro').textContent = T.nitro;

// ---------- Salvataggio (funziona anche dove localStorage è vietato) ----------
var KEY = 'moto-best-' + CFG.title;
var mem = {};
function load(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
var best = parseInt(load(KEY), 10) || 0;
$('best').textContent = best; if (best) $('bestStart').textContent = T.bestIs + best;

// ---------- Ambientazioni ----------
var THEMES = {
  city:   { sky: ['#0b1026', '#3b2a6b', '#ff7a59'], grass: ['#1f2a33', '#18222a'], rumble: ['#e9e9e9', '#d23c3c'], road: ['#3a3d44', '#363940'], lane: '#f5f5f5', fog: '#3b2a6b', side: 'building' },
  desert: { sky: ['#ffb347', '#ffcc70', '#ffe9b0'], grass: ['#e0b46b', '#d6a95e'], rumble: ['#ffffff', '#c0392b'], road: ['#6b5d52', '#66584d'], lane: '#fff7e0', fog: '#ffd89a', side: 'palm' },
  night:  { sky: ['#000008', '#0a0a2a', '#1c1450'], grass: ['#05140d', '#04110b'], rumble: ['#ffffff', '#00e5ff'], road: ['#16161d', '#131319'], lane: '#00e5ff', fog: '#0a0a2a', side: 'lamp' },
  forest: { sky: ['#5fb3ff', '#9fd3ff', '#e6f5ff'], grass: ['#2f8f3a', '#2a8034'], rumble: ['#ffffff', '#e74c3c'], road: ['#555a60', '#50555b'], lane: '#ffffff', fog: '#cfe9ff', side: 'tree' },
  coast:  { sky: ['#1e90ff', '#6ec6ff', '#c9ecff'], grass: ['#f1d9a6', '#e9cf98'], rumble: ['#ffffff', '#1e90ff'], road: ['#4b4f57', '#474b53'], lane: '#ffffff', fog: '#bfe6ff', side: 'palm' },
};
var TH = THEMES[CFG.theme] || THEMES.city;
var DIFF = { easy: 0.8, normal: 1, hard: 1.25 }[CFG.difficulty] || 1;

// ---------- Canvas ----------
var cv = $('c'), cx = cv.getContext('2d'), W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener('resize', resize); resize();

// ---------- Strada (segmenti) ----------
var SEG = 200, RUMBLE = 3, ROADW = 2000, DRAW = 220, CAMH = 1000, CAMD = 1 / Math.tan(50 * Math.PI / 360);
var segs = [], trackLen = 0;
function easeIn(a, b, p) { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); }
function lastY() { return segs.length ? segs[segs.length - 1].p2.y : 0; }
function addSeg(curve, y) {
  var n = segs.length;
  segs.push({ i: n, curve: curve, p1: { y: lastY(), z: n * SEG, sx: 0, sy: 0, sw: 0, scale: 0 }, p2: { y: y, z: (n + 1) * SEG, sx: 0, sy: 0, sw: 0, scale: 0 }, color: Math.floor(n / RUMBLE) % 2, sprites: [], cars: [], coins: [], clip: 0 });
}
function addRoad(enter, hold, leave, curve, hill) {
  var sy = lastY(), ey = sy + hill * SEG, total = enter + hold + leave, i;
  for (i = 0; i < enter; i++) addSeg(easeIn(0, curve, i / enter), easeInOut(sy, ey, i / total));
  for (i = 0; i < hold; i++) addSeg(curve, easeInOut(sy, ey, (enter + i) / total));
  for (i = 0; i < leave; i++) addSeg(easeInOut(curve, 0, i / leave), easeInOut(sy, ey, (enter + hold + i) / total));
}
function rnd(a, b) { return a + Math.random() * (b - a); }
function buildTrack() {
  segs = [];
  addRoad(30, 30, 30, 0, 0);
  for (var k = 0; k < 14; k++) {
    var c = [0, 2, -2, 4, -4, 3, -3, 6, -6][Math.floor(Math.random() * 9)];
    var h = [0, 0, 20, -20, 40, -40, 60, -30][Math.floor(Math.random() * 8)];
    var len = Math.floor(rnd(25, 60));
    addRoad(len, len, len, c, h);
  }
  addRoad(40, 40, 40, 0, -lastY() / SEG);
  trackLen = segs.length * SEG;
  for (var n = 20; n < segs.length; n += 4) {
    segs[n].sprites.push({ off: (Math.random() < .5 ? -1 : 1) * rnd(1.25, 2.4), kind: TH.side, s: rnd(.8, 1.3) });
  }
  for (n = 60; n < segs.length; n += Math.floor(rnd(30, 70))) {
    var lane = [-0.6, 0, 0.6][Math.floor(Math.random() * 3)];
    for (var j = 0; j < 6; j++) if (segs[n + j * 3]) segs[n + j * 3].coins.push({ off: lane, taken: false });
  }
}
function findSeg(z) { return segs[Math.floor(z / SEG) % segs.length]; }

// ---------- Stato ----------
var pos = 0, speed = 0, playerX = 0, maxSpeed = SEG * 60 * 1.15, accel = maxSpeed / 4.5, offRoadLimit = maxSpeed / 3.2;
var cars = [], score = 0, coins = 0, nitro = 1, boosting = false, running = false, dead = false, shake = 0, lean = 0, distance = 0;
var keys = { l: false, r: false, n: false };
var particles = [];
function spawnCars() {
  cars = [];
  var count = Math.round(18 * DIFF);
  for (var i = 0; i < count; i++) {
    var z = (Math.floor(Math.random() * (segs.length - 80)) + 80) * SEG;
    var car = { off: [-0.65, 0, 0.65][Math.floor(Math.random() * 3)] + rnd(-.1, .1), z: z, speed: maxSpeed * rnd(.25, .55), color: ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ecf0f1', '#9b59b6', '#e67e22'][i % 7], w: rnd(.9, 1.15) };
    cars.push(car); findSeg(z).cars.push(car);
  }
}

// ---------- Suono del motore (WebAudio, senza file) ----------
var AC = null, osc = null, osc2 = null, gain = null;
function audioStart() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (osc) return;
    gain = AC.createGain(); gain.gain.value = 0.0; gain.connect(AC.destination);
    var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(gain);
    osc = AC.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 60; osc.connect(f); osc.start();
    osc2 = AC.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 30; var g2 = AC.createGain(); g2.gain.value = .35; osc2.connect(g2); g2.connect(f); osc2.start();
  } catch (e) { AC = null; }
}
function beep(freq, dur, type, vol) {
  if (!AC) return;
  try { var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = vol || .15; o.connect(g); g.connect(AC.destination); var t = AC.currentTime; g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur); } catch (e) {}
}
function engine(r) { if (!osc) return; var t = AC.currentTime; osc.frequency.setTargetAtTime(55 + r * 190, t, .05); osc2.frequency.setTargetAtTime(28 + r * 95, t, .05); gain.gain.setTargetAtTime(running ? .05 + r * .05 : 0, t, .1); }

// ---------- Controlli ----------
function bindHold(el, k) {
  var on = function (e) { e.preventDefault(); keys[k] = true; el.classList.add('on'); audioStart(); };
  var off = function (e) { e.preventDefault(); keys[k] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
}
bindHold($('bl'), 'l'); bindHold($('br'), 'r'); bindHold($('bn'), 'n');
addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = true; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = true; if (e.key === ' ' || e.key === 'ArrowUp') { keys.n = true; e.preventDefault(); } if ((e.key === 'Enter' || e.key === ' ') && !running) start(); });
addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false; if (e.key === ' ' || e.key === 'ArrowUp') keys.n = false; });
// Inclinare il telefono (se possibile) aiuta a sterzare.
var tilt = 0;
addEventListener('deviceorientation', function (e) { if (e.gamma != null) tilt = Math.max(-1, Math.min(1, e.gamma / 25)); });
document.addEventListener('visibilitychange', function () { if (document.hidden && gain) gain.gain.value = 0; });

function show(id, on) { $(id).classList.toggle('hidden', !on); }
function start() {
  audioStart(); buildTrack(); spawnCars();
  pos = 0; speed = 0; playerX = 0; score = 0; coins = 0; nitro = 1; dead = false; running = true; particles = []; distance = 0;
  $('score').textContent = 0; $('coins').textContent = 0;
  show('start', false); show('over', false); show('hud', true); show('ctrl', true); show('speedo', true); show('nbar', true);
  beep(660, .12, 'square', .1); setTimeout(function () { beep(990, .18, 'square', .1); }, 120);
}
function crash() {
  dead = true; running = false; shake = 18; beep(90, .5, 'sawtooth', .3); beep(60, .7, 'square', .2);
  $('flash').style.opacity = .7; setTimeout(function () { $('flash').style.opacity = 0; }, 120);
  var nb = score > best;
  if (nb) { best = score; save(KEY, String(best)); $('best').textContent = best; }
  setTimeout(function () {
    $('overT').textContent = nb ? T.newBest : T.over;
    $('oScore').textContent = T.score + ' : ' + score; $('oCoins').textContent = T.coins + ' : ' + coins; $('oBest').textContent = T.best + ' : ' + best;
    show('over', true); show('ctrl', false); show('nbar', false);
  }, 700);
}
$('play').addEventListener('click', start); $('again').addEventListener('click', start);

// ---------- Aggiornamento ----------
function overlap(x1, w1, x2, w2) { var h1 = w1 / 2, h2 = w2 / 2; return !((x1 + h1 < x2 - h2) || (x1 - h1 > x2 + h2)); }
function update(dt) {
  if (!running) { speed = Math.max(0, speed - accel * dt * 2); pos = (pos + speed * dt) % trackLen; return; }
  var seg = findSeg(pos + CAMH * CAMD);
  var ratio = speed / maxSpeed;
  boosting = keys.n && nitro > 0.02;
  var top = maxSpeed * (boosting ? 1.45 : 1) * (0.85 + Math.min(.35, distance / 4e6)) * DIFF;
  speed += (boosting ? accel * 2.2 : accel) * dt;
  if (boosting) { nitro = Math.max(0, nitro - dt * .28); if (Math.random() < .6) particles.push({ x: W / 2 + rnd(-8, 8), y: H - 70, vx: rnd(-40, 40), vy: rnd(60, 160), life: .5, c: CFG.color1 }); }
  else nitro = Math.min(1, nitro + dt * .05);
  var steer = (keys.l ? -1 : 0) + (keys.r ? 1 : 0) + (Math.abs(tilt) > .15 ? tilt : 0);
  steer = Math.max(-1, Math.min(1, steer));
  playerX += steer * dt * 2.4 * (0.4 + ratio * .9);
  playerX -= dt * 2 * ratio * seg.curve * 0.18;  // forza centrifuga in curva
  lean += (steer * 0.45 - lean) * Math.min(1, dt * 8);
  if ((playerX < -1 || playerX > 1) && speed > offRoadLimit) { speed -= accel * 2.6 * dt; shake = Math.max(shake, 3); }
  playerX = Math.max(-2.2, Math.min(2.2, playerX));
  speed = Math.max(0, Math.min(speed, top));
  pos = (pos + speed * dt) % trackLen; distance += speed * dt;
  // Traffico
  for (var i = 0; i < cars.length; i++) {
    var car = cars[i], old = findSeg(car.z);
    car.z = (car.z + car.speed * dt) % trackLen;
    var nw = findSeg(car.z); if (old !== nw) { old.cars.splice(old.cars.indexOf(car), 1); nw.cars.push(car); }
  }
  // Collisioni e monete
  var ps = findSeg(pos + CAMH * CAMD), pw = 0.16;
  for (i = 0; i < ps.cars.length; i++) { var cc = ps.cars[i]; if (speed > cc.speed && overlap(playerX, pw, cc.off, 0.32 * cc.w)) { crash(); return; } }
  for (var k = -1; k <= 1; k++) { var s2 = segs[(ps.i + k + segs.length) % segs.length]; for (i = 0; i < s2.coins.length; i++) { var co = s2.coins[i]; if (!co.taken && overlap(playerX, pw + .1, co.off, .2)) { co.taken = true; coins++; nitro = Math.min(1, nitro + .12); beep(1200 + coins % 5 * 120, .09, 'triangle', .12); $('coins').textContent = coins; } } }
  score = Math.floor(distance / 1000) + coins * 25;
  $('score').textContent = score;
  if (pos < speed * dt * 2) { for (i = 0; i < segs.length; i++) for (var m = 0; m < segs[i].coins.length; m++) segs[i].coins[m].taken = false; }
  engine(speed / (maxSpeed * 1.45));
  for (i = particles.length - 1; i >= 0; i--) { var p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) particles.splice(i, 1); }
  shake = Math.max(0, shake - dt * 30);
  $('nfill').style.width = Math.round(nitro * 100) + '%';
}

// ---------- Disegno ----------
function project(p, camX, camY, camZ) {
  var tx = 0 - camX, ty = p.y - camY, tz = p.z - camZ;
  p.scale = CAMD / tz; p.sx = Math.round(W / 2 + p.scale * tx * W / 2); p.sy = Math.round(H / 2 - p.scale * ty * H / 2); p.sw = Math.round(p.scale * ROADW * W / 2);
}
function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) { cx.fillStyle = c; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.lineTo(x3, y3); cx.lineTo(x4, y4); cx.closePath(); cx.fill(); }
function drawSky() {
  var g = cx.createLinearGradient(0, 0, 0, H * .6); g.addColorStop(0, TH.sky[0]); g.addColorStop(.6, TH.sky[1]); g.addColorStop(1, TH.sky[2]);
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  var off = (pos / trackLen) * W * 2;
  cx.fillStyle = CFG.theme === 'night' ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.25)';
  if (CFG.theme === 'night') for (var s = 0; s < 60; s++) cx.fillRect((s * 97 - off * .05) % W, (s * 53) % (H * .4), 1.5, 1.5);
  // sole/luna
  cx.beginPath(); cx.fillStyle = CFG.theme === 'night' ? '#f5f3ce' : 'rgba(255,240,200,.9)'; cx.arc(W * .78, H * .22, Math.min(W, H) * .07, 0, 6.3); cx.fill();
  // montagne
  for (var layer = 0; layer < 2; layer++) {
    cx.fillStyle = layer ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.2)';
    cx.beginPath(); cx.moveTo(0, H * .52);
    for (var x = 0; x <= W; x += 20) cx.lineTo(x, H * (.42 + layer * .04) - Math.abs(Math.sin((x + off * (.2 + layer * .2)) / (90 + layer * 50))) * H * (.08 + layer * .03));
    cx.lineTo(W, H * .52); cx.closePath(); cx.fill();
  }
}
function drawSprite(kind, x, y, scale, s) {
  var h = scale * 1800 * W / 2 * s, w = h * .5; if (h < 2) return;
  if (kind === 'palm') { cx.fillStyle = '#7a4a24'; cx.fillRect(x - w * .07, y - h, w * .14, h); cx.fillStyle = '#2e8b3a'; for (var a = 0; a < 6; a++) { cx.beginPath(); cx.ellipse(x + Math.cos(a) * w * .35, y - h + Math.sin(a) * h * .05, w * .45, h * .07, a, 0, 6.3); cx.fill(); } }
  else if (kind === 'tree') { cx.fillStyle = '#5a3a1a'; cx.fillRect(x - w * .06, y - h * .35, w * .12, h * .35); cx.fillStyle = '#1e6b2e'; cx.beginPath(); cx.moveTo(x, y - h); cx.lineTo(x + w * .45, y - h * .3); cx.lineTo(x - w * .45, y - h * .3); cx.fill(); cx.fillStyle = '#2a8a3c'; cx.beginPath(); cx.moveTo(x, y - h * 1.05); cx.lineTo(x + w * .32, y - h * .55); cx.lineTo(x - w * .32, y - h * .55); cx.fill(); }
  else if (kind === 'lamp') { cx.fillStyle = '#444'; cx.fillRect(x - w * .03, y - h, w * .06, h); cx.fillStyle = '#00e5ff'; cx.shadowColor = '#00e5ff'; cx.shadowBlur = 20; cx.fillRect(x - w * .2, y - h, w * .4, h * .03); cx.shadowBlur = 0; }
  else { var bw = w * 1.4, bh = h * 1.4; cx.fillStyle = '#2b2f45'; cx.fillRect(x - bw / 2, y - bh, bw, bh); cx.fillStyle = 'rgba(255,214,120,.8)'; for (var r = 0; r < 6; r++) for (var cl = 0; cl < 3; cl++) if ((r * 3 + cl) % 3) cx.fillRect(x - bw / 2 + bw * (.12 + cl * .3), y - bh + bh * (.08 + r * .15), bw * .16, bh * .08); }
}
function drawCar(x, y, scale, car) {
  var w = scale * 520 * W / 2 * car.w, h = w * .62; if (w < 2) return;
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(x, y, w * .55, h * .12, 0, 0, 6.3); cx.fill();
  cx.fillStyle = car.color; roundRect(x - w / 2, y - h, w, h * .78, w * .12); cx.fill();
  cx.fillStyle = 'rgba(20,30,50,.85)'; roundRect(x - w * .38, y - h * .95, w * .76, h * .32, w * .08); cx.fill();
  cx.fillStyle = '#ff3b3b'; cx.fillRect(x - w * .46, y - h * .42, w * .14, h * .1); cx.fillRect(x + w * .32, y - h * .42, w * .14, h * .1);
  cx.fillStyle = '#111'; cx.fillRect(x - w * .48, y - h * .22, w * .18, h * .22); cx.fillRect(x + w * .3, y - h * .22, w * .18, h * .22);
}
function drawCoin(x, y, scale) {
  var r = scale * 140 * W / 2; if (r < 1) return; var t = performance.now() / 200;
  cx.save(); cx.translate(x, y - r * 2.2); cx.scale(Math.abs(Math.cos(t)) * .8 + .2, 1);
  cx.fillStyle = '#f7c948'; cx.beginPath(); cx.arc(0, 0, r, 0, 6.3); cx.fill(); cx.fillStyle = '#ffe58a'; cx.beginPath(); cx.arc(0, 0, r * .6, 0, 6.3); cx.fill(); cx.restore();
}
function roundRect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function drawBike() {
  var bx = W / 2, by = H - Math.max(200, H * .26), s = Math.min(W, H) / 460;
  var bounce = running ? Math.sin(performance.now() / 40) * speed / maxSpeed * 1.2 : 0;
  cx.save(); cx.translate(bx, by + bounce); cx.rotate(lean * .6); cx.scale(s, s);
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, 52, 46, 9, 0, 0, 6.3); cx.fill();
  cx.fillStyle = '#111'; roundRect(-11, 10, 22, 46, 9); cx.fill();
  cx.fillStyle = CFG.color1; roundRect(-26, -18, 52, 40, 14); cx.fill();
  cx.fillStyle = CFG.color2; roundRect(-20, -12, 40, 10, 5); cx.fill();
  cx.fillStyle = '#ff4d4d'; cx.shadowColor = '#ff4d4d'; cx.shadowBlur = boosting ? 30 : 14; roundRect(-14, 18, 28, 7, 3); cx.fill(); cx.shadowBlur = 0;
  cx.fillStyle = '#222'; roundRect(-30, -46, 60, 30, 12); cx.fill();
  cx.fillStyle = CFG.color1; cx.beginPath(); cx.arc(0, -66, 20, 0, 6.3); cx.fill();
  cx.fillStyle = 'rgba(0,0,0,.65)'; cx.beginPath(); cx.arc(0, -64, 13, 3.4, 6.0); cx.fill();
  cx.fillStyle = '#1b1b1b'; roundRect(-44, -38, 18, 10, 4); cx.fill(); roundRect(26, -38, 18, 10, 4); cx.fill();
  if (boosting) { cx.fillStyle = 'rgba(255,170,60,.9)'; cx.beginPath(); cx.moveTo(-7, 56); cx.lineTo(7, 56); cx.lineTo(0, 80 + Math.random() * 25); cx.fill(); }
  cx.restore();
}
function drawSpeedo() {
  var c = $('speedo').getContext('2d'), r = 95, kmh = Math.round(speed / maxSpeed * 220);
  c.clearRect(0, 0, 220, 220); c.lineWidth = 14; c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(110, 110, r - 10, Math.PI * .75, Math.PI * 2.25); c.stroke();
  var g = c.createLinearGradient(0, 0, 220, 0); g.addColorStop(0, CFG.color2); g.addColorStop(1, CFG.color1);
  c.strokeStyle = g; c.beginPath(); c.arc(110, 110, r - 10, Math.PI * .75, Math.PI * (.75 + 1.5 * Math.min(1, kmh / 320))); c.stroke();
  c.fillStyle = '#fff'; c.font = '900 52px system-ui'; c.textAlign = 'center'; c.fillText(kmh, 110, 120); c.font = '700 20px system-ui'; c.globalAlpha = .7; c.fillText('km/h', 110, 150); c.globalAlpha = 1;
}
function render() {
  cx.save();
  if (shake) cx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawSky();
  var base = findSeg(pos), basePct = (pos % SEG) / SEG, playerY = easeInOut(base.p1.y, base.p2.y, basePct);
  var maxy = H, x = 0, dx = -(base.curve * basePct), n, seg, camY = playerY + CAMH;
  for (n = 0; n < DRAW; n++) {
    seg = segs[(base.i + n) % segs.length];
    var loop = seg.i < base.i ? trackLen : 0;
    project(seg.p1, playerX * ROADW - x, camY, pos - loop); project(seg.p2, playerX * ROADW - x - dx, camY, pos - loop);
    x += dx; dx += seg.curve; seg.clip = maxy;
    if (seg.p1.scale <= 0 || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxy) continue;
    var fog = Math.min(1, n / DRAW), p1 = seg.p1, p2 = seg.p2;
    cx.fillStyle = TH.grass[seg.color]; cx.fillRect(0, p2.sy, W, p1.sy - p2.sy);
    var r1 = p1.sw / 6, r2 = p2.sw / 6;
    poly(p1.sx - p1.sw - r1, p1.sy, p1.sx - p1.sw, p1.sy, p2.sx - p2.sw, p2.sy, p2.sx - p2.sw - r2, p2.sy, TH.rumble[seg.color]);
    poly(p1.sx + p1.sw + r1, p1.sy, p1.sx + p1.sw, p1.sy, p2.sx + p2.sw, p2.sy, p2.sx + p2.sw + r2, p2.sy, TH.rumble[seg.color]);
    poly(p1.sx - p1.sw, p1.sy, p1.sx + p1.sw, p1.sy, p2.sx + p2.sw, p2.sy, p2.sx - p2.sw, p2.sy, TH.road[seg.color]);
    if (seg.color) { var l1 = p1.sw / 40, l2 = p2.sw / 40; for (var ln = -1; ln <= 1; ln += 2) { var lx1 = p1.sx + ln * p1.sw / 3, lx2 = p2.sx + ln * p2.sw / 3; poly(lx1 - l1, p1.sy, lx1 + l1, p1.sy, lx2 + l2, p2.sy, lx2 - l2, p2.sy, TH.lane); } }
    if (fog > .55) { cx.globalAlpha = (fog - .55) * 1.6; cx.fillStyle = TH.fog; cx.fillRect(0, p2.sy, W, p1.sy - p2.sy); cx.globalAlpha = 1; }
    maxy = p1.sy;
  }
  for (n = DRAW - 1; n > 0; n--) {
    seg = segs[(base.i + n) % segs.length];
    if (seg.p1.scale <= 0) continue;
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, seg.clip); cx.clip();
    for (var i = 0; i < seg.sprites.length; i++) { var sp = seg.sprites[i]; drawSprite(sp.kind, seg.p1.sx + seg.p1.scale * sp.off * ROADW * W / 2, seg.p1.sy, seg.p1.scale, sp.s); }
    for (i = 0; i < seg.coins.length; i++) if (!seg.coins[i].taken) drawCoin(seg.p1.sx + seg.p1.scale * seg.coins[i].off * ROADW * W / 2, seg.p1.sy, seg.p1.scale);
    for (i = 0; i < seg.cars.length; i++) { var car = seg.cars[i], pct = (car.z % SEG) / SEG, sc = easeIn(seg.p1.scale, seg.p2.scale, pct), cxx = easeIn(seg.p1.sx, seg.p2.sx, pct) + sc * car.off * ROADW * W / 2, cyy = easeIn(seg.p1.sy, seg.p2.sy, pct); drawCar(cxx, cyy, sc, car); }
    cx.restore();
  }
  // linee di velocità
  if (boosting || speed > maxSpeed * .9) { cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.lineWidth = 2; for (var k = 0; k < 14; k++) { var a = Math.random() * 6.28, r0 = Math.min(W, H) * .35, r1 = r0 + rnd(40, 140); cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * r0, H * .55 + Math.sin(a) * r0); cx.lineTo(W / 2 + Math.cos(a) * r1, H * .55 + Math.sin(a) * r1); cx.stroke(); } }
  for (var q = 0; q < particles.length; q++) { var pt = particles[q]; cx.globalAlpha = Math.max(0, pt.life * 2); cx.fillStyle = pt.c; cx.beginPath(); cx.arc(pt.x, pt.y, 4 + (1 - pt.life) * 8, 0, 6.3); cx.fill(); }
  cx.globalAlpha = 1;
  drawBike();
  cx.restore();
  if (running) drawSpeedo();
}

// ---------- Ciclo ----------
var last = performance.now();
function frame(now) {
  var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (!segs.length) { buildTrack(); spawnCars(); speed = maxSpeed * .5; }
  update(dt); render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;

const SAFE = (s, n) => String(s || '').replace(/[<>&"'`$\\]/g, '').slice(0, n);
const COLOR = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);
export function motoGame(o = {}) {
  const cfg = {
    title: SAFE(o.title, 30) || 'Moto Rush',
    subtitle: SAFE(o.subtitle, 90),
    color1: COLOR(o.color1, '#ff6b35'),
    color2: COLOR(o.color2, '#ffd23f'),
    theme: ['city', 'desert', 'night', 'forest', 'coast'].includes(o.theme) ? o.theme : 'city',
    difficulty: ['easy', 'normal', 'hard'].includes(o.difficulty) ? o.difficulty : 'normal',
    lang: ['fr', 'it', 'en', 'ar', 'es'].includes(o.lang) ? o.lang : 'fr',
  };
  return MOTO_TEMPLATE.replace('__CFG__', JSON.stringify(cfg)).replace('__TITLE__', cfg.title).replace('__LANG__', cfg.lang);
}

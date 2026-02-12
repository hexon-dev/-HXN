/* main.js
   Hexon — Phaser 3 Tetris engine (redraft)
   - AdsGram integrated (init + show)
   - Phantom wallet connect
   - Board sized to fit #phaserCanvas
   - Pieces move/rotate reliably (keyboard + window fallback)
   - API placeholders remain (update API_BASE)
*/

'use strict';

/* ---------------------------
   Config & Constants
   --------------------------- */
const API_BASE = 'https://api.yourdomain.com'; // <-- update to your backend
const DAILY_EMISSION_CAP = 1250000;
const GAME_ALLOCATION = 150_000_000;

// logical board size
const GRID_COLS = 14;
const GRID_ROWS = 24;

// base cell size (scaled to container)
const BASE_CELL = 28;
const BASE_GAP = 2;
let CELL = BASE_CELL;
let GAP = BASE_GAP;

const INITIAL_DROP_MS = 800;

// AdsGram
const ADSGRAM_SRC = 'https://sad.adsgram.ai/js/sad.min.js';
const ADSGRAM_BLOCK_ID = 'int-22823'; // provided by you

// ad/energy config
const AUTO_RECHARGE_MINUTES = 30;
const AUTO_RECHARGE_PERCENT = 10;
const MAX_SITTINGS_PER_DAY = 3;
const MAX_ADS_PER_SITTING = 3;
const MAX_ADS_PER_DAY = 9;

/* ---------------------------
   Client state & helpers
   --------------------------- */
let clientState = {
  sessionId: generateUUID(),
  userId: null,
  wallet: null,
  gp: 0,
  energy: 65,
  miners: [],
  userAU: 0,
  totalAU: 0,
  referralCode: null,
  referralsActive: 0,
  adsThisSitting: 0,
  adsToday: 0,
  actionLog: []
};

function generateUUID(){ return 'xxxxxx'.replace(/[x]/g, ()=> (Math.random()*36|0).toString(36)); }
function $(id){ return document.getElementById(id); }
function logAction(a,p={}){ clientState.actionLog.push({t:Date.now(), a, p}); if(clientState.actionLog.length>5000) clientState.actionLog.shift(); }

async function api(path, method='GET', body=null){
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {'Content-Type':'application/json'},
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('api ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('API error', e);
    return null;
  }
}

/* ---------------------------
   Game state
   --------------------------- */
const gameState = {
  grid: null,
  activePiece: null,   // { type, rot, x, y }
  nextPiece: null,
  score: 0,
  level: 1,
  lines: 0,
  dropInterval: INITIAL_DROP_MS,
  dropTimer: 0,
  isPlaying: false,
  combo: 0
};

/* ---------------------------
   Tetromino definitions
   --------------------------- */
const PIECES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]]
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]]
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]]
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]]
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]]
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]]
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]]
  ]
};
const PIECE_TYPES = Object.keys(PIECES);

/* ---------------------------
   AdsGram loader & controller
   --------------------------- */
let AdsGramLoaded = false;
let AdController = null;

function loadAdsGram(){
  if (window.Adsgram && !AdController){
    try { AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID }); AdsGramLoaded = true; console.log('AdsGram existing init used'); return; } catch(e){ console.warn(e); }
  }
  if (AdsGramLoaded) return;
  const s = document.createElement('script');
  s.src = ADSGRAM_SRC;
  s.async = true;
  s.onload = () => {
    try {
      if (window.Adsgram && typeof window.Adsgram.init === 'function'){
        AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
        AdsGramLoaded = true;
        console.log('AdsGram SDK loaded & initialized, blockId:', ADSGRAM_BLOCK_ID);
      } else {
        console.warn('AdsGram SDK loaded but init not found');
      }
    } catch(e){
      console.warn('AdsGram init error', e);
    }
  };
  s.onerror = ()=> { console.warn('Failed to load AdsGram SDK'); };
  document.head.appendChild(s);
}

/* ---------------------------
   Phaser scenes
   --------------------------- */
let phaserGame;

class BootScene extends Phaser.Scene { constructor(){ super({ key:'BootScene' }); } create(){ this.scene.start('GameScene'); } }

class GameScene extends Phaser.Scene {
  constructor(){ super({ key:'GameScene' }); }
  create(){
    // compute board pixel size using CELL/GAP (already computed)
    this.boardPixelWidth = GRID_COLS * (CELL + GAP) + 40;
    this.boardPixelHeight = GRID_ROWS * (CELL + GAP) + 40;
    this.gridOrigin = { x: 16, y: 16 };

    // background and grid lines
    const g = this.add.graphics();
    g.fillStyle(0x061426, 1);
    g.fillRoundedRect(this.gridOrigin.x - 8, this.gridOrigin.y - 8, this.boardPixelWidth, this.boardPixelHeight, 10);
    g.lineStyle(1, 0x0d2130, 0.6);
    for (let r=0; r<=GRID_ROWS; r++){
      g.strokeLineShape(new Phaser.Geom.Line(this.gridOrigin.x, this.gridOrigin.y + r*(CELL + GAP), this.gridOrigin.x + GRID_COLS*(CELL + GAP), this.gridOrigin.y + r*(CELL + GAP)));
    }
    for (let c=0; c<=GRID_COLS; c++){
      g.strokeLineShape(new Phaser.Geom.Line(this.gridOrigin.x + c*(CELL + GAP), this.gridOrigin.y, this.gridOrigin.x + c*(CELL + GAP), this.gridOrigin.y + GRID_ROWS*(CELL + GAP)));
    }

    // init logical grid + persistent cell sprites
    initGrid();
    this.cellSprites = [];
    for (let r=0; r<GRID_ROWS; r++){
      this.cellSprites[r] = [];
      for (let c=0; c<GRID_COLS; c++){
        const x = this.gridOrigin.x + c*(CELL + GAP) + CELL/2;
        const y = this.gridOrigin.y + r*(CELL + GAP) + CELL/2;
        const rect = this.add.rectangle(x, y, CELL, CELL, 0x102033).setStrokeStyle(1, 0x092033, 0.6);
        this.cellSprites[r][c] = rect;
      }
    }

    spawnPiece();
    gameState.isPlaying = true;
    gameState.dropTimer = 0;

    this.setupInput();
    updateUI();

    // auto-recharge
    this.time.addEvent({ delay: AUTO_RECHARGE_MINUTES * 60e3, callback: this.autoRecharge, callbackScope: this, loop: true });
  }

  update(time, delta){
    if (!gameState.isPlaying) return;
    gameState.dropTimer += delta;
    if (gameState.dropTimer >= gameState.dropInterval){
      gameState.dropTimer = 0;
      const moved = movePieceDown();
      logAction('tick_drop', { moved });
      if (!moved) lockPiece();
    }
    this.renderGrid();
  }

  renderGrid(){
    // locked grid
    for (let r=0; r<GRID_ROWS; r++){
      for (let c=0; c<GRID_COLS; c++){
        const val = gameState.grid[r][c];
        this.cellSprites[r][c].fillColor = val ? colorFromVal(val) : 0x102033;
      }
    }
    // overlay active piece
    if (gameState.activePiece){
      const cells = getPieceCells(gameState.activePiece);
      cells.forEach(p=>{
        if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS){
          this.cellSprites[p.y][p.x].fillColor = colorFromVal(gameState.activePiece.type);
        }
      });
    }
  }

  setupInput(){
    // Phaser keyboard handler
    this.input.keyboard.on('keydown', (ev)=>{
      if (!gameState.isPlaying) return;
      handleKey(ev.code);
    });

    // fallback to window keyboard events (avoids focus issues)
    window.addEventListener('keydown', (ev) => {
      if (!gameState.isPlaying) return;
      handleKey(ev.code);
    });

    // touch controls (DOM)
    if (!document.querySelector('.touch-controls')) setupTouchControls(this);
  }

  autoRecharge(){
    clientState.energy = Math.min(100, clientState.energy + AUTO_RECHARGE_PERCENT);
    updateUI();
    logAction('auto_recharge', { energy: clientState.energy });
  }
}

/* ---------------------------
   Key handling (single place)
   --------------------------- */
function handleKey(code){
  switch(code){
    case 'ArrowLeft': movePiece(-1); break;
    case 'ArrowRight': movePiece(1); break;
    case 'ArrowDown': softDrop(); break;
    case 'Space': hardDrop(); break;
    case 'ArrowUp': rotatePiece(); break;
    default: return;
  }
  updateUI();
}

/* ---------------------------
   Piece helper: canonical model & movement
   --------------------------- */
function getPieceCells(piece){
  const states = PIECES[piece.type];
  const state = states[piece.rot % states.length];
  return state.map(p => ({ x: p[0] + piece.x, y: p[1] + piece.y }));
}

function initGrid(){
  gameState.grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
  gameState.score = 0;
  gameState.level = 1;
  gameState.lines = 0;
  gameState.combo = 0;
  gameState.dropInterval = INITIAL_DROP_MS;
}

function spawnPiece(){
  const type = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  const rot = 0;
  const xStart = Math.floor((GRID_COLS - 4) / 2);
  const yStart = -1;
  gameState.activePiece = { type, rot, x: xStart, y: yStart };
  gameState.nextPiece = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  logAction('spawn', { type, x: xStart, y: yStart });

  if (checkCollision( getPieceCells(gameState.activePiece) )){
    gameOver();
  }
}

function checkCollision(cells){
  for (const p of cells){
    if (p.x < 0 || p.x >= GRID_COLS) return true;
    if (p.y >= GRID_ROWS) return true;
    if (p.y >= 0 && gameState.grid[p.y][p.x]) return true;
  }
  return false;
}

function movePiece(dir){
  if (!gameState.activePiece) return;
  const cand = { ...gameState.activePiece, x: gameState.activePiece.x + dir };
  if (!checkCollision( getPieceCells(cand) )){
    gameState.activePiece.x = cand.x;
    logAction('move', { dir });
  }
}

function movePieceDown(){
  if (!gameState.activePiece) return false;
  const cand = { ...gameState.activePiece, y: gameState.activePiece.y + 1 };
  if (!checkCollision( getPieceCells(cand) )){
    gameState.activePiece.y = cand.y;
    return true;
  }
  return false;
}

function softDrop(){ if (movePieceDown()){ gameState.score += 1; clientState.gp += 1; logAction('soft_drop'); updateUI(); } }

function hardDrop(){
  let falls = 0; while(movePieceDown()) falls++;
  lockPiece();
  gameState.score += falls * 2;
  clientState.gp += falls * 2;
  logAction('hard_drop', { falls });
  updateUI();
}

function rotatePiece(){
  if (!gameState.activePiece) return;
  const candidate = { ...gameState.activePiece, rot: (gameState.activePiece.rot + 1) };
  // simple wall-kick attempts
  const kicks = [{dx:0,dy:0},{dx:-1,dy:0},{dx:1,dy:0},{dx:-2,dy:0},{dx:2,dy:0},{dx:0,dy:-1}];
  for (const k of kicks){
    const cand = { ...candidate, x: candidate.x + k.dx, y: candidate.y + k.dy };
    if (!checkCollision( getPieceCells(cand) )){
      gameState.activePiece.rot = cand.rot;
      gameState.activePiece.x = cand.x;
      gameState.activePiece.y = cand.y;
      logAction('rotate', { rot: cand.rot, kick: k });
      return;
    }
  }
  // rotation blocked
}

/* ---------------------------
   Lock / clear / scoring
   --------------------------- */
function lockPiece(){
  const ap = gameState.activePiece;
  if (!ap) return;
  const cells = getPieceCells(ap);
  for (const p of cells){
    if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS){
      gameState.grid[p.y][p.x] = ap.type;
    }
  }

  const cleared = [];
  for (let r=0; r<GRID_ROWS; r++){
    if (gameState.grid[r].every(v => v !== 0)) cleared.push(r);
  }
  if (cleared.length > 0) clearLines(cleared);
  else gameState.combo = 0;

  spawnPiece();
}

function clearLines(rows){
  rows.sort((a,b)=>a-b);
  for (const r of rows){
    gameState.grid.splice(r,1);
    gameState.grid.unshift(Array(GRID_COLS).fill(0));
  }
  const count = rows.length;
  const base = [0,100,300,500,800];
  gameState.score += base[count] * gameState.level;
  gameState.lines += count;
  gameState.combo += 1;
  clientState.gp += (count * 10) + (gameState.combo * 5);
  logAction('clear', { count, combo: gameState.combo });
  if (gameState.lines % 10 === 0){
    gameState.level++;
    gameState.dropInterval = Math.max(120, gameState.dropInterval * 0.92);
  }
  updateUI();
}

async function gameOver(){
  gameState.isPlaying = false;
  logAction('gameover', { score: gameState.score, lines: gameState.lines });
  try {
    await api('/game/submit-score','POST', {
      sessionId: clientState.sessionId,
      userId: clientState.userId,
      score: gameState.score,
      lines: gameState.lines,
      actionLog: clientState.actionLog.slice(-2000)
    });
  } catch(e){ console.warn(e); }
  showModal(`<div style="font-weight:700">Game Over</div>
    <div class="small-muted">Score ${gameState.score} • Lines ${gameState.lines}</div>
    <div style="height:12px"></div><button id="playAgain" class="button">Play Again</button>`, ()=>{
      $('#playAgain').onclick = ()=>{ hideModal(); resetForPlay(); };
  });
  updateUI();
}

function resetForPlay(){
  initGrid();
  gameState.dropInterval = INITIAL_DROP_MS;
  clientState.actionLog = [];
  spawnPiece();
  gameState.isPlaying = true;
  updateUI();
}

/* ---------------------------
   Colors / touch controls / UI stubs
   --------------------------- */
function colorFromVal(val){
  const map = { I:0x22d3ee, J:0x7c3aed, L:0xf59e0b, O:0xfacc15, S:0x10b981, T:0x8b5cf6, Z:0xef4444 };
  return map[val] ?? 0x0f172a;
}

function setupTouchControls(){
  if (document.querySelector('.touch-controls')) return;
  const wrapper = document.createElement('div');
  wrapper.classList.add('touch-controls');
  wrapper.style.display='flex'; wrapper.style.justifyContent='space-around'; wrapper.style.gap='8px'; wrapper.style.marginTop='12px';
  const btnLeft = document.createElement('div'); btnLeft.className='touch-btn'; btnLeft.innerText='◀';
  const btnRight = document.createElement('div'); btnRight.className='touch-btn'; btnRight.innerText='▶';
  const btnRotate = document.createElement('div'); btnRotate.className='touch-btn'; btnRotate.innerText='↻';
  const btnDown = document.createElement('div'); btnDown.className='touch-btn'; btnDown.innerText='↓';
  [btnLeft, btnRotate, btnDown, btnRight].forEach(b=>{ b.style.padding='10px'; b.style.borderRadius='8px'; b.style.background='rgba(255,255,255,0.04)'; });
  wrapper.append(btnLeft, btnRotate, btnDown, btnRight);
  const ui = $('uiPanel');
  if (ui) ui.append(wrapper);
  btnLeft.onclick = ()=>{ movePiece(-1); logAction('touch_left'); updateUI(); };
  btnRight.onclick = ()=>{ movePiece(1); logAction('touch_right'); updateUI(); };
  btnRotate.onclick = ()=>{ rotatePiece(); logAction('touch_rotate'); updateUI(); };
  btnDown.onclick = ()=>{ softDrop(); logAction('touch_drop'); updateUI(); };
}

/* ---------------------------
   Ads integration (AdsGram + fallback)
   --------------------------- */
loadAdsGram();

async function handleWatchAd(){
  // basic client-side limits — server must authoritatively enforce/verify
  if ((clientState.adsToday || 0) >= MAX_SITTINGS_PER_DAY){
    showModal('<div class="small-muted">Daily ad sitting limit reached.</div>'); return;
  }
  if ((clientState.adsThisSitting || 0) >= MAX_ADS_PER_SITTING){
    showModal('<div class="small-muted">Sitting limit reached. Play a bit then return.</div>'); return;
  }

  showModal('<div class="small-muted">Opening sponsored transmission...</div>');

  // Use AdsGram AdController if present
  if (AdsGramLoaded && AdController && typeof AdController.show === 'function'){
    try {
      const result = await AdController.show();
      // result = ShowPromiseResult per docs
      hideModal();
      // Send result to backend for validation & reward issuance (server should check with AdsGram if needed)
      const resp = await api('/ad/verify','POST',{ sessionId: clientState.sessionId, provider:'AdsGram', payload: result });
      if (resp && resp.grantedPercent){
        clientState.energy = Math.min(100, clientState.energy + resp.grantedPercent);
        clientState.adsThisSitting = (clientState.adsThisSitting||0) + 1;
        clientState.adsToday = (clientState.adsToday||0) + 1;
        logAction('ad_watched', { provider:'AdsGram', granted: resp.grantedPercent });
        updateUI();
        showModal(`<div class="small-muted">Energy credited +${resp.grantedPercent}%</div>`, ()=> setTimeout(hideModal,900));
      } else {
        showModal('<div class="small-muted">Ad verification failed</div>', ()=> setTimeout(hideModal,1200));
      }
      return;
    } catch (err){
      // AdController.show() can reject on skip / error
      console.warn('AdController.show() rejected', err);
      hideModal();
      showModal('<div class="small-muted">Ad failed / skipped — no reward</div>', ()=> setTimeout(hideModal,900));
      return;
    }
  }

  // Fallback simulated ad (still ask backend to validate)
  await new Promise(res => setTimeout(res, 2400));
  hideModal();
  const resp = await api('/ad/verify','POST',{ sessionId: clientState.sessionId, provider:'Fallback', adSessionId: generateUUID() });
  if (resp && resp.grantedPercent){
    clientState.energy = Math.min(100, clientState.energy + resp.grantedPercent);
    clientState.adsThisSitting = (clientState.adsThisSitting||0) + 1;
    clientState.adsToday = (clientState.adsToday||0) + 1;
    logAction('ad_watched', { provider:'Fallback', granted: resp.grantedPercent });
    updateUI();
    showModal(`<div class="small-muted">Energy credited +${resp.grantedPercent}%</div>`, ()=> setTimeout(hideModal,900));
  } else {
    showModal('<div class="small-muted">Ad verification failed</div>', ()=> setTimeout(hideModal,1200));
  }
}

/* ---------------------------
   Phantom wallet integration
   --------------------------- */
async function bindWallet(){
  if (window.solana && window.solana.isPhantom){
    try {
      const resp = await window.solana.connect();
      const publicKey = resp.publicKey.toString();
      const res = await api('/wallet/bind','POST',{ sessionId: clientState.sessionId, wallet: publicKey, referral: clientState.referralCode });
      if (res && res.ok){
        clientState.wallet = publicKey;
        clientState.userId = res.userId ?? clientState.userId;
        clientState.gp = res.gp ?? clientState.gp;
        clientState.miners = res.miners ?? clientState.miners;
        clientState.userAU = res.userAU ?? clientState.userAU;
        updateUI(); renderMinersList();
        alert('Wallet bound: ' + publicKey);
      } else {
        alert('Backend bind failed — check console.');
        console.warn('bind response', res);
      }
    } catch(e){
      console.warn('Phantom connect error', e);
      alert('Wallet connect failed or canceled. Make sure Phantom is installed and unlocked.');
    }
  } else {
    if (confirm('Phantom not detected. Open phantom.app to install?')) window.open('https://phantom.app/', '_blank');
  }
}

/* ---------------------------
   UI helpers, miners, leaderboard
   --------------------------- */
function renderMinersList(){
  const container = $('minersList'); if (!container) return;
  container.innerHTML = '';
  if (!clientState.miners || clientState.miners.length === 0) { container.innerHTML = '<div class="small-muted">No miners owned</div>'; return; }
  clientState.miners.forEach(m=>{
    const node = document.createElement('div');
    node.style.display='flex'; node.style.justifyContent='space-between'; node.style.padding='6px 0';
    node.innerHTML = `<div><b>${m.name}</b><div class="small-muted">Hash ${m.au} AU</div></div><div class="small-muted">${m.status||'Active'}</div>`;
    container.appendChild(node);
  });
}

async function refreshLeaderboard(){
  const top = await api('/leaderboard/top','GET');
  const el = $('leaderboard');
  if (!el) return;
  el.innerHTML = '';
  if (!top) { el.innerHTML = '<div class="small-muted">Leaderboard unavailable</div>'; return; }
  top.forEach((t,idx)=>{
    const row = document.createElement('div'); row.className = 'leader-entry';
    row.innerHTML = `<div>${idx+1}. ${escapeHtml(t.name)}</div><div>${t.score.toLocaleString()}</div>`;
    el.appendChild(row);
  });
}

/* ---------------------------
   Modal / UI helpers
   --------------------------- */
function showModal(html, onMounted){ const o=$('overlay'); if(!o) { console.log('Modal:', html); return; } o.classList.add('show'); $('#modalContent').innerHTML = html; if(onMounted) setTimeout(onMounted,60); }
function hideModal(){ const o=$('overlay'); if(!o) return; o.classList.remove('show'); $('#modalContent').innerHTML = ''; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

function updateUI(){
  if ($('ui-score')) $('ui-score').innerText = gameState.score || 0;
  if ($('ui-gp')) $('ui-gp').innerText = (clientState.gp || 0) + ' GP';
  if ($('ui-energyFill')) $('ui-energyFill').style.width = (clientState.energy) + '%';
  if ($('ui-level')) $('ui-level').innerText = gameState.level;
  if ($('ui-lines')) $('ui-lines').innerText = gameState.lines;
  if ($('ui-au')) $('ui-au').innerText = 'AU: ' + (clientState.userAU || 0).toFixed(2);
  if ($('ui-hxn')) {
    const est = clientState.totalAU>0 ? ((clientState.userAU / clientState.totalAU) * DAILY_EMISSION_CAP) : 0;
    $('ui-hxn').innerText = Math.round(est).toLocaleString() + ' HXN';
  }
}

/* ---------------------------
   Boot & sizing: compute scale to fit #phaserCanvas
   --------------------------- */
window.addEventListener('load', async ()=>{

  // wire UI buttons if present
  if ($('watchAdBtn')) $('watchAdBtn').onclick = handleWatchAd;
  if ($('openStore')) $('openStore').onclick = openMinerShop;
  if ($('bindWalletBtn')) $('bindWalletBtn').onclick = bindWallet;
  if ($('showRefBtn')) $('showRefBtn').onclick = ()=> showModal('<div class="small-muted">Invite friends</div>');
  if ($('viewAlloc')) $('viewAlloc').onclick = ()=> showModal('<div class="small-muted">Allocation preview</div>');

  // attempt initial client init (best-effort)
  try {
    const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.referralCode });
    if (init){
      clientState.userId = init.userId ?? clientState.userId;
      clientState.gp = init.gp ?? clientState.gp;
      clientState.miners = init.miners ?? clientState.miners;
      clientState.userAU = init.userAU ?? clientState.userAU;
      clientState.totalAU = init.totalAU ?? clientState.totalAU;
      clientState.referralsActive = init.referralsActive ?? clientState.referralsActive;
    }
  } catch(e){ console.warn(e); }

  // compute scaling to fit #phaserCanvas
  const parentEl = document.getElementById('phaserCanvas') || document.body;
  const rect = parentEl.getBoundingClientRect();
  const availW = Math.max(320, rect.width || Math.min(window.innerWidth * 0.65, 900));
  const availH = Math.max(320, rect.height || Math.min(window.innerHeight * 0.9, 1200));

  const desiredW = GRID_COLS * (BASE_CELL + BASE_GAP) + 40;
  const desiredH = GRID_ROWS * (BASE_CELL + BASE_GAP) + 40;
  const scale = Math.min(1, Math.min(availW / desiredW, availH / desiredH));

  CELL = Math.max(10, Math.floor(BASE_CELL * scale));
  GAP = Math.max(1, Math.floor(BASE_GAP * scale));

  const canvasWidth = GRID_COLS * (CELL + GAP) + 40;
  const canvasHeight = GRID_ROWS * (CELL + GAP) + 40;

  // ensure parent element size doesn't clip (so board sits above panel)
  if (parentEl && parentEl.style){
    parentEl.style.width = canvasWidth + 'px';
    parentEl.style.height = canvasHeight + 'px';
    parentEl.style.minWidth = '320px';
  }

  // create Phaser
  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentEl,
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: '#061426',
    scene: [ BootScene, GameScene ]
  });

  // load AdsGram (attempt)
  loadAdsGram();

  // initial UI sync and periodic refresh
  updateUI();
  renderMinersList();
  refreshLeaderboard();
  setInterval(()=>{ refreshLeaderboard(); updateUI(); }, 15000);

  console.log('Hexon booted — board', GRID_COLS+'x'+GRID_ROWS, 'CELL', CELL, 'GAP', GAP, 'canvas', canvasWidth+'x'+canvasHeight);
});

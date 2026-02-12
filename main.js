/* main.js
   Fixed & production-ready Phaser 3 Tetris engine for Hexon
   - Replace API_BASE with your backend
   - Replace ad verification / wallet binding with your providers
   - Ensure HTTPS hosting
*/

'use strict';

/* ---------------------------
   Config & Constants
   --------------------------- */
const API_BASE = 'https://api.yourdomain.com'; // <-- update to your backend
const DAILY_EMISSION_CAP = 1250000; // HXN per day for pre-launch (configurable)
const GAME_ALLOCATION = 150_000_000; // total allocated to game (informational)
const GRID_COLS = 10, GRID_ROWS = 20;
const CELL_SIZE = 28;
const AUTO_RECHARGE_MINUTES = 30;
const AUTO_RECHARGE_PERCENT = 10;
const MAX_SITTINGS_PER_DAY = 3;
const MAX_ADS_PER_SITTING = 3;
const MAX_ADS_PER_DAY = 9; // safety

/* ---------------------------
   Local State (client-side)
   --------------------------- */
let clientState = {
  sessionId: generateUUID(),
  userId: null,
  wallet: null,
  gp: 0,
  energy: 65,
  sittedAdsRemaining: MAX_SITTINGS_PER_DAY,
  adsThisSitting: 0,
  adsToday: 0,
  miners: [],
  userAU: 0,
  totalAU: 0,
  referralCode: null,
  referralsActive: 0,
  referralBonusPercent: 0,
  actionLog: [],
  dailyAuCap: null,
};

/* ---------------------------
   Utility helpers
   --------------------------- */
function generateUUID() {
  return 'xxxxxx'.replace(/[x]/g, () => (Math.random()*36|0).toString(36));
}
function $(id){ return document.getElementById(id); }
function qs(sel, ctx = document){ return ctx.querySelector(sel); }

/* ---------------------------
   Referral handling (URL param)
   --------------------------- */
(function initReferral(){
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || localStorage.getItem('hexon_referral');
  if (params.get('ref')) localStorage.setItem('hexon_referral', params.get('ref'));
  clientState.referralCode = ref;
})();

/* ---------------------------
   UI helpers
   --------------------------- */
function updateUI(){
  if ($('ui-score')) $('ui-score').innerText = gameState.score || 0;
  if ($('ui-gp')) $('ui-gp').innerText = (clientState.gp || 0) + ' GP';
  if ($('ui-energyFill')) $('ui-energyFill').style.width = (clientState.energy) + '%';
  if ($('ui-level')) $('ui-level').innerText = gameState.level;
  if ($('ui-lines')) $('ui-lines').innerText = gameState.lines;
  if ($('ui-au')) $('ui-au').innerText = 'AU: ' + (clientState.userAU || 0).toFixed(2);
  const est = clientState.totalAU>0 ? ((clientState.userAU / clientState.totalAU) * DAILY_EMISSION_CAP) : 0;
  if ($('ui-hxn')) $('ui-hxn').innerText = Math.round(est).toLocaleString() + ' HXN';
  if ($('ui-sittings')) $('ui-sittings').innerText = `${MAX_SITTINGS_PER_DAY - (clientState.adsToday||0)} / ${MAX_SITTINGS_PER_DAY}`;
}

/* ---------------------------
   Backend API helpers
   --------------------------- */
async function api(path, method='GET', body=null){
  const headers = { 'Content-Type': 'application/json' };
  try {
    const res = await fetch(API_BASE + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error('API ' + path + ' failed ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('API error', e);
    return null;
  }
}

/* ---------------------------
   Action log (anti-cheat)
   --------------------------- */
function logAction(action, payload = {}){
  clientState.actionLog.push({
    t: Date.now(),
    a: action,
    p: payload,
  });
  if (clientState.actionLog.length > 5000) clientState.actionLog.shift();
}

/* ---------------------------
   Game core state
   --------------------------- */
const gameState = {
  grid: null,
  activePiece: null,
  nextPiece: null,
  score: 0,
  level: 1,
  lines: 0,
  dropInterval: 1000,
  dropTimer: 0,
  isPlaying: false,
  combo: 0,
};

/* ---------------------------
   Tetromino definitions
   --------------------------- */
const PIECES = {
  I: [ [[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]] ],
  J: [ [[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]] ],
  L: [ [[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]] ],
  O: [ [[1,0],[2,0],[1,1],[2,1]] ],
  S: [ [[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]] ],
  T: [ [[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]] ],
  Z: [ [[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]] ],
};
const PIECE_TYPES = Object.keys(PIECES);

/* ---------------------------
   Phaser Game - Scenes
   --------------------------- */
let phaserGame;

/* BootScene */
class BootScene extends Phaser.Scene {
  constructor(){ super({ key: 'BootScene' }); }
  preload(){
    // no external assets necessary
  }
  create(){
    this.scene.start('GameScene');
  }
}

/* GameScene */
class GameScene extends Phaser.Scene {
  constructor(){ super({ key: 'GameScene' }); }
  create(){
    console.log('GameScene.create()');
    this.cameras.main.setBackgroundColor('#071027');
    this.drawGridBackground();
    initGrid();

    // create persistent cell sprites (fast updates)
    this.cellSprites = [];
    for (let r=0; r<GRID_ROWS; r++){
      this.cellSprites[r] = [];
      for (let c=0; c<GRID_COLS; c++){
        const x = this.gridOrigin.x + c*(CELL_SIZE+2) + CELL_SIZE/2;
        const y = this.gridOrigin.y + r*(CELL_SIZE+2) + CELL_SIZE/2;
        const rect = this.add.rectangle(x, y, CELL_SIZE-2, CELL_SIZE-2, 0x102033).setStrokeStyle(1, 0x092033, 0.6);
        this.cellSprites[r][c] = rect;
      }
    }

    spawnPiece();
    gameState.isPlaying = true;
    gameState.dropTimer = 0;
    this.setupInput();
    updateUI();

    // Auto-recharge interval (server should be authoritative)
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

  drawGridBackground(){
    const startX = 20, startY = 20;
    const g = this.add.graphics();
    g.clear();
    g.fillStyle(0x061426, 1);
    g.fillRoundedRect(startX-8, startY-8, GRID_COLS * (CELL_SIZE+2) + 16, GRID_ROWS * (CELL_SIZE+2) + 16, 8);
    g.lineStyle(1, 0x0d2130, 0.6);
    for (let r=0; r<=GRID_ROWS; r++){
      g.strokeLineShape(new Phaser.Geom.Line(startX, startY + r*(CELL_SIZE+2), startX + GRID_COLS*(CELL_SIZE+2), startY + r*(CELL_SIZE+2)));
    }
    for (let c=0; c<=GRID_COLS; c++){
      g.strokeLineShape(new Phaser.Geom.Line(startX + c*(CELL_SIZE+2), startY, startX + c*(CELL_SIZE+2), startY + GRID_ROWS*(CELL_SIZE+2)));
    }
    this.gridOrigin = { x: startX, y: startY };
  }

  renderGrid(){
    // Update locked grid colors first
    for (let r=0; r<GRID_ROWS; r++){
      for (let c=0; c<GRID_COLS; c++){
        const val = gameState.grid[r][c];
        const color = val ? colorFromVal(val) : 0x102033;
        // direct set fillColor is fast in Phaser 3 (rectangle is a GameObject with fillColor)
        this.cellSprites[r][c].fillColor = color;
      }
    }
    // Overlay active piece color (this visually shows the falling piece)
    if (gameState.activePiece){
      gameState.activePiece.cells.forEach(pos=>{
        if (pos.y >= 0 && pos.y < GRID_ROWS && pos.x >= 0 && pos.x < GRID_COLS){
          this.cellSprites[pos.y][pos.x].fillColor = colorFromVal(gameState.activePiece.type);
        }
      });
    }
  }

  setupInput(){
    this.input.keyboard.on('keydown', (ev) => {
      if (!gameState.isPlaying) return;
      switch(ev.code){
        case 'ArrowLeft': movePiece(-1); break;
        case 'ArrowRight': movePiece(1); break;
        case 'ArrowDown': softDrop(); break;
        case 'Space': hardDrop(); break;
        case 'ArrowUp': rotatePiece(); break;
      }
      updateUI();
    });
    setupTouchControls(this);
  }

  autoRecharge(){
    clientState.energy = Math.min(100, clientState.energy + AUTO_RECHARGE_PERCENT);
    updateUI();
    logAction('auto_recharge', { energy: clientState.energy });
  }
}

/* ---------------------------
   Game logic: Grid + pieces
   --------------------------- */
function initGrid(){
  gameState.grid = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(0));
  gameState.score = 0; gameState.level = 1; gameState.lines = 0; gameState.combo = 0;
}

/* spawn new piece */
function spawnPiece(){
  const type = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  const rotIndex = 0;
  const shape = PIECES[type][rotIndex];
  const xOffset = 3;
  const cells = shape.map(p => ({x: p[0] + xOffset, y: p[1] - 1})); // allow some negative y for spawn buffer
  gameState.activePiece = { type, rot: rotIndex, rotationStates: PIECES[type], cells };
  gameState.nextPiece = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  logAction('spawn', { type });
  if (checkCollision(gameState.activePiece.cells)) {
    // immediate collision -> game over
    gameOver();
  }
}

/* check collision */
function checkCollision(cells){
  for (const pos of cells){
    if (pos.x < 0 || pos.x >= GRID_COLS || pos.y >= GRID_ROWS) return true;
    if (pos.y >= 0 && gameState.grid[pos.y][pos.x]) return true;
  }
  return false;
}

/* horizontal move */
function movePiece(dir){
  if (!gameState.activePiece) return;
  const moved = gameState.activePiece.cells.map(p => ({x:p.x+dir, y:p.y}));
  if (!checkCollision(moved)){ gameState.activePiece.cells = moved; logAction('move', {dir}); }
}

/* move down one */
function movePieceDown(){
  if (!gameState.activePiece) return false;
  const moved = gameState.activePiece.cells.map(p => ({x:p.x, y:p.y+1}));
  if (!checkCollision(moved)){ gameState.activePiece.cells = moved; return true; }
  return false;
}

/* soft drop */
function softDrop(){ if (movePieceDown()) { gameState.score += 1; clientState.gp += 1; logAction('soft_drop'); updateUI(); } }

/* hard drop */
function hardDrop(){
  let falls = 0;
  while(movePieceDown()){ falls++; }
  lockPiece();
  gameState.score += falls * 2;
  clientState.gp += falls * 2;
  logAction('hard_drop', {falls});
  updateUI();
}

/* rotate piece */
function rotatePiece(){
  const ap = gameState.activePiece;
  if (!ap) return;
  const nextRot = (ap.rot + 1) % ap.rotationStates.length;
  const shape = ap.rotationStates[nextRot];
  // compute proposed cells anchored to piece's first cell as origin (approx)
  const origin = ap.cells[0];
  const rel = shape.map(p => ({ x: p[0] - shape[0][0] + origin.x, y: p[1] - shape[0][1] + origin.y }));
  if (!checkCollision(rel)) { ap.cells = rel; ap.rot = nextRot; logAction('rotate', {rot:nextRot}); }
}

/* lock piece into grid */
function lockPiece(){
  const ap = gameState.activePiece;
  if (!ap) return;
  for (const p of ap.cells){
    if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS){
      gameState.grid[p.y][p.x] = ap.type;
    }
  }
  // check lines
  const cleared = [];
  for (let r=0; r<GRID_ROWS; r++){
    if (gameState.grid[r].every(v => v !== 0)){
      cleared.push(r);
    }
  }
  if (cleared.length > 0){
    clearLines(cleared);
  } else {
    gameState.combo = 0;
  }
  spawnPiece();
}

/* clear rows and shift */
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
  logAction('clear', {count, combo:gameState.combo});
  if (gameState.lines % 10 === 0) {
    gameState.level++;
    gameState.dropInterval = Math.max(150, gameState.dropInterval * 0.9);
  }
  updateUI();
}

/* game over */
async function gameOver(){
  gameState.isPlaying = false;
  const payload = {
    sessionId: clientState.sessionId,
    userId: clientState.userId,
    score: gameState.score,
    lines: gameState.lines,
    gpEarned: clientState.gp,
    actionLog: clientState.actionLog.slice(-2000)
  };
  logAction('gameover', {score: gameState.score, lines: gameState.lines});
  try {
    const res = await api('/game/submit-score','POST',payload);
    if (res && res.ok) {
      clientState.userAU = res.userAU ?? clientState.userAU;
      clientState.miners = res.miners ?? clientState.miners;
      clientState.gp = res.gp ?? clientState.gp;
    }
  } catch (e) { console.warn(e); }
  showModal(`<div style="font-weight:700;font-size:18px">Game Over</div><div class="small-muted">Score ${gameState.score} • Lines ${gameState.lines}</div><div style="height:12px"></div><button id="playAgain" class="button">Play Again</button>`, ()=> {
    $('#playAgain').onclick = () => {
      hideModal();
      resetForPlay();
    };
  });
  updateUI();
}

function resetForPlay(){
  initGrid();
  gameState.dropInterval = 1000;
  clientState.actionLog = [];
  spawnPiece();
  gameState.isPlaying = true;
  updateUI();
}

function colorFromVal(val){
  const map = { I:0x22d3ee, J:0x7c3aed, L:0xf59e0b, O:0xfacc15, S:0x10b981, T:0x8b5cf6, Z:0xef4444 };
  return map[val] ?? 0x0f172a;
}

/* ---------------------------
   Touch controls
   --------------------------- */
function setupTouchControls(scene){
  const wrapper = document.createElement('div');
  wrapper.classList.add('touch-controls');
  const btnLeft = document.createElement('div'); btnLeft.className='touch-btn'; btnLeft.innerText='◀';
  const btnRight = document.createElement('div'); btnRight.className='touch-btn'; btnRight.innerText='▶';
  const btnRotate = document.createElement('div'); btnRotate.className='touch-btn'; btnRotate.innerText='↻';
  const btnDrop = document.createElement('div'); btnDrop.className='touch-btn'; btnDrop.innerText='↓';
  wrapper.append(btnLeft, btnRotate, btnDrop, btnRight);
  document.getElementById('uiPanel').append(wrapper);
  btnLeft.onclick = () => { movePiece(-1); logAction('touch_left'); updateUI(); };
  btnRight.onclick = () => { movePiece(1); logAction('touch_right'); updateUI(); };
  btnRotate.onclick = () => { rotatePiece(); logAction('touch_rotate'); updateUI(); };
  btnDrop.onclick = () => { softDrop(); logAction('touch_drop'); updateUI(); };
}

/* ---------------------------
   Ads + 3x3 sitting logic
   --------------------------- */
async function handleWatchAd(){
  if (clientState.adsToday >= MAX_SITTINGS_PER_DAY) {
    showModal('<div class="small-muted">Daily ad sitting limit reached.</div>');
    return;
  }
  if (clientState.adsThisSitting >= MAX_ADS_PER_SITTING){
    showModal('<div class="small-muted">You have watched max ads this sitting. Come back after playing or wait for auto recharge.</div>');
    return;
  }
  showModal('<div class="small-muted">Playing Transmission... (simulated)</div>');
  await new Promise(res => setTimeout(res, 2400));
  const resp = await api('/ad/verify','POST',{ sessionId: clientState.sessionId, adProvider: 'AdsGram', adSessionId: generateUUID() });
  hideModal();
  if (resp && resp.grantedPercent){
    clientState.energy = Math.min(100, clientState.energy + resp.grantedPercent);
    clientState.adsThisSitting++;
    clientState.adsToday++;
    logAction('ad_watched', {provider:'AdsGram', granted: resp.grantedPercent});
    updateUI();
    if (clientState.adsThisSitting >= MAX_ADS_PER_SITTING){
      showModal(`<div class="small-muted">Sitting complete. Energy credited.</div>`, ()=>{ setTimeout(hideModal, 900); });
    }
  } else {
    showModal('<div class="small-muted">Ad verification failed. Please try again later.</div>');
  }
}

/* ---------------------------
   Miner shop & rendering
   --------------------------- */
async function openMinerShop(){
  const shop = await api('/miners/shop','GET');
  const shopHtml = ['<div style="font-weight:700">Miner Shop</div>','<div style="height:8px"></div>'];
  if (!shop) { showModal('<div class="small-muted">Shop unavailable</div>'); return; }
  shop.forEach(m => {
    shopHtml.push(`<div style="display:flex;justify-content:space-between;margin:8px 0;"><div><b>${m.name}</b><div class="small-muted">${m.desc}</div></div><div><div class="small-muted">${m.au} AU</div><div style="height:6px"></div><button class="button buyMiner" data-id="${m.id}" data-cost="${m.cost}">Buy ${m.cost} GP</button></div></div>`);
  });
  showModal(shopHtml.join(''), ()=>{
    document.querySelectorAll('.buyMiner').forEach(btn => {
      btn.onclick = async (ev)=>{
        const id = ev.target.dataset.id;
        const cost = parseInt(ev.target.dataset.cost, 10);
        if (clientState.gp < cost) { alert('Not enough GP'); return; }
        const res = await api('/miners/buy','POST',{ sessionId: clientState.sessionId, minerId: id });
        if (res && res.ok){
          clientState.gp = res.gp;
          clientState.miners = res.miners;
          clientState.userAU = res.userAU;
          updateUI();
          hideModal();
        } else {
          alert('Purchase failed');
        }
      };
    });
  });
}

function renderMinersList(){
  const container = $('minersList');
  if (!container) return;
  container.innerHTML = '';
  if (!clientState.miners || clientState.miners.length === 0) {
    container.innerHTML = '<div class="small-muted">No miners owned</div>'; return;
  }
  clientState.miners.forEach(m => {
    const node = document.createElement('div');
    node.style.display = 'flex'; node.style.justifyContent = 'space-between'; node.style.padding = '6px 0';
    node.innerHTML = `<div><b>${m.name}</b><div class="small-muted">Hash ${m.au} AU</div></div><div class="small-muted">${m.status||'Active'}</div>`;
    container.appendChild(node);
  });
}

/* ---------------------------
   Leaderboard fetching
   --------------------------- */
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
   Referral share
   --------------------------- */
function showReferralShare(){
  (async ()=>{
    if (!clientState.userReferralCode){
      const res = await api('/referral/create','POST',{ sessionId: clientState.sessionId });
      if (res && res.code) clientState.userReferralCode = res.code;
    }
    const invite = window.location.origin + window.location.pathname + '?ref=' + (clientState.userReferralCode || 'demo');
    showModal(`<div style="font-weight:700">Invite a Friend</div><div class="small-muted">Share this link. When they activate and meet activity thresholds you'll get hashrate bonus.</div><div style="height:8px"></div><input id="inviteInput" style="width:100%;padding:8px;border-radius:6px;background:#061e2b;color:#9fe7ff;border:1px solid rgba(126,231,255,0.06)" value="${invite}" readonly /></div><div style="height:8px"></div><button id="copyLink" class="button">Copy Link</button>`, ()=>{
      $('#copyLink').onclick = () => { document.getElementById('inviteInput').select(); document.execCommand('copy'); alert('Copied'); };
    });
  })();
}

/* ---------------------------
   Wallet binding (placeholder)
   --------------------------- */
async function bindWallet(){
  const fakeWallet = 'FAKE_SOL_WALLET_' + (Math.random()*1e6|0);
  const res = await api('/wallet/bind','POST',{ sessionId: clientState.sessionId, wallet: fakeWallet, referral: clientState.referralCode });
  if (res && res.ok){
    clientState.wallet = fakeWallet;
    clientState.userId = res.userId;
    clientState.gp = res.gp || clientState.gp;
    clientState.miners = res.miners || clientState.miners;
    clientState.userAU = res.userAU || clientState.userAU;
    updateUI();
    renderMinersList();
    alert('Wallet bound: ' + fakeWallet);
  } else {
    alert('Wallet binding failed');
  }
}

/* ---------------------------
   Modal helpers
   --------------------------- */
function showModal(html, onMounted){
  const o = $('overlay'); if (!o) return;
  o.classList.add('show'); $('#modalContent').innerHTML = html;
  if (onMounted) setTimeout(onMounted, 80);
}
function hideModal(){ const o = $('overlay'); if (!o) return; o.classList.remove('show'); $('#modalContent').innerHTML = ''; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

/* ---------------------------
   Init & boot
   --------------------------- */
window.addEventListener('load', async () => {
  // wire up UI
  if ($('watchAdBtn')) $('watchAdBtn').onclick = handleWatchAd;
  if ($('openStore')) $('openStore').onclick = openMinerShop;
  if ($('bindWalletBtn')) $('bindWalletBtn').onclick = bindWallet;
  if ($('showRefBtn')) $('showRefBtn').onclick = showReferralShare;
  if ($('viewAlloc')) $('viewAlloc').onclick = () => { showModal(`<div><b>Allocation Preview</b><div class="small-muted">Your final HXN allocation is calculated at TGE based on AU snapshot.</div></div>`); };

  // initial client init (non-blocking but useful)
  const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.referralCode });
  if (init){
    clientState.userId = init.userId ?? clientState.userId;
    clientState.gp = init.gp ?? clientState.gp;
    clientState.miners = init.miners ?? [];
    clientState.userAU = init.userAU ?? clientState.userAU;
    clientState.totalAU = init.totalAU ?? clientState.totalAU;
    clientState.referralsActive = init.referralsActive ?? clientState.referralsActive;
  }

  // Phaser config - use AUTO renderer for best compatibility
  const parentEl = document.getElementById('phaserCanvas') || document.body;
  const width = Math.min(window.innerWidth*0.65, 540);
  const height = Math.min(window.innerHeight*0.92, 780);
  const config = {
    type: Phaser.AUTO,
    parent: parentEl,
    width,
    height,
    backgroundColor: '#061426',
    scene: [BootScene, GameScene]
  };

  phaserGame = new Phaser.Game(config);

  // initial UI sync
  renderMinersList();
  refreshLeaderboard();
  updateUI();

  // periodic refreshes
  setInterval(async ()=>{ await refreshLeaderboard(); updateUI(); }, 15_000);
});

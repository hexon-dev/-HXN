/* main.js
   Hexon — Phaser 3 Tetris engine
   - Grid widened and height fixed above dashboard via canvas sizing
   - Pieces move, drop, rotate correctly (with basic wall-kicks)
   - Persistent cell sprites for performance
   - Keep your API_BASE updated for backend hooks
*/

'use strict';

/* ---------------------------
   Config & Constants
   --------------------------- */
// update API endpoint as needed
const API_BASE = 'https://api.yourdomain.com';

// Grid size (wider as requested)
const GRID_COLS = 14;
const GRID_ROWS = 24;

// cell size and spacing
const CELL_SIZE = 28;
const CELL_GAP = 2;

// Gameplay timing
const INITIAL_DROP_MS = 800;

// Ads/energy/miner related constants (kept for compatibility)
const AUTO_RECHARGE_MINUTES = 30;
const AUTO_RECHARGE_PERCENT = 10;
const MAX_SITTINGS_PER_DAY = 3;
const MAX_ADS_PER_SITTING = 3;
const MAX_ADS_PER_DAY = 9;

/* ---------------------------
   Client state & utilities
   --------------------------- */
let clientState = {
  sessionId: generateUUID(),
  userId: null,
  gp: 0,
  energy: 65,
  miners: [],
  userAU: 0,
  totalAU: 0,
  referralCode: null,
  referralsActive: 0,
  actionLog: []
};

function generateUUID(){ return 'xxxxxx'.replace(/[x]/g, ()=> (Math.random()*36|0).toString(36)); }
function $(id){ return document.getElementById(id); }
function logAction(a,p={}){ clientState.actionLog.push({t:Date.now(), a, p}); if (clientState.actionLog.length>5000) clientState.actionLog.shift(); }

// Minimal API helper (same as before — adjust API_BASE)
async function api(path, method='GET', body=null){
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('api:' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('api error', e);
    return null;
  }
}

/* ---------------------------
   Game state
   --------------------------- */
const gameState = {
  grid: null,         // 2D array of 0 or piece types
  activePiece: null,  // { type, rot, x, y }
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
   Tetromino definitions (rotation states)
   --------------------------- */
const PIECES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
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
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]]
  ]
};
const PIECE_TYPES = Object.keys(PIECES);

/* ---------------------------
   Phaser boot & game scene
   --------------------------- */

let phaserGame;

class BootScene extends Phaser.Scene {
  constructor(){ super({ key: 'BootScene' }); }
  create(){ this.scene.start('GameScene'); }
}

class GameScene extends Phaser.Scene {
  constructor(){ super({ key: 'GameScene' }); }
  create(){
    console.log('GameScene.create()');

    // compute grid pixel dims and place board at top-left of canvas
    // boardWidth = GRID_COLS * (CELL_SIZE + CELL_GAP) + some margin
    this.boardPixelWidth = GRID_COLS * (CELL_SIZE + CELL_GAP) + 32;
    this.boardPixelHeight = GRID_ROWS * (CELL_SIZE + CELL_GAP) + 32;

    // origin inside canvas
    this.gridOrigin = { x: 16, y: 16 };

    // background panel for board
    const g = this.add.graphics();
    g.fillStyle(0x061426, 1);
    g.fillRoundedRect(this.gridOrigin.x - 8, this.gridOrigin.y - 8, this.boardPixelWidth, this.boardPixelHeight, 10);
    g.lineStyle(1, 0x0d2130, 0.6);
    // optional grid lines
    for (let r=0; r<=GRID_ROWS; r++){
      g.strokeLineShape(new Phaser.Geom.Line(this.gridOrigin.x, this.gridOrigin.y + r*(CELL_SIZE + CELL_GAP), this.gridOrigin.x + GRID_COLS*(CELL_SIZE+CELL_GAP), this.gridOrigin.y + r*(CELL_SIZE + CELL_GAP)));
    }
    for (let c=0; c<=GRID_COLS; c++){
      g.strokeLineShape(new Phaser.Geom.Line(this.gridOrigin.x + c*(CELL_SIZE + CELL_GAP), this.gridOrigin.y, this.gridOrigin.x + c*(CELL_SIZE + CELL_GAP), this.gridOrigin.y + GRID_ROWS*(CELL_SIZE+CELL_GAP)));
    }

    // initialize logical grid and UI
    initGrid();

    // persistent cell sprites
    this.cellSprites = [];
    for (let r=0; r<GRID_ROWS; r++){
      this.cellSprites[r] = [];
      for (let c=0; c<GRID_COLS; c++){
        const x = this.gridOrigin.x + c*(CELL_SIZE + CELL_GAP) + CELL_SIZE/2;
        const y = this.gridOrigin.y + r*(CELL_SIZE + CELL_GAP) + CELL_SIZE/2;
        const rect = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x102033).setStrokeStyle(1, 0x092033, 0.6);
        this.cellSprites[r][c] = rect;
      }
    }

    // spawn first piece
    spawnPiece();

    gameState.isPlaying = true;
    gameState.dropTimer = 0;

    // input
    this.setupInput();

    // update UI initial
    updateUI();

    // auto-recharge placeholder timer (server should be authoritative)
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
    // paint locked cells first
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

    // add touch buttons if not already present
    if (!document.querySelector('.touch-controls')) setupTouchControls(this);
  }

  autoRecharge(){
    clientState.energy = Math.min(100, clientState.energy + AUTO_RECHARGE_PERCENT);
    updateUI();
    logAction('auto_recharge', { energy: clientState.energy });
  }
}

/* ---------------------------
   Piece helpers: compute absolute cells
   --------------------------- */
function getPieceCells(piece){
  // piece: { type, rot, x, y }
  const states = PIECES[piece.type];
  const state = states[piece.rot % states.length];
  return state.map(p => ({ x: p[0] + piece.x, y: p[1] + piece.y }));
}

/* ---------------------------
   Game logic: grid, move, rotate, lock, clear
   --------------------------- */
function initGrid(){
  gameState.grid = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(0));
  gameState.score = 0;
  gameState.level = 1;
  gameState.lines = 0;
  gameState.combo = 0;
}

function spawnPiece(){
  const type = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  const rot = 0;
  // center piece horizontally (reserve up to 4 columns)
  const xStart = Math.floor((GRID_COLS - 4) / 2);
  const yStart = -1; // start slightly above so I-piece can come in
  gameState.activePiece = { type, rot, x: xStart, y: yStart };
  gameState.nextPiece = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  logAction('spawn', {type, x:xStart, y:yStart});

  // if spawn collides immediately -> game over
  if (checkCollision(getPieceCells(gameState.activePiece))){
    gameOver();
  }
}

function checkCollision(cells){
  for (const p of cells){
    if (p.x < 0 || p.x >= GRID_COLS || p.y >= GRID_ROWS) return true;
    if (p.y >= 0 && gameState.grid[p.y][p.x]) return true;
  }
  return false;
}

function movePiece(dir){
  if (!gameState.activePiece) return;
  const cand = { ...gameState.activePiece, x: gameState.activePiece.x + dir };
  if (!checkCollision(getPieceCells(cand))){
    gameState.activePiece.x += dir;
    logAction('move', {dir});
  }
}

function movePieceDown(){
  if (!gameState.activePiece) return false;
  const cand = { ...gameState.activePiece, y: gameState.activePiece.y + 1 };
  if (!checkCollision(getPieceCells(cand))){
    gameState.activePiece.y += 1;
    return true;
  }
  return false;
}

function softDrop(){
  if (movePieceDown()){
    gameState.score += 1;
    clientState.gp += 1;
    logAction('soft_drop');
    updateUI();
  }
}

function hardDrop(){
  let falls = 0;
  while(movePieceDown()) falls++;
  lockPiece();
  gameState.score += falls * 2;
  clientState.gp += falls * 2;
  logAction('hard_drop', {falls});
  updateUI();
}

function rotatePiece(){
  if (!gameState.activePiece) return;
  const candidate = { ...gameState.activePiece, rot: (gameState.activePiece.rot + 1) };
  // basic wall-kick tests: center, left, right, left2, right2, up
  const kicks = [{dx:0,dy:0},{dx:-1,dy:0},{dx:1,dy:0},{dx:-2,dy:0},{dx:2,dy:0},{dx:0,dy:-1}];
  for (const k of kicks){
    const cand = { ...candidate, x: candidate.x + k.dx, y: candidate.y + k.dy };
    if (!checkCollision(getPieceCells(cand))){
      gameState.activePiece.rot = cand.rot;
      gameState.activePiece.x = cand.x;
      gameState.activePiece.y = cand.y;
      logAction('rotate', {rot: gameState.activePiece.rot, kick:k});
      return;
    }
  }
  // blocked — do nothing
}

function lockPiece(){
  const ap = gameState.activePiece;
  if (!ap) return;
  const cells = getPieceCells(ap);
  for (const p of cells){
    if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS){
      gameState.grid[p.y][p.x] = ap.type;
    }
  }
  // check for clears
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
  logAction('clear', {count, combo: gameState.combo});
  if (gameState.lines % 10 === 0){
    gameState.level++;
    gameState.dropInterval = Math.max(120, gameState.dropInterval * 0.92);
  }
  updateUI();
}

async function gameOver(){
  gameState.isPlaying = false;
  logAction('gameover', {score: gameState.score, lines: gameState.lines});
  // submit to backend (best-effort)
  try { await api('/game/submit-score','POST',{ sessionId: clientState.sessionId, userId: clientState.userId, score: gameState.score, lines: gameState.lines, actionLog: clientState.actionLog.slice(-2000) }); }
  catch(e) { console.warn(e); }
  showModal(`<div style="font-weight:700">Game Over</div><div class="small-muted">Score ${gameState.score} • Lines ${gameState.lines}</div><div style="height:12px"></div><button id="playAgain" class="button">Play Again</button>`, ()=>{
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
   Color mapping
   --------------------------- */
function colorFromVal(val){
  const map = { I:0x22d3ee, J:0x7c3aed, L:0xf59e0b, O:0xfacc15, S:0x10b981, T:0x8b5cf6, Z:0xef4444 };
  return map[val] ?? 0x0f172a;
}

/* ---------------------------
   Touch controls (DOM) - add once
   --------------------------- */
function setupTouchControls(scene){
  if (document.querySelector('.touch-controls')) return; // already added
  const wrapper = document.createElement('div');
  wrapper.classList.add('touch-controls');
  wrapper.style.position = 'relative';
  wrapper.style.marginTop = '10px';
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'space-around';
  wrapper.style.gap = '8px';
  const btnLeft = document.createElement('div'); btnLeft.className='touch-btn'; btnLeft.innerText='◀';
  const btnRight = document.createElement('div'); btnRight.className='touch-btn'; btnRight.innerText='▶';
  const btnRotate = document.createElement('div'); btnRotate.className='touch-btn'; btnRotate.innerText='↻';
  const btnDrop = document.createElement('div'); btnDrop.className='touch-btn'; btnDrop.innerText='↓';
  [btnLeft, btnRotate, btnDrop, btnRight].forEach(b=>{ b.style.padding='10px'; b.style.borderRadius='8px'; b.style.background='rgba(255,255,255,0.04)'; });
  wrapper.append(btnLeft, btnRotate, btnDrop, btnRight);
  const ui = $('uiPanel');
  if (ui) ui.append(wrapper);
  btnLeft.onclick = ()=>{ movePiece(-1); logAction('touch_left'); updateUI(); };
  btnRight.onclick = ()=>{ movePiece(1); logAction('touch_right'); updateUI(); };
  btnRotate.onclick = ()=>{ rotatePiece(); logAction('touch_rotate'); updateUI(); };
  btnDrop.onclick = ()=>{ softDrop(); logAction('touch_drop'); updateUI(); };
}

/* ---------------------------
   Minimal stubs for UI functions referenced earlier
   (If you have full implementations already, they will be used instead)
   --------------------------- */
async function handleWatchAd(){ console.log('watch ad (stub)'); showModal('<div class="small-muted">Ad simulated - energy +50%</div>'); clientState.energy = Math.min(100, clientState.energy + 50); updateUI(); }
async function openMinerShop(){ showModal('<div class="small-muted">Miner shop (stub)</div>'); }
async function bindWallet(){ showModal('<div class="small-muted">Bind wallet (stub)</div>'); }
function renderMinersList(){ /* noop if no miners UI present */ }
async function refreshLeaderboard(){ /* noop stub */ }
function showReferralShare(){ prompt('Share this link', window.location.href + '?ref=yourcode'); }

/* ---------------------------
   Modal helpers (existing HTML expected)
   --------------------------- */
function showModal(html, onMounted){
  const overlay = $('overlay'); if (!overlay) return;
  overlay.classList.add('show');
  const modal = $('#modalContent');
  if (modal) modal.innerHTML = html;
  if (onMounted) setTimeout(onMounted, 50);
}
function hideModal(){ const overlay = $('overlay'); if (!overlay) return; overlay.classList.remove('show'); const modal = $('#modalContent'); if (modal) modal.innerHTML = ''; }

/* ---------------------------
   Init & Phaser boot
   --------------------------- */
window.addEventListener('load', async () => {
  // wire UI buttons if present
  if ($('watchAdBtn')) $('watchAdBtn').onclick = handleWatchAd;
  if ($('openStore')) $('openStore').onclick = openMinerShop;
  if ($('bindWalletBtn')) $('bindWalletBtn').onclick = bindWallet;
  if ($('showRefBtn')) $('showRefBtn').onclick = showReferralShare;
  if ($('viewAlloc')) $('viewAlloc').onclick = ()=> showModal('<div class="small-muted">Allocation preview</div>');

  // try optional client init (non-blocking)
  try {
    const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.referralCode });
    if (init){
      clientState.userId = init.userId ?? clientState.userId;
      clientState.gp = init.gp ?? clientState.gp;
      clientState.miners = init.miners ?? clientState.miners;
      clientState.userAU = init.userAU ?? clientState.userAU;
      clientState.totalAU = init.totalAU ?? clientState.totalAU;
    }
  } catch(e){ console.warn(e); }

  // compute canvas size exactly to board so board fits above dashboard
  const canvasWidth = GRID_COLS * (CELL_SIZE + CELL_GAP) + 40;
  const canvasHeight = GRID_ROWS * (CELL_SIZE + CELL_GAP) + 40;

  const parentEl = document.getElementById('phaserCanvas') || document.body;

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentEl,
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: '#061426',
    scene: [ BootScene, GameScene ]
  });

  // initial UI sync & periodic refresh
  updateUI();
  renderMinersList();
  refreshLeaderboard();
  setInterval(()=>{ refreshLeaderboard(); updateUI(); }, 15000);

  console.log('Phaser boot requested: canvas', canvasWidth, canvasHeight);
});

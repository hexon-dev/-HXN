/* main.js (redraft)
   Hexon — Phaser 3 Tetris engine (FastAPI server-compatible)
   Wallet flow hardened: injected-first, robust deep-link handling for iOS,
   fallback prompts and manual public-key bind.
*/

'use strict';

/* ---------------------------
   Config & Constants
   --------------------------- */
const API_BASE = 'https://unfelt-conner-similarly.ngrok-free.dev'; // <-- preserve as requested
const DAILY_EMISSION_CAP = 1250000;
const GAME_ALLOCATION = 150_000_000;

const GRID_COLS = 14;
const GRID_ROWS = 24;

const BASE_CELL = 28;
const BASE_GAP = 2;
let CELL = BASE_CELL;
let GAP = BASE_GAP;

const INITIAL_DROP_MS = 800;

const ADSGRAM_SRC = 'https://sad.adsgram.ai/js/sad.min.js';
const ADSGRAM_BLOCK_ID = 'int-22823';

const AUTO_RECHARGE_MINUTES = 30;
const AUTO_RECHARGE_PERCENT = 10;
const MAX_SITTINGS_PER_DAY = 3;
const MAX_ADS_PER_SITTING = 3;
const MAX_ADS_PER_DAY = 9; // authoritative on server

/* ---------------------------
   Client state & helpers
   --------------------------- */
function loadSessionFromStorage(){
  try { return localStorage.getItem('hexon_session') || null; } catch(e){ return null; }
}
function saveSessionToStorage(sid){
  try { if(sid) localStorage.setItem('hexon_session', sid); } catch(e){}
}
function loadBoundWalletFromStorage(){
  try { return localStorage.getItem('hexon_bound_wallet') || null; } catch(e){ return null; }
}
function saveBoundWalletToStorage(pk, provider){
  try {
    if (pk) localStorage.setItem('hexon_bound_wallet', pk);
    if (provider) localStorage.setItem('hexon_bound_provider', provider);
  } catch(e){}
}
function clearBoundWalletFromStorage(){
  try { localStorage.removeItem('hexon_bound_wallet'); localStorage.removeItem('hexon_bound_provider'); } catch(e){}
}

let clientState = {
  sessionId: loadSessionFromStorage() || generateUUID(),
  userId: null,
  username: null,
  wallet: loadBoundWalletFromStorage(),
  walletProvider: localStorage.getItem('hexon_bound_provider') || null,
  gp: 0,
  energy: 65,
  miners: [],
  shopItems: [],
  userAU: 0,
  totalAU: 0,
  referralCode: null,
  pendingReferral: null,
  referralsActive: 0,
  adsThisSitting: 0,
  adsToday: 0,
  actionLog: []
};

saveSessionToStorage(clientState.sessionId);

function generateUUID(){
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0; const v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  } catch(e){
    return 'sess-' + Math.floor(Math.random()*1e9).toString(36);
  }
}

function $(id){ return document.getElementById(id); }
function logAction(a,p={}){ clientState.actionLog.push({t:Date.now(), a, p}); if(clientState.actionLog.length>5000) clientState.actionLog.shift(); }

/* ---------------------------
   API helper (auto-attach sessionId to GETs)
*/
async function api(path, method='GET', body=null, optsExtra={}){
  try {
    let url = API_BASE + path;
    if (method.toUpperCase() === 'GET') {
      const sid = clientState.sessionId ? encodeURIComponent(clientState.sessionId) : '';
      if (sid && !url.includes('sessionId=')){
        url += (url.includes('?') ? '&' : '?') + 'sessionId=' + sid;
      }
    }

    const headers = Object.assign({ 'Content-Type': 'application/json' }, optsExtra.headers || {});
    if (clientState.sessionId) headers['X-Session-Id'] = clientState.sessionId;

    const fetchOpts = { method, headers, ...optsExtra };
    if (body !== null && body !== undefined){
      fetchOpts.body = (typeof body === 'string') ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOpts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (err) { json = text || null; }

    if (!res.ok) {
      console.warn('API non-ok', res.status, path, json);
      return json;
    }
    return json;
  } catch (e) {
    console.warn('API error', e);
    return null;
  }
}

/* ---------------------------
   Referral helpers (unchanged)
*/
function getRefFromURL(){
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || params.get('refCode') || null;
  } catch(e){ return null; }
}
function savePendingReferral(code){
  if (!code) return;
  try {
    localStorage.setItem('hexon_pending_ref', code);
    clientState.pendingReferral = code;
    console.log('Saved pending referral', code);
  } catch(e){ console.warn('savePendingReferral', e); }
}
function loadPendingReferral(){
  try {
    const code = localStorage.getItem('hexon_pending_ref');
    clientState.pendingReferral = code || null;
    return clientState.pendingReferral;
  } catch(e){ return null; }
}
function clearPendingReferral(){
  try { localStorage.removeItem('hexon_pending_ref'); clientState.pendingReferral = null; } catch(e){}
}

/* ---------------------------
   Telegram WebApp integration (unchanged)
*/
let tg = null;
function initTelegram(){
  try {
    if (window.Telegram && window.Telegram.WebApp){
      tg = window.Telegram.WebApp;
      try { if (typeof tg.ready === 'function') tg.ready(); } catch(e){ console.warn('tg.ready() failed', e); }
      const u = (tg.initDataUnsafe && tg.initDataUnsafe.user) || (tg.initData && tg.initData.user) || null;
      if (u){
        clientState.userId = clientState.userId || u.id;
        clientState.username = clientState.username || (u.username || `${u.first_name || ''} ${u.last_name || ''}`.trim() || null);
      }
      console.log('Telegram WebApp detected', { username: clientState.username });
    } else {
      console.log('Telegram WebApp not present');
    }
  } catch (e) { console.warn('initTelegram error', e); }
}
function vibratePreferTelegram(pattern=20){
  try {
    if (tg){
      if (typeof tg.triggerHapticFeedback === 'function'){ try { tg.triggerHapticFeedback('selection_change'); return; } catch(e){} }
      if (tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function'){ try { tg.HapticFeedback.impactOccurred(); return; } catch(e){} }
      if (typeof tg.triggerEvent === 'function'){ try { tg.triggerEvent('web_app_trigger_haptic_feedback', { type: 'selection_change' }); return; } catch(e){} }
    }
  } catch(e){ console.warn('Telegram haptic call failed', e); }
  if (navigator && typeof navigator.vibrate === 'function'){ try { navigator.vibrate(pattern); } catch(e){} }
}
function closeTelegramApp(){
  try {
    if (tg && typeof tg.close === 'function'){ tg.close(); return true; }
  } catch(e){ console.warn('tg.close() failed', e); }
  try { window.close(); } catch(e){}
  return false;
}

/* ---------------------------
   AdsGram loader + wrapper (unchanged)
*/
let AdsGramLoaded = false;
let AdController = null;
function loadAdsGram(){
  try {
    if (window.Adsgram && !AdController){
      try { AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID }); AdsGramLoaded = true; return; } catch(e){ console.warn('adsgram init existing', e); }
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
          console.log('AdsGram loaded');
        }
      } catch(e){ console.warn('AdsGram init error', e); }
    };
    s.onerror = ()=> { console.warn('Failed to load AdsGram SDK'); };
    document.head.appendChild(s);
  } catch(e){ console.warn('loadAdsGram', e); }
}

async function showAdAndVerify(){
  if ((clientState.adsToday || 0) >= MAX_ADS_PER_DAY) { showModal('<div class="small-muted">Daily ad limit reached.</div>'); return; }
  if ((clientState.adsThisSitting || 0) >= MAX_ADS_PER_SITTING) { showModal('<div class="small-muted">Sitting limit reached. Play a bit then return.</div>'); return; }

  showModal('<div class="small-muted">Opening sponsored transmission...</div>');
  try {
    let provider = 'Fallback';
    let payload = { adSessionId: generateUUID() };

    if (AdsGramLoaded && AdController && typeof AdController.show === 'function'){
      provider = 'AdsGram';
      try {
        const result = await AdController.show();
        payload = { result };
      } catch(err){
        console.warn('AdController.show error', err);
        hideModal();
        showModal('<div class="small-muted">Ad failed / skipped — no reward</div>', ()=> setTimeout(hideModal,900));
        return;
      }
    } else {
      await new Promise(res => setTimeout(res, 2400));
    }

    const resp = await api('/ad/verify','POST',{ sessionId: clientState.sessionId, provider, payload });
    hideModal();
    if (resp && resp.grantedPercent){
      clientState.energy = Math.min(100, clientState.energy + resp.grantedPercent);
      clientState.adsThisSitting = (clientState.adsThisSitting||0) + 1;
      clientState.adsToday = (clientState.adsToday||0) + 1;
      logAction('ad_watched', { provider, granted: resp.grantedPercent });
      updateUI();
      showModal(`<div class="small-muted">Energy credited +${resp.grantedPercent}%</div>`, ()=> setTimeout(hideModal,900));
    } else {
      const msg = (resp && resp.error) ? resp.error : 'Ad verification failed';
      showModal(`<div class="small-muted">${escapeHtml(msg)}</div>`, ()=> setTimeout(hideModal,1200));
    }
  } catch(e){
    hideModal();
    console.warn('showAdAndVerify error', e);
    showModal('<div class="small-muted">Ad error — try later</div>', ()=> setTimeout(hideModal,1200));
  }
}

/* ---------------------------
   Miner shop (unchanged)
*/
async function fetchShopItems(){
  try {
    const items = await api('/shop/items','GET');
    if (Array.isArray(items)) {
      clientState.shopItems = items.map(i => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        desc: i.description || i.desc || '',
        priceGP: (i.price_gp != null ? i.price_gp : (i.priceGP != null ? i.priceGP : 0)),
        au: (i.au != null ? i.au : 0)
      }));
    } else {
      clientState.shopItems = [];
    }
    return clientState.shopItems;
  } catch(e){ console.warn('fetchShopItems', e); clientState.shopItems = []; return []; }
}

function openMinerShop(){
  (async ()=>{
    showModal('<div class="small-muted">Loading shop...</div>');
    const items = await fetchShopItems();
    if (!items || items.length === 0){
      showModal('<div class="small-muted">Shop unavailable</div>', ()=> setTimeout(hideModal,900));
      return;
    }
    const html = ['<div style="text-align:left"><h3>Miner Shop</h3><div class="small-muted">Buy miners to increase AU</div><div style="height:8px"></div>'];
    items.forEach(it=>{
      html.push(`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px dashed rgba(255,255,255,0.03)">
        <div><b>${escapeHtml(it.name)}</b><div class="small-muted">${escapeHtml(it.desc || '')}</div></div>
        <div style="text-align:right">
          <div style="font-weight:700">${(it.priceGP||0)} GP</div>
          <button class="button" data-item="${escapeHtml(String(it.id))}" style="margin-top:6px">Buy</button>
        </div>
      </div>`);
    });
    html.push('<div style="height:8px"></div><button id="closeShop" class="btn-ghost">Close</button></div>');
    showModal(html.join(''), ()=>{
      document.querySelectorAll('[data-item]').forEach(btn=>{
        btn.onclick = async (ev)=>{
          const id = btn.getAttribute('data-item');
          await purchaseMiner(id);
        };
      });
      const close = $('#closeShop');
      if (close) close.onclick = hideModal;
    });
  })();
}

async function purchaseMiner(itemId){
  showModal('<div class="small-muted">Purchasing...</div>');
  try {
    const resp = await api('/shop/buy','POST', { sessionId: clientState.sessionId, itemId });
    hideModal();
    if (resp && resp.ok){
      if (resp.miners) clientState.miners = resp.miners;
      else {
        const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.pendingReferral || null });
        if (init && init.miners) clientState.miners = init.miners;
      }
      renderMinersList();
      showModal('<div class="small-muted">Purchase successful</div>', ()=> setTimeout(hideModal,900));
      logAction('buy_miner', { itemId });
    } else {
      const err = (resp && resp.error) ? resp.error : 'Purchase failed — check funds or try later';
      console.warn('purchase failed', resp);
      showModal(`<div class="small-muted">${escapeHtml(String(err))}</div>`, ()=> setTimeout(hideModal,1200));
    }
  } catch(e){
    hideModal();
    console.warn('purchaseMiner error', e);
    showModal('<div class="small-muted">Network error — try later</div>', ()=> setTimeout(hideModal,1200));
  }
}

/* ---------------------------
   Utility: environment checks
*/
function isIOS(){
  return /iP(ad|hone|od)/i.test(navigator.userAgent);
}
function isAndroid(){
  return /Android/i.test(navigator.userAgent);
}
function isInAppBrowser(){
  // crude detection for in-app webviews where deep links/universal links may not work
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line|KAKAOTALK|Twitter|LinkedIn|Snapchat/i.test(ua);
}

/* ---------------------------
   Modal utilities (robust) - kept & used heavily by wallet flows
*/
function ensureModalOverlay(){
  let o = $('modalOverlay');
  if (!o){
    o = document.createElement('div');
    o.id = 'modalOverlay';
    o.className = 'modal-overlay';
    Object.assign(o.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: String(2147483650),
      background: 'rgba(0,0,0,0.45)'
    });
    const inner = document.createElement('div');
    inner.id = 'modalContent';
    inner.className = 'modal';
    inner.setAttribute('role','dialog');
    inner.setAttribute('aria-modal','true');
    inner.style.maxWidth = '720px';
    inner.style.width = '92%';
    inner.style.padding = '12px';
    inner.style.borderRadius = '12px';
    inner.style.background = 'linear-gradient(180deg,#071423,#03101a)';
    o.appendChild(inner);
    document.body.appendChild(o);
  }
  return o;
}

function showModal(html, onMounted){
  try {
    const o = ensureModalOverlay();
    o.style.display = 'flex';
    o.classList.add('show');
    o.setAttribute('aria-hidden','false');
    const content = $('#modalContent');
    if (!content){
      console.warn('Modal content missing');
      return;
    }
    content.innerHTML = html;
    setTimeout(()=> {
      if (typeof onMounted === 'function') {
        try { onMounted(); } catch(e){ console.warn('onMounted failed', e); }
      }
    }, 50);
    o.onclick = (ev) => {
      if (ev.target === o){
        hideModal();
      }
    };
    try { content.setAttribute('tabindex', '-1'); content.focus(); } catch(e){}
  } catch(e){
    console.warn('showModal error', e);
  }
}

function hideModal(){
  try {
    const o = ensureModalOverlay();
    o.classList.remove('show');
    o.style.display = 'none';
    o.setAttribute('aria-hidden','true');
    const content = $('#modalContent');
    if (content) content.innerHTML = '';
    try { const b = document.activeElement; if (b) b.blur(); } catch(e){}
  } catch(e){ console.warn('hideModal error', e); }
}

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

/* ---------------------------
   Wallet utilities (unified deep-link opener + detection)
   - openAppOrPrompt tries to open a universal link / deep link and detects success,
     otherwise shows a modal offering explicit "Open app" or "Install" choices.
*/
function openAppOrPrompt({ deepLink, installUrl, appName, fallbackPage }) {
  // returns Promise<boolean> - true if app likely opened, false if not (and modal was shown)
  return new Promise(resolve => {
    let handled = false;
    let timeoutId = null;

    function cleanup() {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
    }

    function onVisibility() {
      if (document.hidden) { handled = true; cleanup(); resolve(true); }
    }
    function onPageHide() { handled = true; cleanup(); resolve(true); }
    function onBlur() { handled = true; cleanup(); resolve(true); }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);

    // Try using location assign first (works best for universal links)
    try {
      window.location.assign(deepLink);
    } catch (e) {
      try { window.open(deepLink, '_self'); } catch (e2) { console.warn('open deep link failed', e2); }
    }

    // If the app doesn't take over quickly, assume it didn't open.
    // Use a short timeout so we don't sit too long.
    timeoutId = setTimeout(() => {
      cleanup();
      if (handled) { resolve(true); return; }
      // show modal with explicit actions: try open again / install / manual instructions
      showModal(`<div style="text-align:left">
          <h3>Open ${escapeHtml(appName)}</h3>
          <div class="small-muted">We couldn't open ${escapeHtml(appName)} automatically. Choose an action below.</div>
          <div style="height:12px"></div>
          <div style="display:flex;gap:8px;">
            <button id="openAppNow" class="button">Try open ${escapeHtml(appName)}</button>
            <button id="installApp" class="btn-ghost">Install / Get ${escapeHtml(appName)}</button>
          </div>
          <div style="height:8px"></div>
          <div class="small-muted">If your wallet supports WalletConnect, use WalletConnect from the wallet app and paste the resulting public key.</div>
        </div>`, ()=>{
          const b = $('#openAppNow'); if (b) b.onclick = ()=> {
            hideModal();
            try { window.location.assign(deepLink); } catch(e){ window.open(deepLink, '_blank'); }
            setTimeout(()=> resolve(false), 600);
          };
          const i = $('#installApp'); if (i) i.onclick = ()=> {
            hideModal();
            try { window.open(installUrl || fallbackPage || deepLink, '_blank'); } catch(e){ try { window.location.assign(installUrl || fallbackPage || deepLink); } catch(e2){} }
            setTimeout(()=> resolve(false), 600);
          };
        });
    }, 1200);
  });
}

/* ---------------------------
   Detect injected providers (unchanged but used more defensively)
*/
function detectInjectedProviders(){
  const providers = {
    phantom: Boolean(window.solana && window.solana.isPhantom),
    solflare: Boolean(window.solflare || (window.solana && window.solana.isSolflare)),
    backpack: Boolean(window.backpack || (window.solana && window.solana.isBackpack)),
  };
  return providers;
}

/* ---------------------------
   Modal-based wallet picker (refined)
*/
function showWalletPicker(){
  const detected = detectInjectedProviders();
  const html = [
    '<div style="text-align:left">',
      '<h3>Connect Wallet</h3>',
      `<div class="small-muted">Choose a wallet — Phantom, Solflare, Backpack, WalletConnect, or paste your public key. ${detected.phantom ? '(Phantom detected)' : ''}</div>`,
      '<div style="height:12px"></div>',
      '<div style="display:flex;flex-direction:column;gap:10px;">',
        `<button class="button wallet-btn" data-w="phantom">Phantom ${detected.phantom ? '• detected' : ''}</button>`,
        `<button class="button wallet-btn" data-w="solflare">Solflare ${detected.solflare ? '• detected' : ''}</button>`,
        `<button class="button wallet-btn" data-w="backpack">Backpack ${detected.backpack ? '• detected' : ''}</button>`,
        `<button class="button wallet-btn" data-w="walletconnect">WalletConnect</button>`,
        `<button class="btn-ghost wallet-btn" data-w="other">Other (Coinbase, Trust...)</button>`,
        `<div style="margin-top:6px"><input id="manualPublicKey" placeholder="Paste public key here" style="width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.06)" /><div style="height:6px"></div><button id="manualBindBtn" class="button">Bind Public Key</button></div>`,
      '</div>',
      '<div style="height:10px"></div><div style="text-align:right"><button id="closeWalletPicker" class="btn-ghost">Close</button></div>',
    '</div>'
  ].join('');

  showModal(html, ()=> {
    const buttons = document.querySelectorAll('.wallet-btn');
    buttons.forEach(btn => {
      btn.onclick = async (ev) => {
        const w = btn.getAttribute('data-w');
        try {
          if (w === 'phantom') {
            await attemptConnectPreferred('phantom');
            return;
          } else if (w === 'solflare') {
            await attemptConnectPreferred('solflare');
            return;
          } else if (w === 'backpack') {
            await attemptConnectPreferred('backpack');
            return;
          } else if (w === 'walletconnect') {
            showWalletConnectInstructions('Attempting WalletConnect — follow your wallet app to complete. If your app returns a public key, paste it using the "Bind Public Key" input.');
            return;
          } else if (w === 'other') {
            showOtherWalletOptions();
            return;
          } else {
            showModal('<div class="small-muted">Unknown wallet option</div>', ()=> setTimeout(hideModal,900));
            return;
          }
        } catch(err){
          console.warn('wallet-btn handler error', err);
          showModal('<div class="small-muted">Wallet action failed</div>', ()=> setTimeout(hideModal,900));
        }
      };
    });

    const manual = $('#manualBindBtn');
    if (manual) manual.onclick = async ()=> {
      const pkBox = $('#manualPublicKey');
      if (!pkBox) return;
      const pk = pkBox.value && pkBox.value.trim();
      if (!pk || pk.length < 20) { showModal('<div class="small-muted">Invalid public key</div>', ()=> setTimeout(hideModal,900)); return; }
      showModal('<div class="small-muted">Binding public key...</div>');
      const ok = await finalizeBind(pk, 'manual');
      if (ok) hideModal();
    };

    const close = $('#closeWalletPicker'); if (close) close.onclick = hideModal;
  });
}

/* ---------------------------
   Other wallet helper dialogs (unchanged)
*/
function showOtherWalletOptions(){
  const html = `<div style="text-align:left">
    <h3>Other wallets</h3>
    <div class="small-muted">Use WalletConnect-compatible wallets (Coinbase Wallet, Trust Wallet, Exodus, etc.) or open their apps and connect via deep link. We recommend WalletConnect for the best mobile UX.</div>
    <div style="height:10px"></div>
    <button id="openWalletConnectFromOther" class="button">Use WalletConnect</button>
    <div style="height:8px"></div>
    <button id="openInstallWallet" class="btn-ghost">Install a wallet app</button>
    <div style="height:8px"></div>
    <div style="height:8px"></div><button id="closeOther" class="btn-ghost">Close</button>
  </div>`;
  showModal(html, ()=>{
    const a = $('#openWalletConnectFromOther'); if (a) a.onclick = ()=> { connectWithWalletConnect(); hideModal(); };
    const i = $('#openInstallWallet'); if (i) i.onclick = ()=> { try { window.open('https://www.trustwallet.com/', '_blank'); } catch(e){ console.warn(e); } };
    const c = $('#closeOther'); if (c) c.onclick = hideModal;
  });
}

/* ---------------------------
   Generic helper to finalize bind (global entrypoint used by index.html's manual bind)
*/
async function finalizeBind(publicKey, providerName){
  if (!publicKey) {
    showModal('<div class="small-muted">No public key provided</div>', ()=> setTimeout(hideModal,900));
    return false;
  }
  clientState.walletProvider = providerName || clientState.walletProvider || null;
  const ok = await bindWalletWithPublicKey(publicKey);
  if (ok){
    clientState.wallet = publicKey;
    clientState.walletProvider = providerName;
    saveBoundWalletToStorage(publicKey, providerName);
    updateUI();
    showModal(`<div class="small-muted">Wallet connected (${escapeHtml(providerName || 'unknown')})</div>`, ()=> setTimeout(hideModal,900));
    return true;
  } else {
    showModal(`<div class="small-muted">Server bind failed for ${escapeHtml(providerName || 'wallet')}</div><div style="height:8px"></div><button id="openWalletRetry" class="button">Try again</button>`, ()=>{
      const b = $('#openWalletRetry'); if (b) b.onclick = ()=> { hideModal(); showWalletPicker(); };
    });
    return false;
  }
}

/* ---------------------------
   Attempt preferred connection (injected-first, then deep-link + prompt)
*/
async function attemptConnectPreferred(providerKey){
  // providerKey: 'phantom'|'solflare'|'backpack'
  hideModal();
  const detected = detectInjectedProviders();

  // If injected provider present, prefer it (user gesture required)
  if ((providerKey === 'phantom' && detected.phantom) ||
      (providerKey === 'solflare' && detected.solflare) ||
      (providerKey === 'backpack' && detected.backpack)) {
    showModal(`<div class="small-muted">Connecting to ${escapeHtml(providerKey)}...</div>`);
    try {
      if (providerKey === 'phantom' && window.solana && window.solana.isPhantom){
        const resp = await window.solana.connect();
        const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || resp;
        const ok = await finalizeBind(publicKey, 'phantom');
        hideModal();
        if (!ok){
          showModal('<div class="small-muted">Injected Phantom connect succeeded but server bind failed</div>', ()=> setTimeout(hideModal,1200));
        }
        return;
      }
      if (providerKey === 'solflare' && (window.solflare || (window.solana && window.solana.isSolflare))){
        const connector = window.solflare || window.solana;
        const resp = await connector.connect();
        const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || resp;
        const ok = await finalizeBind(publicKey, 'solflare');
        hideModal();
        if (!ok) showModal('<div class="small-muted">Injected Solflare connect succeeded but server bind failed</div>', ()=> setTimeout(hideModal,1200));
        return;
      }
      if (providerKey === 'backpack' && (window.backpack || (window.solana && window.solana.isBackpack))){
        const connector = window.backpack || window.solana;
        const resp = await connector.connect();
        const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || resp;
        const ok = await finalizeBind(publicKey, 'backpack');
        hideModal();
        if (!ok) showModal('<div class="small-muted">Injected Backpack connect succeeded but server bind failed</div>', ()=> setTimeout(hideModal,1200));
        return;
      }
    } catch (err){
      console.warn('Injected provider connect failed', err);
      // fallthrough to deep-link attempt
      hideModal();
    }
  }

  // If we reach here, either no injected provider or injected connect failed -> deep-link or universal link
  if (providerKey === 'phantom') {
    await openPhantomDeepLink();
  } else if (providerKey === 'solflare') {
    await openSolflareDeepLink();
  } else if (providerKey === 'backpack') {
    await openBackpackDeepLink();
  } else {
    showModal('<div class="small-muted">Wallet not available</div>', ()=> setTimeout(hideModal,900));
  }
}

/* ---------------------------
   Phantom connector (injected + deep-link fallback, iOS-aware)
*/
function openPhantomDeepLink(){
  try {
    const origin = window.location.origin.replace(/\/+$/, '');
    const cleanRedirect = buildCleanRedirect();
    // Phantom universal link that supports deep linking
    const link = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(origin)}&redirect_link=${encodeURIComponent(cleanRedirect)}`;
    const install = 'https://phantom.app/'; // canonical fallback
    return openAppOrPrompt({ deepLink: link, installUrl: install, appName: 'Phantom' });
  } catch (e) {
    console.error('Phantom deep link failed', e);
    try { window.open('https://phantom.app/', '_blank'); } catch(e2){ console.warn(e2); }
    return Promise.resolve(false);
  }
}

async function connectWithPhantom(){
  if (tg){ openPhantomDeepLink(); return; }

  if (window.solana && window.solana.isPhantom){
    try {
      const resp = await window.solana.connect();
      const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || (resp && resp);
      const ok = await finalizeBind(publicKey, 'phantom');
      if (ok) hideModal();
      return;
    } catch (err) {
      console.warn('Injected Phantom connect failed', err);
      showModal('<div class="small-muted">Phantom connection canceled or failed. Tap to open Phantom app.</div><div style="height:8px"></div><button id="openPhantomBtn" class="button">Open Phantom</button>', ()=>{
        const b = $('#openPhantomBtn'); if (b) b.onclick = ()=> { openPhantomDeepLink(); };
      });
      return;
    }
  } else {
    openPhantomDeepLink();
  }
}

/* ---------------------------
   Solflare connector
*/
function openSolflareDeepLink(){
  try {
    const cleanRedirect = buildCleanRedirect();
    // Solflare universal link
    const link = `https://solflare.com/access?redirect=${encodeURIComponent(cleanRedirect)}`;
    const install = 'https://solflare.com/';
    return openAppOrPrompt({ deepLink: link, installUrl: install, appName: 'Solflare' });
  } catch(e){ console.warn('openSolflareDeepLink failed', e); try { window.open('https://solflare.com/', '_blank'); } catch(e2){} return Promise.resolve(false); }
}

async function connectWithSolflare(){
  if (tg){ openSolflareDeepLink(); return; }

  try {
    if (window.solflare && typeof window.solflare.connect === 'function'){
      const resp = await window.solflare.connect();
      const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || resp;
      const ok = await finalizeBind(publicKey, 'solflare');
      if (ok) hideModal();
      return;
    } else if (window.solana && window.solana.isSolflare){
      try {
        const r = await window.solana.connect();
        const publicKey = (r && r.publicKey && typeof r.publicKey.toString === 'function') ? r.publicKey.toString() : (r && r.publicKey) || (r && r);
        const ok = await finalizeBind(publicKey, 'solflare');
        if (ok) hideModal();
        return;
      } catch(e){}
    }
  } catch(e){ console.warn('solflare injected connect failed', e); }

  openSolflareDeepLink();
}

/* ---------------------------
   Backpack connector
*/
function openBackpackDeepLink(){
  try {
    const link = `https://backpack.app/`; // universal link
    const install = 'https://backpack.app/';
    return openAppOrPrompt({ deepLink: link, installUrl: install, appName: 'Backpack' });
  } catch(e){ console.warn('openBackpackDeepLink failed', e); window.open('https://backpack.app/', '_blank'); return Promise.resolve(false); }
}

async function connectWithBackpack(){
  if (tg){ openBackpackDeepLink(); return; }

  try {
    if (window.backpack && typeof window.backpack.connect === 'function'){
      const resp = await window.backpack.connect();
      const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || resp;
      const ok = await finalizeBind(publicKey, 'backpack');
      if (ok) hideModal();
      return;
    } else if (window.solana && window.solana.isBackpack){
      try {
        const r = await window.solana.connect();
        const publicKey = (r && r.publicKey && typeof r.publicKey.toString === 'function') ? r.publicKey.toString() : (r && r.publicKey) || (r && r);
        const ok = await finalizeBind(publicKey, 'backpack');
        if (ok) hideModal();
        return;
      } catch(e){}
    }
  } catch(e){ console.warn('backpack injected connect failed', e); }

  openBackpackDeepLink();
}

/* ---------------------------
   WalletConnect scaffold (unchanged except messaging)
*/
function showWalletConnectInstructions(qrOrLinkText){
  const html = `<div style="text-align:left">
    <h3>WalletConnect</h3>
    <div class="small-muted">WalletConnect allows many wallets (Coinbase Wallet, Trust Wallet, Exodus, etc.).</div>
    <div style="height:8px"></div>
    <div class="small-muted">${escapeHtml(qrOrLinkText || 'Open your wallet app and choose "WalletConnect" or scan a QR.' )}</div>
    <div style="height:12px"></div>
    <button id="closeWc" class="btn-ghost">Close</button>
  </div>`;
  showModal(html, ()=>{ const c = $('#closeWc'); if (c) c.onclick = hideModal; });
}

async function connectWithWalletConnect(){
  try {
    if (window.SOL_WALLETCONNECT_CONNECTOR && typeof window.SOL_WALLETCONNECT_CONNECTOR.connect === 'function'){
      const pk = await window.SOL_WALLETCONNECT_CONNECTOR.connect({ redirect: buildCleanRedirect() });
      if (pk) {
        const ok = await finalizeBind(pk, 'walletconnect');
        if (ok) hideModal();
      }
      return;
    }
    showWalletConnectInstructions('No WalletConnect helper found. Use your wallet app and paste returned public key into the "Bind Public Key" field.');
  } catch (e) {
    console.warn('connectWithWalletConnect failed', e);
    showWalletConnectInstructions('WalletConnect failed — try a mobile wallet and use WalletConnect option there.');
  }
}

/* ---------------------------
   Generic server finalizer (unchanged)
*/
async function bindWalletWithPublicKey(publicKey){
  try {
    console.log('Attempting server-side wallet bind', publicKey);
    const payload = { sessionId: clientState.sessionId, wallet: publicKey, referral: clientState.pendingReferral || clientState.referralCode || null };
    const res = await api('/wallet/bind','POST', payload);
    if (res && res.ok){
      clientState.wallet = publicKey;
      clientState.userId = res.userId ?? clientState.userId;
      clientState.gp = res.gp ?? clientState.gp;
      clientState.miners = res.miners ?? clientState.miners;
      clientState.userAU = res.userAU ?? clientState.userAU;
      clientState.totalAU = res.totalAU ?? clientState.totalAU;
      clientState.referralCode = res.referralCode ?? clientState.referralCode;
      if (res.referralAccepted) clearPendingReferral();
      saveBoundWalletToStorage(publicKey, clientState.walletProvider || null);
      updateUI(); renderMinersList();
      console.log('Wallet bound via server:', publicKey);
      return true;
    } else {
      console.warn('bindWalletWithPublicKey failed', res);
      return false;
    }
  } catch (e) {
    console.warn('bindWalletWithPublicKey error', e);
    return false;
  }
}

/* ---------------------------
   Parse deep link / redirect returns (Phantom/Solflare/Backpack)
   - looks in query + hash + common param names
*/
function parseReturnParams(){
  try {
    const full = (window.location.search || '') + (window.location.hash && window.location.hash.indexOf('?') !== -1 ? window.location.hash.replace('#','') : '');
    const params = new URLSearchParams(full);
    const candidates = [
      params.get('phantom_public_key'),
      params.get('phantom_encryption_public_key'),
      params.get('public_key'),
      params.get('publicKey'),
      params.get('wallet'),
      params.get('pk'),
      params.get('address'),
      params.get('account')
    ];
    for (const c of candidates){
      if (c) return c;
    }
    // also check common "result" JSON in a single param (rare)
    const raw = params.get('result') || params.get('response');
    if (raw){
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.publicKey || parsed.address || parsed.pk)) return parsed.publicKey || parsed.address || parsed.pk;
      } catch(e){}
    }
    return null;
  } catch(e){ return null; }
}

function readWalletReturn(){
  try {
    const pk = parseReturnParams();
    if (pk){
      console.log('Wallet return detected, publicKey=', pk);
      (async ()=>{
        const ok = await bindWalletWithPublicKey(pk);
        try {
          const cleanUrl = window.location.origin + window.location.pathname;
          history.replaceState({}, document.title, cleanUrl);
        } catch(e){ console.warn('replaceState failed', e); }
        if (ok) {
          clearPendingReferral();
          showModal('<div class="small-muted">Wallet connected</div>', ()=> setTimeout(hideModal,900));
        } else {
          showModal('<div class="small-muted">Wallet connect failed — open app and try again</div>', ()=> setTimeout(hideModal,1200));
        }
      })();
      return true;
    }
    return false;
  } catch(e){
    console.warn('readWalletReturn error', e);
    return false;
  }
}

/* ---------------------------
   Listen for injected provider events
*/
function setupInjectedProviderListeners(){
  try {
    if (window.solana && typeof window.solana.on === 'function'){
      window.solana.on('connect', async (pk) => {
        try {
          const publicKey = (pk && pk.toString) ? pk.toString() : (pk && pk.publicKey && pk.publicKey.toString ? pk.publicKey.toString() : pk);
          if (publicKey && (!clientState.wallet || clientState.wallet !== publicKey)){
            const ok = await bindWalletWithPublicKey(publicKey);
            if (ok) {
              showModal('<div class="small-muted">Wallet connected</div>', ()=> setTimeout(hideModal,900));
            }
          }
        } catch(e){ console.warn('provider connect handler error', e); }
      });
      window.solana.on('disconnect', () => {
        console.log('Provider disconnected');
        clientState.wallet = null;
        clientState.walletProvider = null;
        clearBoundWalletFromStorage();
        updateUI();
      });
    }
  } catch(e){ console.warn('setupInjectedProviderListeners failed', e); }
}

/* ---------------------------
   Referral UI & sharing (unchanged)
*/
async function getMyReferral(){
  try {
    const resp = await api('/player/referral','GET');
    if (resp && resp.refCode){
      clientState.referralCode = resp.refCode;
      clientState.referralsActive = resp.count ?? clientState.referralsActive;
    }
    return clientState.referralCode;
  } catch(e){ console.warn('getMyReferral', e); return clientState.referralCode; }
}

function showReferralModal(){
  (async ()=>{
    let code = clientState.referralCode || await getMyReferral();
    if (!code) code = 'UNKNOWN';
    const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;
    const html = `<div style="text-align:left">
      <h3>Invite Friends</h3>
      <div class="small-muted">Share your referral link — both of you can earn rewards</div>
      <div style="margin-top:8px;"><input id="refLinkBox" style="width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.06)" value="${escapeHtml(link)}" readonly></div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button id="copyRefBtn" class="button">Copy Link</button>
        <button id="shareRefBtn" class="btn-ghost">Share</button>
      </div>
      <div style="margin-top:8px;" class="small-muted">Referrals: ${clientState.referralsActive || 0}</div>
    </div>`;
    showModal(html, ()=>{
      const copy = $('#copyRefBtn'); const share = $('#shareRefBtn'); const box = $('#refLinkBox');
      if (copy) copy.onclick = async ()=>{ try{ await navigator.clipboard.writeText(box.value); showModal('<div class="small-muted">Copied!</div>', ()=> setTimeout(hideModal,600)); } catch(e){ console.warn(e); alert('Copy failed'); } };
      if (share) share.onclick = async ()=>{ try { if (navigator.share) { await navigator.share({ title: 'Play Hexon', text: 'Join me on Hexon', url: box.value }); hideModal(); } else { alert('Share not supported on this device — copy link instead'); } } catch(e){ console.warn(e); } };
    });
  })();
}

/* ---------------------------
   UI helpers, miners, leaderboard (unchanged)
*/
function renderMinersList(){
  const container = $('minersList'); if (!container) return;
  container.innerHTML = '';
  if (!clientState.miners || clientState.miners.length === 0) { container.innerHTML = '<div class="small-muted">No miners owned</div>'; return; }
  clientState.miners.forEach(m=>{
    const node = document.createElement('div');
    node.style.display='flex'; node.style.justifyContent='space-between'; node.style.padding='6px 0';
    node.innerHTML = `<div><b>${escapeHtml(m.name)}</b><div class="small-muted">Hash ${escapeHtml(String(m.au))} AU</div></div><div class="small-muted">${escapeHtml(m.status || 'Active')}</div>`;
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
    row.innerHTML = `<div>${idx+1}. ${escapeHtml(t.name)}</div><div>${Number(t.score).toLocaleString()}</div>`;
    el.appendChild(row);
  });
}

/* ---------------------------
   updateUI (unchanged)
*/
function updateUI(){
  if ($('ui-score')) $('ui-score').innerText = gameState.score || 0;
  if ($('ui-gp')) $('ui-gp').innerText = (clientState.gp || 0) + ' GP';
  if ($('ui-energyFill') && $('ui-energyFill').style) $('ui-energyFill').style.width = Math.max(0, Math.min(100, clientState.energy || 0)) + '%';
  if ($('ui-level')) $('ui-level').innerText = gameState.level;
  if ($('ui-lines')) $('ui-lines').innerText = gameState.lines;
  if ($('ui-au')) $('ui-au').innerText = 'AU: ' + (clientState.userAU || 0).toFixed(2);
  if ($('ui-hxn')) {
    const est = clientState.totalAU>0 ? ((clientState.userAU / clientState.totalAU) * DAILY_EMISSION_CAP) : 0;
    $('ui-hxn').innerText = Math.round(est).toLocaleString() + ' HXN';
  }
  if ($('ui-username')) {
    $('ui-username').innerText = clientState.username ? `@${clientState.username}` : (clientState.userId ? `user:${clientState.userId}` : 'Guest');
  }
  if ($('ui-session')) {
    $('ui-session').innerText = clientState.sessionId || '—';
  }
  if ($('ui-wallet')) {
    $('ui-wallet').innerText = clientState.wallet ? clientState.wallet : 'Not connected';
  }
  if ($('ui-provider')) {
    $('ui-provider').innerText = clientState.walletProvider ? clientState.walletProvider : '—';
  }
  if ($('ui-adsToday')) $('ui-adsToday').innerText = String(clientState.adsToday || 0);
  if ($('ui-sittings')) $('ui-sittings').innerText = `${MAX_SITTINGS_PER_DAY}/${MAX_SITTINGS_PER_DAY}`;
}

/* ---------------------------
   Phaser scenes and game logic (unchanged)
*/
const gameState = {
  grid: null,
  activePiece: null,
  nextPiece: null,
  score: 0,
  level: 1,
  lines: 0,
  dropInterval: INITIAL_DROP_MS,
  isPlaying: false,
  combo: 0
};

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

let phaserGame;

class BootScene extends Phaser.Scene {
  constructor(){ super({ key:'BootScene' }); }
  create(){ this.scene.start('GameScene'); }
}

class GameScene extends Phaser.Scene {
  constructor(){ super({ key:'GameScene' }); }
  create(){
    this.boardPixelWidth = GRID_COLS * (CELL + GAP) + 40;
    this.boardPixelHeight = GRID_ROWS * (CELL + GAP) + 40;
    this.gridOrigin = { x: 16, y: 16 };

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

    initGrid();

    this.cellSprites = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    for (let r=0; r<GRID_ROWS; r++){
      for (let c=0; c<GRID_COLS; c++){
        const x = this.gridOrigin.x + c*(CELL + GAP) + CELL/2;
        const y = this.gridOrigin.y + r*(CELL + GAP) + CELL/2;
        const rect = this.add.rectangle(x, y, CELL, CELL, 0x102033).setStrokeStyle(1, 0x092033, 0.6);
        rect.updateFill = function(color){
          try { this.fillColor = color; } catch(e){}
          try { if (typeof this.setFillStyle === 'function') this.setFillStyle(color); } catch(e){}
        };
        rect.setInteractive({ useHandCursor: true });
        ((rr, cc, node) => {
          node.on('pointerdown', () => {
            vibratePreferTelegram(20);
            logAction('cell_click', { x: cc, y: rr });
            const orig = node.fillColor || 0x102033;
            node.updateFill(0xFFFFFF);
            this.time.delayedCall(80, ()=> node.updateFill(orig));
          });
        })(r, c, rect);
        this.cellSprites[r][c] = rect;
      }
    }

    spawnPiece();
    gameState.isPlaying = true;
    updateUI();
    this.startDropLoop();
    this.setupInput();
    this.time.addEvent({ delay: AUTO_RECHARGE_MINUTES * 60e3, callback: this.autoRecharge, callbackScope: this, loop: true });
  }

  startDropLoop(){
    if (this.dropEvent){
      try { this.dropEvent.remove(false); } catch(e){ console.warn('dropEvent remove failed', e); }
      this.dropEvent = null;
    }
    const delay = Math.max(40, gameState.dropInterval || INITIAL_DROP_MS);
    this.dropEvent = this.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        if (!gameState.isPlaying) return;
        const moved = movePieceDown();
        logAction('tick_drop', { moved });
        if (!moved) lockPiece();
      }
    });
  }

  update(){
    if (!gameState.isPlaying) return;
    this.renderGrid();
  }

  renderGrid(){
    for (let r=0; r<GRID_ROWS; r++){
      for (let c=0; c<GRID_COLS; c++){
        const val = gameState.grid[r][c];
        const color = val ? colorFromVal(val) : 0x102033;
        const rect = this.cellSprites[r][c];
        if (rect && typeof rect.updateFill === 'function') rect.updateFill(color);
      }
    }
    if (gameState.activePiece){
      const cells = getPieceCells(gameState.activePiece);
      cells.forEach(p=>{
        if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS){
          const rect = this.cellSprites[p.y][p.x];
          if (rect && typeof rect.updateFill === 'function') rect.updateFill(colorFromVal(gameState.activePiece.type));
        }
      });
    }
  }

  setupInput(){
    this.input.keyboard.on('keydown', (ev)=>{
      if (!gameState.isPlaying) return;
      handleKey(ev.code || ev.key);
    });
    window.addEventListener('keydown', (ev) => {
      if (!gameState.isPlaying) return;
      handleKey(ev.code || ev.key);
    });
    if (!document.querySelector('.touch-controls')) setupTouchControls(this);
  }

  autoRecharge(){
    clientState.energy = Math.min(100, clientState.energy + AUTO_RECHARGE_PERCENT);
    updateUI();
    logAction('auto_recharge', { energy: clientState.energy });
  }
}

/* game utilities, lock/clear/score, gameover, etc. -- keep the same as before */
function handleKey(code){
  switch(code){
    case 'ArrowLeft': case 'Left': movePiece(-1); break;
    case 'ArrowRight': case 'Right': movePiece(1); break;
    case 'ArrowDown': case 'Down': softDrop(); break;
    case 'Space': case ' ': hardDrop(); break;
    case 'ArrowUp': case 'Up': rotatePiece(); break;
    default: return;
  }
  updateUI();
}
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
  const yStart = 0;
  gameState.activePiece = { type, rot, x: xStart, y: yStart };
  gameState.nextPiece = PIECE_TYPES[Math.floor(Math.random()*PIECE_TYPES.length)];
  logAction('spawn', { type, x: xStart, y: yStart });
  if (checkCollision(getPieceCells(gameState.activePiece))) gameOver();
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
  if (!checkCollision(getPieceCells(cand))){
    gameState.activePiece.x = cand.x;
    logAction('move', { dir });
  }
}
function movePieceDown(){
  if (!gameState.activePiece) return false;
  const cand = { ...gameState.activePiece, y: gameState.activePiece.y + 1 };
  if (!checkCollision(getPieceCells(cand))){
    gameState.activePiece.y = cand.y;
    return true;
  }
  return false;
}
function softDrop(){ if (movePieceDown()){ gameState.score += 1; clientState.gp += 1; logAction('soft_drop'); updateUI(); } }
function hardDrop(){ let falls = 0; while(movePieceDown()) falls++; lockPiece(); gameState.score += falls * 2; clientState.gp += falls * 2; logAction('hard_drop', { falls }); updateUI(); }
function rotatePiece(){ if (!gameState.activePiece) return; const candidate = { ...gameState.activePiece, rot: (gameState.activePiece.rot + 1) }; const kicks = [{dx:0,dy:0},{dx:-1,dy:0},{dx:1,dy:0},{dx:-2,dy:0},{dx:2,dy:0},{dx:0,dy:-1}]; for (const k of kicks){ const cand = { ...candidate, x: candidate.x + k.dx, y: candidate.y + k.dy }; if (!checkCollision(getPieceCells(cand))){ gameState.activePiece.rot = cand.rot; gameState.activePiece.x = cand.x; gameState.activePiece.y = cand.y; logAction('rotate', { rot: cand.rot, kick: k }); return; } } }
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

  try {
    const scene = phaserGame && phaserGame.scene && phaserGame.scene.keys && phaserGame.scene.keys.GameScene;
    if (scene && typeof scene.startDropLoop === 'function') scene.startDropLoop();
  } catch(e){ console.warn('restart drop loop failed', e); }
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
    gameState.dropInterval = Math.max(120, Math.floor(gameState.dropInterval * 0.92));
  }
  updateUI();
}
async function gameOver(){
  gameState.isPlaying = false;
  logAction('gameover', { score: gameState.score, lines: gameState.lines });
  try {
    await api('/game/submit-score','POST', {
      sessionId: clientState.sessionId,
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
  try {
    const scene = phaserGame && phaserGame.scene && phaserGame.scene.keys && phaserGame.scene.keys.GameScene;
    if (scene && typeof scene.startDropLoop === 'function') scene.startDropLoop();
  } catch(e){ console.warn(e); }
  updateUI();
}

/* colors / touch controls (unchanged) */
function colorFromVal(val){
  const map = { I:0x22d3ee, J:0x7c3aed, L:0xf59e0b, O:0xfacc15, S:0x10b981, T:0x8b5cf6, Z:0xef4444 };
  return map[val] ?? 0x0f172a;
}
function setupTouchControls(scene){
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
  btnLeft.onclick = ()=>{ movePiece(-1); vibratePreferTelegram(20); logAction('touch_left'); updateUI(); };
  btnRight.onclick = ()=>{ movePiece(1); vibratePreferTelegram(20); logAction('touch_right'); updateUI(); };
  btnRotate.onclick = ()=>{ rotatePiece(); vibratePreferTelegram(20); logAction('touch_rotate'); updateUI(); };
  btnDown.onclick = ()=>{ softDrop(); vibratePreferTelegram(20); logAction('touch_drop'); updateUI(); };
}

/* ---------------------------
   Boot & sizing (use DOMContentLoaded for reliability)
*/
document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    console.log('Hexon boot starting...');
    initTelegram();

    // Handle wallet returns first (Phantom / Solflare / Backpack)
    try { readWalletReturn(); } catch(e){ console.warn('readWalletReturn failed', e); }

    // referral
    const ref = getRefFromURL();
    if (ref) savePendingReferral(ref);
    else loadPendingReferral();

    // wire UI buttons - safely, with fallbacks
    try { const wa = $('#watchAdBtn'); if (wa) wa.addEventListener('click', showAdAndVerify); } catch(e){ console.warn(e); }
    try { const os = $('#openStore'); if (os) os.addEventListener('click', openMinerShop); } catch(e){ console.warn(e); }
    try { const bw = $('#bindWalletBtn'); if (bw) bw.addEventListener('click', (ev)=> { ev.preventDefault(); ev.stopPropagation(); showWalletPicker(); }); } catch(e){ console.warn(e); }
    try { const sr = $('#showRefBtn'); if (sr) sr.addEventListener('click', showReferralModal); } catch(e){ /* optional */ }
    try { const va = $('#viewAlloc'); if (va) va.addEventListener('click', ()=> showModal('<div class="small-muted">Allocation preview</div>')); } catch(e){}
    try { const cr = $('#claimRewardBtn'); if (cr) cr.addEventListener('click', claimRewards); } catch(e){}

    // attempt initial client init
    try {
      const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.pendingReferral || null });
      if (init){
        if (init.sessionId && init.sessionId !== clientState.sessionId){
          clientState.sessionId = init.sessionId;
          saveSessionToStorage(clientState.sessionId);
          console.log('Adopted server sessionId:', clientState.sessionId);
        }

        clientState.userId = init.userId ?? clientState.userId;
        clientState.gp = init.gp ?? clientState.gp;
        clientState.miners = init.miners ?? clientState.miners;
        clientState.userAU = init.userAU ?? clientState.userAU;
        clientState.totalAU = init.totalAU ?? clientState.totalAU;
        clientState.referralsActive = init.referralsActive ?? clientState.referralsActive;
        clientState.referralCode = init.referralCode ?? clientState.referralCode;
        if (!clientState.username && init.username) clientState.username = init.username;
        if (init.referralAccepted) clearPendingReferral();
      }
    } catch(e){ console.warn('client init failed', e); }

    // compute scale and sizing (same logic)
    const parentEl = document.getElementById('phaserCanvas') || document.body;
    if (parentEl && parentEl.clientHeight < 200){
      parentEl.style.minHeight = Math.max(420, Math.floor(window.innerHeight * 0.6)) + 'px';
      parentEl.style.width = '100%';
    }

    const rect = parentEl.getBoundingClientRect();
    const availW = Math.max(320, rect.width || Math.min(window.innerWidth * 0.9, 900));
    const availH = Math.max(320, rect.height || Math.min(window.innerHeight * 0.9, 1200));
    const desiredW = GRID_COLS * (BASE_CELL + BASE_GAP) + 40;
    const desiredH = GRID_ROWS * (BASE_CELL + BASE_GAP) + 40;
    const scale = Math.min(1, Math.min(availW / desiredW, availH / desiredH));
    CELL = Math.max(10, Math.floor(BASE_CELL * scale));
    GAP = Math.max(1, Math.floor(BASE_GAP * scale));
    const canvasWidth = GRID_COLS * (CELL + GAP) + 40;
    const canvasHeight = GRID_ROWS * (CELL + GAP) + 40;

    if (parentEl && parentEl.style){
      parentEl.style.minWidth = Math.min(canvasWidth, Math.max(320, canvasWidth)) + 'px';
      parentEl.style.minHeight = Math.min(canvasHeight, Math.max(420, canvasHeight)) + 'px';
    }

    // create Phaser
    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaserCanvas',
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#061426',
      scene: [ BootScene, GameScene ],
      render: { pixelArt: false, antialias: true }
    });

    setupInjectedProviderListeners();
    loadAdsGram();

    updateUI();
    renderMinersList();
    refreshLeaderboard();
    setInterval(()=>{ refreshLeaderboard(); updateUI(); }, 15000);

    console.log('Hexon booted — board', GRID_COLS+'x'+GRID_ROWS, 'CELL', CELL, 'GAP', GAP, 'canvas', canvasWidth+'x'+canvasHeight);
  } catch (err) {
    console.error('Hexon boot failure:', err);
  }
});

/* ---------------------------
   Misc: claimRewards
*/
async function claimRewards(){
  showModal('<div class="small-muted">Claiming rewards...</div>');
  try {
    const resp = await api('/rewards/claim','POST',{ sessionId: clientState.sessionId });
    hideModal();
    if (resp && resp.ok){
      clientState.gp = resp.gp ?? clientState.gp;
      clientState.userAU = resp.userAU ?? clientState.userAU;
      updateUI();
      showModal('<div class="small-muted">Rewards claimed! Closing...</div>');
      setTimeout(()=>{ hideModal(); closeTelegramApp(); }, 900);
    } else {
      const err = (resp && resp.error) ? resp.error : 'Claim failed — try again later.';
      showModal(`<div class="small-muted">${escapeHtml(String(err))}</div>`, ()=> setTimeout(hideModal,1200));
    }
  } catch(e){
    hideModal();
    console.warn('claimRewards error', e);
    showModal('<div class="small-muted">Network error — try again later.</div>', ()=> setTimeout(hideModal,1200));
  }
}

/* ---------------------------
   Expose wallet helpers globally so index.html bottom-sheet can call them
*/
window.connectWithPhantom = connectWithPhantom;
window.connectWithSolflare = connectWithSolflare;
window.connectWithBackpack = connectWithBackpack;
window.connectWithWalletConnect = connectWithWalletConnect;
window.finalizeBind = finalizeBind;
window.showWalletPicker = showWalletPicker;
window.openPhantomDeepLink = openPhantomDeepLink;
window.openSolflareDeepLink = openSolflareDeepLink;
window.openBackpackDeepLink = openBackpackDeepLink;

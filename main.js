/* main.js
   Hexon — Phaser 3 Tetris engine (redraft to match FastAPI server)
   - Adopt server sessionId
   - GETs automatically append sessionId query param
   - shop_items mapping (snake_case -> client fields)
   - ad daily limit consistent with server (MAX_ADS_PER_DAY)
   - persist sessionId in localStorage
   - defensive API handling
   - reliable Phantom deep link fallback for mobile (iOS/Android)
   - Telegram WebApp safe: deep-link only (no injected provider detection)
   - Handles Phantom redirect return (phantom_public_key, public_key, publicKey)
*/

'use strict';

/* ---------------------------
   Config & Constants
   --------------------------- */
const API_BASE = 'https://unfelt-conner-similarly.ngrok-free.dev'; // <-- change to your backend
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

let clientState = {
  sessionId: loadSessionFromStorage() || generateUUID(),
  userId: null,
  username: null,
  wallet: null,
  gp: 0,
  energy: 65,
  miners: [],        // owned miners
  shopItems: [],     // fetched store items (mapped)
  userAU: 0,
  totalAU: 0,
  referralCode: null,   // my own code (from server)
  pendingReferral: null,// code used to refer me (captured from URL)
  referralsActive: 0,
  adsThisSitting: 0,
  adsToday: 0,
  actionLog: []
};

// ensure initial sessionId is persisted
saveSessionToStorage(clientState.sessionId);

function generateUUID(){
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // fallback: reasonably random 16-char hex
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
   - returns parsed JSON on success or error JSON when server replies non-2xx
   - returns null on network error
   - also sends X-Session-Id header for server convenience
*/
async function api(path, method='GET', body=null){
  try {
    // Build URL and auto-attach sessionId for GET requests
    let url = API_BASE + path;
    if (method.toUpperCase() === 'GET') {
      const sid = clientState.sessionId ? encodeURIComponent(clientState.sessionId) : '';
      if (sid && !url.includes('sessionId=')){
        url += (url.includes('?') ? '&' : '?') + 'sessionId=' + sid;
      }
    }

    const headers = { 'Content-Type': 'application/json' };
    if (clientState.sessionId) headers['X-Session-Id'] = clientState.sessionId;

    const opts = { method, headers };
    if (body !== null && body !== undefined) {
      // allow sending already-stringified bodies, but prefer objects
      opts.body = (typeof body === 'string') ? body : JSON.stringify(body);
    }

    const res = await fetch(url, opts);
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
   Referral helpers
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
   Telegram WebApp integration (feature-detected)
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
   AdsGram loader + wrapper
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

// unified ad show function (server enforces MAX_ADS_PER_DAY)
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
        const result = await AdController.show(); // may throw if skipped
        payload = { result };
      } catch(err){
        console.warn('AdController.show error', err);
        hideModal();
        showModal('<div class="small-muted">Ad failed / skipped — no reward</div>', ()=> setTimeout(hideModal,900));
        return;
      }
    } else {
      // fallback: simulate watch delay
      await new Promise(res => setTimeout(res, 2400));
    }

    // verify with backend for authoritative reward issuance
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
   Miner shop (UI + backend)
   - fetch /shop/items (GET)
   - buy: /shop/buy (POST { sessionId, itemId })
   - maps server snake_case fields to client fields
*/
async function fetchShopItems(){
  try {
    const items = await api('/shop/items','GET');
    if (Array.isArray(items)) {
      // map server fields (description, price_gp) -> client (desc, priceGP)
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
  // render modal with shop items
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
      // attach buy handlers
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
      // refresh local miners (backend returns updated miners)
      if (resp.miners) clientState.miners = resp.miners;
      else {
        // fallback: request client/init to refresh
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
   Phantom wallet integration (bind includes referral)
   - server expects sessionId, wallet, referral (optional)
   - If injected provider exists (desktop / supported mobile browsers), use it.
   - Otherwise open Phantom universal link (deep link) immediately so iOS will hand off to the app.
   - Telegram WebApp: always deep-link (in-app WebView can't detect injected provider)
   - Handles Phantom redirect return (phantom_public_key, public_key, publicKey)
   - IMPORTANT: keep deep-link calls inside user gesture where possible.
*/

/*
  IMPORTANT PHANTOM iOS NOTE (applies to openPhantomDeepLink below)
  - Phantom expects a clean, same-origin redirect URL (no querystring fragments, stable path).
  - Using a full `window.location.href` with existing query/hash often causes the universal link
    to open Safari but the Phantom app will not redirect back to your original URL.
  - Use a clean origin-root redirect (e.g. https://yourdomain.com/) OR a dedicated static path
    that you serve from the same origin (e.g. /phantom-return).
*/

/* create a clean redirect path on the same origin (no query/hash) */
function buildCleanRedirect(){
  try {
    // If you have a dedicated endpoint that is whitelisted in Phantom, return it here.
    // Default to origin + '/' which is the safest general-purpose choice.
    const origin = window.location.origin.replace(/\/+$/, '');
    return origin + '/';
  } catch (e) {
    return window.location.origin + '/';
  }
}

/* openPhantomDeepLink: uses a clean redirect_link so Phantom can return to us reliably */
function openPhantomDeepLink(){
  try {
    const origin = window.location.origin.replace(/\/+$/, '');
    const cleanRedirect = buildCleanRedirect(); // e.g. https://example.com/
    const app_url = encodeURIComponent(origin);
    const redirect_link = encodeURIComponent(cleanRedirect);

    // Use the universal link for Phantom. Keep this in a synchronous user gesture.
    const link =
      `https://phantom.app/ul/v1/connect` +
      `?app_url=${app_url}` +
      `&redirect_link=${redirect_link}`;

    console.log('Attempting Phantom deep link ->', { link, cleanRedirect });

    // Assign (synchronous) so it's treated as a user gesture.
    // window.location.assign may be preferable to setting href in some contexts.
    window.location.assign(link);
  } catch (e) {
    console.error('Phantom deep link failed', e);
    try { window.location.assign('https://phantom.app/'); } catch(e2){ window.open('https://phantom.app/', '_blank'); }
  }
}

/* bindWalletWithPublicKey: calls backend to finalize binding and updates UI */
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
      clientState.referralCode = res.referralCode ?? clientState.referralCode;
      if (res.referralAccepted) clearPendingReferral();
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

/* parsePhantomReturnParams: support many possible returned param names, search both search and hash */
function parsePhantomReturnParams(){
  try {
    // Combine search and hash safely: treat hash like a query if it looks like '#?a=b'
    const search = window.location.search || '';
    const hash = window.location.hash && window.location.hash.indexOf('?') !== -1 ? window.location.hash.replace('#','') : '';
    const combined = (search || '') + (hash || '');
    const params = new URLSearchParams(combined);
    const candidates = [
      params.get('phantom_public_key'),
      params.get('phantom_encryption_public_key'),
      params.get('public_key'),
      params.get('publicKey'),
      params.get('wallet'),
      params.get('pk')
    ];
    for (const c of candidates){
      if (c) return c;
    }
    return null;
  } catch(e){ return null; }
}

/* readPhantomReturn: called on load to detect Phantom redirect and finalize bind */
function readPhantomReturn(){
  try {
    const pk = parsePhantomReturnParams();
    if (pk){
      console.log('Phantom return detected, publicKey=', pk);
      // Immediately attempt to bind using returned public key
      (async ()=>{
        const ok = await bindWalletWithPublicKey(pk);
        // Remove phantom params so UI is clean (preserve path)
        try {
          // Prefer replaceState to remove query/hash only if supported
          const cleanUrl = window.location.origin + window.location.pathname + window.location.hash.replace(/[?&]phantom_public_key=[^&]*/,'').replace(/[?&]public_key=[^&]*/,'').replace(/[?&]publicKey=[^&]*/,'');
          history.replaceState({}, document.title, cleanUrl);
        } catch(e){ console.warn('replaceState failed', e); }
        if (ok) {
          clearPendingReferral();
          showModal('<div class="small-muted">Wallet connected</div>', ()=> setTimeout(hideModal,900));
        } else {
          showModal('<div class="small-muted">Wallet connect failed — tap "Open Phantom" to try via app</div><div style="height:8px"></div><button id="openPhantomRetry" class="button">Open Phantom</button>', ()=>{
            const b = $('#openPhantomRetry'); if (b) b.onclick = ()=> { hideModal(); openPhantomDeepLink(); };
          });
        }
      })();
      return true;
    }
    return false;
  } catch(e){
    console.warn('readPhantomReturn error', e);
    return false;
  }
}

/*
  bindWallet()
  - MUST be wired to a user gesture (click) so deep-link fallback has maximal chance to open the native app.
  - Behavior:
    * Telegram WebApp -> deep-link immediately (webview cannot detect injected provider reliably)
    * If injected Phantom provider present -> attempt connect() (this runs during user gesture and may prompt extension/app)
      - on connect success -> hit server bind
      - on connect error/cancel -> show a simple modal with an explicit "Open Phantom" button (user must click to re-open app)
    * If no injected provider -> deep-link immediately
*/
async function bindWallet(event){
  try {
    // If Telegram WebApp — deep link only (in-app webview can't detect injected provider reliably).
    if (tg) {
      openPhantomDeepLink();
      return;
    }

    const injected = Boolean(window.solana && window.solana.isPhantom);

    if (!injected){
      // No injected provider at all — deep-link immediately (inside user gesture)
      openPhantomDeepLink();
      return;
    }

    // If we reach here: injected provider exists. Attempt connect (this still originates from user gesture)
    try {
      const resp = await window.solana.connect();
      // resp may be { publicKey: PublicKey } or similar
      const publicKey = (resp && resp.publicKey && typeof resp.publicKey.toString === 'function') ? resp.publicKey.toString() : (resp && resp.publicKey) || (resp && resp);
      if (!publicKey) throw new Error('No publicKey returned from provider');

      // call server bind
      const ok = await bindWalletWithPublicKey(publicKey);
      if (ok){
        showModal('<div class="small-muted">Wallet bound</div>', ()=> setTimeout(hideModal,900));
        return;
      } else {
        showModal('<div class="small-muted">Bind failed — open Phantom app to continue</div><div style="height:8px"></div><button id="openPhantomFromBind" class="button">Open Phantom</button>', ()=>{
          const b = $('#openPhantomFromBind'); if (b) b.onclick = ()=> { hideModal(); openPhantomDeepLink(); };
        });
        return;
      }
    } catch (err) {
      // If injected connect failed or was canceled, do NOT attempt to auto-open deep-link outside of a user gesture.
      console.warn('Injected Phantom connect error or canceled — presenting deep-link CTA', err);
      showModal('<div class="small-muted">Phantom connection canceled or failed. Tap to open the Phantom app.</div><div style="height:8px"></div><button id="openPhantomBtn" class="button">Open Phantom</button>', ()=>{
        const b = $('#openPhantomBtn'); if (b) b.onclick = ()=> { hideModal(); openPhantomDeepLink(); };
      });
      return;
    }
  } catch (e) {
    console.warn('bindWallet general error', e);
    showModal('<div class="small-muted">Wallet connect error — try again</div>', ()=> setTimeout(hideModal,1200));
  }
}

/* ---------------------------
   Listen for injected provider "connect" events — helpful if provider connects outside flow
   (e.g., extension auto-connect or mobile provider handing off)
*/
function setupInjectedProviderListeners(){
  try {
    if (window.solana && typeof window.solana.on === 'function'){
      // on connect: update UI and attempt server bind if we don't have wallet bound
      window.solana.on('connect', async (pk) => {
        try {
          const publicKey = (pk && pk.toString) ? pk.toString() : (pk && pk.publicKey && pk.publicKey.toString ? pk.publicKey.toString() : pk);
          if (publicKey && (!clientState.wallet || clientState.wallet !== publicKey)){
            // attempt server-side bind silently
            const ok = await bindWalletWithPublicKey(publicKey);
            if (ok) {
              showModal('<div class="small-muted">Wallet connected</div>', ()=> setTimeout(hideModal,900));
            }
          }
        } catch(e){ console.warn('provider connect handler error', e); }
      });
      window.solana.on('disconnect', () => {
        // provider disconnected — keep server-binding state (server owns binding), but reflect UI
        console.log('Phantom provider disconnected');
      });
    }
  } catch(e){ console.warn('setupInjectedProviderListeners failed', e); }
}

/* ---------------------------
   Referral UI & sharing
   - server endpoint /player/referral expects sessionId query param (api() attaches automatically)
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
    if (!code) {
      code = 'UNKNOWN';
    }
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
   UI helpers, miners, leaderboard
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
   Modal / UI helpers
*/
function showModal(html, onMounted){ const o=$('overlay'); if(!o) { console.log('Modal:', html); return; } o.classList.add('show'); $('#modalContent').innerHTML = html; if(onMounted) setTimeout(onMounted,60); }
function hideModal(){ const o=$('overlay'); if(!o) return; o.classList.remove('show'); $('#modalContent').innerHTML = ''; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

function updateUI(){
  if ($('ui-score')) $('ui-score').innerText = gameState.score || 0;
  if ($('ui-gp')) $('ui-gp').innerText = (clientState.gp || 0) + ' GP';
  if ($('ui-energyFill') && $('ui-energyFill').style) $('ui-energyFill').style.width = (clientState.energy) + '%';
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
}

/* ---------------------------
   Phaser scenes and game logic (unchanged core)
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
  create(){ console.log('BootScene.create -> switching to GameScene'); this.scene.start('GameScene'); }
}

class GameScene extends Phaser.Scene {
  constructor(){ super({ key:'GameScene' }); }
  create(){
    console.log('GameScene.create');
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
    console.log('GameScene created — boardSize', this.boardPixelWidth, this.boardPixelHeight);
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

/* ---------------------------
   Game utilities (movement, scoring)
*/
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

/* ---------------------------
   Lock / clear / scoring
*/
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

/* ---------------------------
   Game over / reset
   - server endpoint /game/submit-score expects sessionId in POST body
*/
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

/* ---------------------------
   Colors / touch controls
*/
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
   Boot & sizing
   - perform client /client/init and adopt server sessionId (stored locally)
   - readPhantomReturn() before init so Phantom-deep-link returns are handled
*/
window.addEventListener('load', async ()=>{
  try {
    console.log('Hexon boot starting...');
    initTelegram();

    // If Phantom redirected back with params, read and handle them first
    try { readPhantomReturn(); } catch(e){ /* non-fatal */ console.warn('readPhantomReturn failed', e); }

    // Capture and persist referral from URL before init
    const ref = getRefFromURL();
    if (ref) savePendingReferral(ref);
    else loadPendingReferral();

    // wire UI buttons safely (use addEventListener so we preserve user gesture)
    try { if ($('watchAdBtn')) $('watchAdBtn').addEventListener('click', showAdAndVerify); } catch(e){ console.warn(e); }
    try { if ($('openStore')) $('openStore').addEventListener('click', openMinerShop); } catch(e){ console.warn(e); }
    try { if ($('bindWalletBtn')) $('bindWalletBtn').addEventListener('click', bindWallet); } catch(e){ console.warn(e); }
    if ($('showRefBtn')) $('showRefBtn').addEventListener('click', showReferralModal);
    if ($('viewAlloc')) $('viewAlloc').addEventListener('click', ()=> showModal('<div class="small-muted">Allocation preview</div>'));
    if ($('claimRewardBtn')) $('claimRewardBtn').addEventListener('click', claimRewards);

    // attempt initial client init (include pending referral so backend can register if desired)
    try {
      const init = await api('/client/init','POST',{ sessionId: clientState.sessionId, referral: clientState.pendingReferral || null });
      if (init){
        // adopt authoritative sessionId from server (very important)
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
        // if backend accepted referral at init, clear pending
        if (init.referralAccepted) clearPendingReferral();
      }
    } catch(e){ console.warn('client init failed', e); }

    // compute scale and ensure parent height
    const parentEl = document.getElementById('phaserCanvas') || document.body;
    if (parentEl && parentEl.clientHeight < 200){
      parentEl.style.minHeight = Math.max(420, Math.floor(window.innerHeight * 0.6)) + 'px';
      parentEl.style.width = '100%';
      console.log('Enforced minHeight on phaserCanvas:', parentEl.style.minHeight);
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

    // setup provider listeners (if injected)
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
   Misc: claimRewards (keeps existing behavior)
   - server expects { sessionId }
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

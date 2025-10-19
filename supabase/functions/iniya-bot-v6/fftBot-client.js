// ===== INIYA BOT v3.1 - REMOTE STORAGE =====
// remote (persistent) - Removed localStorage code

  /*
In function saveConfig, remove all localStorage code, keep only remote code
*/

(function() {
  'use strict';

  const CFG = {
    EDGE_URL: 'https://opaxtxfxropmjrrqlewh.supabase.co/functions/v1/iniya-bot-v6',
    BUCKET_DELAY: 7000,
    MAX_BUCKET: 10,
    INIT_CMD: 'hi/',
    DEBUG: true
  };

  const STATE = {
    room: window.location.pathname,
    username: null,
    platformId: null,
    enabled: false,
    seen: new Set(),
    observer: null
  };

  const BUCKET = { events: [], timer: null, processing: false };

  const SEL = {
    input: '.ant-mentions.input-box textarea',
    send: 'button.send-box',
    msg: '[data-message-id]',
    sysMsg: '.system-message[data-message-id]',
    user: '.user .name.primary span',
    text: '.text.main-content .html.text-overflow',
    sysUser: '.system.typography strong',
    sysType: '.typography',
    quote: '.text.quote.main-quote-content',
    quoteName: '.quote-name',
    quoteContent: '.quote-content[data-message-id]',
    quoteText: '.quote-content .html.text-overflow'
  };

  // ===== UTILITIES =====
  const log = (...args) => CFG.DEBUG && console.log(`[${STATE.username || 'Bot'}]`, new Date().toLocaleTimeString(), ...args);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ===== STORAGE (Remote Supabase) =====
  const saveConfig = async (roomId, platformId, username) => {
    try {

      // Save only to remote (persistent, cross-device)
      await fetch(CFG.EDGE_URL + '/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, platformId, username })
      });
      log('☁️ Config saved to remote');
    } catch (e) {
      log('⚠️ Remote save failed:', e.message);
    }
  };


  // ===== EXTRACTION =====
  const extractData = (el) => {
    const id = el.getAttribute('data-message-id');
    if (!id) return null;
    const [, platformId, timestamp] = id.split(':');
    return { messageId: id, platformId, timestamp: parseInt(timestamp) || Date.now() };
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')} ${d.getDate().toString().padStart(2,'0')}-${d.toLocaleString('en-US',{month:'short'})}-${d.getFullYear()} IST`;
  };

  // ===== SYSTEM EVENT DETECTION =====
  const detectSystemEvent = (el) => {
    if (!el.classList.contains('system-message')) return null;

    const userEl = el.querySelector(SEL.sysUser);
    if (!userEl) return null;

    const username = userEl.textContent.trim();
    const typeEl = el.querySelector(SEL.sysType);

    let type = null;
    if (typeEl.classList.contains('join')) type = 'joined';
    else if (typeEl.classList.contains('leave')) type = 'left';

    if (!type) return null;

    const data = extractData(el);
    if (!data) return null;

    return {
      type,
      username,
      text: username + ' ' + type,
      timestamp: data.timestamp,
      messageId: data.messageId
    };
  };

  // ===== QUOTED MESSAGE DETECTION =====
  const detectQuoted = (el, timestamp) => {
    const qContainer = el.querySelector(SEL.quote);
    if (!qContainer) return null;

    let qName = qContainer.querySelector(SEL.quoteName)?.textContent.trim();
    const qContent = qContainer.querySelector(SEL.quoteContent);
    const qText = qContainer.querySelector(SEL.quoteText)?.textContent.trim();
    const replyText = el.querySelector(SEL.text)?.textContent.trim();

    if (!qName || !qText || !replyText) return null;

    qName = qName.replace(/^.*(un)?verified/i, '');

    let qPlatformId = null;
    let qTimestamp = timestamp;

    if (qContent) {
      const qData = extractData(qContent);
      if (qData) {
        qPlatformId = qData.platformId;
        qTimestamp = qData.timestamp;
      }
    }

    // If platformId still missing, try to find it in recent BUCKET.events
    if (!qPlatformId) {
      const recentEvent = BUCKET.events.find(e => e.username === qName);
      if (recentEvent && recentEvent.platformId) {
        qPlatformId = recentEvent.platformId;
      }
    }

    // If platformId still missing, log warning and return null (skip quotedMessage)
    if (!qPlatformId) {
      log('⚠️ Missing platformId for quoted message from:', qName);
      return null;
    }

    return {
      quotedMessage: {
        username: qName,
        platformId: qPlatformId,
        text: qText,
        timestamp: qTimestamp
      },
      replyText
    };
  };

  // ===== INITIALIZATION =====
  const tryInit = (el) => {
    const text = el.querySelector(SEL.text)?.textContent.trim();
    if (!text || !text.startsWith(CFG.INIT_CMD)) return false;

    const username = el.querySelector(SEL.user)?.textContent.trim();
    const data = extractData(el);

    if (!username || !data) {
      log('❌ Init failed - missing data');
      return false;
    }

    STATE.username = username;
    STATE.platformId = data.platformId;
    STATE.enabled = true;

    saveConfig(STATE.room, data.platformId, username);

    log('✅ Initialized:', username, data.platformId);
    updateUI(true);
    return true;
  };

  // ===== MESSAGE DETECTION =====
  const detectMsg = async (el) => {
    try {
      if (el.classList.contains('server-notification')) {
        log('⚠️ Skipping server notification');
        return;
      }

      const adminBadge = el.querySelector('.roleType-1');
      if (adminBadge) {
        const username = el.querySelector(SEL.user)?.textContent.trim();
        log('⚠️ Skipping admin message from:', username);
        return;
      }

      const username = el.querySelector(SEL.user)?.textContent.trim();
      const systemUsernames = ['Coffee Notification', 'System', 'Free4Talk'];
      if (systemUsernames.includes(username)) {
        log('⚠️ Skipping system username:', username);
        return;
      }

      const newRoom = window.location.pathname;
      if (newRoom !== STATE.room) {
          // Reset everything for new room, getConfig deleted
          STATE.room = newRoom;
          STATE.username = null;
          STATE.platformId = null;
          STATE.enabled = false;
          updateUI(false);
          STATE.seen.clear();
          log('🔄 new room:', newRoom);
      }

      const data = extractData(el);
      if (!data || STATE.seen.has(data.messageId)) return;

      STATE.seen.add(data.messageId);
      if (STATE.seen.size > 1000) {
        STATE.seen = new Set([...STATE.seen].slice(-800));
      }

      if (!STATE.enabled) {
        tryInit(el);
        return;
      }

      const sysEvent = detectSystemEvent(el);
      if (sysEvent) {
        log('📩', sysEvent.username, sysEvent.type, '@', formatTime(sysEvent.timestamp));
        BUCKET.events.push(sysEvent);
        resetTimer();
        return;
      }

      const text = el.querySelector(SEL.text)?.textContent.trim();

      if (!username || !data.platformId) return;

      if (text?.startsWith(CFG.INIT_CMD)) return;

      const quoted = detectQuoted(el, data.timestamp);

      const event = {
        type: quoted ? 'quoted' : 'message',
        username,
        platformId: data.platformId,
        text: quoted ? quoted.replyText : text,
        timestamp: data.timestamp,
        messageId: data.messageId
      };

      if (quoted) {
        event.quotedMessage = quoted.quotedMessage;
      }

      log('📩', username, ':', text, '@', formatTime(data.timestamp));
      BUCKET.events.push(event);

      if (BUCKET.events.length > CFG.MAX_BUCKET * 2) {
        BUCKET.events = BUCKET.events.slice(-CFG.MAX_BUCKET);
      }

      resetTimer();

    } catch (e) {
      log('❌ Detection error:', e.message);
    }
  };

  // ===== BUCKET PROCESSING =====
  const resetTimer = () => {
    if (!STATE.enabled) return;
    clearTimeout(BUCKET.timer);
    //Check if bucket only has system events, if so, add 5s to delay
    const hasRealMessages = BUCKET.events.some(e => 
      e.type === 'message' || e.type === 'quoted'
    );
    if (!hasRealMessages) {
      BUCKET.timer = setTimeout(resetTimer, 5000);
      return;
    }

    BUCKET.timer = setTimeout(sendBucket, CFG.BUCKET_DELAY);
  };

  const sendBucket = async () => {
    if (!STATE.enabled || BUCKET.processing || BUCKET.events.length === 0) return;

        const hasRealMessages = BUCKET.events.some(e => 
      e.type === 'message' || e.type === 'quoted'
    );

    if (!hasRealMessages) {
      log('⏳ System events only, postponing +5s');
      clearTimeout(BUCKET.timer);
      BUCKET.timer = setTimeout(resetTimer, 5000);
      return;
    }
    
    BUCKET.processing = true;
    clearTimeout(BUCKET.timer);
    BUCKET.timer = null;

    const events = [...BUCKET.events];
    BUCKET.events = [];
    log('📨 sending bucket:', events.length);

    try {
      const res = await fetch(CFG.EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botPlatformId: STATE.platformId,
          roomPath: STATE.room,
          events
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      log('✅ Response:', result);

      if ((result.strategy === 'ENGAGE' || result.strategy === 'OBSERVE') && result.messages?.length > 0) {
        for (const msg of result.messages) {
          await sendMsg(msg.text, msg.delayMs || 1500);
        }
      } else {
        log('👀 No reply needed');
      }

    } catch (e) {
      log('❌ Edge error:', e.message);
    } finally {
      BUCKET.processing = false;
    }
  };

  // ===== MESSAGE SENDING =====
  const sendMsg = async (text, delay) => {
    await sleep(delay);

    const input = document.querySelector(SEL.input);
    const btn = document.querySelector(SEL.send);

    if (!input || !btn) {
      log('❌ Input/button not found');
      return false;
    }

    try {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

      for (let i = 0; i <= text.length; i++) {
        setter.call(input, text.slice(0, i));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(40 + Math.random() * 40);
      }

      await sleep(400);

      if (btn.disabled) {
        log('❌ Button disabled');
        return false;
      }

      btn.click();
      log('✉️ Sent:', text);
      return true;

    } catch (e) {
      log('❌ Send error:', e.message);
      return false;
    }
  };

  // ===== UI =====
  const createUI = () => {
    const panel = document.createElement('div');
    panel.id = 'bot-panel';
    panel.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:10px 15px;background:linear-gradient(135deg,#1a1a1a,#2a2a2a);border-radius:20px;color:#fff;font-size:13px;font-family:'Segoe UI',Arial;box-shadow:0 4px 12px rgba(0,0,0,0.5);cursor:move;user-select:none"><span id="dot" style="width:10px;height:10px;border-radius:50%;background:#f44;box-shadow:0 0 8px #f44;animation:pulse 2s infinite"></span><span id="status">Send "hi/"</span></div>`;
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000';

    let drag = false, x, y;
    panel.onmousedown = e => { drag = true; x = e.clientX - panel.offsetLeft; y = e.clientY - panel.offsetTop; };
    document.onmousemove = e => { if(drag) { panel.style.left = `${e.clientX - x}px`; panel.style.top = `${e.clientY - y}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; }};
    document.onmouseup = () => drag = false;

    document.body.appendChild(panel);
    const style = document.createElement('style');
    style.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}';
    document.head.appendChild(style);
  };

  const updateUI = (active) => {
    const dot = document.getElementById('dot');
    const txt = document.getElementById('status');
    if (dot && txt) {
      dot.style.background = active ? '#4f4' : '#f44';
      dot.style.boxShadow = active ? '0 0 8px #4f4' : '0 0 8px #f44';
      txt.textContent = active ? `${STATE.username} Active` : 'Send "hi/"';
    }
  };

  // ===== INIT =====
  const init = async () => {
    log('🚀 Loaded');

    createUI();
    updateUI(false);

    STATE.observer = new MutationObserver(muts => {
      muts.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            if (node.matches(SEL.msg)) detectMsg(node);
            else node.querySelectorAll(SEL.msg).forEach(detectMsg);
          }
        });
      });
    });

    STATE.observer.observe(document.body, { childList: true, subtree: true });
    log('✅ Ready - Waiting for hi/');
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

  window.InyaBot = {
    state: STATE,
    clear: async () => {
      // Optional: Add API call to clear remote config
      log('✅ State cleared'); 
    }
  };
})();
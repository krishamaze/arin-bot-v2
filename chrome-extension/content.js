// ===== WINGMAN DATING HELPER v1.0 - Chrome Extension ===== //

// Extension context - no IIFE needed
'use strict';

// ===== CONFIGURATION =====
const CFG = {
  EDGE_URL: 'https://opaxtxfxropmjrrqlewh.supabase.co/functions/v1/chat-api-v2',
  BUCKET_DELAY: 5000,      // 5s delay before analyzing messages
  MAX_MESSAGES: 10,        // Last 10 messages for context
  INIT_CMD: 'wingman/',    // Changed from 'hi/' to 'wingman/'
  DEBUG: true,
  PANEL_Z_INDEX: 2147483647, // Maximum safe z-index
  STORAGE_KEY_POSITION: 'wingman_panel_position',
  STORAGE_KEY_VISIBLE: 'wingman_panel_visible'
};

// ===== STATE =====
const STATE = {
  conversationId: null,    // UUID from database
  userId: null,            // Bot owner's platform ID
  girlId: null,            // Current match's platform ID
  girlName: null,          // Current match's display name
  username: null,          // Bot owner's username
  enabled: false,
  seen: new Set(),
  observer: null,
  lastAnalysis: null,      // Store last Wingman response
  panel: null,             // Panel DOM element
  isVisible: true,         // Panel visibility state
  isDragging: false,       // Drag state
  dragOffset: { x: 0, y: 0 }
};

const BUCKET = {
  messages: [],            // Recent conversation messages
  timer: null,
  processing: false
};

// ===== DOM SELECTORS =====
const SEL = {
  input: '.ant-mentions.input-box textarea',
  send: 'button.send-box',
  msg: '[data-message-id]',
  user: '.user .name.primary span',
  text: '.text.main-content .html.text-overflow',
  sysMsg: '.system-message[data-message-id]',
  quote: '.text.quote.main-quote-content'
};

// ===== UTILITIES =====
const log = (...args) => CFG.DEBUG && console.log(
  `[Wingman Extension]`, 
  new Date().toLocaleTimeString(), 
  ...args
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chrome storage helpers
const storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  },
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }
};

// ===== DATA EXTRACTION =====
const extractData = (el) => {
  const id = el.getAttribute('data-message-id');
  if (!id) return null;
  const [, platformId, timestamp] = id.split(':');
  return {
    messageId: id,
    platformId,
    timestamp: parseInt(timestamp) || Date.now()
  };
};

// ===== INITIALIZATION =====
const tryInit = async (el) => {
  const text = el.querySelector(SEL.text)?.textContent.trim();
  if (!text || !text.startsWith(CFG.INIT_CMD)) return false;

  const username = el.querySelector(SEL.user)?.textContent.trim();
  const data = extractData(el);
  
  if (!username || !data) {
    log('❌ Init failed - missing data');
    return false;
  }

  STATE.username = username;
  STATE.userId = data.platformId;
  STATE.enabled = true;

  // Create/get user profile via /init endpoint
  try {
    const res = await fetch(`${CFG.EDGE_URL}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformId: data.platformId,
        username: username,
        roomPath: window.location.pathname
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const result = await res.json();
    STATE.conversationId = result.conversationId;
    
    log('✅ Wingman initialized for:', username);
    log('📝 Conversation ID:', result.conversationId);
    updateUI(true);
    
    return true;
  } catch (e) {
    log('❌ Init error:', e.message);
    return false;
  }
};

// ===== MESSAGE DETECTION =====
const detectMsg = async (el) => {
  try {
    // Skip admin/system messages
    if (el.classList.contains('server-notification')) return;
    if (el.querySelector('.roleType-1')) return;
    
    const username = el.querySelector(SEL.user)?.textContent.trim();
    const systemUsernames = ['Coffee Notification', 'System', 'Free4Talk', 'Admin', 'Moderator'];
    if (systemUsernames.includes(username)) return;

    const data = extractData(el);
    if (!data || STATE.seen.has(data.messageId)) return;
    
    STATE.seen.add(data.messageId);
    if (STATE.seen.size > 1000) {
      STATE.seen = new Set([...STATE.seen].slice(-800));
    }

    // Get text early for validation
    const text = el.querySelector(SEL.text)?.textContent.trim();
    
    // Skip empty or whitespace-only messages
    if (!text || text.length === 0) return;

    // Try initialization if not enabled
    if (!STATE.enabled) {
      await tryInit(el);
      return;
    }

    // Skip init commands
    if (text?.startsWith(CFG.INIT_CMD)) return;
    if (!username) return;

    // Identify if message is from bot owner or girl
    const isFromUser = data.platformId === STATE.userId;
    
    if (!isFromUser) {
      // Last message wins - always update to most recent active girl
      const girlChanged = STATE.girlId && STATE.girlId !== data.platformId;
      
      if (girlChanged) {
        log('🔄 Girl changed:', STATE.girlName, '→', username);
        // Reset conversation context when girl changes
        BUCKET.messages = [];
        STATE.seen.clear();
        // Note: conversationId stays the same, but we'll track new match
      }
      
      STATE.girlId = data.platformId;
      STATE.girlName = username;
      
      if (!girlChanged) {
        log('👩 Matched with:', username, `(${data.platformId})`);
      }
    }

    // Add to conversation history
    const message = {
      sender: isFromUser ? 'user' : 'girl',
      username: username,
      text: text,
      timestamp: data.timestamp,
      messageId: data.messageId
    };

    BUCKET.messages.push(message);
    
    // Keep only last N messages
    if (BUCKET.messages.length > CFG.MAX_MESSAGES) {
      BUCKET.messages = BUCKET.messages.slice(-CFG.MAX_MESSAGES);
    }

    log('📩', username, ':', text.substring(0, 50));

    // Trigger analysis if message is from girl
    if (!isFromUser) {
      resetTimer();
    }

  } catch (e) {
    log('❌ Detection error:', e.message);
  }
};

// ===== WINGMAN ANALYSIS =====
const resetTimer = () => {
  if (!STATE.enabled || !STATE.girlId) return;
  
  clearTimeout(BUCKET.timer);
  BUCKET.timer = setTimeout(requestWingmanHelp, CFG.BUCKET_DELAY);
};

const requestWingmanHelp = async () => {
  if (!STATE.enabled || BUCKET.processing || BUCKET.messages.length === 0) return;
  if (!STATE.conversationId || !STATE.girlId) {
    log('⚠️ Missing conversation data');
    return;
  }

  BUCKET.processing = true;
  clearTimeout(BUCKET.timer);

  const messages = [...BUCKET.messages];
  
  // Show loading state in UI
  if (STATE.panel) {
    const contentDiv = STATE.panel.querySelector('.wingman-content');
    if (contentDiv) {
      contentDiv.classList.add('loading');
      contentDiv.innerHTML = '<div style="padding: 20px; text-align: center;">⏳ Analyzing conversation...</div>';
    }
  }
  
  log('🤔 Requesting Wingman analysis...');

  try {
    const res = await fetch(CFG.EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: STATE.conversationId,
        userId: STATE.userId,
        girlId: STATE.girlId,
        girlName: STATE.girlName,
        recentMessages: messages.map(m => ({
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp
        }))
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const result = await res.json();
    STATE.lastAnalysis = result;
    
    log('✅ Wingman Response:');
    log('📊 Analysis:', result.analysis);
    log('💡 Suggestion:');
    log(`  [${result.suggestion.type}] ${result.suggestion.text}`);
    log(`     → ${result.suggestion.rationale}`);
    log('🎯 Tip:', result.wingman_tip);

    // Remove loading state
    if (STATE.panel) {
      const contentDiv = STATE.panel.querySelector('.wingman-content');
      if (contentDiv) {
        contentDiv.classList.remove('loading');
      }
    }
    
    // Display in UI
    displaySuggestions(result);

  } catch (e) {
    // Remove loading state on error
    if (STATE.panel) {
      const contentDiv = STATE.panel.querySelector('.wingman-content');
      if (contentDiv) {
        contentDiv.classList.remove('loading');
      }
    }
    log('❌ Wingman error:', e.message);
    
    // Show error in UI
    if (STATE.panel) {
      const contentDiv = STATE.panel.querySelector('.wingman-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div class="error-message" style="padding: 20px; text-align: center; color: #ef4444;">
            <strong>⚠️ Error:</strong><br>
            ${escapeHtml(e.message || 'Failed to get suggestions')}<br>
            <button onclick="window.wingman.refresh()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Retry
            </button>
          </div>
        `;
      }
    }
  } finally {
    BUCKET.processing = false;
  }
};

// ===== UI DISPLAY =====
const displaySuggestions = (result) => {
  if (!STATE.panel) return;

  const suggestion = result.suggestion;
  const suggestionHTML = `
    <div class="suggestion" data-index="0">
      <div class="suggestion-header">
        <span class="suggestion-type">${escapeHtml(suggestion.type)}</span>
        <button class="copy-btn" data-text="${escapeHtml(suggestion.text)}">
          📋 Copy
        </button>
      </div>
      <div class="suggestion-text">${escapeHtml(suggestion.text)}</div>
      <div class="suggestion-rationale">${escapeHtml(suggestion.rationale)}</div>
    </div>
  `;

  const contentDiv = STATE.panel.querySelector('.wingman-content');
  if (contentDiv) {
    contentDiv.innerHTML = `
      <div class="analysis">
        <strong>Analysis:</strong>
        <div>• Her vibe: ${escapeHtml(result.analysis.her_last_message_feeling)}</div>
        <div>• Conversation: ${escapeHtml(result.analysis.conversation_vibe)}</div>
        <div>• Next step: ${escapeHtml(result.analysis.recommended_goal)}</div>
      </div>
      <div class="suggestions-container">
        ${suggestionHTML}
      </div>
      <div class="wingman-tip">
        <strong>💡 Tip:</strong> ${escapeHtml(result.wingman_tip)}
      </div>
    `;

    // Add copy button handler
    const copyBtn = contentDiv.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const text = copyBtn.getAttribute('data-text');
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✓ Copied';
          setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
        }).catch(err => {
          log('❌ Copy failed:', err);
        });
      };
    }
  }
};

// HTML escaping helper (improved - handles quotes and special chars)
const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ===== DRAG FUNCTIONALITY =====
const initDrag = () => {
  if (!STATE.panel) return;
  
  const dragHandle = STATE.panel.querySelector('.drag-handle');
  if (!dragHandle) return;

  let startX, startY, initialX, initialY;

  const dragStart = (e) => {
    if (e.button !== 0) return; // Only left mouse button
    
    STATE.isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = STATE.panel.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    STATE.dragOffset.x = startX - initialX;
    STATE.dragOffset.y = startY - initialY;
    
    STATE.panel.style.transition = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    
    e.preventDefault();
  };

  const drag = (e) => {
    if (!STATE.isDragging) return;
    
    e.preventDefault();
    
    const currentX = e.clientX - STATE.dragOffset.x;
    const currentY = e.clientY - STATE.dragOffset.y;
    
    // Keep panel within viewport with safe-area padding
    const maxX = window.innerWidth - STATE.panel.offsetWidth - 20;
    const maxY = window.innerHeight - STATE.panel.offsetHeight - 20;
    const minX = 20;
    const minY = 20;
    
    const constrainedX = Math.max(minX, Math.min(currentX, maxX));
    const constrainedY = Math.max(minY, Math.min(currentY, maxY));
    
    STATE.panel.style.left = constrainedX + 'px';
    STATE.panel.style.top = constrainedY + 'px';
    STATE.panel.style.right = 'auto';
    STATE.panel.style.bottom = 'auto';
  };

  const dragEnd = () => {
    if (!STATE.isDragging) return;
    
    STATE.isDragging = false;
    STATE.panel.style.transition = '';
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Save position
    const rect = STATE.panel.getBoundingClientRect();
    savePanelPosition({ x: rect.left, y: rect.top });
  };

  dragHandle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mouseleave', dragEnd);
  
  // Touch support for mobile
  dragHandle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    dragStart({ clientX: touch.clientX, clientY: touch.clientY, button: 0, preventDefault: () => {} });
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!STATE.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    drag({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
  });
  
  document.addEventListener('touchend', dragEnd);
};

// ===== PANEL POSITION MANAGEMENT =====
const savePanelPosition = async (pos) => {
  const domain = window.location.hostname;
  const key = `${CFG.STORAGE_KEY_POSITION}_${domain}`;
  await storage.set(key, pos);
};

const loadPanelPosition = async () => {
  const domain = window.location.hostname;
  const key = `${CFG.STORAGE_KEY_POSITION}_${domain}`;
  const pos = await storage.get(key);
  return pos || { x: window.innerWidth - 440, y: window.innerHeight - 620 };
};

const savePanelVisibility = async (visible) => {
  STATE.isVisible = visible;
  const domain = window.location.hostname;
  const key = `${CFG.STORAGE_KEY_VISIBLE}_${domain}`;
  await storage.set(key, visible);
};

const loadPanelVisibility = async () => {
  const domain = window.location.hostname;
  const key = `${CFG.STORAGE_KEY_VISIBLE}_${domain}`;
  const visible = await storage.get(key);
  return visible !== false; // Default to visible
};

// ===== PANEL TOGGLE =====
const togglePanel = async () => {
  if (!STATE.panel) return;
  
  const newVisibility = !STATE.isVisible;
  STATE.panel.style.display = newVisibility ? 'flex' : 'none';
  await savePanelVisibility(newVisibility);
  log(newVisibility ? '👁️ Panel shown' : '🙈 Panel hidden');
};

// ===== UI PANEL CREATION =====
const createUI = async () => {
  if (STATE.panel) return;

  const panel = document.createElement('div');
  panel.id = 'wingman-extension-panel';
  panel.className = 'wingman-panel';
  
  // Load saved position and visibility
  const savedPos = await loadPanelPosition();
  const isVisible = await loadPanelVisibility();
  
  panel.style.left = savedPos.x + 'px';
  panel.style.top = savedPos.y + 'px';
  panel.style.display = isVisible ? 'flex' : 'none';
  panel.style.zIndex = CFG.PANEL_Z_INDEX;
  
  STATE.isVisible = isVisible;
  
  panel.innerHTML = `
    <div class="wingman-header">
      <div class="drag-handle" title="Drag to move">⋮⋮</div>
      <h3>💬 Wingman</h3>
      <div class="header-controls">
        <button class="toggle-btn" title="Toggle panel (Ctrl+Shift+W)" aria-label="Toggle panel">−</button>
      </div>
      <span class="wingman-status" id="wingman-status">Inactive</span>
    </div>
    <div class="wingman-content">
      <div class="placeholder">
        Type "wingman/" to activate<br>
        Then chat with someone!
      </div>
    </div>
  `;

  // Toggle button handler
  const toggleBtn = panel.querySelector('.toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag when clicking toggle
      togglePanel();
    });
  }

  document.body.appendChild(panel);
  STATE.panel = panel;
  
  // Initialize drag functionality
  initDrag();
  
  log('✅ Wingman panel created');
};

// ===== UI UPDATE =====
const updateUI = (active) => {
  if (!STATE.panel) return;
  
  const status = STATE.panel.querySelector('#wingman-status');
  if (!status) return;
  
  status.textContent = active ? `Active - ${STATE.username || ''}` : 'Inactive';
  status.className = 'wingman-status' + (active ? ' active' : '');
};

// ===== MESSAGE OBSERVER =====
const startObserver = () => {
  const container = document.querySelector('.message-list-box') || document.body;
  
  // Cleanup existing observer
  if (STATE.observer) {
    STATE.observer.disconnect();
  }
  
  // Process existing messages
  container.querySelectorAll(SEL.msg).forEach(detectMsg);
  
  // Watch for new messages
  STATE.observer = new MutationObserver(mutations => {
    mutations.forEach(mut => {
      mut.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.matches && node.matches(SEL.msg)) {
            detectMsg(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll(SEL.msg).forEach(detectMsg);
          }
        }
      });
    });
  });

  STATE.observer.observe(container, {
    childList: true,
    subtree: true
  });

  log('👁️ Wingman observer started');
};

// ===== SPA NAVIGATION DETECTION =====
let lastPathname = window.location.pathname;

const handleNavigation = () => {
  const currentPathname = window.location.pathname;
  
  if (currentPathname !== lastPathname) {
    log('🔄 Route changed:', lastPathname, '→', currentPathname);
    lastPathname = currentPathname;
    
    // Reset conversation state on route change
    STATE.conversationId = null;
    STATE.girlId = null;
    STATE.girlName = null;
    STATE.enabled = false;
    BUCKET.messages = [];
    STATE.seen.clear();
    
    // Restart observer for new page
    setTimeout(() => {
      startObserver();
      updateUI(false);
    }, 500);
  }
};

// Watch for route changes (SPA navigation)
const watchNavigation = () => {
  // Use MutationObserver to detect URL changes in SPAs
  const navObserver = new MutationObserver(() => {
    handleNavigation();
  });
  
  navObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also watch popstate for browser navigation
  window.addEventListener('popstate', handleNavigation);
  
  // Watch for pushState/replaceState (SPA routing)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(handleNavigation, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(handleNavigation, 100);
  };
};

// Listen for messages from background script (keyboard shortcuts, icon clicks)
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle-panel') {
      togglePanel().then(() => {
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async response
    } else if (request.action === 'get-status') {
      sendResponse({ 
        enabled: STATE.enabled,
        visible: STATE.isVisible,
        conversationId: STATE.conversationId
      });
      return false; // Synchronous response
    }
    return false;
  });
}

// ===== INITIALIZATION =====
const init = async () => {
  log('🚀 Wingman Extension initializing...');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await createUI();
      updateUI(false);
      startObserver();
      watchNavigation();
    });
  } else {
    await createUI();
    updateUI(false);
    startObserver();
    watchNavigation();
  }
  
  // Global helper functions (for console debugging)
  window.wingman = {
    status: () => STATE,
    lastAnalysis: () => STATE.lastAnalysis,
    refresh: () => requestWingmanHelp(),
    toggle: () => togglePanel(),
    help: () => console.log(`
      Wingman Extension Commands:
      - Type "wingman/" in chat to activate
      - Press Ctrl+Shift+W to toggle panel
      - wingman.status() - View current state
      - wingman.lastAnalysis() - See last suggestions
      - wingman.refresh() - Request new analysis
      - wingman.toggle() - Toggle panel visibility
    `)
  };
  
  log('✅ Wingman Extension ready!');
  log('💡 Use wingman.help() for commands');
  log('⌨️ Press Ctrl+Shift+W to toggle panel');
};

// Start initialization
init();


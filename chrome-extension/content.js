// ===== WINGMAN DATING HELPER v1.0 - Chrome Extension ===== //

// Extension context - no IIFE needed
'use strict';

// ===== CONFIGURATION =====
const CFG = {
  EDGE_URL: 'https://opaxtxfxropmjrrqlewh.supabase.co/functions/v1/chat-api-v2',
  BUCKET_DELAY: 3000,      // 3s quiet period after last message
  MIN_API_INTERVAL: 5000,  // 5s minimum between API calls (respects 15 RPM limit)
  MAX_MESSAGES: 10,        // Last 10 messages for context
  DEBUG: true,
  PANEL_Z_INDEX: 2147483647, // Maximum safe z-index
  STORAGE_KEY_POSITION: 'wingman_panel_position',
  STORAGE_KEY_VISIBLE: 'wingman_panel_visible',
  STORAGE_KEY_BOT_ENABLED: 'wingman_bot_enabled'
};

// ===== STATE =====
const STATE = {
  conversationId: null,    // UUID from database
  userId: null,            // Bot owner's platform ID
  girlId: null,            // Current match's platform ID
  girlName: null,          // Current match's display name
  username: null,          // Bot owner's username
  enabled: false,
  botEnabled: false,      // Bot toggle state (from storage)
  seen: new Set(),
  observer: null,
  responses: [],           // Store Wingman responses (newest first, max 10)
  panel: null,             // Panel DOM element
  isVisible: true,         // Panel visibility state
  isDragging: false,       // Drag state
  dragOffset: { x: 0, y: 0 }
};

const BUCKET = {
  messages: [],            // Recent conversation messages
  timer: null,
  processing: false,
  lastApiCall: null,      // Timestamp of last API call for rate limiting
  lastError: null          // Last error for display
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

// ===== AUTO-INITIALIZATION =====
const autoInitialize = async () => {
  if (!STATE.botEnabled) {
    log('⏸️ Bot disabled, skipping initialization');
    return false;
  }

  if (STATE.enabled) {
    log('✅ Already initialized');
    return true;
  }

  // Find user's own message to get platformId and username
  const messages = document.querySelectorAll(SEL.msg);
  let userMessage = null;
  let userData = null;
  let username = null;

  // Look for a message that's likely from the user (not system, not PM mode)
  for (const msg of messages) {
    if (msg.classList.contains('server-notification')) continue;
    if (msg.querySelector('.roleType-1')) continue;
    
    const msgUsername = msg.querySelector(SEL.user)?.textContent.trim();
    const systemUsernames = ['Coffee Notification', 'System', 'Free4Talk', 'Admin', 'Moderator'];
    if (systemUsernames.includes(msgUsername)) continue;

    const data = extractData(msg);
    if (!data) continue;

    // Check if this message is in PM mode (likely user's own message)
    const isPM = msg.classList.contains('pm-mode');
    if (isPM) {
      userMessage = msg;
      userData = data;
      username = msgUsername;
      break;
    }
  }

  // If no PM message found, try to find any recent message (fallback)
  if (!userMessage && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.classList.contains('server-notification')) continue;
      
      const msgUsername = msg.querySelector(SEL.user)?.textContent.trim();
      const systemUsernames = ['Coffee Notification', 'System', 'Free4Talk', 'Admin', 'Moderator'];
      if (systemUsernames.includes(msgUsername)) continue;

      const data = extractData(msg);
      if (data) {
        userMessage = msg;
        userData = data;
        username = msgUsername;
        break;
      }
    }
  }

  if (!userData || !username) {
    log('⚠️ Could not find user message for initialization');
    return false;
  }

  STATE.username = username;
  STATE.userId = userData.platformId;

  // Create/get user profile via /init endpoint
  try {
    const res = await fetch(`${CFG.EDGE_URL}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformId: userData.platformId,
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
    STATE.enabled = true;
    
    log('✅ Wingman initialized for:', username);
    log('📝 Conversation ID:', result.conversationId);
    updateUI(true);
    
    return true;
  } catch (e) {
    log('❌ Init error:', e.message);
    return false;
  }
};

// ===== MESSAGE TYPE DETECTION =====
const detectMessageType = (el, text, username) => {
  // Free4Talk-specific terms
  const free4talkTerms = ['kick', 'follow', 'unfollow', 'owner', 'co-owner', 'moderator', 'room settings', 'permissions'];
  const lowerText = text.toLowerCase();
  
  // Check for Free4Talk terms
  if (free4talkTerms.some(term => lowerText.includes(term))) {
    return 'social';
  }

  // Check if PM mode
  if (el.classList.contains('pm-mode')) {
    return 'pm';
  }

  // Check if message mentions bot owner (simplified - check if username appears)
  if (STATE.username && lowerText.includes(STATE.username.toLowerCase())) {
    return 'mentioned';
  }

  // Check if group chat (multiple participants visible)
  const allMessages = document.querySelectorAll(SEL.msg);
  const uniqueSenders = new Set();
  allMessages.forEach(msg => {
    const msgUser = msg.querySelector(SEL.user)?.textContent.trim();
    if (msgUser && !['Coffee Notification', 'System', 'Free4Talk', 'Admin', 'Moderator'].includes(msgUser)) {
      uniqueSenders.add(msgUser);
    }
  });
  
  if (uniqueSenders.size > 2) {
    return 'group';
  }

  // Default to one_on_one
  return 'one_on_one';
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

    // Detect message type
    const messageType = detectMessageType(el, text, username);
    
    // Skip social messages (Free4Talk system messages)
    if (messageType === 'social') {
      log('⏭️ Skipping social message:', text.substring(0, 50));
      return;
    }

    // Try auto-initialization if not enabled and bot is enabled
    if (!STATE.enabled && STATE.botEnabled) {
      await autoInitialize();
      // Continue processing message even if init failed
    }

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
        // Load person facts for this match
        await loadPersonFacts();
        // Reload profiles (in case new match needs different profile)
        await loadProfiles();
      }
    }

    // Add to conversation history
    const message = {
      sender: isFromUser ? 'user' : 'girl',
      username: username,
      text: text,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : parseInt(data.timestamp) || Date.now(),
      messageId: data.messageId,
      messageType: messageType,
      senderId: data.platformId
    };

    BUCKET.messages.push(message);
    
    // Keep only last N messages
    if (BUCKET.messages.length > CFG.MAX_MESSAGES) {
      BUCKET.messages = BUCKET.messages.slice(-CFG.MAX_MESSAGES);
    }

    log('📩', username, ':', text.substring(0, 50));

    // Trigger analysis if message is from girl (and not a social message)
    if (!isFromUser && messageType !== 'social') {
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

// Actual API call function (separated for rate limiting)
const sendWingmanRequest = async () => {
  if (!STATE.enabled || BUCKET.processing || BUCKET.messages.length === 0) return;
  if (!STATE.conversationId || !STATE.girlId) {
    log('⚠️ Missing conversation data');
    return;
  }

  BUCKET.processing = true;
  clearTimeout(BUCKET.timer);

  const messages = [...BUCKET.messages];
  
  // Show skeleton loader at top (keep existing responses visible)
  displaySuggestions(null); // Pass null to show skeleton while keeping existing responses
  
  log('🤔 Requesting Wingman analysis...');

  try {
    // Get current profile setting
    const currentProfile = await storage.get('wingman_current_profile') || 'auto';
    const autoDetectProfile = currentProfile === 'auto';

    const res = await fetch(CFG.EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: STATE.conversationId,
        userId: STATE.userId,
        girlId: STATE.girlId,
        girlName: STATE.girlName,
        recentMessages: messages.map(m => ({
          sender: m.sender, // Should be 'user' or 'girl'
          senderId: m.senderId,
          text: m.text,
          timestamp: typeof m.timestamp === 'number' ? m.timestamp : parseInt(m.timestamp) || Date.now(),
          messageType: m.messageType
        })),
        profileId: autoDetectProfile ? undefined : (currentProfile !== 'auto' ? currentProfile : undefined),
        autoDetectProfile: autoDetectProfile
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const result = await res.json();
    
    // Store suggestion ID for feedback tracking
    // We'll get this from the stored bot_suggestion after it's saved
    const suggestionId = result.suggestionId || null;
    
    // Add response to array with timestamp (newest first)
    STATE.responses.unshift({ ...result, timestamp: Date.now(), suggestionId });
    // Limit to latest 10 responses
    STATE.responses = STATE.responses.slice(0, 10);
    
    // Update rate limiting timestamp after successful call
    BUCKET.lastApiCall = Date.now();
    
    log('✅ Wingman Response:');
    log('📊 Analysis:', result.analysis);
    log('💡 Suggestion:');
    log(`  [${result.suggestion.type}] ${result.suggestion.text}`);
    log(`     → ${result.suggestion.rationale}`);
    log('🎯 Tip:', result.wingman_tip);

    // Display updated UI with new response
    displaySuggestions(null);

  } catch (e) {
    // Remove skeleton on error and show error message
    log('❌ Wingman error:', e.message);
    
    // Store error for display in finally block
    BUCKET.lastError = e;
  } finally {
    BUCKET.processing = false;
    // Refresh display (skeleton will be removed since processing is false)
    displaySuggestions(null);
    
    // Show error message at top if there was an error
    if (STATE.panel && BUCKET.lastError) {
      const contentDiv = STATE.panel.querySelector('.wingman-content');
      if (contentDiv) {
        // Check if error message already exists
        const existingError = contentDiv.querySelector('.error-message');
        if (!existingError) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.innerHTML = `
            <strong>⚠️ Error:</strong><br>
            ${escapeHtml(BUCKET.lastError.message || 'Failed to get suggestions')}<br>
            <button class="retry-btn" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Retry
            </button>
          `;
          // Insert error at top
          contentDiv.insertBefore(errorDiv, contentDiv.firstChild);
          
          // Attach retry button handler
          const retryBtn = errorDiv.querySelector('.retry-btn');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => {
              errorDiv.remove();
              BUCKET.lastError = null;
              requestWingmanHelp();
            });
          }
        }
      }
      BUCKET.lastError = null; // Clear error after displaying
    }
  }
};

// Rate-limited wrapper that checks minimum interval before sending
const requestWingmanHelp = async () => {
  if (!STATE.enabled || BUCKET.processing || BUCKET.messages.length === 0) return;
  if (!STATE.conversationId || !STATE.girlId) {
    log('⚠️ Missing conversation data');
    return;
  }

  clearTimeout(BUCKET.timer);

  // Check rate limiting: ensure minimum interval between API calls
  const now = Date.now();
  const timeSinceLastCall = BUCKET.lastApiCall ? now - BUCKET.lastApiCall : Infinity;
  
  if (timeSinceLastCall < CFG.MIN_API_INTERVAL) {
    const remainingTime = CFG.MIN_API_INTERVAL - timeSinceLastCall;
    log(`⏳ Rate limiting: waiting ${remainingTime}ms before next API call`);
    
    // Delay the request until minimum interval has passed
    setTimeout(() => {
      sendWingmanRequest();
    }, remainingTime);
    return;
  }

  // Enough time has passed, send immediately
  sendWingmanRequest();
};

// ===== SKELETON LOADER =====
const createSkeletonHTML = () => {
  return `
    <div class="response-card skeleton">
      <div class="analysis skeleton-item">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
      <div class="suggestion skeleton-item">
        <div class="suggestion-header">
          <div class="skeleton-line" style="width: 100px;"></div>
          <div class="skeleton-line" style="width: 60px;"></div>
        </div>
        <div class="skeleton-line" style="width: 90%;"></div>
        <div class="skeleton-line" style="width: 80%;"></div>
        <div class="skeleton-line" style="width: 70%;"></div>
      </div>
    </div>
  `;
};

// ===== UI DISPLAY =====
const displaySuggestions = (result) => {
  if (!STATE.panel) return;

  const contentDiv = STATE.panel.querySelector('.wingman-content');
  if (!contentDiv) return;

  // Show placeholder if no responses and not processing
  if (STATE.responses.length === 0 && !BUCKET.processing) {
    contentDiv.innerHTML = `
      <div class="placeholder">
        Enable bot to start<br>
        Then chat with someone!
      </div>
    `;
    return;
  }

  // Build HTML for all responses
  let html = '';
  
  // Show skeleton at top if processing
  if (BUCKET.processing) {
    html += createSkeletonHTML();
  }

  // Render all responses (newest first)
  STATE.responses.forEach((response, index) => {
    const suggestion = response.suggestion;
    const responseHTML = `
      <div class="response-card" data-index="${index}">
        <div class="analysis">
          <strong>Analysis:</strong>
          <div>• Her vibe: ${escapeHtml(response.analysis.her_last_message_feeling)}</div>
          <div>• Conversation: ${escapeHtml(response.analysis.conversation_vibe)}</div>
          <div>• Next step: ${escapeHtml(response.analysis.recommended_goal)}</div>
        </div>
        <div class="suggestion">
          <div class="suggestion-header">
            <span class="suggestion-type">${escapeHtml(suggestion.type)}</span>
            <div class="suggestion-actions">
              <button class="info-btn" data-tip="${escapeHtml(response.wingman_tip)}" title="Show tip">
                ℹ️
              </button>
              <button class="copy-btn" data-text="${escapeHtml(suggestion.text)}">
                📋 Copy
              </button>
            </div>
          </div>
          <div class="suggestion-text">${escapeHtml(suggestion.text)}</div>
          <div class="suggestion-rationale">${escapeHtml(suggestion.rationale)}</div>
        </div>
      </div>
    `;
    html += responseHTML;
  });

  contentDiv.innerHTML = html;

  // Attach event handlers for all buttons
  contentDiv.querySelectorAll('.copy-btn').forEach((btn, index) => {
    btn.onclick = async () => {
      const text = btn.getAttribute('data-text');
      const responseIndex = parseInt(btn.closest('.response-card')?.getAttribute('data-index') || '0');
      const response = STATE.responses[responseIndex];
      
      // Track suggestion usage
      if (response && STATE.conversationId) {
        try {
          // Get the bot_suggestion_id from the response (we'll need to store it)
          const suggestionId = response.suggestionId || response.id;
          if (suggestionId) {
            await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/feedback-collector`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                botSuggestionId: suggestionId,
                conversationId: STATE.conversationId,
                userSelectedIndex: index,
                userModified: false // User hasn't modified yet
              })
            });
          }
        } catch (e) {
          log('Error tracking suggestion usage:', e);
        }
      }
      
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = '📋 Copy', 2000);
      }).catch(err => {
        log('❌ Copy failed:', err);
      });
    };
  });

  // Attach event handlers for info buttons (tooltip)
  contentDiv.querySelectorAll('.info-btn').forEach(btn => {
    const tip = btn.getAttribute('data-tip');
    let tooltip = null;

    const showTooltip = (e) => {
      e.stopPropagation();
      if (tooltip) return; // Already showing

      tooltip = document.createElement('div');
      tooltip.className = 'tip-tooltip';
      tooltip.textContent = tip;
      document.body.appendChild(tooltip);

      const rect = btn.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';

      // Adjust if tooltip goes off screen
      if (tooltip.offsetLeft < 10) {
        tooltip.style.left = '10px';
      }
      if (tooltip.offsetTop < 10) {
        tooltip.style.top = (rect.bottom + 8) + 'px';
      }
    };

    const hideTooltip = () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    };

    btn.addEventListener('mouseenter', showTooltip);
    btn.addEventListener('mouseleave', hideTooltip);
    btn.addEventListener('click', (e) => {
      if (tooltip) {
        hideTooltip();
      } else {
        showTooltip(e);
      }
    });

    // Hide tooltip when clicking outside
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && (!tooltip || !tooltip.contains(e.target))) {
        hideTooltip();
      }
    });
  });
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

// ===== BOT TOGGLE =====
const toggleBot = async () => {
  STATE.botEnabled = !STATE.botEnabled;
  await storage.set(CFG.STORAGE_KEY_BOT_ENABLED, STATE.botEnabled);
  
  // Update UI
  const botToggleBtn = STATE.panel?.querySelector('#bot-toggle-btn');
  if (botToggleBtn) {
    const icon = botToggleBtn.querySelector('.bot-toggle-icon');
    const text = botToggleBtn.querySelector('.bot-toggle-text');
    if (icon && text) {
      icon.textContent = STATE.botEnabled ? '🟢' : '🔴';
      text.textContent = STATE.botEnabled ? 'ON' : 'OFF';
      botToggleBtn.classList.toggle('bot-enabled', STATE.botEnabled);
      botToggleBtn.classList.toggle('bot-disabled', !STATE.botEnabled);
    }
  }
  
  if (STATE.botEnabled) {
    log('✅ Bot enabled');
    // Try to initialize if not already initialized
    if (!STATE.enabled) {
      await autoInitialize();
    }
  } else {
    log('⏸️ Bot disabled');
    STATE.enabled = false;
    updateUI(false);
  }
};

// ===== SETTINGS TOGGLE =====
const toggleSettings = () => {
  if (!STATE.panel) return;
  
  const settingsPanel = STATE.panel.querySelector('#wingman-settings');
  const contentPanel = STATE.panel.querySelector('#wingman-content');
  if (!settingsPanel || !contentPanel) return;
  
  const isVisible = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = isVisible ? 'none' : 'block';
  contentPanel.style.display = isVisible ? 'flex' : 'none';
  
  log(isVisible ? '⚙️ Settings hidden' : '⚙️ Settings shown');
};

// ===== INITIALIZE SETTINGS HANDLERS =====
const initSettingsHandlers = async () => {
  if (!STATE.panel) return;

  // Load settings from storage
  const theme = await storage.get('wingman_theme') || 'light';
  const panelSize = await storage.get('wingman_panel_size') || 420;
  const fontSize = await storage.get('wingman_font_size') || 14;
  const bucketDelay = await storage.get('wingman_bucket_delay') || 3000;

  // Theme selector
  const themeSelector = STATE.panel.querySelector('#theme-selector');
  if (themeSelector) {
    themeSelector.value = theme;
    themeSelector.addEventListener('change', async (e) => {
      const newTheme = e.target.value;
      await storage.set('wingman_theme', newTheme);
      applyTheme(newTheme);
    });
    applyTheme(theme);
  }

  // Panel size slider
  const panelSizeSlider = STATE.panel.querySelector('#panel-size-slider');
  const panelSizeValue = STATE.panel.querySelector('#panel-size-value');
  if (panelSizeSlider && panelSizeValue) {
    panelSizeSlider.value = panelSize;
    panelSizeValue.textContent = `${panelSize}px`;
    panelSizeSlider.addEventListener('input', async (e) => {
      const size = parseInt(e.target.value);
      panelSizeValue.textContent = `${size}px`;
      STATE.panel.style.width = `${size}px`;
      await storage.set('wingman_panel_size', size);
    });
    STATE.panel.style.width = `${panelSize}px`;
  }

  // Font size slider
  const fontSizeSlider = STATE.panel.querySelector('#font-size-slider');
  const fontSizeValue = STATE.panel.querySelector('#font-size-value');
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.value = fontSize;
    fontSizeValue.textContent = `${fontSize}px`;
    fontSizeSlider.addEventListener('input', async (e) => {
      const size = parseInt(e.target.value);
      fontSizeValue.textContent = `${size}px`;
      document.documentElement.style.setProperty('--wingman-font-size', `${size}px`);
      await storage.set('wingman_font_size', size);
    });
    document.documentElement.style.setProperty('--wingman-font-size', `${fontSize}px`);
  }

  // Bucket delay input
  const bucketDelayInput = STATE.panel.querySelector('#bucket-delay-input');
  if (bucketDelayInput) {
    bucketDelayInput.value = bucketDelay;
    bucketDelayInput.addEventListener('change', async (e) => {
      const delay = parseInt(e.target.value);
      CFG.BUCKET_DELAY = delay;
      await storage.set('wingman_bucket_delay', delay);
    });
  }

  // Person facts handlers
  const addFactBtn = STATE.panel.querySelector('#add-fact-btn');
  const newFactInput = STATE.panel.querySelector('#new-fact-input');
  if (addFactBtn && newFactInput) {
    addFactBtn.addEventListener('click', async () => {
      const factText = newFactInput.value.trim();
      if (factText && STATE.girlId) {
        await addPersonFact(factText);
        newFactInput.value = '';
      }
    });
    newFactInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const factText = newFactInput.value.trim();
        if (factText && STATE.girlId) {
          await addPersonFact(factText);
          newFactInput.value = '';
        }
      }
    });
  }

  // Profile selector - load profiles
  const profileSelector = STATE.panel.querySelector('#profile-selector');
  if (profileSelector) {
    await loadProfiles();
    profileSelector.addEventListener('change', async (e) => {
      const profileId = e.target.value;
      await storage.set('wingman_current_profile', profileId);
      log('Profile changed to:', profileId);
    });
  }

  // Auto personality generator
  const generatePersonaBtn = STATE.panel.querySelector('#generate-persona-btn');
  const personaExamplesInput = STATE.panel.querySelector('#persona-examples-input');
  const generatedPersonaDiv = STATE.panel.querySelector('#generated-persona');
  const generatedPersonaText = STATE.panel.querySelector('#generated-persona-text');
  const savePersonaBtn = STATE.panel.querySelector('#save-persona-btn');

  if (generatePersonaBtn && personaExamplesInput && generatedPersonaDiv && generatedPersonaText && savePersonaBtn) {
    generatePersonaBtn.addEventListener('click', async () => {
      const examples = personaExamplesInput.value.trim();
      if (!examples) {
        alert('Please paste example messages first');
        return;
      }

      generatePersonaBtn.disabled = true;
      generatePersonaBtn.textContent = 'Generating...';

      try {
        const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/generate-persona`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examples })
        });

        if (res.ok) {
          const result = await res.json();
          generatedPersonaText.textContent = result.persona;
          generatedPersonaDiv.style.display = 'block';
          log('Persona generated successfully');
        } else {
          throw new Error('Failed to generate persona');
        }
      } catch (e) {
        log('Error generating persona:', e);
        alert('Failed to generate persona. Please try again.');
      } finally {
        generatePersonaBtn.disabled = false;
        generatePersonaBtn.textContent = 'Generate Persona';
      }
    });

    savePersonaBtn.addEventListener('click', async () => {
      const personaText = generatedPersonaText.textContent;
      if (!personaText || !STATE.userId) {
        alert('No persona to save or user not initialized');
        return;
      }

      try {
        const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/bot-persona`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botUserId: STATE.userId,
            personaPrompt: personaText,
            reason: 'auto_generated'
          })
        });

        if (res.ok) {
          alert('Persona saved successfully!');
          generatedPersonaDiv.style.display = 'none';
          personaExamplesInput.value = '';
        } else {
          throw new Error('Failed to save persona');
        }
      } catch (e) {
        log('Error saving persona:', e);
        alert('Failed to save persona. Please try again.');
      }
    });
  }
};

// ===== LOAD PROFILES =====
const loadProfiles = async () => {
  if (!STATE.userId || !STATE.panel) return;

  const profileSelector = STATE.panel.querySelector('#profile-selector');
  if (!profileSelector) return;

  try {
    const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/wingman-profiles?botUserId=${STATE.userId}`);
    if (res.ok) {
      const data = await res.json();
      const profiles = data.profiles || [];
      
      // Clear existing options except "Auto"
      profileSelector.innerHTML = '<option value="auto">Auto (ML Detection)</option>';
      
      // Add profile options
      profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.profile_name + (profile.is_default ? ' (Default)' : '');
        profileSelector.appendChild(option);
      });

      // Load saved profile
      const savedProfile = await storage.get('wingman_current_profile') || 'auto';
      profileSelector.value = savedProfile;
    }
  } catch (e) {
    log('Error loading profiles:', e);
  }
};

// ===== APPLY THEME =====
const applyTheme = (theme) => {
  if (!STATE.panel) return;
  STATE.panel.classList.toggle('theme-dark', theme === 'dark');
  STATE.panel.classList.toggle('theme-light', theme === 'light');
};

// ===== PERSON FACTS MANAGEMENT =====
const loadPersonFacts = async () => {
  if (!STATE.girlId || !STATE.userId) return;
  
  try {
    const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/person-facts?botUserId=${STATE.userId}&matchUserId=${STATE.girlId}`);
    if (res.ok) {
      const facts = await res.json();
      displayPersonFacts(facts);
    }
  } catch (e) {
    log('Error loading person facts:', e);
  }
};

const displayPersonFacts = (facts) => {
  const factsList = STATE.panel?.querySelector('#person-facts-list');
  if (!factsList) return;

  if (!facts || facts.length === 0) {
    factsList.innerHTML = '<div class="no-facts">No facts yet. Add one above!</div>';
    return;
  }

  factsList.innerHTML = facts.map((fact, idx) => `
    <div class="person-fact-item" data-fact-id="${fact.id}">
      <span class="fact-text">${escapeHtml(fact.fact_text)}</span>
      <button class="fact-delete-btn" data-fact-id="${fact.id}">✕</button>
    </div>
  `).join('');

  // Add delete handlers
  factsList.querySelectorAll('.fact-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const factId = btn.getAttribute('data-fact-id');
      await deletePersonFact(factId);
    });
  });
};

const addPersonFact = async (factText) => {
  if (!STATE.girlId || !STATE.userId) {
    log('Cannot add fact: missing user/match IDs');
    return;
  }

  try {
    const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/person-facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_user_id: STATE.userId,
        match_user_id: STATE.girlId,
        fact_text: factText,
        source: 'manual'
      })
    });

    if (res.ok) {
      await loadPersonFacts();
      log('Fact added:', factText);
    }
  } catch (e) {
    log('Error adding fact:', e);
  }
};

const deletePersonFact = async (factId) => {
  try {
    const res = await fetch(`${CFG.EDGE_URL.replace('/chat-api-v2', '')}/person-facts/${factId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadPersonFacts();
      log('Fact deleted');
    }
  } catch (e) {
    log('Error deleting fact:', e);
  }
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
        <button class="bot-toggle-btn" id="bot-toggle-btn" title="Toggle bot" aria-label="Toggle bot">
          <span class="bot-toggle-icon">🟢</span>
          <span class="bot-toggle-text">ON</span>
        </button>
        <button class="settings-toggle-btn" id="settings-toggle-btn" title="Settings" aria-label="Settings">⚙️</button>
        <button class="toggle-btn" title="Toggle panel (Ctrl+Shift+W)" aria-label="Toggle panel">−</button>
      </div>
      <span class="wingman-status" id="wingman-status">Inactive</span>
    </div>
    <div class="wingman-settings" id="wingman-settings" style="display: none;">
      <div class="settings-content">
        <div class="settings-section">
          <h4>General</h4>
          <div class="settings-item">
            <label>Profile:</label>
            <select id="profile-selector" class="settings-input">
              <option value="auto">Auto (ML Detection)</option>
            </select>
          </div>
        </div>
        <div class="settings-section">
          <h4>Appearance</h4>
          <div class="settings-item">
            <label>Theme:</label>
            <select id="theme-selector" class="settings-input">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div class="settings-item">
            <label>Panel Size:</label>
            <input type="range" id="panel-size-slider" class="settings-slider" min="320" max="600" value="420" step="20">
            <span id="panel-size-value" class="settings-value">420px</span>
          </div>
          <div class="settings-item">
            <label>Font Size:</label>
            <input type="range" id="font-size-slider" class="settings-slider" min="12" max="18" value="14" step="1">
            <span id="font-size-value" class="settings-value">14px</span>
          </div>
        </div>
        <div class="settings-section">
          <h4>Person Facts</h4>
          <div id="person-facts-container" class="person-facts-container">
            <div class="person-facts-list" id="person-facts-list"></div>
            <div class="person-facts-add">
              <input type="text" id="new-fact-input" class="settings-input" placeholder="Add fact about current match...">
              <button id="add-fact-btn" class="settings-btn">Add</button>
            </div>
          </div>
        </div>
        <div class="settings-section">
          <h4>Advanced</h4>
          <div class="settings-item">
            <label>Analysis Frequency (ms):</label>
            <input type="number" id="bucket-delay-input" class="settings-input" min="1000" max="10000" value="3000" step="500">
          </div>
          <div class="settings-item">
            <label>Auto Personality Generator:</label>
            <textarea id="persona-examples-input" class="settings-input" rows="4" placeholder="Paste example messages here to generate a persona..."></textarea>
            <button id="generate-persona-btn" class="settings-btn" style="margin-top: 8px;">Generate Persona</button>
            <div id="generated-persona" style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; display: none;">
              <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 4px;">Generated Persona:</div>
              <div id="generated-persona-text" style="font-size: 12px; color: rgba(255,255,255,0.9); white-space: pre-wrap;"></div>
              <button id="save-persona-btn" class="settings-btn" style="margin-top: 8px; width: 100%;">Save Persona</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="wingman-content" id="wingman-content">
      <div class="placeholder">
        Enable bot to start<br>
        Then chat with someone!
      </div>
    </div>
  `;

  // Bot toggle button handler
  const botToggleBtn = panel.querySelector('#bot-toggle-btn');
  if (botToggleBtn) {
    botToggleBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent drag when clicking toggle
      await toggleBot();
    });
  }

  // Settings toggle button handler
  const settingsToggleBtn = panel.querySelector('#settings-toggle-btn');
  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettings();
    });
  }

  // Panel toggle button handler
  const toggleBtn = panel.querySelector('.toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag when clicking toggle
      togglePanel();
    });
  }

  // Initialize settings handlers
  initSettingsHandlers();

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
  
  // Load bot enabled state from storage
  STATE.botEnabled = await storage.get(CFG.STORAGE_KEY_BOT_ENABLED) ?? false;
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await createUI();
      updateBotToggleUI();
      updateUI(false);
      startObserver();
      watchNavigation();
      // Auto-initialize if bot is enabled
      if (STATE.botEnabled) {
        setTimeout(() => autoInitialize(), 1000);
      }
    });
  } else {
    await createUI();
    updateBotToggleUI();
    updateUI(false);
    startObserver();
    watchNavigation();
    // Auto-initialize if bot is enabled
    if (STATE.botEnabled) {
      setTimeout(() => autoInitialize(), 1000);
    }
  }
  
  // Global helper functions (for console debugging)
  window.wingman = {
    status: () => STATE,
    responses: () => STATE.responses,
    refresh: () => requestWingmanHelp(),
    toggle: () => togglePanel(),
    toggleBot: () => toggleBot(),
    help: () => console.log(`
      Wingman Extension Commands:
      - Click bot toggle button to enable/disable
      - Press Ctrl+Shift+W to toggle panel
      - wingman.status() - View current state
      - wingman.responses() - See all responses
      - wingman.refresh() - Request new analysis
      - wingman.toggle() - Toggle panel visibility
      - wingman.toggleBot() - Toggle bot on/off
    `)
  };
  
  log('✅ Wingman Extension ready!');
  log('💡 Use wingman.help() for commands');
  log('⌨️ Press Ctrl+Shift+W to toggle panel');
};

// ===== UPDATE BOT TOGGLE UI =====
const updateBotToggleUI = () => {
  if (!STATE.panel) return;
  
  const botToggleBtn = STATE.panel.querySelector('#bot-toggle-btn');
  if (botToggleBtn) {
    const icon = botToggleBtn.querySelector('.bot-toggle-icon');
    const text = botToggleBtn.querySelector('.bot-toggle-text');
    if (icon && text) {
      icon.textContent = STATE.botEnabled ? '🟢' : '🔴';
      text.textContent = STATE.botEnabled ? 'ON' : 'OFF';
      botToggleBtn.classList.toggle('bot-enabled', STATE.botEnabled);
      botToggleBtn.classList.toggle('bot-disabled', !STATE.botEnabled);
    }
  }
};

// Start initialization
init();


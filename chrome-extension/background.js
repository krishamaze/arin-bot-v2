// ===== WINGMAN EXTENSION - Background Service Worker ===== //

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') {
    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-panel' }).catch(() => {
          // Ignore errors if content script isn't loaded
        });
      }
    });
  }
});

// Handle extension icon click (toggle panel)
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggle-panel' }).catch(() => {
    // Ignore errors if content script isn't loaded
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    console.log('[Wingman Background]', request.message);
    sendResponse({ success: true });
  }
  return true;
});

// Clean up on extension uninstall (optional)
chrome.runtime.setUninstallURL('https://example.com/uninstall-survey', () => {
  // Optional: Track uninstalls
});


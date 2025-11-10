# Wingman Dating Helper - Chrome Extension

A Chrome extension that provides AI-powered dating chat assistance for Free4Talk conversations.

## Features

- 🤖 **AI-Powered Suggestions**: Get personalized reply suggestions based on conversation context
- 💬 **Floating UI Panel**: Draggable, persistent panel that stays on top
- ⌨️ **Keyboard Shortcuts**: Toggle panel with `Ctrl+Shift+W` (or `Cmd+Shift+W` on Mac)
- 💾 **Persistent State**: Remembers panel position and visibility per domain
- 📱 **Mobile-Friendly**: Responsive design with touch support
- 🔄 **SPA Navigation**: Automatically handles single-page app route changes
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Installation

### Development

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder
6. The extension is now installed and active!

### Icons

You'll need to create icon files in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use any image editor or online tool to create these icons.

## Usage

1. Navigate to https://www.free4talk.com
2. The Wingman panel will appear in the bottom-right corner
3. Type `wingman/` in the chat to activate
4. Start chatting with someone
5. When they reply, Wingman will analyze and suggest responses
6. Click "📋 Copy" on any suggestion to copy it to clipboard
7. Press `Ctrl+Shift+W` to toggle panel visibility

## Keyboard Shortcuts

- `Ctrl+Shift+W` (Windows/Linux) or `Cmd+Shift+W` (Mac): Toggle panel visibility

## Console Commands

Open the browser console (F12) and use these commands:

- `wingman.status()` - View current state
- `wingman.lastAnalysis()` - See last suggestions
- `wingman.refresh()` - Request new analysis
- `wingman.toggle()` - Toggle panel visibility
- `wingman.help()` - Show all commands

## Architecture

### Files

- `manifest.json` - Extension configuration
- `content.js` - Main content script (injected into Free4Talk pages)
- `background.js` - Service worker for keyboard shortcuts and icon clicks
- `floating-ui.css` - Styles for the floating panel
- `icons/` - Extension icons

### Key Features

1. **Content Script**: Runs on Free4Talk pages, handles message detection and UI
2. **Background Worker**: Handles keyboard shortcuts and extension icon clicks
3. **Chrome Storage**: Persists panel position and visibility per domain
4. **SPA Navigation**: Detects route changes and resets state appropriately
5. **Drag & Drop**: Full drag support with viewport constraints

## Development

### Making Changes

1. Edit files in `chrome-extension/`
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the Free4Talk page to see changes

### Debugging

- Open browser console (F12) to see Wingman logs
- Check `chrome://extensions/` for service worker errors
- Use `wingman.status()` in console to inspect state

## Permissions

- `storage`: Save panel position and preferences
- `activeTab`: Access current tab for content script injection
- `host_permissions`: Access Free4Talk and Supabase API

## Privacy

- All data is stored locally in Chrome storage
- No data is sent to third parties except the Wingman API
- Conversation analysis is sent to the Supabase Edge Function
- No tracking or analytics

## Troubleshooting

### Panel not appearing
- Check that you're on a Free4Talk page
- Reload the page after installing the extension
- Check console for errors (F12)

### Suggestions not generating
- Make sure you've typed `wingman/` to activate
- Check that you've received a message from someone
- Verify network connection to Supabase API

### Panel position resetting
- Check Chrome storage permissions
- Clear extension data and reload

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.


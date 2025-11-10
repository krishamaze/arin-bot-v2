# Installation Guide

## Quick Start

1. **Download/Clone** this repository
2. **Create Icons** (see `icons/README.md`)
3. **Load Extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
4. **Visit Free4Talk** and start using Wingman!

## Step-by-Step

### 1. Prepare Icons

You need three icon files in the `icons/` folder:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

See `icons/README.md` for creation instructions.

### 2. Load Extension

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Toggle "Developer mode" (top-right corner)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder
6. The extension should now appear in your extensions list

### 3. Verify Installation

1. Check that the extension is enabled
2. Look for the Wingman icon in your Chrome toolbar
3. Navigate to https://www.free4talk.com
4. You should see the Wingman panel in the bottom-right corner

### 4. First Use

1. Type `wingman/` in the chat to activate
2. Start a conversation with someone
3. When they reply, Wingman will analyze and suggest responses
4. Click "📋 Copy" to copy suggestions
5. Press `Ctrl+Shift+W` to toggle the panel

## Troubleshooting

### Extension Not Loading

- Make sure all files are in the `chrome-extension` folder
- Check that `manifest.json` is valid JSON
- Verify icons exist in `icons/` folder
- Check console for errors (F12)

### Panel Not Appearing

- Reload the Free4Talk page
- Check browser console for errors
- Verify extension is enabled in `chrome://extensions/`
- Try toggling the panel with `Ctrl+Shift+W`

### Icons Missing

- Create placeholder icons (see `icons/README.md`)
- Or use a simple colored square as temporary icon
- Extension will work without icons, but Chrome will show a default icon

## Development Mode

When developing:

1. Make changes to files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the Free4Talk page
5. Changes should be reflected immediately

## Updating

To update the extension:

1. Pull latest changes (if using git)
2. Go to `chrome://extensions/`
3. Click refresh on the extension card
4. Reload Free4Talk page

No need to reload the extension if files change - just refresh the extension card.

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Wingman Dating Helper"
3. Click "Remove"
4. Confirm removal

All stored data (panel positions, preferences) will be deleted.


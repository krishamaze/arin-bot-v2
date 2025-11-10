# Extension Structure

## File Overview

```
chrome-extension/
├── manifest.json          # Extension configuration (MV3)
├── content.js            # Main content script (injected into Free4Talk)
├── background.js         # Service worker (keyboard shortcuts, icon clicks)
├── floating-ui.css       # Styles for the floating panel
├── README.md             # Main documentation
├── INSTALL.md            # Installation instructions
├── STRUCTURE.md          # This file
├── .gitignore           # Git ignore rules
└── icons/               # Extension icons
    ├── README.md        # Icon creation guide
    ├── icon16.png       # 16x16 toolbar icon
    ├── icon48.png       # 48x48 management page icon
    └── icon128.png      # 128x128 store icon
```

## Key Components

### manifest.json
- Defines extension permissions and configuration
- Sets up content script injection
- Configures keyboard shortcuts (`Ctrl+Shift+W`)
- Defines background service worker

### content.js
- Main extension logic (converted from console script)
- Message detection and analysis
- UI panel creation and management
- Drag and drop functionality
- SPA navigation handling
- Chrome storage integration

### background.js
- Handles keyboard shortcuts
- Responds to extension icon clicks
- Message routing between components

### floating-ui.css
- Panel styling with gradient design
- Mobile-responsive layouts
- Safe-area padding for mobile devices
- Drag handle and button styles
- Scrollbar customization

## Key Features

### 1. Draggable Panel
- Visible drag handle (⋮⋮)
- Viewport constraints (stays within screen)
- Touch support for mobile
- Position persistence per domain

### 2. Persistent State
- Panel position saved per domain
- Visibility state saved per domain
- Uses `chrome.storage.local`
- Survives page reloads

### 3. SPA Navigation
- Detects route changes
- Resets conversation state
- Restarts message observer
- Handles pushState/replaceState

### 4. Keyboard Shortcuts
- `Ctrl+Shift+W` (Windows/Linux)
- `Cmd+Shift+W` (Mac)
- Toggles panel visibility
- Handled by background worker

### 5. Mobile Support
- Touch drag support
- Responsive design
- Safe-area padding
- Mobile-friendly touch targets

### 6. Z-Index Safety
- Uses maximum safe z-index (2147483647)
- Stays on top of all page elements
- Prevents conflicts with page styles

## Data Flow

```
User Action → Content Script → API Request → Response → UI Update
     ↓
Chrome Storage (position, visibility)
     ↓
Background Worker (shortcuts, icon clicks)
```

## State Management

### Global State (STATE object)
- `conversationId`: Current conversation UUID
- `userId`: Bot owner's platform ID
- `girlId`: Current match's platform ID
- `girlName`: Current match's display name
- `enabled`: Activation status
- `panel`: DOM reference to panel
- `isVisible`: Panel visibility state
- `isDragging`: Drag state

### Chrome Storage
- `wingman_panel_position_{domain}`: Panel position
- `wingman_panel_visible_{domain}`: Panel visibility

## Message Flow

### Background → Content
- `toggle-panel`: Toggle panel visibility
- `get-status`: Get current state

### Content → Background
- Log messages (optional)
- Status updates (optional)

## Security Considerations

1. **Content Security Policy**: Extension runs in isolated context
2. **Permissions**: Minimal permissions (storage, activeTab)
3. **Host Permissions**: Only Free4Talk and Supabase API
4. **Data Storage**: Local only, no external tracking
5. **XSS Protection**: HTML escaping in `escapeHtml()` function

## Performance

1. **Lazy Loading**: Observer only watches message container
2. **Debouncing**: 5-second delay before analysis
3. **Message Limits**: Only last 10 messages for context
4. **Cache Management**: Seen messages Set limited to 1000
5. **Efficient DOM**: Minimal re-renders, targeted updates

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
- Opera 74+ (Chromium-based)
- Not compatible with Firefox (different manifest format)

## Development Workflow

1. Edit files in `chrome-extension/`
2. Go to `chrome://extensions/`
3. Click refresh on extension card
4. Reload Free4Talk page
5. Test changes

## Deployment

1. Create icons (16, 48, 128px)
2. Test on Free4Talk
3. Package extension (optional)
4. Submit to Chrome Web Store (optional)
5. Or distribute as unpacked extension

## Future Enhancements

- [ ] Settings page (popup or options page)
- [ ] Multiple conversation support
- [ ] Export conversation history
- [ ] Customizable keyboard shortcuts
- [ ] Theme customization
- [ ] Analytics (opt-in)
- [ ] Offline mode
- [ ] Multi-language support


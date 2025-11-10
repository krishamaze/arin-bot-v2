# Extension Icons

Place your extension icons in this directory:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

You can create icons using any image editor or online tool. Recommended tools:

1. **Online**: [Favicon Generator](https://www.favicon-generator.org/)
2. **Online**: [Canva](https://www.canva.com/)
3. **Local**: GIMP, Photoshop, or any image editor

## Icon Design Tips

- Use a simple, recognizable design
- Ensure icons are clear at small sizes (16px)
- Use high contrast colors
- Consider a gradient or solid color background
- Add the Wingman logo/emoji (💬) if desired

## Quick Placeholder

If you need placeholder icons quickly, you can:

1. Create a simple colored square (e.g., purple gradient matching the UI)
2. Add text "WM" or emoji "💬" in the center
3. Export at all three sizes (16, 48, 128)

## Example Command (ImageMagick)

If you have ImageMagick installed:

```bash
# Create a simple gradient icon
convert -size 128x128 gradient:#667eea-#764ba2 icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

Or use an online service to generate icons from a single image.


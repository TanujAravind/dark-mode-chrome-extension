# Media-Safe Dark Mode

A lightweight Chrome extension (Manifest V3) that applies dark mode to websites **without inverting images, videos, canvases, or other visual media**.

## Features

- Smart dark mode that darkens backgrounds and text while preserving readability
- Media-safe: images, videos, canvases, iframes and SVG graphics are never inverted or filtered
- Per-site toggle — enable or disable dark mode for individual domains
- Global toggle — turn the extension on or off entirely
- Auto-detection: skips sites that are already dark
- MutationObserver support for dynamically loaded content (SPAs, infinite scroll, etc.)
- SPA navigation detection via polling `location.href`

## Project structure

```
dark-mode-chrome-extension/
├── manifest.json       # MV3 manifest
├── background.js       # Service worker: storage defaults + message relay
├── content.js          # Injected into every page: dark mode logic
├── popup.html          # Extension popup
├── popup.js            # Popup interactivity
├── popup.css           # Popup styles
├── icons/              # Extension icons (16, 48, 128px)
└── README.md
```

## How it works

### CSS base layer
A stylesheet (`content.js` → `BASE_CSS`) is injected and scoped under `html.msdm-dark`. It handles common patterns:
- Root/body backgrounds → `#121212`
- Form inputs, buttons, tables, code blocks → dark equivalents
- Links → readable blue/purple
- Media elements (`img`, `video`, `canvas`, `iframe`, etc.) get `filter: none !important` to prevent accidental inversion from any ancestor filter

### DOM transformation layer
After injecting the stylesheet, `content.js` walks the DOM with a `TreeWalker` and inspects each element's **computed styles**:
- Light backgrounds → converted to dark surfaces (hue-preserving dimming)
- Near-black text on dark backgrounds → lightened for readability
- Light borders → converted to subtle dark borders
- Elements with `background-image` are skipped entirely
- SVG subtrees, media tags, and iframes are skipped

### MutationObserver
New DOM nodes (from SPAs, lazy loading, etc.) are transformed as they arrive.

## Installing locally

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder

## Customizing

- **Dark threshold**: adjust `LIGHT_THRESHOLD` in `content.js` (default `0.5` relative luminance)
- **Dark surface colour**: modify `darkenBackground()` in `content.js`
- **Base CSS**: edit `BASE_CSS` in `content.js` to override specific selectors
- **Storage**: preferences are stored in `chrome.storage.sync` under `globalEnabled` (boolean) and `sitePrefs` (hostname → boolean map)

## Limitations

- Cross-origin iframes cannot be styled (browser security restriction)
- Very aggressive inline styles on a page may override the extension's changes
- Sites that use canvas for rendering (web apps, games) will not be darkened beyond the page chrome
- Some complex CSS frameworks may need additional selector overrides in `BASE_CSS`

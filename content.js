/**
 * Media-Safe Dark Mode — content script
 *
 * Strategy:
 *   1. Inject a base stylesheet that handles the bulk of common patterns via CSS.
 *   2. Walk the DOM and restyle elements whose computed background/text colors
 *      are too light, converting them to dark equivalents.
 *   3. Explicitly skip media elements (img, video, canvas, svg graphics, etc.)
 *      and elements with background-image so they stay untouched.
 *   4. Watch for new nodes via MutationObserver and handle SPA navigation.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const STYLE_ID = "msdm-styles";
const PROCESSED_ATTR = "data-msdm";
const DARK_CLASS = "msdm-dark";

// Luminance threshold: values above this are considered "light"
const LIGHT_THRESHOLD = 0.5;

// Elements that should never be color-transformed
const SKIP_TAGS = new Set([
  "IMG", "IMAGE", "VIDEO", "AUDIO", "CANVAS", "PICTURE", "IFRAME",
  "OBJECT", "EMBED", "MAP", "AREA", "TRACK",
]);

// CSS selector for the base stylesheet to exclude from filter
const MEDIA_SAFE_EXCLUSIONS = `
  img, video, canvas, picture, iframe, object, embed,
  [data-msdm-skip],
  .msdm-skip
`;

// ─── Color utilities ──────────────────────────────────────────────────────────

function parseColor(str) {
  if (!str || str === "transparent" || str === "inherit" || str === "initial") {
    return null;
  }
  // rgb(a) format
  const m = str.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/);
  if (m) {
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1,
    };
  }
  return null;
}

function linearize(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function isLight(color) {
  if (!color) return false;
  if (color.a < 0.1) return false; // fully transparent – ignore
  return relativeLuminance(color) > LIGHT_THRESHOLD;
}

function isDark(color) {
  if (!color) return false;
  if (color.a < 0.1) return false;
  return relativeLuminance(color) < 0.05;
}

// Darken a light background colour toward a dark surface
function darkenBackground({ r, g, b, a }) {
  // Desaturate and bring down to a dark surface
  const lum = relativeLuminance({ r, g, b });
  // Preserve a hint of the original hue
  const factor = 0.08 + (lum * 0.05);
  return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${a})`;
}

// Lighten a near-black text colour for readability on dark backgrounds
function lightenText({ r, g, b, a }) {
  const lum = relativeLuminance({ r, g, b });
  if (lum > 0.7) return null; // already light, leave alone
  // Push toward a light grey
  const base = 220;
  const blend = 0.15;
  return `rgba(${Math.round(r * blend + base * (1 - blend))}, ${Math.round(g * blend + base * (1 - blend))}, ${Math.round(b * blend + base * (1 - blend))}, ${a})`;
}

function adjustBorderColor({ r, g, b, a }) {
  // Make light borders subtly visible on dark backgrounds
  const lum = relativeLuminance({ r, g, b });
  if (lum < 0.3) return null; // already dark enough
  return `rgba(80, 80, 90, ${a})`;
}

// ─── Page dark-mode detection ─────────────────────────────────────────────────

function pageIsAlreadyDark() {
  const body = document.body;
  if (!body) return false;
  const bg = parseColor(getComputedStyle(body).backgroundColor);
  const html = parseColor(getComputedStyle(document.documentElement).backgroundColor);
  // If either the <html> or <body> bg is dark, assume the site is already dark
  for (const c of [bg, html]) {
    if (c && c.a > 0.5 && relativeLuminance(c) < 0.1) return true;
  }
  // Check meta color-scheme
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta && /dark/.test(meta.content)) return true;
  // Check prefers-color-scheme media in existing stylesheets (heuristic: class names)
  if (document.documentElement.classList.contains("dark") ||
      document.documentElement.dataset.theme === "dark" ||
      document.documentElement.dataset.colorScheme === "dark") return true;
  return false;
}

// ─── Base stylesheet ──────────────────────────────────────────────────────────

const BASE_CSS = `
/* ── Media-Safe Dark Mode base styles ── */

html.${DARK_CLASS} {
  color-scheme: dark;
}

/* Root surfaces */
html.${DARK_CLASS},
html.${DARK_CLASS} body {
  background-color: #121212 !important;
  color: #e0e0e0 !important;
}

/* Generic containers */
html.${DARK_CLASS} div,
html.${DARK_CLASS} section,
html.${DARK_CLASS} article,
html.${DARK_CLASS} aside,
html.${DARK_CLASS} header,
html.${DARK_CLASS} footer,
html.${DARK_CLASS} main,
html.${DARK_CLASS} nav,
html.${DARK_CLASS} li,
html.${DARK_CLASS} ul,
html.${DARK_CLASS} ol {
  /* Only override if a light inline or computed bg is detected; JS handles per-element */
}

/* Text elements */
html.${DARK_CLASS} p,
html.${DARK_CLASS} span,
html.${DARK_CLASS} h1, html.${DARK_CLASS} h2, html.${DARK_CLASS} h3,
html.${DARK_CLASS} h4, html.${DARK_CLASS} h5, html.${DARK_CLASS} h6,
html.${DARK_CLASS} label,
html.${DARK_CLASS} td, html.${DARK_CLASS} th,
html.${DARK_CLASS} li,
html.${DARK_CLASS} blockquote {
  color: inherit;
}

/* Links */
html.${DARK_CLASS} a {
  color: #7cb9e8;
}
html.${DARK_CLASS} a:visited {
  color: #b39ddb;
}

/* Form controls */
html.${DARK_CLASS} input:not([type=range]):not([type=color]),
html.${DARK_CLASS} textarea,
html.${DARK_CLASS} select {
  background-color: #1e1e1e !important;
  color: #e0e0e0 !important;
  border-color: #444 !important;
}

/* Buttons */
html.${DARK_CLASS} button {
  background-color: #2a2a2a !important;
  color: #e0e0e0 !important;
  border-color: #555 !important;
}

/* Tables */
html.${DARK_CLASS} table {
  border-color: #444 !important;
}
html.${DARK_CLASS} th {
  background-color: #1e1e1e !important;
}
html.${DARK_CLASS} tr:nth-child(even) {
  background-color: #1a1a1a !important;
}

/* Code blocks */
html.${DARK_CLASS} pre,
html.${DARK_CLASS} code {
  background-color: #1a1a1a !important;
  color: #cdd3de !important;
  border-color: #333 !important;
}

/* Scrollbars */
html.${DARK_CLASS} * {
  scrollbar-color: #555 #1a1a1a;
}

/* ── Preserve media — no filter, no inversion ── */
html.${DARK_CLASS} img,
html.${DARK_CLASS} picture,
html.${DARK_CLASS} video,
html.${DARK_CLASS} canvas,
html.${DARK_CLASS} svg image,
html.${DARK_CLASS} iframe,
html.${DARK_CLASS} object,
html.${DARK_CLASS} embed {
  filter: none !important;
  /* Avoid inheriting any filter from ancestors */
}

/* Inline SVG used decoratively — allow color inheritance but no inversion */
html.${DARK_CLASS} svg {
  fill: currentColor;
}

/* Remove box shadows on cards so they don't look odd */
html.${DARK_CLASS} [class*="card"],
html.${DARK_CLASS} [class*="modal"],
html.${DARK_CLASS} [class*="dialog"],
html.${DARK_CLASS} [class*="panel"],
html.${DARK_CLASS} [class*="sidebar"] {
  box-shadow: 0 2px 8px rgba(0,0,0,0.6) !important;
}
`;

// ─── Stylesheet injection ─────────────────────────────────────────────────────

function injectStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BASE_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function removeStylesheet() {
  document.getElementById(STYLE_ID)?.remove();
}

// ─── Per-element DOM transformation ──────────────────────────────────────────

function shouldSkipElement(el) {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.dataset.msdmSkip) return true;

  // Skip elements with background images
  const bg = getComputedStyle(el).backgroundImage;
  if (bg && bg !== "none") return true;

  // Skip SVG children that are graphical (paths, circles used for icons)
  if (el.closest("svg")) {
    // SVG inline icons: let CSS `fill: currentColor` handle them
    return true;
  }

  return false;
}

function transformElement(el) {
  if (el[PROCESSED_ATTR]) return;
  if (shouldSkipElement(el)) return;

  const style = getComputedStyle(el);
  let changed = false;

  // Background
  const bgColor = parseColor(style.backgroundColor);
  if (bgColor && bgColor.a > 0.05 && isLight(bgColor)) {
    el.style.setProperty("background-color", darkenBackground(bgColor), "important");
    changed = true;
  }

  // Text color — only fix if bg is now dark (either we changed it, or it was already dark)
  const textColor = parseColor(style.color);
  if (textColor) {
    const finalBg = parseColor(el.style.backgroundColor) || bgColor;
    const bgIsDark = !finalBg || isDark(finalBg) || (finalBg.a < 0.1);
    if (bgIsDark && isDark(textColor)) {
      const lighter = lightenText(textColor);
      if (lighter) {
        el.style.setProperty("color", lighter, "important");
        changed = true;
      }
    }
  }

  // Border color
  const borderColor = parseColor(style.borderColor);
  if (borderColor) {
    const adjusted = adjustBorderColor(borderColor);
    if (adjusted) {
      el.style.setProperty("border-color", adjusted, "important");
      changed = true;
    }
  }

  if (changed) el[PROCESSED_ATTR] = true;
}

function walkDOM(root) {
  // Use TreeWalker for performance
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    transformElement(node);
    node = walker.nextNode();
  }
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

let observer = null;

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === 1) {
          transformElement(node);
          if (node.children.length) walkDOM(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

// ─── SPA navigation detection ─────────────────────────────────────────────────

let lastHref = location.href;

function checkNavigation() {
  if (location.href !== lastHref) {
    lastHref = location.href;
    // Re-scan after a tick so new content has time to land
    setTimeout(() => {
      if (isEnabled()) walkDOM(document.documentElement);
    }, 300);
  }
}

// ─── Enable / Disable ────────────────────────────────────────────────────────

let _enabled = false;

function isEnabled() { return _enabled; }

function enable() {
  if (_enabled) return;
  _enabled = true;
  injectStylesheet();
  document.documentElement.classList.add(DARK_CLASS);
  if (document.body) walkDOM(document.body);
  startObserver();
}

function disable() {
  if (!_enabled) return;
  _enabled = false;
  document.documentElement.classList.remove(DARK_CLASS);
  removeStylesheet();
  stopObserver();
  // Reset inline styles we applied
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
    el.style.removeProperty("background-color");
    el.style.removeProperty("color");
    el.style.removeProperty("border-color");
    delete el[PROCESSED_ATTR];
  });
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getHostname() {
  return location.hostname;
}

function loadPrefsAndApply() {
  chrome.storage.sync.get(["globalEnabled", "sitePrefs"], ({ globalEnabled = true, sitePrefs = {} }) => {
    const hostname = getHostname();
    const sitePref = sitePrefs[hostname];

    // Site override takes priority over global
    let shouldEnable;
    if (sitePref === false) {
      shouldEnable = false;
    } else if (sitePref === true) {
      shouldEnable = true;
    } else {
      // No site override — respect global and page darkness
      shouldEnable = globalEnabled && !pageIsAlreadyDark();
    }

    if (shouldEnable) {
      // Wait until DOM is ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", enable, { once: true });
      } else {
        enable();
      }
    }
  });
}

// ─── Messaging from background / popup ───────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "GLOBAL_CHANGED") {
    if (!msg.value) {
      disable();
    } else {
      loadPrefsAndApply();
    }
  }
  if (msg.type === "SITE_CHANGED") {
    if (msg.value === false) {
      disable();
    } else {
      loadPrefsAndApply();
    }
  }
});

// ─── SPA poll ────────────────────────────────────────────────────────────────

setInterval(checkNavigation, 1000);

// ─── Init ────────────────────────────────────────────────────────────────────

loadPrefsAndApply();

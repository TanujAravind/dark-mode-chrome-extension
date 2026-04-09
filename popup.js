// Popup logic: reads/writes storage and reflects state in the UI

const globalToggle = document.getElementById("global-toggle");
const siteToggle = document.getElementById("site-toggle");
const statusBadge = document.getElementById("status-badge");
const hostnameLabel = document.getElementById("hostname-label");
const hintText = document.getElementById("hint-text");

let hostname = "";
let globalEnabled = true;
let sitePrefs = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateUI() {
  const sitePref = sitePrefs[hostname]; // true | false | undefined

  globalToggle.checked = globalEnabled;

  // Site toggle reflects explicit pref, or falls back to global
  const siteEffective = sitePref !== undefined ? sitePref : globalEnabled;
  siteToggle.checked = siteEffective;

  // Disable site toggle when global is off and there's no explicit site override
  siteToggle.disabled = !globalEnabled && sitePref === undefined;

  const activeOnSite = globalEnabled && siteEffective;
  statusBadge.textContent = activeOnSite ? "ON" : "OFF";
  statusBadge.className = "badge" + (activeOnSite ? " on" : "");

  // Hint text
  if (!globalEnabled) {
    hintText.textContent = "Dark mode is globally disabled.";
  } else if (sitePref === false) {
    hintText.textContent = "Dark mode is disabled for this site.";
  } else if (sitePref === true) {
    hintText.textContent = "Dark mode is forced on for this site.";
  } else {
    hintText.textContent = "Auto-detected: dark mode applies to light sites.";
  }
}

// ─── Load state ───────────────────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab?.url) return;
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    hostname = "";
  }
  hostnameLabel.textContent = hostname || "—";

  chrome.storage.sync.get(["globalEnabled", "sitePrefs"], (data) => {
    globalEnabled = data.globalEnabled !== false;
    sitePrefs = data.sitePrefs || {};
    updateUI();
  });
});

// ─── Global toggle ────────────────────────────────────────────────────────────

globalToggle.addEventListener("change", () => {
  globalEnabled = globalToggle.checked;
  chrome.runtime.sendMessage({ type: "SET_GLOBAL", value: globalEnabled }, () => {
    updateUI();
  });
});

// ─── Site toggle ──────────────────────────────────────────────────────────────

siteToggle.addEventListener("change", () => {
  const newVal = siteToggle.checked;

  // If the new value matches what global would give us with no override, clear the override
  if (newVal === globalEnabled) {
    delete sitePrefs[hostname];
    chrome.storage.sync.get("sitePrefs", ({ sitePrefs: stored = {} }) => {
      delete stored[hostname];
      chrome.storage.sync.set({ sitePrefs: stored }, () => {
        sitePrefs = stored;
        chrome.runtime.sendMessage({ type: "SITE_CHANGED", hostname, value: newVal });
        updateUI();
      });
    });
  } else {
    sitePrefs[hostname] = newVal;
    chrome.runtime.sendMessage({ type: "SET_SITE", hostname, value: newVal }, () => {
      updateUI();
    });
  }
});

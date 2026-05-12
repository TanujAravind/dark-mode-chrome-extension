// Popup logic: reads/writes storage and reflects state in the UI

const globalToggle = document.getElementById("global-toggle");
const siteToggle = document.getElementById("site-toggle");
const statusBadge = document.getElementById("status-badge");
const hostnameLabel = document.getElementById("hostname-label");
const hintText = document.getElementById("hint-text");
const excludeForm = document.getElementById("exclude-form");
const excludeInput = document.getElementById("exclude-input");
const excludeError = document.getElementById("exclude-error");
const excludedList = document.getElementById("excluded-list");

let hostname = "";
let globalEnabled = true;
let sitePrefs = {};
let excludedSites = [];

function normalizeHost(h) {
  return (h || "").toLowerCase().replace(/^www\./, "");
}

function extractHostname(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  const tryParse = (s) => {
    try { return new URL(s).hostname.toLowerCase(); } catch { return null; }
  };
  return tryParse(trimmed) || tryParse("https://" + trimmed);
}

function isExcluded(host) {
  const n = normalizeHost(host);
  return excludedSites.some((s) => normalizeHost(s) === n);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateUI() {
  const sitePref = sitePrefs[hostname]; // true | false | undefined
  const hostExcluded = isExcluded(hostname);

  globalToggle.checked = globalEnabled;

  // Site toggle reflects explicit pref, or falls back to global
  const siteEffective = sitePref !== undefined ? sitePref : globalEnabled;
  siteToggle.checked = !hostExcluded && siteEffective;

  // Disable site toggle when excluded, or global off with no explicit site override
  siteToggle.disabled = hostExcluded || (!globalEnabled && sitePref === undefined);

  const activeOnSite = !hostExcluded && globalEnabled && siteEffective;
  statusBadge.textContent = activeOnSite ? "ON" : "OFF";
  statusBadge.className = "badge" + (activeOnSite ? " on" : "");

  // Hint text
  if (hostExcluded) {
    hintText.textContent = "This site is in the excluded list.";
  } else if (!globalEnabled) {
    hintText.textContent = "Dark mode is globally disabled.";
  } else if (sitePref === false) {
    hintText.textContent = "Dark mode is disabled for this site.";
  } else if (sitePref === true) {
    hintText.textContent = "Dark mode is forced on for this site.";
  } else {
    hintText.textContent = "Auto-detected: dark mode applies to light sites.";
  }

  renderExcluded();
}

function renderExcluded() {
  excludedList.innerHTML = "";
  if (excludedSites.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No excluded sites yet.";
    excludedList.appendChild(li);
    return;
  }
  for (const host of excludedSites) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "host";
    span.textContent = host;
    span.title = host;
    const btn = document.createElement("button");
    btn.className = "remove";
    btn.type = "button";
    btn.textContent = "×";
    btn.setAttribute("aria-label", `Remove ${host}`);
    btn.addEventListener("click", () => removeExcluded(host));
    li.appendChild(span);
    li.appendChild(btn);
    excludedList.appendChild(li);
  }
}

function saveExcluded() {
  chrome.storage.sync.set({ excludedSites }, () => {
    updateUI();
  });
}

function addExcluded(rawInput) {
  excludeError.textContent = "";
  const host = extractHostname(rawInput);
  if (!host) {
    excludeError.textContent = "Couldn't parse a URL from that input.";
    return;
  }
  if (isExcluded(host)) {
    excludeError.textContent = `${host} is already excluded.`;
    return;
  }
  excludedSites = [...excludedSites, host];
  excludeInput.value = "";
  saveExcluded();
}

function removeExcluded(host) {
  const n = normalizeHost(host);
  excludedSites = excludedSites.filter((s) => normalizeHost(s) !== n);
  saveExcluded();
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

  chrome.storage.sync.get(["globalEnabled", "sitePrefs", "excludedSites"], (data) => {
    globalEnabled = data.globalEnabled !== false;
    sitePrefs = data.sitePrefs || {};
    excludedSites = Array.isArray(data.excludedSites) ? data.excludedSites : [];
    updateUI();
  });
});

excludeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addExcluded(excludeInput.value);
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

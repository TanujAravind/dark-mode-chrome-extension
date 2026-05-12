// Service worker: handles storage defaults and messaging

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["globalEnabled", "sitePrefs", "excludedSites"], (data) => {
    const defaults = {};
    if (data.globalEnabled === undefined) defaults.globalEnabled = true;
    if (data.sitePrefs === undefined) defaults.sitePrefs = {};
    if (data.excludedSites === undefined) defaults.excludedSites = [];
    if (Object.keys(defaults).length) chrome.storage.sync.set(defaults);
  });
});

// Relay messages from popup to content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    chrome.storage.sync.get(["globalEnabled", "sitePrefs", "excludedSites"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.type === "SET_EXCLUDED") {
    chrome.storage.sync.set({ excludedSites: msg.value }, () => {
      sendResponse({ ok: true });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: "EXCLUDED_CHANGED" }).catch(() => {});
        });
      });
    });
    return true;
  }

  if (msg.type === "SET_GLOBAL") {
    chrome.storage.sync.set({ globalEnabled: msg.value }, () => {
      sendResponse({ ok: true });
      // Notify all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: "GLOBAL_CHANGED", value: msg.value }).catch(() => {});
        });
      });
    });
    return true;
  }

  if (msg.type === "SET_SITE") {
    chrome.storage.sync.get("sitePrefs", ({ sitePrefs = {} }) => {
      sitePrefs[msg.hostname] = msg.value;
      chrome.storage.sync.set({ sitePrefs }, () => {
        sendResponse({ ok: true });
        // Notify active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "SITE_CHANGED", value: msg.value }).catch(() => {});
          }
        });
      });
    });
    return true;
  }
});

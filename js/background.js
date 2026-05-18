// VaultX Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("VaultX Password Manager installed.");
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CURRENT_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || "" });
    });
    return true; // keep channel open for async
  }
});

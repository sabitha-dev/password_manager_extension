// VaultX Content Script — autofill support

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTOFILL") {
    const { username, password } = message.data;

    // Try common input selectors
    const userField =
      document.querySelector('input[type="email"]') ||
      document.querySelector('input[name*="user"]') ||
      document.querySelector('input[name*="email"]') ||
      document.querySelector('input[id*="user"]') ||
      document.querySelector('input[id*="email"]');

    const passField =
      document.querySelector('input[type="password"]');

    if (userField) {
      userField.value = username;
      userField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passField) {
      passField.value = password;
      passField.dispatchEvent(new Event("input", { bubbles: true }));
    }

    sendResponse({ success: !!(userField || passField) });
  }
});

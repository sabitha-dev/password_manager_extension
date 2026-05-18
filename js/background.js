let pendingCredential = null;

chrome.runtime.onMessage.addListener((message) => {

  if (message.type === "PROMPT_SAVE_CREDENTIAL") {
    pendingCredential = message.data;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "VaultX",
      message: `Save password for ${pendingCredential.domain}?`,
      buttons: [
        { title: "Save" },
        { title: "Cancel" }
      ]
    });
  }
});

chrome.notifications.onButtonClicked.addListener((id, btnIndex) => {

  if (!pendingCredential) return;

  if (btnIndex === 0) {
    fetch("http://localhost:8080/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingCredential),
    });
  }

  pendingCredential = null;
});
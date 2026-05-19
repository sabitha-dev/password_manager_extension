let pendingCredential = null;

chrome.runtime.onMessage.addListener((message) => {

  if (message.type === "PROMPT_SAVE_CREDENTIAL") {

    chrome.storage.local.set({
      pendingCredential: message.data
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "VaultX",
      message: `Save password for ${message.data.domain}?`,
      buttons: [
        { title: "Save" },
        { title: "Cancel" }
      ]
    });
  }
});
chrome.notifications.onButtonClicked.addListener((id, btnIndex) => {

  if (btnIndex !== 0) return;

  chrome.storage.local.get(["pendingCredential", "vaultx_token"], async (result) => {

    const pendingCredential = result.pendingCredential;
    const token = result.vaultx_token;

    if (!pendingCredential) {
      console.error("No pending credential found");
      return;
    }

    const payload = {
      siteUrl: pendingCredential.domain,
      appName: pendingCredential.domain,
      loginUsername: pendingCredential.username,
      password: pendingCredential.password,
      notes: ""
    };

    try {
      const response = await fetch("http://localhost:8080/vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.text();
      console.log("SAVE RESPONSE:", data);

      chrome.storage.local.remove("pendingCredential");

    } catch (err) {
      console.error("SAVE ERROR:", err);
    }
  });
});
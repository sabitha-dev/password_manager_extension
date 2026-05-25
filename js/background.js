import { ENV } from "./env.js";

chrome.notifications.onButtonClicked.addListener(async (id, btnIndex) => {
  if (btnIndex !== 0) return;

  chrome.storage.local.get(
    ["pendingCredential", "vaultx_token", "pendingAction"],
    async (result) => {
      const pendingCredential = result.pendingCredential;
      const token = result.vaultx_token;
      const action = result.pendingAction;

      if (!pendingCredential) return;

      // PAYLOAD HERE
      const payload = {
        siteUrl: pendingCredential.domain,
        appName: pendingCredential.domain,
        loginUsername: pendingCredential.username,
        password: pendingCredential.password,
        notes: "",
      };

      try {
        // UPDATE
        if (action === "update") {
          const res = await fetch(`${ENV.API_BASE_URL}/vault`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json();

          const vaultList = data.data || [];

          const existing = vaultList.find(
            (v) =>
              v.siteUrl?.includes(pendingCredential.domain) &&
              v.loginUsername === pendingCredential.username,
          );

          console.log("UPDATE CHECK:", {
            pendingCredential,
            existing,
          });

          if (existing) {
            await fetch(`${ENV.API_BASE_URL}/vault/${existing.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                password: pendingCredential.password,
              }),
            });

            console.log("PASSWORD UPDATED");
          }
        }

        // SAVE
        else {
          const res = await fetch(`${ENV.API_BASE_URL}/vault`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          console.log(res);
        }

        chrome.storage.local.remove(["pendingCredential", "pendingAction"]);
      } catch (err) {
        console.error(err);
      }
    },
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "LOGIN_ATTEMPT") return;

  chrome.storage.local.get(["vaultx_token"], async (result) => {
    const token = result.vaultx_token;
    if (!token) return;

    try {
      const res = await fetch(`${ENV.API_BASE_URL}/vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const vaultList = data.data || [];

      const existing = vaultList.find(
        (v) =>
          v.siteUrl?.includes(message.data.domain) &&
          v.loginUsername === message.data.username,
      );
      console.log(vaultList, "vaultist");

      console.log(existing, "exisitng");

      // ✅ SAVE FLOW
      if (!existing) {
        chrome.storage.local.set({
          pendingCredential: message.data,
          pendingAction: "save",
        });

        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/Notification_icon.jpeg"),
          title: "VaultX",
          message: `Save password for ${message.data.domain}?`,
          buttons: [{ title: "Save" }, { title: "Cancel" }],
          priority: 2,
        });

        console.log("SAVE NOTIFICATION TRIGGERED");
        return;
      }
      const detailRes = await fetch(
        `${ENV.API_BASE_URL}/vault/${existing.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const detailData = await detailRes.json();

      const savedPassword = detailData.data.password;

      console.log("SAVED PASSWORD:", savedPassword);
      console.log("CURRENT PASSWORD:", message.data.password);
      if (savedPassword !== message.data.password) {
        chrome.storage.local.set({
          pendingCredential: {
            ...message.data,
            id: existing.id,
          },
          pendingAction: "update",
        });

        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/Notification_icon.jpeg"),
          title: "VaultX",
          message: `Password changed. Update for ${message.data.domain}?`,
          buttons: [{ title: "Update" }, { title: "Cancel" }],
          priority: 2,
        });

        console.log("UPDATE NOTIFICATION TRIGGERED");
        return;
      }

      console.log("No change → no notification");
    } catch (err) {
      console.error(err);
    }
  });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CREDENTIALS") {
    chrome.storage.local.get(["vaultx_token"], async (result) => {
      const token = result.vaultx_token;

      if (!token) {
        sendResponse({ data: null });
        return;
      }

      try {
        const res = await fetch(`${ENV.API_BASE_URL}/vault`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        const vaultList = data.data || [];

        const matched = vaultList.find((v) =>
          v.siteUrl?.includes(message.domain),
        );

        if (!matched) {
          sendResponse({ data: null });
          return;
        }

        const detailRes = await fetch(
          `${ENV.API_BASE_URL}/vault/${matched.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const detailData = await detailRes.json();

        sendResponse({
          data: {
            username: detailData.data.loginUsername,
            password: detailData.data.password,
          },
        });
      } catch (err) {
        console.error(err);
        sendResponse({ data: null });
      }
    });

    return true;
  }
});

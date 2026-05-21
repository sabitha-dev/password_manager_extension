// let pendingCredential = null;

// chrome.runtime.onMessage.addListener((message) => {

//   if (message.type === "PROMPT_SAVE_CREDENTIAL") {

//     chrome.storage.local.set({
//       pendingCredential: message.data
//     });

//     chrome.notifications.create({
//       type: "basic",
//       iconUrl: chrome.runtime.getURL("icons/icon48.png"),
//       title: "VaultX",
//       message: `Save password for ${message.data.domain}?`,
//       buttons: [
//         { title: "Save" },
//         { title: "Cancel" }
//       ]
//     });
//   }
// });
// chrome.notifications.onButtonClicked.addListener((id, btnIndex) => {

//   if (btnIndex !== 0) return;

//   chrome.storage.local.get(["pendingCredential", "vaultx_token"], async (result) => {

//     const pendingCredential = result.pendingCredential;
//     const token = result.vaultx_token;

//     if (!pendingCredential) {
//       console.error("No pending credential found");
//       return;
//     }

//     const payload = {
//       siteUrl: pendingCredential.domain,
//       appName: pendingCredential.domain,
//       loginUsername: pendingCredential.username,
//       password: pendingCredential.password,
//       notes: ""
//     };

//     try {
//       const response = await fetch("http://localhost:8080/vault", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `Bearer ${token}`
//         },
//         body: JSON.stringify(payload),
//       });

//       const data = await response.text();
//       console.log("SAVE RESPONSE:", data);

//       chrome.storage.local.remove("pendingCredential");

//     } catch (err) {
//       console.error("SAVE ERROR:", err);
//     }
//   });
// });

// chrome.runtime.onMessage.addListener((message) => {

//   // SAVE
//   if (message.type === "PROMPT_SAVE_CREDENTIAL") {

//     chrome.storage.local.set({
//       pendingCredential: message.data,
//       pendingAction: "save"
//     });

//     chrome.notifications.create({
//       type: "basic",
//       iconUrl: chrome.runtime.getURL("icons/icon48.png"),
//       title: "VaultX",
//       message: `Save password for ${message.data.domain}?`,
//       buttons: [
//         { title: "Save" },
//         { title: "Cancel" }
//       ]
//     });
//   }

//   // UPDATE
//   if (message.type === "PROMPT_UPDATE_CREDENTIAL") {

//     chrome.storage.local.set({
//       pendingCredential: message.data,
//       pendingAction: "update"
//     });

//     chrome.notifications.create({
//       type: "basic",
//       iconUrl: chrome.runtime.getURL("icons/icon48.png"),
//       title: "VaultX",
//       message: `Update password for ${message.data.domain}?`,
//       buttons: [
//         { title: "Update" },
//         { title: "Cancel" }
//       ]
//     });
//   }
// });

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
        notes: ""
      };

      try {

        // UPDATE
        if (action === "update") {

          const res = await fetch("http://localhost:8080/vault", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          const data = await res.json();

          const vaultList = data.data || [];

          const existing = vaultList.find(
            (v) =>
              v.siteUrl?.includes(pendingCredential.domain) &&
              v.loginUsername === pendingCredential.username
          );

          if (existing) {

            await fetch(`http://localhost:8080/vault/${existing.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                password: pendingCredential.password
              })
            });

            console.log("PASSWORD UPDATED");
          }

        }

        // SAVE
        else {

         const res= await fetch("http://localhost:8080/vault", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
console.log(res);

        }

        chrome.storage.local.remove([
          "pendingCredential",
          "pendingAction"
        ]);

      } catch (err) {
        console.error(err);
      }
    }
  );
});
chrome.runtime.onMessage.addListener((message) => {

  // SAVE
  if (message.type === "PROMPT_SAVE_CREDENTIAL") {

    chrome.storage.local.get(["vaultx_token"], async (result) => {

      const token = result.vaultx_token;

      if (!token) return;

      try {

        // GET SAVED VAULTS
        const res = await fetch("http://localhost:8080/vault", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        const vaultList = data.data || [];

        // CHECK SAME DOMAIN + USERNAME
        const alreadyExists = vaultList.find(
          (v) =>
            v.siteUrl?.includes(message.data.domain) &&
            v.loginUsername === message.data.username
        );

        // ALREADY SAVED
        if (alreadyExists) {
          console.log("Credential already saved");
          return;
        }

        // TEMP STORAGE
        chrome.storage.local.set({
          pendingCredential: message.data,
          pendingAction: "save"
        });

        // SHOW NOTIFICATION
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "VaultX",
          message: `Save password for ${message.data.domain}?`,
          buttons: [
            { title: "Save" },
            { title: "Cancel" }
          ],
          priority: 2
        });

      } catch (err) {
        console.error(err);
      }

    });

  }

  // UPDATE
  if (message.type === "PROMPT_UPDATE_CREDENTIAL") {

    chrome.storage.local.set({
      pendingCredential: message.data,
      pendingAction: "update"
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "VaultX",
      message: `Update password for ${message.data.domain}?`,
      buttons: [
        { title: "Update" },
        { title: "Cancel" }
      ],
      priority: 2
    });
  }

});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // GET CREDENTIALS
  if (message.type === "GET_CREDENTIALS") {

    chrome.storage.local.get(["vaultx_token"], async (result) => {

      const token = result.vaultx_token;

      if (!token) {
        sendResponse({ data: null });
        return;
      }

      try {

        const res = await fetch("http://localhost:8080/vault", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        const vaultList = data.data || [];

        const matched = vaultList.find(
          (v) =>
            v.siteUrl?.includes(message.domain)
        );

        if (!matched) {
          sendResponse({ data: null });
          return;
        }

        const detailRes = await fetch(
          `http://localhost:8080/vault/${matched.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const detailData = await detailRes.json();

        sendResponse({
          data: {
            username: detailData.data.loginUsername,
            password: detailData.data.password
          }
        });

      } catch (err) {
        console.error(err);
        sendResponse({ data: null });
      }

    });

    return true;
  }

});
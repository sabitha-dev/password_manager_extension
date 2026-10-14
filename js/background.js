import { ENV } from "./env.js";
import { hostMatches, normalizeHost, sameUsername } from "./utils.js";

const ICON_URL = chrome.runtime.getURL("icons/icon128.png");

// Free hosting tiers can take up to a minute to wake up.
const REQUEST_TIMEOUT_MS = 70000;
// Give the page time to show an error (wrong password) or navigate away.
const LOGIN_SETTLE_MS = 2500;
// MV3 service workers are stopped after ~30s of inactivity; ping an extension
// API more often than that while a slow request is in flight.
const KEEP_ALIVE_MS = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
async function getToken() {
  const res = await chrome.storage.local.get("vaultx_token");
  return res.vaultx_token;
}

/** Keeps the service worker alive while `task` runs. */
async function withKeepAlive(task) {
  const timer = setInterval(
    () => chrome.runtime.getPlatformInfo(() => {}),
    KEEP_ALIVE_MS,
  );
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const token = await getToken();
  if (!token) throw new ApiError("Not signed in", 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(ENV.API_BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(
      err?.name === "AbortError"
        ? "the server took too long to respond"
        : "the server could not be reached",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (res.status === 401) {
    await chrome.storage.local.remove(["vaultx_token", "vaultx_user"]);
    throw new ApiError("session expired", 401);
  }

  if (!res.ok) {
    throw new ApiError(
      data?.message || res.statusText || `request failed (${res.status})`,
      res.status,
    );
  }

  return data;
}

function notify(id, message, buttons) {
  return new Promise((resolve) => {
    chrome.notifications.create(
      id,
      {
        type: "basic",
        iconUrl: ICON_URL,
        title: "VaultX",
        message,
        priority: 2,
        // Notifications with buttons must stay until the user answers,
        // otherwise they disappear before Save / Update can be clicked.
        ...(buttons
          ? {
              buttons: buttons.map((title) => ({ title })),
              requireInteraction: true,
            }
          : {}),
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "VaultX notification failed:",
            chrome.runtime.lastError.message,
          );
        }
        resolve();
      },
    );
  });
}

function reportError(err, doing) {
  console.error("VaultX:", doing, err);
  if (err?.status === 401) {
    return notify(
      "vaultx:error",
      "Your VaultX session has expired. Open VaultX and sign in again to save passwords.",
    );
  }
  return notify(
    "vaultx:error",
    `VaultX couldn't ${doing}: ${err?.message || "unknown error"}.`,
  );
}

const pendingKey = (notificationId) => `pending:${notificationId}`;

/**
 * Decides whether the login that just happened actually succeeded by asking
 * the content script of the (possibly new) page.
 */
async function waitForLoginResult(tabId) {
  await sleep(LOGIN_SETTLE_MS);
  if (tabId == null) return true;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reply = await chrome.tabs.sendMessage(tabId, {
        type: "CHECK_LOGIN_STATE",
      });
      if (reply) return !reply.failed;
    } catch {
      // Page is still navigating / content script not ready yet.
    }
    await sleep(1000);
  }
  // Could not ask the page (e.g. closed, or a page without our script):
  // better to offer the prompt than to silently lose it.
  return true;
}

/* ─────────────────────────────────────────────
   LOGIN DETECTED -> SAVE / UPDATE PROMPT
───────────────────────────────────────────── */
async function handleLoginAttempt(data, tabId) {
  const username = (data?.username || "").trim();
  const password = data?.password || "";
  const domain = normalizeHost(data?.domain);
  if (!username || !password || !domain) return;

  // Not signed in to VaultX: nothing to save to.
  if (!(await getToken())) return;

  await withKeepAlive(async () => {
    try {
      // Fetch the vault while the page settles, so a cold backend wakes up early.
      const [loginResult, listResult] = await Promise.allSettled([
        waitForLoginResult(tabId),
        apiFetch("/vault"),
      ]);

      if (loginResult.status === "fulfilled" && loginResult.value === false) {
        return; // login failed on the page -> nothing to save
      }
      if (listResult.status === "rejected") throw listResult.reason;

      const vaultList = listResult.value?.data || [];
      const existing = vaultList.find(
        (v) =>
          hostMatches(v.siteUrl, domain) &&
          sameUsername(v.loginUsername, username),
      );

      const credential = {
        domain,
        origin: data.origin || `https://${domain}`,
        username,
        password,
      };

      // NEW credential
      if (!existing) {
        const id = `vaultx:save:${domain}:${username}`;
        await chrome.storage.session.set({
          [pendingKey(id)]: { action: "save", credential },
        });
        await notify(id, `Save password for ${username} on ${domain}?`, [
          "Save",
          "Cancel",
        ]);
        return;
      }

      // EXISTING credential: offer an update only if the password changed
      const detail = await apiFetch(`/vault/${existing.id}`);
      if (detail?.data?.password === password) return;

      const id = `vaultx:update:${domain}:${username}`;
      await chrome.storage.session.set({
        [pendingKey(id)]: {
          action: "update",
          vaultId: existing.id,
          credential,
        },
      });
      await notify(
        id,
        `Password changed. Update it for ${username} on ${domain}?`,
        ["Update", "Cancel"],
      );
    } catch (err) {
      await reportError(err, "check your saved passwords");
    }
  });
}

/* ─────────────────────────────────────────────
   NOTIFICATION BUTTONS
───────────────────────────────────────────── */
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    const key = pendingKey(notificationId);
    const stored = await chrome.storage.session.get(key);
    const pending = stored[key];

    chrome.notifications.clear(notificationId);
    await chrome.storage.session.remove(key);

    // Button 1 = Cancel
    if (!pending || buttonIndex !== 0) return;

    const { credential } = pending;

    await withKeepAlive(async () => {
      try {
        if (pending.action === "update") {
          await apiFetch(`/vault/${pending.vaultId}`, {
            method: "PATCH",
            body: { password: credential.password },
          });
          await notify(
            "vaultx:result",
            `Password updated for ${credential.username} on ${credential.domain}.`,
          );
        } else {
          await apiFetch("/vault", {
            method: "POST",
            body: {
              siteUrl: credential.origin,
              appName: credential.domain,
              loginUsername: credential.username,
              password: credential.password,
              notes: "",
            },
          });
          await notify(
            "vaultx:result",
            `Password saved for ${credential.username} on ${credential.domain}.`,
          );
        }
      } catch (err) {
        await reportError(
          err,
          pending.action === "update" ? "update the password" : "save the password",
        );
      }
    });
  },
);

// Dismissed with the X -> forget the pending credential.
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (byUser) chrome.storage.session.remove(pendingKey(notificationId));
});

/* ─────────────────────────────────────────────
   AUTOFILL LOOKUP
───────────────────────────────────────────── */
async function handleGetCredentials(domain) {
  try {
    if (!(await getToken())) return { data: null };

    const list = await apiFetch("/vault");
    const matched = (list?.data || []).find((v) =>
      hostMatches(v.siteUrl, domain),
    );
    if (!matched) return { data: null };

    const detail = await apiFetch(`/vault/${matched.id}`);
    return {
      data: {
        username: detail.data.loginUsername,
        password: detail.data.password,
      },
    };
  } catch (err) {
    console.error("VaultX autofill lookup failed:", err);
    return { data: null };
  }
}

/* ─────────────────────────────────────────────
   MESSAGES FROM CONTENT SCRIPTS
───────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LOGIN_ATTEMPT") {
    handleLoginAttempt(message.data, sender.tab?.id);
    return false;
  }

  if (message?.type === "GET_CREDENTIALS") {
    withKeepAlive(() => handleGetCredentials(message.domain)).then(
      sendResponse,
    );
    return true; // keep the channel open for the async response
  }

  return false;
});

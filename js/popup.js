// VaultX Popup Logic
import { Auth, Passwords } from "./api.js";
/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let currentView = "auth"; // auth | vault | add | detail | edit
let passwords = [];
let selectedEntry = null;
let searchQuery = "";

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["vaultx_token"], (result) => {
    const token = result.vaultx_token;

    if (token) {
      showVault();
    } else {
      showAuth("login");
    }
  });
  // Auth tab switching
  document
    .getElementById("tab-login")
    .addEventListener("click", () => showAuth("login"));
  document
    .getElementById("tab-register")
    .addEventListener("click", () => showAuth("register"));

  // Login form
  document.getElementById("login-form").addEventListener("submit", handleLogin);

  // Register form
  document
    .getElementById("register-form")
    .addEventListener("submit", handleRegister);

  // Logout
  document.getElementById("btn-logout").addEventListener("click", handleLogout);

  // Add new password button
  document
    .getElementById("btn-add-new")
    .addEventListener("click", () => showAddForm());

  // Back buttons
  document
    .getElementById("btn-back-add")
    .addEventListener("click", () => showVault());
  document
    .getElementById("btn-back-detail")
    .addEventListener("click", () => showVault());

  // Add password form submit
  document
    .getElementById("add-form")
    .addEventListener("submit", handleAddPassword);

  // Edit form submit
  document
    .getElementById("edit-form")
    .addEventListener("submit", handleEditPassword);

  // Delete button in detail
  document
    .getElementById("btn-delete")
    .addEventListener("click", handleDeletePassword);

  // Edit button in detail
  document
    .getElementById("btn-edit")
    .addEventListener("click", () => showEditForm(selectedEntry));

  // Back from edit
  document
    .getElementById("btn-back-edit")
    .addEventListener("click", () => showDetail(selectedEntry));

  // Search
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderPasswordList();
  });

  // Toggle password visibility buttons
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁";
      }
    });
  });

  // Copy buttons in detail view
  document.getElementById("btn-copy-username").addEventListener("click", () => {
    copyToClipboard(
      document.getElementById("detail-username").textContent,
      "btn-copy-username",
    );
  });
  document.getElementById("btn-copy-email").addEventListener("click", () => {
    copyToClipboard(
      document.getElementById("detail-appname").textContent,
      "btn-copy-email",
    );
  });
  document.getElementById("btn-copy-password").addEventListener("click", () => {
    copyToClipboard(
      document.getElementById("detail-password-val").dataset.raw,
      "btn-copy-password",
    );
  });

  // Autofill button
  document
    .getElementById("btn-autofill")
    .addEventListener("click", handleAutofill);

  // Generate password
  document
    .getElementById("btn-generate-add")
    .addEventListener("click", () => generatePassword("add-password"));
  document
    .getElementById("btn-generate-edit")
    .addEventListener("click", () => generatePassword("edit-password"));
});

/* ─────────────────────────────────────────────
   VIEW CONTROLLERS
───────────────────────────────────────────── */
function showView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  currentView = viewId;
}

function showAuth(tab = "login") {
  showView("view-auth");
  switchAuthTab(tab);
  clearErrors();
}

function switchAuthTab(tab) {
  document
    .getElementById("tab-login")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("tab-register")
    .classList.toggle("active", tab === "register");
  document
    .getElementById("login-section")
    .classList.toggle("hidden", tab !== "login");
  document
    .getElementById("register-section")
    .classList.toggle("hidden", tab !== "register");
}

async function showVault() {
  showView("view-vault");
  await loadPasswords();
}

function showAddForm() {
  document.getElementById("add-form").reset();
  clearErrors("add-error");
  showView("view-add");
}

function showDetail(entry) {
  selectedEntry = entry;

  document.getElementById("detail-site").textContent = entry.appName || "—";

  document.getElementById("detail-url").textContent = entry.siteUrl || "—";
  document.getElementById("detail-url").href = entry.siteUrl || "—";

  document.getElementById("detail-appname").textContent = entry.appName || "—";
  document.getElementById("detail-username").textContent =
    entry.loginUsername || "—";
  document.getElementById("detail-notes").textContent = entry.notes || "—";

  const pwEl = document.getElementById("detail-password-val");
  pwEl.textContent = "••••••••";
  pwEl.dataset.raw = entry.encryptedPassword || "";
  pwEl.dataset.visible = "false";
  document.getElementById("btn-reveal-password").onclick = async () => {
    const visible = pwEl.dataset.visible === "true";

    // if already visible -> hide
    if (visible) {
      pwEl.textContent = "••••••••";
      pwEl.dataset.visible = "false";
      document.getElementById("btn-reveal-password").textContent = "👁 Reveal";
      return;
    }

    // else fetch decrypted password from backend
    try {
      const res = await Passwords.getById(entry.id);
      const fullEntry = res.data.data;
      pwEl.textContent = fullEntry.password;
      pwEl.dataset.visible = "true";
      document.getElementById("btn-reveal-password").textContent = "🙈 Hide";

      // update selectedEntry so autofill also works
      selectedEntry.password = fullEntry.password;
    } catch (err) {
      showToast("Failed to reveal password", true);
    }
  };

  showView("view-detail");
}

async function showEditForm(entry) {
  try {
    console.log(entry);

    const res = await Passwords.getById(entry.id);
    const fullEntry = res.data.data;

    document.getElementById("edit-site-name").value = fullEntry.appName || "-";
    document.getElementById("edit-site-url").value = fullEntry.siteUrl || "-";
    document.getElementById("edit-username").value =
      fullEntry.loginUsername || "-";
    document.getElementById("edit-password").value = fullEntry.password || "-";
    document.getElementById("edit-notes").value = fullEntry.notes || "-";

    document.getElementById("edit-password").type = "password";
    clearErrors("edit-error");
    showView("view-edit");
  } catch (err) {
    showToast("Failed to load password for editing", true);
  }
}
/* ─────────────────────────────────────────────
   AUTH HANDLERS
───────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");

  setLoading(btn, true, "Signing in…");
  clearErrors("login-error");

  try {
    const res = await Auth.login(email, password);

    const message = res?.data?.message;
    const token = res?.data?.data;
    const user = res?.data?.user;

    if (!token) {
      showError("login-error", message || "Login failed. Token not received.");
      return;
    }
    chrome.storage.local.set(
      {
        vaultx_token: token,
      },
      () => {
        console.log("VaultX token saved");
      },
    );

    document.getElementById("user-name").textContent =
      user?.username || user?.email || email;

    showVault();
  } catch (err) {
    showError("login-error", getErrorMessage(err));
  } finally {
    setLoading(btn, false, "Sign In");
  }
}
async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm = document.getElementById("reg-confirm").value;

  const btn = document.getElementById("btn-register");

  clearErrors("register-error");

  if (password !== confirm) {
    showError("register-error", "Passwords do not match.");
    return;
  }

  setLoading(btn, true, "Creating account…");

  try {
    const res = await Auth.register(username, email, password);

    console.log(res, "Res");

    if (res?.data?.message !== "User created successfully!") {
      showError("register-error", res?.data?.message || "Register failed");
      return;
    }

    // ✅ Clear register form
    document.getElementById("register-form").reset();

    // ✅ Navigate to login view
    showAuth("login");

    // ✅ Optional: auto fill login email
    document.getElementById("login-email").value = email;

    showToast("Account created! Please sign in.");
  } catch (err) {
    console.log("FULL ERROR:", err);

    showError("register-error", getErrorMessage(err));
  } finally {
    setLoading(btn, false, "Create Account");
  }
}

function handleLogout() {
  Auth.logout();
  showAuth("login");
  showToast("Signed out.");
}

/* ─────────────────────────────────────────────
   PASSWORD CRUD
───────────────────────────────────────────── */
async function loadPasswords() {
  const list = document.getElementById("password-list");
  list.innerHTML = `<div class="loading-state">Loading vault…</div>`;

  try {
    const res = await Passwords.getAll();
    console.log(res, "Res");

    passwords = res.data.data || [];

    chrome.storage.local.get(["vaultx_user"], (result) => {
      const user = result.vaultx_user || {};

      document.getElementById("user-name").textContent =
        user.username || user.email || "User";
    });

    document.getElementById("vault-count").textContent =
      `${passwords.length} item${passwords.length !== 1 ? "s" : ""}`;

    renderPasswordList();
  } catch (err) {
    list.innerHTML = `<div class="empty-state">⚠ Failed to load vault.<br><small>${getErrorMessage(err)}</small></div>`;
  }
}

function renderPasswordList() {
  const list = document.getElementById("password-list");
  const filtered = passwords.filter(
    (p) =>
      (p.appName || "").toLowerCase().includes(searchQuery) ||
      (p.siteUrl || "").toLowerCase().includes(searchQuery) ||
      (p.loginUsername || "").toLowerCase().includes(searchQuery),
  );

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">${searchQuery ? "No results found." : "Your vault is empty.<br>Add your first password!"}</div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (entry) => `
  <div class="pw-item" data-id="${entry.id}">
    <div class="pw-item-icon">
      ${getFavicon(entry.siteUrl, entry.appName)}
    </div>

    <div class="pw-item-info">
      <!-- App Name -->
      <span class="pw-item-site">
        ${escHtml(entry.appName || "Unnamed")}
      </span>

      <!-- URL separate -->
      <span class="pw-item-sub">
        ${escHtml(entry.siteUrl || "")}
      </span>

      <!-- Username separate -->
      <span class="pw-item-sub">
        ${escHtml(entry.loginUsername || "")}
      </span>
    </div>

    <div class="pw-item-arrow">›</div>
  </div>
`,
    )
    .join("");

  list.querySelectorAll(".pw-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const entry = passwords.find((p) => String(p.id) === String(id));
      if (entry) showDetail(entry);
    });
  });
}

async function handleAddPassword(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-save-add");
  clearErrors("add-error");
  setLoading(btn, true, "Saving…");

  const data = {
    appName: document.getElementById("add-site-name").value.trim(),
    siteUrl: document.getElementById("add-site-url").value.trim(),
    loginUsername: document.getElementById("add-username").value.trim(),
    password: document.getElementById("add-password").value,
    notes: document.getElementById("add-notes").value.trim(),
  };

  try {
    const res = await Passwords.create(data);
    console.log(res, "Res");

    showToast("Password saved!");
    showVault();
  } catch (err) {
    console.log(err, "er");

    showError("add-error", getErrorMessage(err));
  } finally {
    setLoading(btn, false, "Save Password");
  }
}

async function handleEditPassword(e) {
  e.preventDefault();
  if (!selectedEntry) return;
  const btn = document.getElementById("btn-save-edit");
  clearErrors("edit-error");
  setLoading(btn, true, "Updating…");

  const data = {
    appName: document.getElementById("edit-site-name").value.trim(),
    siteUrl: document.getElementById("edit-site-url").value.trim(),
    loginUsername: document.getElementById("edit-username").value.trim(),
    password: document.getElementById("edit-password").value,
    notes: document.getElementById("edit-notes").value.trim(),
  };

  try {
    await Passwords.update(selectedEntry.id, data);
    showToast("Password updated!");
    // Update local state
    const idx = passwords.findIndex((p) => p.id === selectedEntry.id);
    if (idx !== -1) passwords[idx] = { ...selectedEntry, ...data };
    selectedEntry = { ...selectedEntry, ...data };
    showDetail(selectedEntry);
  } catch (err) {
    showError("edit-error", getErrorMessage(err));
  } finally {
    setLoading(btn, false, "Update Password");
  }
}

async function handleDeletePassword() {
  if (!selectedEntry) return;
  if (!confirm(`Delete "${selectedEntry.appName}"? This cannot be undone.`))
    return;

  try {
    await Passwords.delete(selectedEntry.id);
    passwords = passwords.filter((p) => p.id !== selectedEntry.id);
    selectedEntry = null;
    showToast("Deleted.");
    showVault();
  } catch (err) {
    showToast("Failed to delete: " + getErrorMessage(err), true);
  }
}

/* ─────────────────────────────────────────────
   AUTOFILL
───────────────────────────────────────────── */
async function handleAutofill() {
  if (!selectedEntry) return;

  try {
    // fetch decrypted password first
    const res = await Passwords.getById(selectedEntry.id);
    const fullEntry = res.data.data;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: "AUTOFILL",
          data: {
            username: fullEntry.loginUsername,
            password: fullEntry.password,
          },
        },
        (res) => {
          showToast(
            res?.success
              ? "Autofilled!"
              : "Could not find fields on this page.",
            !res?.success,
          );
        },
      );
    });
  } catch (err) {
    showToast("Failed to autofill (password not fetched)", true);
  }
}

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
function generatePassword(fieldId) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}";
  let pw = "";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  arr.forEach((n) => {
    pw += chars[n % chars.length];
  });
  const field = document.getElementById(fieldId);
  field.type = "text";
  field.value = pw;
  showToast("Strong password generated!");
}

function copyToClipboard(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    const orig = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1500);
    showToast("Copied to clipboard!");
  });
}

function getFavicon(url, appName) {
  if (url) {
    try {
      const domain = new URL(url).hostname;
      return `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none">${(appName || "?")[0].toUpperCase()}</span>`;
    } catch {}
  }
  return `<span>${(appName || "?")[0].toUpperCase()}</span>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getErrorMessage(err) {
  const res = err?.response?.data;
  console.log(err, "res");

  if (res?.message === "Validation Failed" && typeof res?.data === "object") {
    return Object.values(res.data).join("\n");
  }

  return res?.message || res?.error || err?.message || "Something went wrong.";
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}

function clearErrors(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "";
      el.classList.add("hidden");
    }
  } else {
    document.querySelectorAll(".error-msg").forEach((el) => {
      el.textContent = "";
      el.classList.add("hidden");
    });
  }
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.textContent = text;
  btn.classList.toggle("loading", loading);
}

let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}

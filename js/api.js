import { ENV } from "./env.js";

// Free hosting tiers can take up to a minute to wake up, so allow for that.
const REQUEST_TIMEOUT_MS = 70000;
const AUTH_PATHS = ["/login", "/register"];

async function getToken() {
  const res = await chrome.storage.local.get("vaultx_token");
  return res.vaultx_token;
}

async function request(method, url, body) {
  const isAuthCall = AUTH_PATHS.includes(url);
  const headers = { "Content-Type": "application/json" };

  if (!isAuthCall) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(ENV.API_BASE_URL + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      err?.name === "AbortError"
        ? "The server is taking too long to respond. Please try again."
        : "Cannot reach the server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // Expired / invalid token on a protected call -> sign the user out.
  if (res.status === 401 && !isAuthCall) {
    await chrome.storage.local.remove(["vaultx_token", "vaultx_user"]);
    const error = new Error("Session expired. Please sign in again.");
    error.code = "SESSION_EXPIRED";
    throw error;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      res.statusText ||
      "Request failed";

    const error = new Error(msg);

    // Keep the full backend validation data so the UI can show field errors.
    error.response = {
      status: res.status,
      data: data,
    };

    throw error;
  }

  return { data };
}

/* ── AUTH ── */
const Auth = {
  register: (username, email, password) =>
    request("POST", "/register", {
      name: username,
      email: email,
      password: password,
    }),

  login: (email, password) => request("POST", "/login", { email, password }),

  logout: () => chrome.storage.local.remove(["vaultx_token", "vaultx_user"]),
};

/* ── PASSWORDS ── */
const Passwords = {
  getAll: () => request("GET", "/vault"),

  getById: (id) => request("GET", `/vault/${id}`),

  create: (data) => request("POST", "/vault", data),

  update: (id, data) => request("PATCH", `/vault/${id}`, data),

  delete: (id) => request("DELETE", `/vault/${id}`),
};
export { Auth, Passwords };

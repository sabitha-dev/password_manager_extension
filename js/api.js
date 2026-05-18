// VaultX API Layer — Fetch based (no axios needed)

function getToken() {
  return localStorage.getItem("vaultx_token");
}

async function request(method, url, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(ENV.API_BASE_URL + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // handle 401 auto logout
  if (res.status === 401) {
    localStorage.removeItem("vaultx_token");
    localStorage.removeItem("vaultx_user");
    throw new Error("Unauthorized. Please login again.");
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      res.statusText ||
      "Request failed";
    throw new Error(msg);
  }

  return { data };
}

/* ── AUTH ── */
const Auth = {
   register: (username, email, password) =>
     request("POST","/register", {
      name: username, 
      email: email,
      password: password
    }),

  login: (email, password) =>
    request("POST", "/login", { email, password }),

  logout: () => {
    localStorage.removeItem("vaultx_token");
    localStorage.removeItem("vaultx_user");
  }
};

/* ── PASSWORDS ── */
const Passwords = {
  getAll: () => request("GET", "/vault"),

  getById: (id) => request("GET", `/vault/${id}`),

  create: (data) => request("POST", "/vault", data),

  update: (id, data) => request("PATCH", `/vault/${id}`, data),

  delete: (id) => request("DELETE", `/vault/${id}`)
};
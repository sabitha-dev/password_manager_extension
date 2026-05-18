# VaultX – Chrome Extension Password Manager

A complete Chrome extension for managing passwords, backed by a Spring Boot API.

---

## 📁 Project Structure

```
password-manager-extension/
├── manifest.json          # Chrome Extension manifest v3
├── popup.html             # Full extension UI (all views)
├── .env.example           # Environment config template
├── css/
│   └── popup.css          # All styles
├── js/
│   ├── config.js          # ← SET YOUR BACKEND URL HERE
│   ├── api.js             # Axios API layer (Auth + Passwords)
│   ├── popup.js           # Full app logic
│   ├── background.js      # Service worker
│   └── content.js         # Autofill content script
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚙️ Setup

### 1. Set your backend URL

Edit `js/config.js`:
```js
const ENV = {
  API_BASE_URL: "http://localhost:8080/api"
  // Change to your deployed URL in production
};
```

### 2. Add icons

Place PNG icons in the `icons/` folder:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

### 3. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `password-manager-extension/` folder

---

## 🔌 Expected Spring Boot API Endpoints

### Auth
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ username, email, password }` | `{ message }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: { id, username, email } }` |

### Passwords (JWT protected via `Authorization: Bearer <token>`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/passwords` | — | `[ PasswordEntry ]` |
| GET | `/api/passwords/:id` | — | `PasswordEntry` |
| POST | `/api/passwords` | `PasswordEntry` | `PasswordEntry` |
| PUT | `/api/passwords/:id` | `PasswordEntry` | `PasswordEntry` |
| DELETE | `/api/passwords/:id` | — | `{ message }` |
| GET | `/api/passwords/search?q=...` | — | `[ PasswordEntry ]` |

### PasswordEntry shape
```json
{
  "id": 1,
  "siteName": "GitHub",
  "siteUrl": "https://github.com",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "s3cr3t!",
  "notes": "Work account"
}
```

---

## ✨ Features

- **Login / Register** with JWT auth
- **Vault list** with search/filter
- **Add, View, Edit, Delete** passwords
- All fields: site name, URL, username, email, password, notes
- **Copy to clipboard** (username, email, password)
- **Autofill** into browser forms
- **Password generator** (cryptographically secure)
- **Show/hide** password toggles
- Toast notifications
- Premium dark UI with Syne + DM Mono fonts

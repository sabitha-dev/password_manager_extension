# VaultX – Chrome Extension Password Manager

Manifest V3 Chrome extension backed by the Spring Boot API in `Password_Manager_Backend`.

## Structure

```
├── manifest.json
├── popup.html            # popup UI (all views)
├── css/popup.css
├── icons/
└── js/
    ├── env.js            # ← backend URL
    ├── api.js            # API layer used by the popup
    ├── popup.js          # popup logic
    ├── background.js     # service worker: "Save / Update password" notifications
    ├── content.js        # detects logins, autofills forms
    └── utils.js          # site matching helpers
```

## Setup

1. Set the backend URL in `js/env.js` **and** the same origin in `host_permissions` in `manifest.json`
   (e.g. `"http://localhost:8080/*"` for local development).
2. Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked** and select this folder.
3. After changing any file, press **Reload** on the extension card (and refresh open tabs so the new content script is used).

## How the save / update alerts work

1. `content.js` notices a login (form submit, Enter key, or a sign-in button click) and sends it to the background worker.
2. `background.js` waits ~2.5 s, asks the page whether the login failed, and checks the vault.
3. New site/username → **Save** prompt. Known site/username with a different password → **Update** prompt.
4. Clicking the button saves/updates and shows a confirmation notification. Errors (server unreachable, session expired) are also shown as notifications.

Pending passwords are kept only in `chrome.storage.session` (memory, cleared when the browser closes).

## API used

| Method | Path          | Notes                                                       |
| ------ | ------------- | ----------------------------------------------------------- |
| POST   | `/register`   | `{ name, email, password }`                                 |
| POST   | `/login`      | `{ email, password }` → `data` is the JWT                   |
| GET    | `/vault`      | list (passwords returned encrypted)                         |
| GET    | `/vault/{id}` | one entry with the decrypted password                       |
| POST   | `/vault`      | `{ siteUrl, appName, loginUsername, password, notes }`      |
| PATCH  | `/vault/{id}` | any subset of the fields above                              |
| DELETE | `/vault/{id}` |                                                             |

All `/vault` calls need `Authorization: Bearer <token>`; an expired token returns `401`.

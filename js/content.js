(() => {
  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  const TEXT_TYPES = ["text", "email", "tel", ""];

  const isVisible = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const extensionAlive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  const visiblePasswordInputs = (scope = document) =>
    [...scope.querySelectorAll('input[type="password"]')].filter(isVisible);

  /** The input that most likely holds the username: the closest text/email field before the password field. */
  function findUsernameInput(passwordInput, scope = document) {
    const inputs = [...scope.querySelectorAll("input")];
    const index = inputs.indexOf(passwordInput);
    const candidates = inputs
      .slice(0, index === -1 ? inputs.length : index)
      .filter(
        (el) =>
          TEXT_TYPES.includes((el.getAttribute("type") || "").toLowerCase()) &&
          isVisible(el) &&
          !el.disabled &&
          !el.readOnly,
      );
    if (candidates.length === 0) return null;

    const preferred = [...candidates]
      .reverse()
      .find(
        (el) =>
          /username|email/i.test(el.autocomplete || "") ||
          el.type === "email" ||
          /user|email|login|account/i.test(`${el.name} ${el.id}`),
      );
    return preferred || candidates[candidates.length - 1];
  }

  /** Reads what the user typed in the login / signup / change-password form. */
  function readCredentials(scope) {
    const root = scope || document;
    const passwords = [...root.querySelectorAll('input[type="password"]')].filter(
      (el) => el.value,
    );
    if (passwords.length === 0) return null;

    const usernameInput = findUsernameInput(passwords[0], root);
    const username = usernameInput?.value.trim();
    if (!username) return null;

    return {
      username,
      // Last filled password: for "change password" forms this is the new one.
      password: passwords[passwords.length - 1].value,
    };
  }

  /** Climbs from an element to the nearest container that includes a password field. */
  function containerWithPassword(el) {
    let node = el;
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      if (node.querySelector?.('input[type="password"]')) return node;
    }
    return null;
  }

  /* ─────────────────────────────────────────────
     LOGIN DETECTION
  ───────────────────────────────────────────── */
  let lastSent = { key: "", at: 0 };

  function captureAndSend(scope) {
    if (!extensionAlive()) return;

    const creds = readCredentials(scope);
    if (!creds) return;

    // submit + click + Enter can all fire for one login; send it once.
    const key = `${creds.username}\n${creds.password}`;
    if (key === lastSent.key && Date.now() - lastSent.at < 5000) return;
    lastSent = { key, at: Date.now() };

    // Sent immediately: the page may navigate away right after submitting,
    // which would destroy any timer started here. The background worker
    // decides whether the login succeeded.
    try {
      chrome.runtime.sendMessage({
        type: "LOGIN_ATTEMPT",
        data: {
          ...creds,
          domain: location.hostname,
          origin: location.origin,
        },
      });
    } catch (err) {
      console.debug("VaultX: could not send login attempt", err);
    }
  }

  // 1) Normal <form> submissions
  document.addEventListener(
    "submit",
    (e) => captureAndSend(e.target instanceof HTMLFormElement ? e.target : null),
    true,
  );

  // 2) Single-page apps that log in with a button handler instead of a submit
  const SUBMIT_LABEL =
    /log ?in|sign ?in|submit|continue|next|register|sign ?up|create|save|update|change|confirm/i;
  const NOT_SUBMIT_LABEL = /show|hide|toggle|visible|eye|forgot|reset|cancel/i;

  document.addEventListener(
    "click",
    (e) => {
      const button =
        e.target instanceof Element
          ? e.target.closest(
              'button, input[type="submit"], input[type="button"], [role="button"]',
            )
          : null;
      if (!button) return;

      const label =
        `${button.textContent || ""} ${button.value || ""} ${button.getAttribute("aria-label") || ""} ${button.title || ""}`.trim();
      if (NOT_SUBMIT_LABEL.test(label)) return;

      const isSubmitButton =
        button.type === "submit" || (!button.getAttribute("type") && button.tagName === "BUTTON");
      // Real submit buttons inside a <form> are handled by the submit event.
      if (isSubmitButton && button.closest("form")) return;
      if (!isSubmitButton && !SUBMIT_LABEL.test(label)) return;

      captureAndSend(containerWithPassword(button));
    },
    true,
  );

  // 3) Enter pressed in a field that is not inside a <form>
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
      if (e.target.form) return; // handled by the submit event
      captureAndSend(containerWithPassword(e.target));
    },
    true,
  );

  /* ─────────────────────────────────────────────
     DID THE LOGIN FAIL?
     Only looks at elements that look like error messages
     (not the whole page text, which often contains words like "error").
  ───────────────────────────────────────────── */
  const ERROR_WORDS =
    /invalid|incorrect|wrong|failed|not match|try again|error|denied|unauthori[sz]ed|not found|doesn't|does not|couldn't|unable/i;

  function visibleErrorMessage() {
    const selector = [
      '[role="alert"]',
      '[aria-live="assertive"]',
      '[aria-invalid="true"]',
      ".error",
      ".errors",
      ".alert-danger",
      ".invalid-feedback",
      '[class*="error" i]',
      '[class*="invalid" i]',
    ].join(",");

    return [...document.querySelectorAll(selector)].some(
      (el) =>
        isVisible(el) &&
        (el.matches('[aria-invalid="true"]') ||
          ERROR_WORDS.test(el.innerText || el.textContent || "")),
    );
  }

  function loginLooksFailed() {
    // Login form is gone -> navigated / modal closed -> success.
    // Form still there AND an error is showing -> failed.
    return visiblePasswordInputs().length > 0 && visibleErrorMessage();
  }

  /* ─────────────────────────────────────────────
     AUTOFILL
  ───────────────────────────────────────────── */
  function setFieldValue(el, value) {
    // Use the native setter so React / Vue style frameworks notice the change.
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      "value",
    )?.set;
    if (setter) setter.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillCredentials({ username, password }) {
    const passField = visiblePasswordInputs()[0];
    const userField = passField
      ? findUsernameInput(passField)
      : document.querySelector(
          'input[type="email"], input[type="text"], input:not([type])',
        );

    let filled = false;
    if (userField && username) {
      setFieldValue(userField, username);
      filled = true;
    }
    if (passField && password) {
      setFieldValue(passField, password);
      filled = true;
    }
    return filled;
  }

  /* ─────────────────────────────────────────────
     MESSAGES FROM THE EXTENSION
  ───────────────────────────────────────────── */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CHECK_LOGIN_STATE") {
      sendResponse({ failed: loginLooksFailed() });
    } else if (message?.type === "AUTOFILL") {
      sendResponse({ success: fillCredentials(message.data || {}) });
    }
    // Synchronous responses only.
    return false;
  });

  /* ─────────────────────────────────────────────
     OFFER AUTOFILL WHEN A LOGIN PAGE OPENS
  ───────────────────────────────────────────── */
  function offerAutofill() {
    if (!extensionAlive() || visiblePasswordInputs().length === 0) return;

    chrome.runtime.sendMessage(
      { type: "GET_CREDENTIALS", domain: location.hostname },
      (res) => {
        if (chrome.runtime.lastError || !res?.data) return;

        const creds = res.data;
        if (!confirm(`Autofill saved password for ${creds.username}?`)) return;

        fillCredentials(creds);
      },
    );
  }

  // The "load" event may already have fired by the time this script runs.
  if (document.readyState === "complete") offerAutofill();
  else window.addEventListener("load", offerAutofill, { once: true });
})();

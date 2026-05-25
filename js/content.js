console.log("VaultX running:", location.href);

let formData = {
  username: "",
  password: "",
};

let passwords = [];

// CAPTURE INPUTS
document.addEventListener("input", (e) => {
  const el = e.target;

  if (el.type === "password") {
    formData.password = el.value;

    if (!passwords.includes(el.value)) {
      passwords.push(el.value);
    }
  }

  if (el.type === "email" || el.type === "text") {
    formData.username = el.value;
  }
});

// SUBMIT DETECTION

document.addEventListener(
  "submit",
  () => {
    const passwordFields = [
      ...document.querySelectorAll('input[type="password"]'),
    ].filter((input) => input.value);

    const filledPasswords = passwordFields.map((input) => input.value);

    if (!formData.username || filledPasswords.length === 0) {
      return;
    }

    // WAIT FOR LOGIN SUCCESS
    setTimeout(() => {
      const pageText = document.body.innerText.toLowerCase();

      const isError =
        pageText.includes("invalid") ||
        pageText.includes("wrong password") ||
        pageText.includes("incorrect") ||
        pageText.includes("failed") ||
        pageText.includes("error") ||
        pageText.includes("try again") ||
        pageText.includes("not found") ||
        pageText.includes("not match") ||
        pageText.includes("login failed") ||
        pageText.includes("invalid credentials");

      if (isError) {
        console.log("LOGIN FAILED → NO SAVE/UPDATE");
        return;
      }

      chrome.runtime.sendMessage({
        type: "LOGIN_ATTEMPT",
        data: {
          username: formData.username,
          password: filledPasswords[filledPasswords.length - 1],
          domain: location.hostname,
        },
      });

      console.log("LOGIN SUCCESS DETECTED");
    }, 3000);
  },
  true,
);
window.addEventListener("load", () => {
  const hasPasswordField = document.querySelector('input[type="password"]');

  if (!hasPasswordField) return;

  chrome.runtime.sendMessage(
    {
      type: "GET_CREDENTIALS",
      domain: location.hostname,
    },
    (res) => {
      console.log("AUTOFILL RESPONSE:", res);

      if (!res?.data) return;

      const creds = res.data;

      const shouldFill = confirm(
        `Autofill saved password for ${creds.username}?`,
      );

      if (!shouldFill) return;

      const userField = document.querySelector(
        'input[type="email"], input[type="text"]',
      );

      const passField = document.querySelector('input[type="password"]');

      if (userField) {
        userField.value = creds.username;
        userField.dispatchEvent(new Event("input", { bubbles: true }));
      }

      if (passField) {
        passField.value = creds.password;
        passField.dispatchEvent(new Event("input", { bubbles: true }));
      }

      console.log("AUTOFILL SUCCESS");
    },
  );
});

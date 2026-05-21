
// console.log("VaultX running:", location.href);

// let formData = {
//   username: "",
//   password: ""
// };

// // Capture input values
// document.addEventListener("input", (e) => {
//   const el = e.target;

//   if (
//     el.type === "email" ||
//     el.type === "text"
//   ) {
//     formData.username = el.value;
//   }

//   if (el.type === "password") {
//     formData.password = el.value;
//   }
// });

// document.addEventListener("submit", (e) => {

//   if (!formData.username || !formData.password) return;

//   console.log("LOGIN SUBMIT DETECTED", formData);

//   chrome.runtime.sendMessage({
//     type: "PROMPT_SAVE_CREDENTIAL",
//     data: {
//       username: formData.username,
//       password: formData.password,
//       domain: location.hostname
//     }
//   });

// }, true);


console.log("VaultX running:", location.href);

let formData = {
  username: "",
  password: ""
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
document.addEventListener("submit", (e) => {

  const passwordFields = [
    ...document.querySelectorAll('input[type="password"]')
  ].filter(input => input.value);

  console.log("PASSWORD FIELDS:", passwordFields);

  const filledPasswords =
    passwordFields.map(input => input.value);

  // UPDATE PASSWORD
  if (filledPasswords.length >= 2) {

    const oldPassword = filledPasswords[0];

    const newPassword =
      filledPasswords[filledPasswords.length - 1];

    // SAME PASSWORD
    if (oldPassword === newPassword) {
      passwords = [];
      return;
    }

    console.log("UPDATE DETECTED");

    chrome.runtime.sendMessage({
      type: "PROMPT_UPDATE_CREDENTIAL",
      data: {
        username: formData.username || "Admin",
        password: newPassword,
        domain: location.hostname
      }
    });

  }

  // NORMAL LOGIN
    else if (filledPasswords.length === 1) {

    console.log("LOGIN DETECTED");

    chrome.runtime.sendMessage({
      type: "PROMPT_SAVE_CREDENTIAL",
      data: {
        username: formData.username,
        password: filledPasswords[0],
        domain: location.hostname
      }
    });

  }

  passwords = [];

}, true);

window.addEventListener("load", () => {

  const hasPasswordField =
    document.querySelector('input[type="password"]');

  if (!hasPasswordField) return;

  chrome.runtime.sendMessage(
    {
      type: "GET_CREDENTIALS",
      domain: location.hostname
    },
    (res) => {

      console.log("AUTOFILL RESPONSE:", res);

      if (!res?.data) return;

      const creds = res.data;

      const shouldFill = confirm(
        `Autofill saved password for ${creds.username}?`
      );

      if (!shouldFill) return;

      const userField = document.querySelector(
        'input[type="email"], input[type="text"]'
      );

      const passField = document.querySelector(
        'input[type="password"]'
      );

      if (userField) {
        userField.value = creds.username;
        userField.dispatchEvent(
          new Event("input", { bubbles: true })
        );
      }

      if (passField) {
        passField.value = creds.password;
        passField.dispatchEvent(
          new Event("input", { bubbles: true })
        );
      }

      console.log("AUTOFILL SUCCESS");

    }
  );

});

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

// // Detect form submit/login button click
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

// Detect form submit
document.addEventListener("submit", (e) => {
  if (!formData.username) return;

  // Password update case
  if (passwords.length >= 2) {
    const newPassword = passwords[passwords.length - 1];

    console.log("PASSWORD UPDATE DETECTED", newPassword);

    chrome.runtime.sendMessage({
      type: "PROMPT_UPDATE_CREDENTIAL",
      data: {
        username: formData.username,
        password: newPassword,
        domain: location.hostname
      }
    });

  } 
  // Login save case
  else if (formData.password) {
    console.log("LOGIN SUBMIT DETECTED", formData);

    chrome.runtime.sendMessage({
      type: "PROMPT_SAVE_CREDENTIAL",
      data: {
        username: formData.username,
        password: formData.password,
        domain: location.hostname
      }
    });
  }

  passwords = [];

}, true);
window.addEventListener("load", () => {
  chrome.runtime.sendMessage(
    {
      type: "GET_CREDENTIALS",
      domain: location.hostname
    },
    (res) => {
      if (!res?.data) return;

      const creds = res.data;

      const userField = document.querySelector(
        'input[type="email"], input[type="text"]'
      );

      const passField = document.querySelector(
        'input[type="password"]'
      );

      if (userField) userField.value = creds.username;
      if (passField) passField.value = creds.password;

      console.log("AUTOFILLED SUCCESS");
    }
  );
});
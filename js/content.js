console.log("VaultX running:", location.href);

let formData = {
  username: "",
  password: ""
};

// capture typing
document.addEventListener("input", (e) => {
  const el = e.target;

  if (el.type === "email" || el.type === "text") {
    formData.username = el.value;
  }

  if (el.type === "password") {
    formData.password = el.value;
  }
});

// detect user finished login (MOST RELIABLE)
document.addEventListener("blur", (e) => {
  const el = e.target;

  if (el.type !== "password") return;

  setTimeout(() => {
    if (!formData.username || !formData.password) return;

    console.log("LOGIN DETECTED:", formData);

    chrome.runtime.sendMessage({
      type: "PROMPT_SAVE_CREDENTIAL",
      data: {
        username: formData.username,
        password: formData.password,
        domain: location.hostname
      }
    });

  }, 500);
}, true);
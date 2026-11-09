/* Entry point for login.html. */

import { Api } from "./core/api.js";
import { redirectIfLoggedIn } from "./core/auth-guard.js";
import { showFormError } from "./utils/form.js";

redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("authError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  try {
    await Api.login(email, password);
    window.location.href = "dashboard";
  } catch (err) {
    showFormError(errorBox, err.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
  }
});

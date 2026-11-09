/* Entry point for signup.html. */

import { Api } from "./core/api.js";
import { redirectIfLoggedIn } from "./core/auth-guard.js";
import { showFormError } from "./utils/form.js";

redirectIfLoggedIn();

const form = document.getElementById("signupForm");
const errorBox = document.getElementById("authError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!name || !email || !password) {
    showFormError(errorBox, "الرجاء تعبئة جميع الحقول.");
    return;
  }
  try {
    await Api.signup(name, email, password);
    window.location.href = "dashboard";
  } catch (err) {
    showFormError(errorBox, err.message || "تعذّر إنشاء الحساب.");
  }
});

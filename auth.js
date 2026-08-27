function requireAuth() {
  const token = Api.getToken();
  if (!token) {
    window.location.href = "login.html";
    return null;
  }
  return Api.getSessionUser();
}

function redirectIfLoggedIn() {
  if (Api.getToken()) {
    window.location.href = "dashboard.html";
  }
}

function initSignupForm() {
  redirectIfLoggedIn();
  const form = document.getElementById("signupForm");
  const errorBox = document.getElementById("authError");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!name || !email || !password) {
      showError(errorBox, "الرجاء تعبئة جميع الحقول.");
      return;
    }
    try {
      await Api.signup(name, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(errorBox, err.message || "تعذّر إنشاء الحساب.");
    }
  });
}

function initLoginForm() {
  redirectIfLoggedIn();
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("authError");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    try {
      await Api.login(email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(errorBox, err.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }
  });
}

function showError(box, message) {
  box.textContent = message;
  box.classList.add("visible");
}

function logout() {
  Api.clearSession();
  window.location.href = "login.html";
}

DataStore.seedIfNeeded();

function requireAuth() {
  const session = DataStore.getSession();
  if (!session) {
    window.location.href = "login.html";
  }
  return session;
}

function redirectIfLoggedIn() {
  if (DataStore.getSession()) {
    window.location.href = "dashboard.html";
  }
}

function initSignupForm() {
  redirectIfLoggedIn();
  const form = document.getElementById("signupForm");
  const errorBox = document.getElementById("authError");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    if (!name || !email || !password) {
      showError(errorBox, "الرجاء تعبئة جميع الحقول.");
      return;
    }
    const users = DataStore.getUsers();
    if (users.some((u) => u.email === email)) {
      showError(errorBox, "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.");
      return;
    }
    const user = { id: DataStore.uid("user"), name, email, password };
    users.push(user);
    DataStore.saveUsers(users);
    DataStore.setSession(user);
    window.location.href = "dashboard.html";
  });
}

function initLoginForm() {
  redirectIfLoggedIn();
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("authError");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const users = DataStore.getUsers();
    let user = users.find((u) => u.email === email && u.password === password);

    // Convenience demo account so the dashboard can be explored instantly.
    if (!user && email === "demo@aqari.app" && password === "demo1234") {
      user = { id: "demo_user", name: "حساب تجريبي", email };
    }

    if (!user) {
      showError(errorBox, "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      return;
    }
    DataStore.setSession(user);
    window.location.href = "dashboard.html";
  });
}

function showError(box, message) {
  box.textContent = message;
  box.classList.add("visible");
}

function logout() {
  DataStore.clearSession();
  window.location.href = "login.html";
}

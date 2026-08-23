const navToggle = document.getElementById("navToggle");
const navLinks = document.querySelector(".nav-links");
const navAuth = document.querySelector(".nav-auth");

if (navToggle) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
    navAuth.classList.toggle("mobile-open");
  });
}

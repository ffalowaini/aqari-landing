/* Form helpers shared by the login and signup pages. */

export function showFormError(box, message) {
  box.textContent = message;
  box.classList.add("visible");
}

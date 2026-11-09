/* Page access rules: dashboard needs a session, login/signup skip ahead when signed in. */

import { clearSession, getSessionUser, getToken } from "./session.js";

/** Sends the visitor to the login page unless signed in; returns the signed-in user. */
export function requireAuth() {
  if (!getToken()) {
    window.location.href = "login";
    return null;
  }
  return getSessionUser();
}

export function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.href = "dashboard";
  }
}

export function logout() {
  clearSession();
  window.location.href = "login";
}

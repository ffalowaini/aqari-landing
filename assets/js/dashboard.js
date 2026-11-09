/* Entry point for dashboard.html: checks the session, wires the app shell
   (sidebar, logout, modal overlay, table filters), then starts the router. */

import { requireAuth, logout } from "./core/auth-guard.js";
import { els } from "./components/dom.js";
import { closeModal } from "./components/modal.js";
import { wireTableFilters } from "./components/table-filter.js";
import { initTestClock } from "./features/test-clock.js";
import { router } from "./router.js";

const session = requireAuth();
if (session) els.user.textContent = session.name;

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("sidebarToggle").addEventListener("click", () => {
  els.sidebar.classList.toggle("open");
});
els.modalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

// Every page renders into #appContent — wire any new filter bars as they appear.
new MutationObserver(() => wireTableFilters(els.content)).observe(els.content, { childList: true, subtree: true });

window.addEventListener("hashchange", router);
initTestClock().finally(router);

/* Hash router: maps #units, #overview, #admin, #property/:id, #unit/:id to pages. */

import { els } from "./components/dom.js";
import { loadingHTML, safely } from "./components/modal.js";
import { renderAdmin } from "./pages/admin.js";
import { renderOverview } from "./pages/overview.js";
import { renderPropertyDetails } from "./pages/property-details.js";
import { renderUnitDetails } from "./pages/unit-details.js";
import { renderUnits } from "./pages/units.js";

const routes = {
  units: { title: "الوحدات", render: renderUnits },
  overview: { title: "لوحة المعلومات", render: renderOverview },
  admin: { title: "الإدارة", render: renderAdmin },
};

export async function router() {
  const hash = (window.location.hash || "#units").slice(1);
  const [routeKey, param] = hash.split("/");
  els.content.innerHTML = loadingHTML();
  els.sidebar.classList.remove("open");

  if (routeKey === "property" && param) {
    els.title.textContent = "تفاصيل العقار";
    document.querySelectorAll(".sidebar-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === "units"));
    await safely(() => renderPropertyDetails(param));
    return;
  }
  if (routeKey === "unit" && param) {
    els.title.textContent = "تفاصيل الوحدة";
    document.querySelectorAll(".sidebar-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === "units"));
    await safely(() => renderUnitDetails(param));
    return;
  }

  const route = routes[routeKey] || routes.units;
  els.title.textContent = route.title;
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === routeKey);
  });
  await safely(route.render);
}

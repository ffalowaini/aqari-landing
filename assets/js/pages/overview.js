/* Page: لوحة المعلومات — dashboard boxes (reorderable by drag and drop). */

import { Api } from "../core/api.js";
import { els } from "../components/dom.js";
import { filterBarHTML } from "../components/table-filter.js";
import { money, statusBadge, toHijri } from "../utils/format.js";

const DASH_ORDER_KEY = "aqari_dash_order";

const DASH_BOX_TITLES = {
  stats1: "أرقام أساسية",
  stats2: "العقود والتحصيل",
  delayed: "الوحدات المتأخرة",
  upcoming: "مستحقات الشهر القادم",
  ended: "مستحقات على عقود منتهية",
};

function getDashOrder(defaultIds) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(DASH_ORDER_KEY) || "[]"); } catch (e) { saved = []; }
  const known = new Set(defaultIds);
  const filtered = saved.filter((id) => known.has(id));
  const missing = defaultIds.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

function saveDashOrder(order) {
  try { localStorage.setItem(DASH_ORDER_KEY, JSON.stringify(order)); } catch (e) { /* ignore */ }
}

export async function renderOverview() {
  const o = await Api.getOverview();

  const boxes = {
    stats1: `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">إجمالي الوحدات</div><div class="stat-value">${o.totalUnits}</div></div>
        <div class="stat-card"><div class="stat-label">نسبة الإشغال</div><div class="stat-value">${o.occupancyRate}%</div></div>
        <div class="stat-card accent"><div class="stat-label">المحصّل من العقود السارية (السنة الحالية)</div><div class="stat-value">${money(o.totalPaid)}</div></div>
        <div class="stat-card warn"><div class="stat-label">المتبقي من العقود السارية (متأخرات + السنة الحالية)</div><div class="stat-value">${money(o.totalRemaining)}</div></div>
      </div>
    `,
    stats2: `
      <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
        <div class="stat-card"><div class="stat-label">إجمالي قيمة العقود السارية</div><div class="stat-value">${money(o.totalRent)}</div></div>
        <div class="stat-card accent"><div class="stat-label">نسبة التحصيل</div><div class="stat-value">${o.collectionRate}%</div></div>
      </div>
    `,
    delayed: `
      <div class="panel">
        <div class="panel-head"><h2>الوحدات المتأخرة في السداد (${o.unpaidUnits.length})</h2></div>
        ${o.unpaidUnits.length ? `
          <div style="overflow-x:auto;">
            ${filterBarHTML("dash-delayed")}
        <table class="data-table" data-filter-table="dash-delayed">
              <thead><tr><th>المستأجر</th><th>الوحدة</th><th>متأخرات سابقة</th><th>المتبقي (السنة الحالية)</th><th>الإجمالي</th><th>حالة الدفع</th></tr></thead>
              <tbody>
                ${o.unpaidUnits.map((r) => `
                  <tr>
                    <td>${r.tenantName}</td>
                    <td>${r.unitLabel}</td>
                    <td>${r.oldArrears > 0 ? `<span style="color:#dc2626;font-weight:700;">${money(r.oldArrears)}</span>` : "—"}</td>
                    <td>${money(r.currentRemaining)}</td>
                    <td><strong>${money(r.totalOwed)}</strong></td>
                    <td>${statusBadge(r.status)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state">لا توجد وحدات متأخرة في السداد حاليًا. 👍</div>`}
      </div>
    `,
    upcoming: `
      <div class="panel">
        <div class="panel-head"><h2>مبالغ مستحقة الشهر القادم (${o.upcomingNextMonth.length})</h2></div>
        ${o.upcomingNextMonth.length ? `
          <div style="overflow-x:auto;">
            ${filterBarHTML("dash-upcoming")}
        <table class="data-table" data-filter-table="dash-upcoming">
              <thead><tr><th>المستأجر</th><th>الوحدة</th><th>تاريخ الاستحقاق (هجري)</th><th>المبلغ</th></tr></thead>
              <tbody>
                ${o.upcomingNextMonth.map((p) => `
                  <tr>
                    <td>${p.tenantName}</td>
                    <td>${p.unitLabel}</td>
                    <td>${toHijri(p.dueDate)}</td>
                    <td>${money(p.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state">لا توجد دفعات مستحقة خلال الشهر القادم.</div>`}
      </div>
    `,
    ended: `
      <div class="panel">
        <div class="panel-head"><h2>مستحقات على عقود منتهية: ${money(o.endedContractsOutstanding || 0)} (${(o.endedContractsWithBalance || []).length})</h2></div>
        ${(o.endedContractsWithBalance || []).length ? `
          <div style="overflow-x:auto;">
            ${filterBarHTML("dash-ended")}
        <table class="data-table" data-filter-table="dash-ended">
              <thead><tr><th>المستأجر</th><th>الوحدة</th><th>تاريخ الانتهاء (هجري)</th><th>المتبقي عليه</th><th></th></tr></thead>
              <tbody>
                ${o.endedContractsWithBalance.map((r) => `
                  <tr>
                    <td>${r.tenantName}</td>
                    <td>${r.unitLabel}</td>
                    <td>${toHijri(r.endedAt)}</td>
                    <td><strong style="color:#dc2626;">${money(r.outstanding)}</strong></td>
                    <td><a class="link-btn" href="#unit/${r.unitId}">عرض</a></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state">لا توجد مبالغ متبقية على عقود منتهية.</div>`}
      </div>
    `,
  };

  const order = getDashOrder(Object.keys(boxes));

  els.content.innerHTML = `
    <div class="dash-boxes" id="dashBoxes">
      ${order.map((id) => `
        <div class="dash-box" data-box-id="${id}">
          <div class="dash-box-handle" draggable="true" title="اسحب لإعادة الترتيب">
            <span class="dash-box-grip">⠿⠿</span>
            <span class="dash-box-title">${DASH_BOX_TITLES[id]}</span>
          </div>
          <div class="dash-box-body">${boxes[id]}</div>
        </div>
      `).join("")}
    </div>
  `;

  initDashDragDrop();
}

function initDashDragDrop() {
  const container = document.getElementById("dashBoxes");
  if (!container) return;
  let dragEl = null;

  container.querySelectorAll(".dash-box-handle").forEach((handle) => {
    handle.addEventListener("dragstart", (e) => {
      dragEl = handle.closest(".dash-box");
      dragEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", dragEl.dataset.boxId); } catch (err) { /* ignore */ }
    });
    handle.addEventListener("dragend", () => {
      if (dragEl) dragEl.classList.remove("dragging");
      dragEl = null;
      const order = [...container.querySelectorAll(".dash-box")].map((b) => b.dataset.boxId);
      saveDashOrder(order);
    });
  });

  container.addEventListener("dragover", (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const siblings = [...container.querySelectorAll(".dash-box:not(.dragging)")];
    let afterEl = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    for (const box of siblings) {
      const rect = box.getBoundingClientRect();
      const offset = e.clientY - rect.top - rect.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        afterEl = box;
      }
    }
    if (afterEl == null) container.appendChild(dragEl);
    else container.insertBefore(dragEl, afterEl);
  });
  container.addEventListener("drop", (e) => e.preventDefault());
}

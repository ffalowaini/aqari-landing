/* Page: تفاصيل العقار — one property's units and payments. */

import { Api } from "../core/api.js";
import { els } from "../components/dom.js";
import { filterBarHTML, statusOptions, uniqueOptions } from "../components/table-filter.js";
import { openRecordPaymentModal } from "../modals/contract-modals.js";
import { openRentOutModal } from "../modals/unit-modals.js";
import { money, statusBadge, toHijri } from "../utils/format.js";
import { escapeAttr } from "../utils/text.js";

export async function renderPropertyDetails(propertyId) {
  let property;
  try {
    property = await Api.getPropertyDetail(propertyId);
  } catch (err) {
    els.content.innerHTML = `<div class="empty-state">هذا العقار غير موجود أو تم حذفه.<br><a href="#units" class="link-btn" style="margin-top:10px;display:inline-block;">العودة للوحدات</a></div>`;
    return;
  }

  els.content.innerHTML = `
    <a href="#units" class="link-btn" style="display:inline-block;margin-bottom:16px;">→ العودة للوحدات</a>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">عدد الوحدات</div><div class="stat-value">${property.units.length}</div></div>
      <div class="stat-card"><div class="stat-label">الوحدات المؤجرة</div><div class="stat-value">${property.units.filter((u) => u.status === "occupied").length}</div></div>
      <div class="stat-card accent"><div class="stat-label">إجمالي المحصّل</div><div class="stat-value">${money(property.totalPaid)}</div></div>
      <div class="stat-card warn"><div class="stat-label">متأخرات سابقة</div><div class="stat-value">${money(property.totalOldArrears)}</div></div>
      <div class="stat-card warn"><div class="stat-label">المتبقي (السنة الحالية)</div><div class="stat-value">${money(property.totalRemaining)}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>${property.name}</h2>
        <span style="color:var(--text-dim);font-size:.85rem;">${property.city}</span>
      </div>
      ${property.units.length ? `
        <div style="overflow-x:auto;">
          ${filterBarHTML("property-units", [
          { field: "status", label: "حالة الدفع", options: statusOptions(property.units.map((u) => u.activeContract ? u.activeContract.status : "vacant"), ["late", "on_track", "not_started", "paid_full", "vacant"]) },
        ])}
        <table class="data-table" data-filter-table="property-units">
            <thead><tr><th>الوحدة</th><th>الشارع</th><th>المستأجر</th><th>قيمة الإيجار</th><th>متأخرات سابقة</th><th>المتبقي (السنة الحالية)</th><th>حالة الدفع</th><th></th></tr></thead>
            <tbody>
              ${property.units.map((u) => {
                const c = u.activeContract;
                return `
                  <tr data-f-status="${c ? c.status : "vacant"}">
                    <td><button class="link-btn cell-link" data-view-unit="${u.id}">${u.number}</button></td>
                    <td>${u.street || "—"}</td>
                    <td>${c ? c.tenantName : "—"}</td>
                    <td>${c ? money(c.rent) : "—"}</td>
                    <td>${c && c.oldArrears > 0 ? `<span style="color:#dc2626;font-weight:700;">${money(c.oldArrears)}</span>` : "—"}</td>
                    <td>${c ? money(c.remaining) : "—"}</td>
                    <td>${statusBadge(c ? c.status : "vacant")}</td>
                    <td class="table-actions">
                      ${c
                        ? `<button class="link-btn" data-record-payment="${c.id}">تسجيل دفعة</button>`
                        : `<button class="link-btn" data-rent-out="${u.id}">تأجير الوحدة</button>`}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">لا توجد وحدات في هذا العقار بعد.</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>قائمة المدفوعات (${property.payments.length})</h2></div>
      ${property.payments.length ? `
        <div style="overflow-x:auto;">
          ${filterBarHTML("property-payments", [
          { field: "method", label: "طريقة الدفع", options: uniqueOptions(property.payments.map((p) => p.method)) },
        ])}
        <table class="data-table" data-filter-table="property-payments">
            <thead><tr><th>التاريخ (هجري)</th><th>الوحدة</th><th>المستأجر</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
            <tbody>
              ${property.payments.map((p) => `
                <tr data-f-method="${escapeAttr(p.method)}">
                  <td>${toHijri(p.date)}</td>
                  <td>${p.unitNumber}</td>
                  <td>${p.tenantName}</td>
                  <td>${money(p.amount)}</td>
                  <td>${p.method}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">لا توجد مدفوعات مسجلة بعد.</div>`}
    </div>
  `;

  els.content.querySelectorAll("[data-view-unit]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#unit/${btn.dataset.viewUnit}`; });
  });
  els.content.querySelectorAll("[data-record-payment]").forEach((btn) => {
    btn.addEventListener("click", () => openRecordPaymentModal(btn.dataset.recordPayment, () => renderPropertyDetails(propertyId)));
  });
  els.content.querySelectorAll("[data-rent-out]").forEach((btn) => {
    btn.addEventListener("click", () => openRentOutModal(btn.dataset.rentOut, () => renderPropertyDetails(propertyId)));
  });
}

/* Page: الوحدات — all units with their current contract. */

import { Api } from "../core/api.js";
import { currentPeriodHTML } from "../components/contract-ui.js";
import { els } from "../components/dom.js";
import { filterBarHTML, statusOptions } from "../components/table-filter.js";
import { openRecordPaymentModal } from "../modals/contract-modals.js";
import { openAddPropertyModal } from "../modals/property-modals.js";
import { openAddUnitModal, openRentOutModal } from "../modals/unit-modals.js";
import { money, statusBadge } from "../utils/format.js";

export async function renderUnits() {
  const units = await Api.getUnits();
  const properties = await Api.getProperties();

  const rows = units.map((u) => {
    const c = u.activeContract;
    return `
      <tr data-f-property="${u.propertyId}" data-f-status="${c ? c.status : "vacant"}" data-f-commit="${c ? c.paymentCommitmentClassification : ""}" data-f-arrears="${c && c.oldArrears > 0 ? "has" : "none"}">
        <td><button class="link-btn cell-link" data-view-property="${u.propertyId}">${u.propertyName}</button></td>
        <td><button class="link-btn cell-link" data-view-unit="${u.id}">${u.number}</button></td>
        <td>${c ? c.tenantName : "—"}</td>
        <td>${c ? currentPeriodHTML(c) : "—"}</td>
        <td>${c ? money(c.rent) : "—"}</td>
        <td>${c ? c.installments : "—"}</td>
        <td>${c ? money(c.currentYearPaid) : "—"}</td>
        <td>${c && c.oldArrears > 0 ? `<span style="color:#dc2626;font-weight:700;">${money(c.oldArrears)}</span>` : (c ? "—" : "—")}</td>
        <td>${c ? money(c.remaining) : "—"}</td>
        <td>${statusBadge(c ? c.status : "vacant")}</td>
        <td>${c ? statusBadge(c.paymentCommitmentClassification) : "—"}</td>
        <td class="table-actions">
          ${c
            ? `<button class="link-btn" data-record-payment="${c.id}">تسجيل دفعة</button>`
            : `<button class="link-btn" data-rent-out="${u.id}">تأجير الوحدة</button>`}
        </td>
      </tr>
    `;
  }).join("");

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>الوحدات (${units.length})</h2>
        <div class="table-actions">
          <button class="btn btn-outline" id="addPropertyBtn">+ عقار جديد</button>
          <button class="btn btn-primary" id="addUnitBtn">+ وحدة جديدة</button>
        </div>
      </div>
      ${units.length ? `
        <div style="overflow-x:auto;">
          ${filterBarHTML("units", [
          { field: "property", label: "العقار", options: properties.map((p) => ({ value: String(p.id), label: p.name })) },
          { field: "status", label: "حالة الدفع", options: statusOptions(units.map((u) => u.activeContract ? u.activeContract.status : "vacant"), ["late", "on_track", "not_started", "paid_full", "vacant"]) },
          { field: "commit", label: "الالتزام", options: statusOptions(units.map((u) => u.activeContract && u.activeContract.paymentCommitmentClassification), ["committed", "semi_committed", "delinquent"]) },
          { field: "arrears", label: "المتأخرات", options: [{ value: "has", label: "عليه متأخرات سابقة" }, { value: "none", label: "بدون متأخرات" }] },
        ])}
        <table class="data-table" data-filter-table="units">
            <thead>
              <tr>
                <th>العقار</th><th>الوحدة</th><th>المستأجر</th>
                <th>بداية الفترة الحالية (هجري)</th><th>قيمة الإيجار</th><th>عدد الأقساط</th>
                <th>المدفوع (السنة الحالية)</th><th>متأخرات سابقة</th><th>المتبقي (السنة الحالية)</th><th>حالة الدفع</th><th>الالتزام بالسداد</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="empty-state">${properties.length ? "لا توجد وحدات بعد، ابدأ بإضافة وحدة." : "ابدأ بإضافة عقار ثم وحدة."}</div>`}
    </div>
  `;

  document.getElementById("addPropertyBtn").addEventListener("click", () => openAddPropertyModal(renderUnits));
  document.getElementById("addUnitBtn").addEventListener("click", () => openAddUnitModal(renderUnits));

  els.content.querySelectorAll("[data-view-property]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#property/${btn.dataset.viewProperty}`; });
  });
  els.content.querySelectorAll("[data-view-unit]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#unit/${btn.dataset.viewUnit}`; });
  });
  els.content.querySelectorAll("[data-record-payment]").forEach((btn) => {
    btn.addEventListener("click", () => openRecordPaymentModal(btn.dataset.recordPayment, renderUnits));
  });
  els.content.querySelectorAll("[data-rent-out]").forEach((btn) => {
    btn.addEventListener("click", () => openRentOutModal(btn.dataset.rentOut, renderUnits));
  });
}

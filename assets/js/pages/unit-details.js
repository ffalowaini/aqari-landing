/* Page: تفاصيل الوحدة — one unit's contract, schedule, payments and history. */

import { Api } from "../core/api.js";
import { rentHistoryHTML } from "../components/contract-ui.js";
import { els } from "../components/dom.js";
import { openConfirmModal, safely } from "../components/modal.js";
import { filterBarHTML, statusOptions, uniqueOptions } from "../components/table-filter.js";
import { openEndLeaseModal, openRecordPaymentModal, openRenewContractModal, openRentChangeModal } from "../modals/contract-modals.js";
import { openRentOutModal } from "../modals/unit-modals.js";
import { money, statusBadge, toHijri } from "../utils/format.js";
import { escapeAttr } from "../utils/text.js";

export async function renderUnitDetails(unitId) {
  let unit;
  try {
    unit = await Api.getUnitDetail(unitId);
  } catch (err) {
    els.content.innerHTML = `<div class="empty-state">هذه الوحدة غير موجودة أو تم حذفها.<br><a href="#units" class="link-btn" style="margin-top:10px;display:inline-block;">العودة للوحدات</a></div>`;
    return;
  }

  const c = unit.activeContract;
  const payments = c ? [...c.payments] : [];
  const schedule = c ? c.schedule : [];
  const pastContracts = unit.pastContracts || [];

  els.content.innerHTML = `
    <a href="#property/${unit.propertyId}" class="link-btn" style="display:inline-block;margin-bottom:16px;">→ العودة لتفاصيل العقار</a>

    ${c ? `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">قيمة الإيجار</div><div class="stat-value">${money(c.rent)}</div></div>
        <div class="stat-card accent"><div class="stat-label">المدفوع (السنة الحالية)</div><div class="stat-value">${money(c.currentYearPaid)}</div><div style="font-size:.75rem;color:var(--text-dim);margin-top:4px;">إجمالي المدفوع منذ بداية العقد: ${money(c.paidAmount)}</div></div>
        <div class="stat-card warn"><div class="stat-label">متأخرات سابقة</div><div class="stat-value">${money(c.oldArrears)}</div></div>
        <div class="stat-card warn"><div class="stat-label">المتبقي (السنة الحالية)</div><div class="stat-value">${money(c.remaining)}</div></div>
        <div class="stat-card"><div class="stat-label">حالة الدفع</div><div class="stat-value">${statusBadge(c.status)}</div></div>
        <div class="stat-card"><div class="stat-label">الالتزام بالسداد</div><div class="stat-value">${statusBadge(c.paymentCommitmentClassification)}</div></div>
      </div>
    ` : ""}

    <div class="panel">
      <div class="panel-head">
        <h2>${unit.propertyName} — وحدة ${unit.number}</h2>
        <div class="table-actions">
          ${c ? `
            <button class="btn btn-outline" id="rentChangeBtn">تغيير الإيجار</button>
            <button class="btn btn-outline" id="renewBtn">تجديد العقد</button>
            <button class="btn btn-outline" id="endLeaseBtn" style="color:#dc2626;border-color:#dc2626;">إنهاء العقد</button>
            <button class="btn btn-primary" id="recordPaymentBtn">تسجيل دفعة</button>
          ` : `<button class="btn btn-primary" id="rentOutBtn">تأجير الوحدة</button>`}
        </div>
      </div>
      <div style="padding:18px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;color:var(--text-dim);font-size:.88rem;">
        <div>الشارع<br><strong style="color:var(--text);">${unit.street || "—"}</strong></div>
        <div>المستأجر<br><strong style="color:var(--text);">${c ? c.tenantName : "—"}</strong></div>
        <div>الفترة الحالية (هجري)<br><strong style="color:var(--text);">${c ? `${toHijri(c.currentPeriodStart)} ← ${toHijri(c.currentPeriodEnd)}` : "—"}</strong>${c ? `<br><span style="font-size:.78rem;">السنة ${c.currentYearNumber} من العقد · بداية العقد الأصلية: ${toHijri(c.start)}</span>` : ""}</div>
        <div>عدد الأقساط<br><strong style="color:var(--text);">${c ? c.installments : "—"}</strong></div>
        ${c ? `
          <div>حساب التجديد السنوي<br>
            <strong style="color:var(--text);">${c.calendarBasis === "GREGORIAN" ? "ميلادي" : "هجري (افتراضي)"}</strong>
            <button class="link-btn" id="toggleCalendarBtn" style="margin-right:8px;font-size:.8rem;">
              ${c.calendarBasis === "GREGORIAN" ? "التحويل إلى هجري" : "التحويل إلى ميلادي"}
            </button>
          </div>
          <div>نوع العقد<br><strong style="color:var(--text);">${c.contractFormat === "ELECTRONIC" ? "إلكتروني (موثق)" : "ورقي"}</strong></div>
          <div>القيمة السوقية التقديرية<br><strong style="color:var(--text);">${c.marketValueEstimate != null ? money(c.marketValueEstimate) : "لم تُقيَّم"}</strong></div>
          <div>تصنيف السعر مقابل السوق<br>${statusBadge(c.priceClassification)}</div>
        ` : ""}
      </div>
    </div>

    ${c ? rentHistoryHTML(c) : ""}

    ${c ? `
      <div class="panel">
        <div class="panel-head"><h2>جدول استحقاق الأقساط</h2></div>
        <div style="overflow-x:auto;">
          ${filterBarHTML("schedule", [
          { field: "year", label: "السنة", options: [...new Set(schedule.map((i) => i.year))].map((y) => ({ value: String(y), label: `سنة ${y}` })) },
          { field: "status", label: "الحالة", options: statusOptions(schedule.map((i) => i.status), ["overdue", "upcoming", "paid"]) },
        ])}
        <table class="data-table" data-filter-table="schedule">
            <thead><tr><th>السنة</th><th>القسط</th><th>تاريخ الاستحقاق (هجري)</th><th>المبلغ</th><th>الحالة</th></tr></thead>
            <tbody>
              ${schedule.map((inst) => `
                <tr data-f-year="${inst.year}" data-f-status="${inst.status}">
                  <td>سنة ${inst.year}</td>
                  <td>${inst.index} من ${schedule.filter((s) => s.year === inst.year).length}</td>
                  <td>${toHijri(inst.dueDate)}</td>
                  <td>${money(inst.amount)}</td>
                  <td>${statusBadge(inst.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : ""}

    <div class="panel">
      <div class="panel-head"><h2>سجل المدفوعات لهذه الوحدة (${payments.length})</h2></div>
      ${payments.length ? `
        <div style="overflow-x:auto;">
          ${filterBarHTML("unit-payments", [
          { field: "method", label: "طريقة الدفع", options: uniqueOptions(payments.map((p) => p.method)) },
        ])}
        <table class="data-table" data-filter-table="unit-payments">
            <thead><tr><th>التاريخ (هجري)</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
            <tbody>
              ${payments.map((p) => `
                <tr data-f-method="${escapeAttr(p.method)}">
                  <td>${toHijri(p.date)}</td>
                  <td>${money(p.amount)}</td>
                  <td>${p.method}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">لا توجد مدفوعات مسجلة لهذه الوحدة بعد.</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>سجل العقود السابقة (${pastContracts.length})</h2></div>
      ${pastContracts.length ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>المستأجر</th><th>من (هجري)</th><th>إلى (هجري)</th><th>قيمة الإيجار</th><th>إجمالي المدفوع</th><th>المتبقي على المستأجر</th><th></th></tr></thead>
            <tbody>
              ${pastContracts.map((pc) => `
                <tr>
                  <td>${pc.tenantName}</td>
                  <td>${toHijri(pc.start)}</td>
                  <td>${pc.endedAt ? toHijri(pc.endedAt) : "—"}</td>
                  <td>${money(pc.rent)}</td>
                  <td>${money(pc.paidAmount)}</td>
                  <td>${pc.outstanding > 0
                    ? `<span style="color:#dc2626;font-weight:700;">${money(pc.outstanding)}</span>`
                    : (pc.balanceCarriedForward > 0 ? `<span style="color:var(--text-dim);font-size:.8rem;">نُقل ${money(pc.balanceCarriedForward)} للعقد الجديد</span>` : "لا مستحقات")}</td>
                  <td>${pc.outstanding > 0 ? `<button class="link-btn" data-pay-ended="${pc.id}">تسجيل دفعة</button>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">لا توجد عقود سابقة لهذه الوحدة.</div>`}
    </div>
  `;

  const recordBtn = document.getElementById("recordPaymentBtn");
  if (recordBtn) recordBtn.addEventListener("click", () => openRecordPaymentModal(c.id, () => renderUnitDetails(unitId)));
  const rentOutBtn = document.getElementById("rentOutBtn");
  if (rentOutBtn) rentOutBtn.addEventListener("click", () => openRentOutModal(unit.id, () => renderUnitDetails(unitId)));
  const renewBtn = document.getElementById("renewBtn");
  if (renewBtn) renewBtn.addEventListener("click", () => openRenewContractModal(unitId, c, () => renderUnitDetails(unitId)));
  const endLeaseBtn = document.getElementById("endLeaseBtn");
  if (endLeaseBtn) endLeaseBtn.addEventListener("click", () => openEndLeaseModal(unitId, c, () => renderUnitDetails(unitId)));
  const rentChangeBtn = document.getElementById("rentChangeBtn");
  if (rentChangeBtn) rentChangeBtn.addEventListener("click", () => openRentChangeModal(c, () => renderUnitDetails(unitId)));
  els.content.querySelectorAll("[data-delete-rent-change]").forEach((b) => {
    b.addEventListener("click", () => openConfirmModal("سيتم حذف تغيير الإيجار هذا، وتعود السنوات التي يغطيها للسعر السابق.", async () => {
      await Api.deleteRentChange(c.id, b.dataset.deleteRentChange);
      renderUnitDetails(unitId);
    }));
  });
  els.content.querySelectorAll("[data-pay-ended]").forEach((b) => {
    b.addEventListener("click", () => openRecordPaymentModal(b.dataset.payEnded, () => renderUnitDetails(unitId)));
  });
  const toggleCalendarBtn = document.getElementById("toggleCalendarBtn");
  if (toggleCalendarBtn) toggleCalendarBtn.addEventListener("click", () => {
    const next = c.calendarBasis === "GREGORIAN" ? "HIJRI" : "GREGORIAN";
    safely(async () => {
      await Api.updateCalendarBasis(c.id, next);
      renderUnitDetails(unitId);
    });
  });
}

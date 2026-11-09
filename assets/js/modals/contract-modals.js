/* Contract actions: record payment, end lease, change rent, renew. */

import { Api } from "../core/api.js";
import { leaseYearStartLabel } from "../components/contract-ui.js";
import { closeModal, openModal, safely } from "../components/modal.js";
import { dayBefore } from "../utils/dates.js";
import { money, statusBadge, toHijri } from "../utils/format.js";
import { hijriPickerHTML, readHijriPicker, todayHijri } from "../utils/hijri.js";

export function openRecordPaymentModal(contractId, onSaved) {
  openModal(`
    <h3>تسجيل دفعة جديدة</h3>
    <form class="modal-form" id="paymentForm">
      <label>المبلغ <input type="number" name="amount" min="1" required></label>
      <label>طريقة الدفع
        <select name="method" required>
          <option value="نقدي">نقدي</option>
          <option value="تحويل بنكي">تحويل بنكي</option>
          <option value="شيك">شيك</option>
          <option value="بطاقة">بطاقة</option>
        </select>
      </label>
      <label>تاريخ الدفع (هجري)
        ${hijriPickerHTML("date", todayHijri())}
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("paymentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.recordPayment(contractId, Number(f.amount.value), f.method.value, readHijriPicker(f, "date"));
      closeModal();
      onSaved();
    });
  });
}

export function openEndLeaseModal(unitId, contract, onSaved) {
  // When the tenant left at the end of the previous lease year (common when
  // the end is only recorded later), the year auto-renewed after that is
  // never owed — this shortcut picks exactly that date.
  const prevPeriodEnd = contract.currentYearNumber > 1 ? dayBefore(contract.currentPeriodStart) : null;
  openModal(`
    <h3>إنهاء العقد</h3>
    <p style="color:var(--text-dim);font-size:.88rem;line-height:1.7;margin-top:-6px;">
      المستأجر: <strong style="color:var(--text);">${contract.tenantName}</strong><br>
      اختر <strong>آخر يوم فعلي</strong> للمستأجر في الوحدة. يُحسب عليه فقط ما استحق حتى هذا التاريخ،
      ولا تُحسب الأقساط التي يحل موعدها بعده — حتى لو سجّلت الإنهاء في النظام متأخرًا.
      يبقى العقد وسجل مدفوعاته ضمن "سجل العقود السابقة"، ويظهر أي مبلغ متبقٍّ عليه هناك وفي لوحة المعلومات.
    </p>
    ${prevPeriodEnd ? `
      <div class="test-clock-presets">
        <button type="button" class="btn btn-outline" id="endAtPrevPeriod">انتهى بنهاية الفترة السابقة (${toHijri(prevPeriodEnd)})</button>
      </div>` : ""}
    <form class="modal-form" id="endLeaseForm">
      <label>تاريخ انتهاء العقد الفعلي (هجري)
        ${hijriPickerHTML("end", todayHijri(), 3, 0)}
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-danger">إنهاء العقد</button>
      </div>
    </form>
  `);
  const finish = (endDate) => safely(async () => {
    await Api.endLease(unitId, endDate);
    closeModal();
    onSaved();
  });
  const prevBtn = document.getElementById("endAtPrevPeriod");
  if (prevBtn) prevBtn.addEventListener("click", () => finish(prevPeriodEnd));
  document.getElementById("endLeaseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    finish(readHijriPicker(e.target, "end"));
  });
}

export function openRentChangeModal(contract, onSaved) {
  const cur = contract.currentYearNumber;
  const years = [];
  for (let y = Math.max(2, cur); y <= cur + 1; y++) years.push(y);
  openModal(`
    <h3>تغيير قيمة الإيجار</h3>
    <p style="color:var(--text-dim);font-size:.88rem;line-height:1.7;margin-top:-6px;">
      يبقى نفس العقد ونفس المستأجر وسجل الدفعات. السنوات السابقة تبقى بسعرها القديم،
      ويُطبق السعر الجديد من السنة التي تختارها وما بعدها (ويستمر مع التجديد التلقائي).
    </p>
    <form class="modal-form" id="rentChangeForm">
      <label>يبدأ السعر الجديد من
        <select name="effectiveYear" required>
          ${years.map((y) => `<option value="${y}" ${y === cur + 1 ? "selected" : ""}>السنة ${y} — من ${leaseYearStartLabel(contract, y)}${y === cur ? " (الفترة الحالية)" : " (الفترة القادمة)"}</option>`).join("")}
        </select>
      </label>
      <label>قيمة الإيجار السنوي الجديدة <input type="number" name="rent" min="1" value="${contract.rent}" required></label>
      <label>عدد الأقساط <input type="number" name="installments" min="1" max="12" value="${contract.installments}" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("rentChangeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.setRentChange(contract.id, Number(f.effectiveYear.value), Number(f.rent.value), Number(f.installments.value));
      closeModal();
      onSaved();
    });
  });
}

export function openRenewContractModal(unitId, oldContract, onSaved) {
  openModal(`
    <h3>تجديد العقد لنفس المستأجر</h3>
    <p style="margin-top:-8px;font-size:.85rem;color:var(--text-dim);">المستأجر: ${oldContract.tenantName}</p>
    <p style="margin:-6px 0 0;font-size:.85rem;">
      تصنيف السعر الحالي: ${statusBadge(oldContract.priceClassification)} &nbsp; الالتزام بالسداد: ${statusBadge(oldContract.paymentCommitmentClassification)}
    </p>
    <p style="margin:4px 0 0;font-size:.8rem;color:var(--text-dim);line-height:1.6;">
      لتحديث السعر فقط استخدم "تغيير الإيجار" بدلًا من التجديد. عند التجديد يُغلق العقد الحالي في اليوم السابق لبداية العقد الجديد،
      وأي مبلغ متبقٍّ على المستأجر منه${oldContract.outstanding > 0 ? ` (حاليًا ${money(oldContract.outstanding)})` : ""} يُنقل إلى متأخرات العقد الجديد.
    </p>
    <form class="modal-form" id="renewForm">
      <label>تاريخ بدء العقد الجديد (هجري)
        ${hijriPickerHTML("start", todayHijri())}
      </label>
      <label>قيمة الإيجار السنوي <input type="number" name="rent" min="1" value="${oldContract.rent}" required></label>
      <label>عدد الأقساط <input type="number" name="installments" min="1" value="${oldContract.installments}" required></label>
      <label>المبلغ المدفوع مقدمًا <input type="number" name="paidAmount" min="0" value="0" required></label>
      <label>طريقة الدفع (عند وجود مبلغ مقدم)
        <select name="method">
          <option value="نقدي">نقدي</option>
          <option value="تحويل بنكي">تحويل بنكي</option>
          <option value="شيك">شيك</option>
          <option value="بطاقة">بطاقة</option>
        </select>
      </label>
      <label>نوع العقد
        <select name="contractFormat">
          <option value="PAPER" ${oldContract.contractFormat === "PAPER" ? "selected" : ""}>ورقي</option>
          <option value="ELECTRONIC" ${oldContract.contractFormat === "ELECTRONIC" ? "selected" : ""}>إلكتروني (موثق)</option>
        </select>
      </label>
      <label>القيمة السوقية التقديرية (اختياري) <input type="number" name="marketValueEstimate" min="0" value="${oldContract.marketValueEstimate != null ? oldContract.marketValueEstimate : ""}"></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">تجديد العقد</button>
      </div>
    </form>
  `);
  document.getElementById("renewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.renew(unitId, {
        start: readHijriPicker(f, "start"),
        rent: Number(f.rent.value),
        installments: Number(f.installments.value),
        paidAmount: Number(f.paidAmount.value),
        method: f.method.value,
        contractFormat: f.contractFormat.value,
        marketValueEstimate: f.marketValueEstimate.value ? Number(f.marketValueEstimate.value) : null,
      });
      closeModal();
      onSaved();
    });
  });
}

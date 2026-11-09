/* Add / edit unit and rent-out dialogs. */

import { Api } from "../core/api.js";
import { closeModal, openModal, safely } from "../components/modal.js";
import { money } from "../utils/format.js";
import { getHijriParts, hijriPickerHTML, readHijriPicker, todayHijri } from "../utils/hijri.js";

export async function openAddUnitModal(onSaved) {
  const properties = await Api.getProperties();
  if (!properties.length) {
    openModal(`
      <h3>لا يوجد عقارات بعد</h3>
      <p style="color:var(--text-dim);font-size:.88rem;">أضف عقارًا أولًا قبل إضافة وحدة.</p>
      <div class="modal-actions"><button class="btn btn-outline" id="cancelModal">إغلاق</button></div>
    `);
    return;
  }
  openModal(`
    <h3>إضافة وحدة جديدة</h3>
    <form class="modal-form" id="unitForm">
      <label>العقار
        <select name="propertyId" required>
          ${properties.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
      </label>
      <label>رقم الوحدة <input type="text" name="number" required></label>
      <label>الشارع <input type="text" name="street" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("unitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.createUnit(f.propertyId.value, f.number.value.trim(), f.street.value.trim());
      closeModal();
      onSaved();
    });
  });
}

export async function openEditUnitModal(unitId, onSaved) {
  const [unit, properties] = await Promise.all([Api.getUnitDetail(unitId), Api.getProperties()]);
  const c = unit.activeContract;
  const startParts = c ? getHijriParts(new Date(c.start + "T00:00:00")) : todayHijri();

  openModal(`
    <h3>تعديل بيانات الوحدة</h3>
    <form class="modal-form" id="editUnitForm">
      <label>العقار
        <select name="propertyId" required>
          ${properties.map((p) => `<option value="${p.id}" ${p.id === unit.propertyId ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
      </label>
      <label>رقم الوحدة <input type="text" name="number" value="${unit.number}" required></label>
      <label>الشارع <input type="text" name="street" value="${unit.street || ""}" required></label>
      ${c ? `
        <label>اسم المستأجر <input type="text" name="tenantName" value="${c.tenantName}" required></label>
        <label>رقم الجوال <input type="text" name="phone" value="${c.tenantPhone}" required></label>
        <label>تاريخ بدء الإيجار (هجري)
          ${hijriPickerHTML("start", startParts)}
        </label>
        <label>قيمة الإيجار السنوي${c.rentChanges && c.rentChanges.length ? " (السنة الأولى)" : ""} <input type="number" name="rent" min="1" value="${c.baseRent}" required></label>
        <label>عدد الأقساط${c.rentChanges && c.rentChanges.length ? " (السنة الأولى)" : ""} <input type="number" name="installments" min="1" value="${c.baseInstallments}" required></label>
        ${c.rentChanges && c.rentChanges.length ? `<p style="margin:-4px 0 0;font-size:.78rem;color:var(--text-dim);">تغييرات الإيجار للسنوات التالية تُدار من "تغيير الإيجار" في صفحة الوحدة.</p>` : ""}
        <p style="margin:-4px 0 0;font-size:.78rem;color:var(--text-dim);">المبلغ المدفوع (${money(c.paidAmount)}) يُدار من سجل الدفعات — استخدم "تسجيل دفعة" في صفحة الوحدات أو تفاصيل العقار لإضافة دفعة جديدة.</p>
        <label>نوع العقد
          <select name="contractFormat">
            <option value="PAPER" ${c.contractFormat !== "ELECTRONIC" ? "selected" : ""}>ورقي</option>
            <option value="ELECTRONIC" ${c.contractFormat === "ELECTRONIC" ? "selected" : ""}>إلكتروني (موثق)</option>
          </select>
        </label>
        <label>القيمة السوقية التقديرية (اختياري) <input type="number" name="marketValueEstimate" min="0" value="${c.marketValueEstimate != null ? c.marketValueEstimate : ""}"></label>
        <label style="flex-direction:row-reverse;justify-content:flex-end;align-items:center;gap:8px;">
          <input type="checkbox" id="oldArrearsToggle" style="width:auto;" ${c.oldArrearsOverride != null ? "checked" : ""}>
          تعديل يدوي للمتأخرات السابقة (المحسوبة تلقائيًا: ${money(c.computedOldArrears)})
        </label>
        <label id="oldArrearsFieldWrap" ${c.oldArrearsOverride != null ? "" : 'style="display:none;"'}>
          متأخرات سابقة (تعديل يدوي)
          <input type="number" name="oldArrearsOverride" min="0" value="${c.oldArrearsOverride != null ? c.oldArrearsOverride : c.computedOldArrears}">
        </label>
      ` : ""}
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
      </div>
    </form>
  `);
  const oldArrearsToggle = document.getElementById("oldArrearsToggle");
  if (oldArrearsToggle) {
    oldArrearsToggle.addEventListener("change", () => {
      document.getElementById("oldArrearsFieldWrap").style.display = oldArrearsToggle.checked ? "" : "none";
    });
  }
  document.getElementById("editUnitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.updateUnit(unitId, f.propertyId.value, f.number.value.trim(), f.street.value.trim());
      if (c) {
        await Api.updateTenant(c.tenantId, f.tenantName.value.trim(), f.phone.value.trim());
        const oldArrearsOverride = oldArrearsToggle && oldArrearsToggle.checked
          ? Number(f.oldArrearsOverride.value)
          : null;
        const marketValueEstimate = f.marketValueEstimate.value ? Number(f.marketValueEstimate.value) : null;
        await Api.updateContract(c.id, readHijriPicker(f, "start"), Number(f.rent.value), Number(f.installments.value), oldArrearsOverride, f.contractFormat.value, marketValueEstimate);
      }
      closeModal();
      onSaved();
    });
  });
}

export function openRentOutModal(unitId, onSaved) {
  openModal(`
    <h3>تأجير الوحدة</h3>
    <form class="modal-form" id="rentOutForm">
      <label>اسم المستأجر <input type="text" name="tenantName" required></label>
      <label>رقم الجوال <input type="text" name="phone" required></label>
      <label>تاريخ بدء الإيجار (هجري)
        ${hijriPickerHTML("start", todayHijri())}
      </label>
      <label>قيمة الإيجار السنوي <input type="number" name="rent" min="1" required></label>
      <label>عدد الأقساط <input type="number" name="installments" min="1" value="1" required></label>
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
          <option value="PAPER">ورقي</option>
          <option value="ELECTRONIC">إلكتروني (موثق)</option>
        </select>
      </label>
      <label>القيمة السوقية التقديرية (اختياري) <input type="number" name="marketValueEstimate" min="0"></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("rentOutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.rentOut(unitId, {
        tenantName: f.tenantName.value.trim(),
        phone: f.phone.value.trim(),
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

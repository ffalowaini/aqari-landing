/* Page: الإدارة — backup (export/import), and edit/delete properties and units. */

import { Api } from "../core/api.js";
import { els } from "../components/dom.js";
import { openConfirmModal, safely, showMessage } from "../components/modal.js";
import { filterBarHTML, statusOptions, uniqueOptions } from "../components/table-filter.js";
import { openEditPropertyModal } from "../modals/property-modals.js";
import { openEditUnitModal } from "../modals/unit-modals.js";
import { statusBadge } from "../utils/format.js";
import { escapeAttr } from "../utils/text.js";

function exportData() {
  safely(async () => {
    const bundle = await Api.exportData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqari-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function exportExcel() {
  safely(async () => {
    const blob = await Api.exportExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqari-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try {
      payload = JSON.parse(reader.result);
    } catch (e) {
      showMessage("خطأ", "الملف غير صالح. تأكد من اختيار ملف تصدير تم إنشاؤه من هذا الموقع.");
      return;
    }
    if (!Array.isArray(payload.properties)) {
      showMessage("خطأ", "صيغة الملف غير متوافقة مع هذا الموقع.");
      return;
    }
    openConfirmModal(
      "سيتم استبدال جميع البيانات الحالية (العقارات، الوحدات، المستأجرين، والعقود) بالبيانات الموجودة في الملف المستورد. لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await Api.importData(payload);
        renderAdmin();
      }
    );
  };
  reader.readAsText(file);
}

export async function renderAdmin() {
  const properties = await Api.getProperties();
  const units = await Api.getUnits();

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>نسخ احتياطي للبيانات</h2>
        <div class="table-actions">
          <button class="btn btn-outline" id="exportExcelBtn">📊 تصدير Excel</button>
          <button class="btn btn-outline" id="exportDataBtn">تصدير البيانات (JSON)</button>
          <button class="btn btn-outline" id="importDataBtn">استيراد البيانات</button>
          <input type="file" id="importFileInput" accept="application/json,.json" style="display:none">
        </div>
      </div>
      <div style="padding:18px 22px;color:var(--text-dim);font-size:.85rem;line-height:1.7;">
        البيانات محفوظة الآن على خادم حقيقي مرتبط بقاعدة بيانات SQL. "تصدير Excel" ينزّل تقريرًا منسّقًا (نظرة عامة، الوحدات، المدفوعات) للاطلاع أو الأرشفة. استخدم "تصدير البيانات (JSON)" لحفظ نسخة كاملة قابلة لإعادة الاستيراد لاحقًا عبر "استيراد البيانات".
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>العقارات (${properties.length})</h2></div>
      ${properties.length ? `
        ${filterBarHTML("admin-properties")}
        <table class="data-table" data-filter-table="admin-properties">
          <thead><tr><th>اسم العقار</th><th>المدينة</th><th>عدد الوحدات</th><th></th></tr></thead>
          <tbody>
            ${properties.map((p) => `
              <tr>
                <td>${p.name}</td>
                <td>${p.city}</td>
                <td>${p.unitsCount}</td>
                <td class="table-actions">
                  <button class="link-btn" data-view-property="${p.id}">التفاصيل</button>
                  <button class="link-btn" data-edit-property="${p.id}">تعديل</button>
                  <button class="link-btn link-danger" data-del-property="${p.id}">حذف العقار</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد عقارات بعد.</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>الوحدات (${units.length})</h2></div>
      ${units.length ? `
        ${filterBarHTML("admin-units", [
          { field: "property", label: "العقار", options: uniqueOptions(units.map((u) => u.propertyName)) },
          { field: "status", label: "الحالة", options: statusOptions(units.map((u) => u.status), ["occupied", "vacant"]) },
        ])}
        <table class="data-table" data-filter-table="admin-units">
          <thead><tr><th>العقار</th><th>الوحدة</th><th>الشارع</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${units.map((u) => `
              <tr data-f-property="${escapeAttr(u.propertyName)}" data-f-status="${u.status}">
                <td>${u.propertyName}</td>
                <td><button class="link-btn cell-link" data-view-unit="${u.id}">${u.number}</button></td>
                <td>${u.street || "—"}</td>
                <td>${statusBadge(u.status)}</td>
                <td class="table-actions">
                  <button class="link-btn" data-edit-unit="${u.id}">تعديل</button>
                  <button class="link-btn link-danger" data-del-unit="${u.id}">حذف الوحدة</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد وحدات بعد.</div>`}
    </div>
  `;

  document.getElementById("exportExcelBtn").addEventListener("click", exportExcel);
  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("importDataBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document.getElementById("importFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
    e.target.value = "";
  });

  els.content.querySelectorAll("[data-view-property]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#property/${btn.dataset.viewProperty}`; });
  });
  els.content.querySelectorAll("[data-view-unit]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#unit/${btn.dataset.viewUnit}`; });
  });
  els.content.querySelectorAll("[data-edit-property]").forEach((btn) => {
    btn.addEventListener("click", () => openEditPropertyModal(btn.dataset.editProperty, properties, renderAdmin));
  });
  els.content.querySelectorAll("[data-edit-unit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditUnitModal(btn.dataset.editUnit, renderAdmin));
  });
  els.content.querySelectorAll("[data-del-property]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = properties.find((x) => x.id == btn.dataset.delProperty);
      const message = p.unitsCount
        ? `سيتم حذف العقار "${p.name}" نهائيًا، بالإضافة إلى ${p.unitsCount} وحدة وكل بيانات المستأجرين والعقود المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.`
        : `سيتم حذف العقار "${p.name}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.`;
      openConfirmModal(message, async () => { await Api.deleteProperty(p.id); renderAdmin(); });
    });
  });
  els.content.querySelectorAll("[data-del-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = units.find((x) => x.id == btn.dataset.delUnit);
      const message = u.activeContract
        ? `سيتم حذف الوحدة "${u.number}" نهائيًا، بالإضافة إلى بيانات المستأجر والعقد المرتبطين بها. لا يمكن التراجع عن هذا الإجراء.`
        : `سيتم حذف الوحدة "${u.number}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.`;
      openConfirmModal(message, async () => { await Api.deleteUnit(u.id); renderAdmin(); });
    });
  });
}

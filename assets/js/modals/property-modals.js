/* Add / edit property dialogs. */

import { Api } from "../core/api.js";
import { closeModal, openModal, safely } from "../components/modal.js";

export function openAddPropertyModal(onSaved) {
  openModal(`
    <h3>إضافة عقار جديد</h3>
    <form class="modal-form" id="propertyForm">
      <label>اسم العقار <input type="text" name="name" required></label>
      <label>المدينة <input type="text" name="city" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("propertyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.createProperty(f.name.value.trim(), f.city.value.trim());
      closeModal();
      onSaved();
    });
  });
}

export function openEditPropertyModal(propertyId, properties, onSaved) {
  const property = properties.find((p) => p.id == propertyId);
  openModal(`
    <h3>تعديل بيانات العقار</h3>
    <form class="modal-form" id="editPropertyForm">
      <label>اسم العقار <input type="text" name="name" value="${property.name}" required></label>
      <label>المدينة <input type="text" name="city" value="${property.city}" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
      </div>
    </form>
  `);
  document.getElementById("editPropertyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    safely(async () => {
      await Api.updateProperty(propertyId, f.name.value.trim(), f.city.value.trim());
      closeModal();
      onSaved();
    });
  });
}

/* Modal dialog helpers, confirm/message dialogs, and safely() error handling. */

import { els } from "./dom.js";

export async function safely(fn) {
  try {
    await fn();
  } catch (err) {
    showMessage("خطأ", err.message || "حدث خطأ غير متوقع.");
  }
}

export function openModal(html) {
  els.modalBody.innerHTML = html;
  els.modalOverlay.classList.add("open");
  const cancelBtn = document.getElementById("cancelModal");
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
}

export function closeModal() {
  els.modalOverlay.classList.remove("open");
  els.modalBody.innerHTML = "";
}

export function openConfirmModal(message, onConfirm) {
  openModal(`
    <h3>تأكيد الحذف</h3>
    <p style="color:var(--text-dim);font-size:.9rem;line-height:1.7;">${message}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
      <button type="button" class="btn btn-danger" id="confirmDeleteBtn">حذف نهائيًا</button>
    </div>
  `);
  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    safely(async () => { await onConfirm(); closeModal(); });
  });
}

export function showMessage(title, text) {
  openModal(`
    <h3>${title}</h3>
    <p style="color:var(--text-dim);font-size:.9rem;line-height:1.7;">${text}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="cancelModal">حسنًا</button>
    </div>
  `);
}

export function loadingHTML() {
  return `<div class="empty-state">جارٍ التحميل...</div>`;
}

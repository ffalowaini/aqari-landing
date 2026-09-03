const session = requireAuth();

const els = {
  content: document.getElementById("appContent"),
  title: document.getElementById("pageTitle"),
  user: document.getElementById("appUser"),
  sidebar: document.getElementById("sidebar"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalBody: document.getElementById("modalBody"),
};

if (session) els.user.textContent = session.name;

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("sidebarToggle").addEventListener("click", () => {
  els.sidebar.classList.toggle("open");
});
els.modalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

/* ---------- helpers ---------- */
/* Official Saudi Riyal symbol (SAMA, Feb 2025 / Unicode U+20C1). Most fonts
   don't have the glyph yet, so it's embedded as an inline vector icon
   instead of relying on font support — renders identically everywhere. */
const RIYAL_ICON = '<svg viewBox="0 0 1124.14 1256.39" style="width:.72em;height:.8em;display:inline-block;vertical-align:-0.05em;fill:currentColor;" aria-hidden="true"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>';

function money(n) {
  return Number(n).toLocaleString("ar-SA-u-nu-latn") + " " + RIYAL_ICON;
}
function toHijri(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
  }).format(d);
}
function statusBadge(status) {
  const map = {
    vacant: ["شاغرة", "badge-gray"],
    occupied: ["مؤجرة", "badge-green"],
    not_started: ["لم يبدأ السداد", "badge-gray"],
    late: ["متأخر", "badge-red"],
    on_track: ["قيد السداد", "badge-blue"],
    paid_full: ["مكتمل السداد", "badge-green"],
    paid: ["مدفوع", "badge-green"],
    overdue: ["متأخر", "badge-red"],
    upcoming: ["قادم", "badge-gray"],
    committed: ["ملتزم", "badge-green"],
    semi_committed: ["شبه ملتزم", "badge-orange"],
    delinquent: ["مماطل", "badge-red"],
    near_market: ["قريب من السوق", "badge-green"],
    moderate_gap: ["فارق متوسط", "badge-orange"],
    far_from_market: ["بعيد جدًا عن السوق", "badge-red"],
    unknown: ["غير مقيّم", "badge-gray"],
  };
  const [label, cls] = map[status] || [status, "badge-gray"];
  return `<span class="badge ${cls}">${label}</span>`;
}
async function safely(fn) {
  try {
    await fn();
  } catch (err) {
    showMessage("خطأ", err.message || "حدث خطأ غير متوقع.");
  }
}

/* ---------- Hijri date picker (Umm al-Qura) — UI-only, still done client-side ---------- */
const HIJRI_MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

function getHijriParts(date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const obj = {};
  parts.forEach((p) => { if (p.type !== "literal") obj[p.type] = parseInt(p.value, 10); });
  return { y: obj.year, m: obj.month, d: obj.day };
}
function todayHijri() {
  return getHijriParts(new Date());
}
function hijriToGregorianISO(hy, hm, hd) {
  const today = new Date();
  const t0 = getHijriParts(today);
  const approxDays = Math.round((hy - t0.y) * 354.367 + (hm - t0.m) * 29.5306 + (hd - t0.d));
  const base = new Date(today);
  base.setDate(base.getDate() + approxDays);

  for (let day = hd; day >= 1; day--) {
    for (let delta = -15; delta <= 15; delta++) {
      const cand = new Date(base);
      cand.setDate(cand.getDate() + delta);
      const parts = getHijriParts(cand);
      if (parts.y === hy && parts.m === hm && parts.d === day) {
        return cand.toISOString().slice(0, 10);
      }
    }
  }
  return base.toISOString().slice(0, 10);
}
function hijriPickerHTML(prefix, defaultParts) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const years = [];
  for (let y = defaultParts.y - 3; y <= defaultParts.y + 2; y++) years.push(y);
  return `
    <div class="hijri-picker">
      <select name="${prefix}Day">${days.map((d) => `<option value="${d}" ${d === defaultParts.d ? "selected" : ""}>${d}</option>`).join("")}</select>
      <select name="${prefix}Month">${HIJRI_MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === defaultParts.m ? "selected" : ""}>${m}</option>`).join("")}</select>
      <select name="${prefix}Year">${years.map((y) => `<option value="${y}" ${y === defaultParts.y ? "selected" : ""}>${y} هـ</option>`).join("")}</select>
    </div>
  `;
}
function readHijriPicker(form, prefix) {
  const hy = Number(form[prefix + "Year"].value);
  const hm = Number(form[prefix + "Month"].value);
  const hd = Number(form[prefix + "Day"].value);
  return hijriToGregorianISO(hy, hm, hd);
}

/* ---------- modal helpers ---------- */
function openModal(html) {
  els.modalBody.innerHTML = html;
  els.modalOverlay.classList.add("open");
  const cancelBtn = document.getElementById("cancelModal");
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
}
function closeModal() {
  els.modalOverlay.classList.remove("open");
  els.modalBody.innerHTML = "";
}
function openConfirmModal(message, onConfirm) {
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
function showMessage(title, text) {
  openModal(`
    <h3>${title}</h3>
    <p style="color:var(--text-dim);font-size:.9rem;line-height:1.7;">${text}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="cancelModal">حسنًا</button>
    </div>
  `);
}
function loadingHTML() {
  return `<div class="empty-state">جارٍ التحميل...</div>`;
}

/* ---------- router ---------- */
const routes = {
  units: { title: "الوحدات", render: renderUnits },
  overview: { title: "لوحة المعلومات", render: renderOverview },
  admin: { title: "الإدارة", render: renderAdmin },
};

async function router() {
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
window.addEventListener("hashchange", router);

/* ---------- الوحدات (merged unit view) ---------- */
async function renderUnits() {
  const units = await Api.getUnits();
  const properties = await Api.getProperties();

  const rows = units.map((u) => {
    const c = u.activeContract;
    return `
      <tr>
        <td><button class="link-btn cell-link" data-view-property="${u.propertyId}">${u.propertyName}</button></td>
        <td><button class="link-btn cell-link" data-view-unit="${u.id}">${u.number}</button></td>
        <td>${c ? c.tenantName : "—"}</td>
        <td>${c ? toHijri(c.start) : "—"}</td>
        <td>${c ? money(c.rent) : "—"}</td>
        <td>${c ? c.installments : "—"}</td>
        <td>${c ? money(c.paidAmount) : "—"}</td>
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
          <table class="data-table">
            <thead>
              <tr>
                <th>العقار</th><th>الوحدة</th><th>المستأجر</th>
                <th>تاريخ بدء الإيجار (هجري)</th><th>قيمة الإيجار</th><th>عدد الأقساط</th>
                <th>المبلغ المدفوع</th><th>متأخرات سابقة</th><th>المتبقي (السنة الحالية)</th><th>حالة الدفع</th><th>الالتزام بالسداد</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="empty-state">${properties.length ? "لا توجد وحدات بعد، ابدأ بإضافة وحدة." : "ابدأ بإضافة عقار ثم وحدة."}</div>`}
    </div>
  `;

  document.getElementById("addPropertyBtn").addEventListener("click", openAddPropertyModal);
  document.getElementById("addUnitBtn").addEventListener("click", openAddUnitModal);

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

function openAddPropertyModal() {
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
      renderUnits();
    });
  });
}

async function openAddUnitModal() {
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
      renderUnits();
    });
  });
}

function openRentOutModal(unitId, onSaved) {
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
      (onSaved || renderUnits)();
    });
  });
}

function openRecordPaymentModal(contractId, onSaved) {
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
      (onSaved || renderUnits)();
    });
  });
}

function openEndLeaseModal(unitId, tenantName, onSaved) {
  openConfirmModal(
    `سيتم إنهاء عقد "${tenantName}" الحالي وتحويل الوحدة إلى شاغرة. ستبقى بيانات المستأجر وسجل مدفوعاته محفوظة ضمن سجل العقود السابقة لهذه الوحدة، ويمكنك بعدها تأجيرها لمستأجر جديد.`,
    async () => {
      await Api.endLease(unitId);
      (onSaved || renderUnits)();
    }
  );
}

function openRenewContractModal(unitId, oldContract, onSaved) {
  openModal(`
    <h3>تجديد العقد لنفس المستأجر</h3>
    <p style="margin-top:-8px;font-size:.85rem;color:var(--text-dim);">المستأجر: ${oldContract.tenantName}</p>
    <p style="margin:-6px 0 0;font-size:.85rem;">
      تصنيف السعر الحالي: ${statusBadge(oldContract.priceClassification)} &nbsp; الالتزام بالسداد: ${statusBadge(oldContract.paymentCommitmentClassification)}
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
      (onSaved || renderUnits)();
    });
  });
}

/* ---------- تفاصيل العقار ---------- */
async function renderPropertyDetails(propertyId) {
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
          <table class="data-table">
            <thead><tr><th>الوحدة</th><th>الشارع</th><th>المستأجر</th><th>قيمة الإيجار</th><th>متأخرات سابقة</th><th>المتبقي (السنة الحالية)</th><th>حالة الدفع</th><th></th></tr></thead>
            <tbody>
              ${property.units.map((u) => {
                const c = u.activeContract;
                return `
                  <tr>
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
          <table class="data-table">
            <thead><tr><th>التاريخ (هجري)</th><th>الوحدة</th><th>المستأجر</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
            <tbody>
              ${property.payments.map((p) => `
                <tr>
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

/* ---------- تفاصيل الوحدة ---------- */
async function renderUnitDetails(unitId) {
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
        <div class="stat-card accent"><div class="stat-label">المدفوع</div><div class="stat-value">${money(c.paidAmount)}</div></div>
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
            <button class="btn btn-outline" id="renewBtn">تجديد العقد</button>
            <button class="btn btn-outline" id="endLeaseBtn" style="color:#dc2626;border-color:#dc2626;">إنهاء العقد</button>
            <button class="btn btn-primary" id="recordPaymentBtn">تسجيل دفعة</button>
          ` : `<button class="btn btn-primary" id="rentOutBtn">تأجير الوحدة</button>`}
        </div>
      </div>
      <div style="padding:18px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;color:var(--text-dim);font-size:.88rem;">
        <div>الشارع<br><strong style="color:var(--text);">${unit.street || "—"}</strong></div>
        <div>المستأجر<br><strong style="color:var(--text);">${c ? c.tenantName : "—"}</strong></div>
        <div>تاريخ بدء الإيجار (هجري)<br><strong style="color:var(--text);">${c ? toHijri(c.start) : "—"}</strong></div>
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

    ${c ? `
      <div class="panel">
        <div class="panel-head"><h2>جدول استحقاق الأقساط</h2></div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>السنة</th><th>القسط</th><th>تاريخ الاستحقاق (هجري)</th><th>المبلغ</th><th>الحالة</th></tr></thead>
            <tbody>
              ${schedule.map((inst) => `
                <tr>
                  <td>سنة ${inst.year}</td>
                  <td>${inst.index} من ${c.installments}</td>
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
          <table class="data-table">
            <thead><tr><th>التاريخ (هجري)</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
            <tbody>
              ${payments.map((p) => `
                <tr>
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
            <thead><tr><th>المستأجر</th><th>من (هجري)</th><th>إلى (هجري)</th><th>قيمة الإيجار</th><th>إجمالي المدفوع</th></tr></thead>
            <tbody>
              ${pastContracts.map((pc) => `
                <tr>
                  <td>${pc.tenantName}</td>
                  <td>${toHijri(pc.start)}</td>
                  <td>${pc.endedAt ? toHijri(pc.endedAt) : "—"}</td>
                  <td>${money(pc.rent)}</td>
                  <td>${money(pc.paidAmount)}</td>
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
  if (endLeaseBtn) endLeaseBtn.addEventListener("click", () => openEndLeaseModal(unitId, c.tenantName, () => renderUnitDetails(unitId)));
  const toggleCalendarBtn = document.getElementById("toggleCalendarBtn");
  if (toggleCalendarBtn) toggleCalendarBtn.addEventListener("click", () => {
    const next = c.calendarBasis === "GREGORIAN" ? "HIJRI" : "GREGORIAN";
    safely(async () => {
      await Api.updateCalendarBasis(c.id, next);
      renderUnitDetails(unitId);
    });
  });
}

/* ---------- لوحة المعلومات (dashboard overview) ---------- */
const DASH_ORDER_KEY = "aqari_dash_order";
const DASH_BOX_TITLES = {
  stats1: "أرقام أساسية",
  stats2: "العقود والتحصيل",
  delayed: "الوحدات المتأخرة",
  upcoming: "مستحقات الشهر القادم",
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

async function renderOverview() {
  const o = await Api.getOverview();

  const boxes = {
    stats1: `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">إجمالي الوحدات</div><div class="stat-value">${o.totalUnits}</div></div>
        <div class="stat-card"><div class="stat-label">نسبة الإشغال</div><div class="stat-value">${o.occupancyRate}%</div></div>
        <div class="stat-card accent"><div class="stat-label">المحصّل من العقود السارية</div><div class="stat-value">${money(o.totalPaid)}</div></div>
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
            <table class="data-table">
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
            <table class="data-table">
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

/* ---------- الإدارة (admin: edit/delete + backup) ---------- */
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

async function renderAdmin() {
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
        <table class="data-table">
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
        <table class="data-table">
          <thead><tr><th>العقار</th><th>الوحدة</th><th>الشارع</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${units.map((u) => `
              <tr>
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
    btn.addEventListener("click", () => openEditPropertyModal(btn.dataset.editProperty, properties));
  });
  els.content.querySelectorAll("[data-edit-unit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditUnitModal(btn.dataset.editUnit));
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

function openEditPropertyModal(propertyId, properties) {
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
      renderAdmin();
    });
  });
}

async function openEditUnitModal(unitId) {
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
        <label>قيمة الإيجار السنوي <input type="number" name="rent" min="1" value="${c.rent}" required></label>
        <label>عدد الأقساط <input type="number" name="installments" min="1" value="${c.installments}" required></label>
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
      renderAdmin();
    });
  });
}

router();

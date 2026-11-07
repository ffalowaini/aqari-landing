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
/* Start of the contract's current annual cycle (full start → end on hover), with which year of the lease it is and the original start underneath. */
function currentPeriodHTML(c) {
  return `<div style="white-space:nowrap;" title="${toHijri(c.currentPeriodStart)} ← ${toHijri(c.currentPeriodEnd)}">${toHijri(c.currentPeriodStart)}</div>`
    + `<div style="font-size:.75rem;color:var(--text-dim);">السنة ${c.currentYearNumber} · بدأ ${toHijri(c.start)}</div>`;
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
    ended: ["منتهي", "badge-gray"],
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
  return getHijriParts(appToday());
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
function hijriPickerHTML(prefix, defaultParts, yearsBack = 3, yearsAhead = 2) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const years = [];
  for (let y = defaultParts.y - yearsBack; y <= defaultParts.y + yearsAhead; y++) years.push(y);
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

/* ---------- table filters (client-side, all pages) ----------
   filterBarHTML(key, selects) renders a search box + dropdowns above the table
   marked data-filter-table="key". Dropdowns match a row's data-f-<field>
   attribute exactly; the search box matches any
   text in the row. Chosen filters are remembered per table while the app is
   open, so re-rendering after e.g. recording a payment keeps them. */
const filterState = {};

function normalizeArabic(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")          // tashkeel + tatweel
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function escapeAttr(v) {
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function filterBarHTML(key, selects = []) {
  const st = filterState[key] || { q: "", sel: {} };
  return `
    <div class="table-filter" data-filter-key="${key}">
      <input type="search" class="tf-search" placeholder="🔍 بحث..." value="${escapeAttr(st.q)}">
      ${selects.filter((f) => f.options.length > 1).map((f) => `
        <select class="tf-select" data-field="${f.field}">
          <option value="">${f.label}: الكل</option>
          ${f.options.map((o) => `<option value="${escapeAttr(o.value)}" ${st.sel[f.field] === String(o.value) ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>`).join("")}
      <button type="button" class="link-btn tf-clear">مسح الفلاتر</button>
      <span class="tf-count"></span>
    </div>`;
}
/* Options for a status-style dropdown, limited to values that actually occur. */
function statusOptions(values, order) {
  const present = new Set(values);
  const labels = { vacant: "شاغرة", late: "متأخر", on_track: "قيد السداد", not_started: "لم يبدأ السداد", paid_full: "مكتمل السداد",
    committed: "ملتزم", semi_committed: "شبه ملتزم", delinquent: "مماطل", paid: "مدفوع", overdue: "متأخر", upcoming: "قادم", occupied: "مؤجرة" };
  return order.filter((v) => present.has(v)).map((v) => ({ value: v, label: labels[v] || v }));
}
function uniqueOptions(values) {
  return [...new Set(values.filter((v) => v != null && v !== ""))].map((v) => ({ value: v, label: v }));
}
function wireTableFilters(root) {
  root.querySelectorAll(".table-filter:not([data-wired])").forEach((bar) => {
    bar.dataset.wired = "1";
    const key = bar.dataset.filterKey;
    const table = root.querySelector(`table[data-filter-table="${key}"]`);
    if (!table || !table.tBodies[0]) return;
    const rows = [...table.tBodies[0].rows];
    const search = bar.querySelector(".tf-search");
    const selects = [...bar.querySelectorAll(".tf-select")];
    const count = bar.querySelector(".tf-count");
    const apply = () => {
      const q = normalizeArabic(search.value.trim());
      const sel = {};
      selects.forEach((sl) => { if (sl.value) sel[sl.dataset.field] = sl.value; });
      filterState[key] = { q: search.value.trim(), sel };
      let shown = 0;
      rows.forEach((r) => {
        const okText = !q || normalizeArabic(r.textContent).includes(q);
        const okSel = Object.entries(sel).every(([f, v]) => (r.getAttribute(`data-f-${f}`) || "") === v);
        const show = okText && okSel;
        r.style.display = show ? "" : "none";
        if (show) shown++;
      });
      const active = q || Object.keys(sel).length;
      count.textContent = active ? `عرض ${shown} من ${rows.length}` : `${rows.length} سجل`;
      bar.classList.toggle("is-active", !!active);
    };
    search.addEventListener("input", apply);
    selects.forEach((sl) => sl.addEventListener("change", apply));
    bar.querySelector(".tf-clear").addEventListener("click", () => {
      search.value = "";
      selects.forEach((sl) => { sl.value = ""; });
      apply();
    });
    apply();
  });
}
// Every page renders into #appContent — wire any new filter bars as they appear.
new MutationObserver(() => wireTableFilters(els.content)).observe(els.content, { childList: true, subtree: true });

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

/* ISO date one day before the given ISO date. */
function dayBefore(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

function openEndLeaseModal(unitId, contract, onSaved) {
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
    (onSaved || renderUnits)();
  });
  const prevBtn = document.getElementById("endAtPrevPeriod");
  if (prevBtn) prevBtn.addEventListener("click", () => finish(prevPeriodEnd));
  document.getElementById("endLeaseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    finish(readHijriPicker(e.target, "end"));
  });
}

/* ---------- تغيير الإيجار (price change from a lease year onward) ---------- */
/* Hijri label for the first day of lease year N (same day/month as the start, N-1 years later). */
function leaseYearStartLabel(contract, year) {
  const p = getHijriParts(new Date(contract.start + "T00:00:00"));
  return `${p.d} ${HIJRI_MONTHS[p.m - 1]} ${p.y + year - 1} هـ`;
}

function openRentChangeModal(contract, onSaved) {
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

/* Rent history: year 1 price plus every change, each with the lease years it covers. */
function rentHistoryHTML(c) {
  if (!c.rentChanges || !c.rentChanges.length) return "";
  const rows = [{ id: null, effectiveYear: 1, rent: c.baseRent, installments: c.baseInstallments }, ...c.rentChanges];
  return `
    <div class="panel">
      <div class="panel-head"><h2>سجل قيمة الإيجار</h2></div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>السنوات</th><th>من (هجري)</th><th>قيمة الإيجار السنوي</th><th>عدد الأقساط</th><th></th></tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              const next = rows[i + 1];
              const span = next ? (next.effectiveYear - 1 === r.effectiveYear ? `السنة ${r.effectiveYear}` : `السنة ${r.effectiveYear} – ${next.effectiveYear - 1}`) : `السنة ${r.effectiveYear} وما بعدها`;
              return `
                <tr>
                  <td>${span}${r.effectiveYear <= c.currentYearNumber && (!next || next.effectiveYear > c.currentYearNumber) ? ` <span class="badge badge-green">الحالي</span>` : ""}</td>
                  <td>${leaseYearStartLabel(c, r.effectiveYear)}</td>
                  <td>${money(r.rent)}</td>
                  <td>${r.installments}</td>
                  <td>${r.id ? `<button class="link-btn" data-delete-rent-change="${r.id}" style="color:#dc2626;">حذف</button>` : ""}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openRenewContractModal(unitId, oldContract, onSaved) {
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

/* ---------- لوحة المعلومات (dashboard overview) ---------- */
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

async function renderOverview() {
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
      renderAdmin();
    });
  });
}

/* ---------- test clock (local dev only) ----------
   Lets you pretend "today" is a later date so you can see how installments,
   arrears and statuses change over time. The backend does the date math, so
   the override lives there (in memory — it resets when the server restarts),
   and the button only appears when the backend has the test clock enabled
   (local dev; it's switched off on the live Render deployment). */
let appTodayISO = null; // simulated "today" (yyyy-mm-dd), null = the real date

function appToday() {
  return appTodayISO ? new Date(appTodayISO + "T00:00:00") : new Date();
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function applyTestClockState(state) {
  appTodayISO = state.overridden ? state.today : null;
  const btn = document.getElementById("testClockBtn");
  if (!btn) return;
  btn.classList.toggle("active", state.overridden);
  btn.innerHTML = state.overridden
    ? `🧪 اليوم التجريبي: ${toHijri(state.today)}`
    : "🧪 تغيير تاريخ اليوم";
  btn.title = state.overridden
    ? "التطبيق يعمل الآن بتاريخ تجريبي — اضغط للتغيير أو للعودة لتاريخ اليوم الحقيقي"
    : "اختبار التطبيق بتاريخ مستقبلي";
}

async function changeTestClock(action) {
  await safely(async () => {
    const state = await action();
    applyTestClockState(state);
    closeModal();
    await router();
  });
}

function openTestClockModal() {
  const presets = [
    [1, "+ شهر"],
    [3, "+ 3 أشهر"],
    [6, "+ 6 أشهر"],
    [12, "+ سنة"],
  ];
  openModal(`
    <h3>🧪 تغيير تاريخ اليوم (للاختبار)</h3>
    <p style="color:var(--text-dim);font-size:.88rem;line-height:1.7;margin-bottom:12px;">
      يحسب التطبيق الأقساط والمتأخرات وحالة السداد ولوحة المعلومات كأن اليوم هو التاريخ الذي تختاره.
      لا تتغير أي بيانات محفوظة، ويعود التاريخ الحقيقي عند الضغط على "العودة لتاريخ اليوم" أو عند إعادة تشغيل الخادم.
    </p>
    <div class="test-clock-presets">
      ${presets.map(([m, label]) => `<button type="button" class="btn btn-outline" data-months="${m}">${label}</button>`).join("")}
    </div>
    <form class="modal-form" id="testClockForm">
      <label>أو اختر تاريخًا (هجري)
        ${hijriPickerHTML("clock", todayHijri(), 1, 6)}
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        ${appTodayISO ? `<button type="button" class="btn btn-outline" id="resetTestClock">العودة لتاريخ اليوم</button>` : ""}
        <button type="submit" class="btn btn-primary">تطبيق</button>
      </div>
    </form>
  `);
  els.modalBody.querySelectorAll("[data-months]").forEach((b) => {
    b.addEventListener("click", () => {
      const d = appToday();
      d.setMonth(d.getMonth() + Number(b.dataset.months));
      changeTestClock(() => Api.setTestClock(isoDate(d)));
    });
  });
  const resetBtn = document.getElementById("resetTestClock");
  if (resetBtn) resetBtn.addEventListener("click", () => changeTestClock(() => Api.resetTestClock()));
  document.getElementById("testClockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    changeTestClock(() => Api.setTestClock(readHijriPicker(e.target, "clock")));
  });
}

async function initTestClock() {
  let state;
  try {
    state = await Api.getTestClock();
  } catch (e) {
    return; // backend without the test clock (e.g. the live site) — no button
  }
  if (!state || !state.enabled) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "testClockBtn";
  btn.className = "btn btn-outline test-clock-btn";
  btn.addEventListener("click", openTestClockModal);
  els.user.parentNode.insertBefore(btn, els.user);
  applyTestClockState(state);
}

initTestClock().finally(router);

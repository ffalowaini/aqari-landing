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
function money(n) {
  return Number(n).toLocaleString("ar-SA") + " ر.س";
}
function propertyName(id) {
  const p = DataStore.getProperties().find((x) => x.id === id);
  return p ? p.name : "—";
}
function tenantName(id) {
  const t = DataStore.getTenants().find((x) => x.id === id);
  return t ? t.name : "—";
}
function toHijri(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    year: "numeric", month: "long", day: "numeric",
  }).format(d) + " هـ";
}

/* ---------- Hijri date picker (Umm al-Qura, same calendar used for display) ---------- */
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
function contractForUnit(unitId) {
  return DataStore.getContracts()
    .filter((c) => c.unitId === unitId)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
}
const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "شيك", "بطاقة"];

function contractPaidAmount(contract) {
  return (contract.payments || []).reduce((s, p) => s + p.amount, 0);
}
/* How much of the rent SHOULD be paid by today, given the installment schedule.
   Installments are assumed evenly spaced across the 12 months from the lease start. */
function expectedPaidByNow(contract) {
  const start = new Date(contract.start + "T00:00:00");
  const now = new Date();
  if (now < start) return 0;
  let monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) monthsElapsed -= 1;
  monthsElapsed = Math.max(0, monthsElapsed);
  const monthsPerInstallment = 12 / contract.installments;
  const installmentsDue = Math.min(contract.installments, Math.floor(monthsElapsed / monthsPerInstallment) + 1);
  return Math.min(contract.rent, installmentsDue * (contract.rent / contract.installments));
}
function paymentStatusOf(contract) {
  if (!contract) return "vacant";
  const paid = contractPaidAmount(contract);
  if (paid >= contract.rent) return "paid_full";
  if (paid < expectedPaidByNow(contract)) return "late";
  if (paid <= 0) return "not_started";
  return "on_track";
}
function statusBadge(status) {
  const map = {
    vacant: ["شاغرة", "badge-gray"],
    occupied: ["مؤجرة", "badge-green"],
    not_started: ["لم يبدأ السداد", "badge-gray"],
    late: ["متأخر", "badge-red"],
    on_track: ["قيد السداد", "badge-blue"],
    paid_full: ["مكتمل السداد", "badge-green"],
  };
  const [label, cls] = map[status] || [status, "badge-gray"];
  return `<span class="badge ${cls}">${label}</span>`;
}
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
    onConfirm();
    closeModal();
  });
}

/* ---------- router ---------- */
const routes = {
  units: { title: "الوحدات", render: renderUnits },
  overview: { title: "لوحة المعلومات", render: renderOverview },
  admin: { title: "الإدارة", render: renderAdmin },
};

function router() {
  const hash = (window.location.hash || "#units").slice(1);
  const [routeKey, param] = hash.split("/");

  if (routeKey === "property" && param) {
    els.title.textContent = "تفاصيل العقار";
    document.querySelectorAll(".sidebar-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === "units"));
    els.content.innerHTML = "";
    renderPropertyDetails(param);
    els.sidebar.classList.remove("open");
    return;
  }
  if (routeKey === "unit" && param) {
    els.title.textContent = "تفاصيل الوحدة";
    document.querySelectorAll(".sidebar-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === "units"));
    els.content.innerHTML = "";
    renderUnitDetails(param);
    els.sidebar.classList.remove("open");
    return;
  }

  const route = routes[routeKey] || routes.units;
  els.title.textContent = route.title;
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === routeKey);
  });
  els.content.innerHTML = "";
  route.render();
  els.sidebar.classList.remove("open");
}
window.addEventListener("hashchange", router);

/* ---------- الوحدات (merged unit view) ---------- */
function renderUnits() {
  const units = DataStore.getUnits();
  const properties = DataStore.getProperties();

  const rows = units.map((u) => {
    const contract = contractForUnit(u.id);
    const status = paymentStatusOf(contract);
    const paid = contract ? contractPaidAmount(contract) : 0;
    const remaining = contract ? Math.max(0, contract.rent - paid) : 0;
    return `
      <tr>
        <td><button class="link-btn cell-link" data-view-property="${u.propertyId}">${propertyName(u.propertyId)}</button></td>
        <td><button class="link-btn cell-link" data-view-unit="${u.id}">${u.number}</button></td>
        <td>${u.street || "—"}</td>
        <td>${contract ? tenantName(contract.tenantId) : "—"}</td>
        <td>${contract ? toHijri(contract.start) : "—"}</td>
        <td>${contract ? money(contract.rent) : "—"}</td>
        <td>${contract ? contract.installments : "—"}</td>
        <td>${contract ? money(paid) : "—"}</td>
        <td>${contract ? money(remaining) : "—"}</td>
        <td>${statusBadge(status)}</td>
        <td class="table-actions">
          ${contract
            ? `<button class="link-btn" data-record-payment="${contract.id}">تسجيل دفعة</button>`
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
                <th>العقار</th><th>الوحدة</th><th>الشارع</th><th>المستأجر</th>
                <th>تاريخ بدء الإيجار (هجري)</th><th>قيمة الإيجار</th><th>عدد الأقساط</th>
                <th>المبلغ المدفوع</th><th>المبلغ المتبقي</th><th>حالة الدفع</th><th></th>
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
    btn.addEventListener("click", () => openRecordPaymentModal(btn.dataset.recordPayment));
  });
  els.content.querySelectorAll("[data-rent-out]").forEach((btn) => {
    btn.addEventListener("click", () => openRentOutModal(btn.dataset.rentOut));
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
    const properties = DataStore.getProperties();
    properties.push({ id: DataStore.uid("p"), name: f.name.value.trim(), city: f.city.value.trim(), unitsCount: 0 });
    DataStore.saveProperties(properties);
    closeModal();
    renderUnits();
  });
}

function openAddUnitModal() {
  const properties = DataStore.getProperties();
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
    const units = DataStore.getUnits();
    units.push({
      id: DataStore.uid("u"),
      propertyId: f.propertyId.value,
      number: f.number.value.trim(),
      street: f.street.value.trim(),
      rent: 0,
      status: "vacant",
    });
    DataStore.saveUnits(units);
    closeModal();
    renderUnits();
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
          ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
        </select>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("rentOutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const rent = Number(f.rent.value);
    const paidAmount = Math.min(Number(f.paidAmount.value), rent);
    const startISO = readHijriPicker(f, "start");

    const tenants = DataStore.getTenants();
    const tenant = { id: DataStore.uid("t"), name: f.tenantName.value.trim(), phone: f.phone.value.trim(), unitId };
    tenants.push(tenant);
    DataStore.saveTenants(tenants);

    const contracts = DataStore.getContracts();
    const contract = {
      id: DataStore.uid("c"),
      tenantId: tenant.id,
      unitId,
      start: startISO,
      rent,
      installments: Number(f.installments.value),
      payments: [],
    };
    if (paidAmount > 0) {
      contract.payments.push({ id: DataStore.uid("pay"), amount: paidAmount, method: f.method.value, date: startISO });
    }
    contracts.push(contract);
    DataStore.saveContracts(contracts);

    const units = DataStore.getUnits();
    const unit = units.find((u) => u.id === unitId);
    if (unit) { unit.status = "occupied"; unit.rent = rent; }
    DataStore.saveUnits(units);

    closeModal();
    (onSaved || renderUnits)();
  });
}

function openRecordPaymentModal(contractId, onSaved) {
  const contracts = DataStore.getContracts();
  const contract = contracts.find((c) => c.id === contractId);
  if (!contract) return;
  const paid = contractPaidAmount(contract);
  const remaining = Math.max(0, contract.rent - paid);

  openModal(`
    <h3>تسجيل دفعة جديدة</h3>
    <p style="margin-top:-8px;font-size:.85rem;color:var(--text-dim);">قيمة الإيجار: ${money(contract.rent)} — المدفوع حتى الآن: ${money(paid)} — المتبقي: ${money(remaining)}</p>
    <form class="modal-form" id="paymentForm">
      <label>المبلغ <input type="number" name="amount" min="1" value="${remaining > 0 ? remaining : ""}" required></label>
      <label>طريقة الدفع
        <select name="method" required>
          ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
        </select>
      </label>
      <label>تاريخ الدفع <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("paymentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!Array.isArray(contract.payments)) contract.payments = [];
    contract.payments.push({
      id: DataStore.uid("pay"),
      amount: Number(f.amount.value),
      method: f.method.value,
      date: f.date.value,
    });
    DataStore.saveContracts(contracts);
    closeModal();
    (onSaved || renderUnits)();
  });
}

/* ---------- تفاصيل العقار ---------- */
function renderPropertyDetails(propertyId) {
  const property = DataStore.getProperties().find((p) => p.id === propertyId);
  if (!property) {
    els.content.innerHTML = `<div class="empty-state">هذا العقار غير موجود أو تم حذفه.<br><a href="#units" class="link-btn" style="margin-top:10px;display:inline-block;">العودة للوحدات</a></div>`;
    return;
  }

  const units = DataStore.getUnits().filter((u) => u.propertyId === propertyId);
  const contracts = DataStore.getContracts();
  const unitRows = units.map((u) => ({
    unit: u,
    contract: contracts.filter((c) => c.unitId === u.id).sort((a, b) => b.start.localeCompare(a.start))[0],
  }));

  const occupiedCount = units.filter((u) => u.status === "occupied").length;
  const totalRent = unitRows.reduce((s, { contract }) => s + (contract ? contract.rent : 0), 0);
  const totalPaid = unitRows.reduce((s, { contract }) => s + (contract ? contractPaidAmount(contract) : 0), 0);
  const totalRemaining = Math.max(0, totalRent - totalPaid);

  const allPayments = [];
  unitRows.forEach(({ unit, contract }) => {
    if (!contract) return;
    (contract.payments || []).forEach((p) => allPayments.push({ ...p, unit, contract }));
  });
  allPayments.sort((a, b) => b.date.localeCompare(a.date));

  els.content.innerHTML = `
    <a href="#units" class="link-btn" style="display:inline-block;margin-bottom:16px;">→ العودة للوحدات</a>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">عدد الوحدات</div><div class="stat-value">${units.length}</div></div>
      <div class="stat-card"><div class="stat-label">الوحدات المؤجرة</div><div class="stat-value">${occupiedCount}</div></div>
      <div class="stat-card accent"><div class="stat-label">إجمالي المحصّل</div><div class="stat-value">${money(totalPaid)}</div></div>
      <div class="stat-card warn"><div class="stat-label">إجمالي المتبقي</div><div class="stat-value">${money(totalRemaining)}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>${property.name}</h2>
        <span style="color:var(--text-dim);font-size:.85rem;">${property.city}</span>
      </div>
      ${units.length ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>الوحدة</th><th>الشارع</th><th>المستأجر</th><th>قيمة الإيجار</th><th>المبلغ المتبقي</th><th>حالة الدفع</th><th></th></tr></thead>
            <tbody>
              ${unitRows.map(({ unit, contract }) => {
                const paid = contract ? contractPaidAmount(contract) : 0;
                const remaining = contract ? Math.max(0, contract.rent - paid) : 0;
                return `
                  <tr>
                    <td><button class="link-btn cell-link" data-view-unit="${unit.id}">${unit.number}</button></td>
                    <td>${unit.street || "—"}</td>
                    <td>${contract ? tenantName(contract.tenantId) : "—"}</td>
                    <td>${contract ? money(contract.rent) : "—"}</td>
                    <td>${contract ? money(remaining) : "—"}</td>
                    <td>${statusBadge(paymentStatusOf(contract))}</td>
                    <td class="table-actions">
                      ${contract
                        ? `<button class="link-btn" data-record-payment="${contract.id}">تسجيل دفعة</button>`
                        : `<button class="link-btn" data-rent-out="${unit.id}">تأجير الوحدة</button>`}
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
      <div class="panel-head"><h2>قائمة المدفوعات (${allPayments.length})</h2></div>
      ${allPayments.length ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>التاريخ (هجري)</th><th>الوحدة</th><th>المستأجر</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
            <tbody>
              ${allPayments.map((p) => `
                <tr>
                  <td>${toHijri(p.date)}</td>
                  <td>${p.unit.number}</td>
                  <td>${tenantName(p.contract.tenantId)}</td>
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
function renderUnitDetails(unitId) {
  const unit = DataStore.getUnits().find((u) => u.id === unitId);
  if (!unit) {
    els.content.innerHTML = `<div class="empty-state">هذه الوحدة غير موجودة أو تم حذفها.<br><a href="#units" class="link-btn" style="margin-top:10px;display:inline-block;">العودة للوحدات</a></div>`;
    return;
  }

  const contract = DataStore.getContracts()
    .filter((c) => c.unitId === unitId)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  const paid = contract ? contractPaidAmount(contract) : 0;
  const remaining = contract ? Math.max(0, contract.rent - paid) : 0;
  const payments = contract ? [...(contract.payments || [])].sort((a, b) => b.date.localeCompare(a.date)) : [];

  els.content.innerHTML = `
    <a href="#property/${unit.propertyId}" class="link-btn" style="display:inline-block;margin-bottom:16px;">→ العودة لتفاصيل العقار</a>

    ${contract ? `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">قيمة الإيجار</div><div class="stat-value">${money(contract.rent)}</div></div>
        <div class="stat-card accent"><div class="stat-label">المدفوع</div><div class="stat-value">${money(paid)}</div></div>
        <div class="stat-card warn"><div class="stat-label">المتبقي</div><div class="stat-value">${money(remaining)}</div></div>
        <div class="stat-card"><div class="stat-label">حالة الدفع</div><div class="stat-value">${statusBadge(paymentStatusOf(contract))}</div></div>
      </div>
    ` : ""}

    <div class="panel">
      <div class="panel-head">
        <h2>${propertyName(unit.propertyId)} — وحدة ${unit.number}</h2>
        ${contract ? `<button class="btn btn-primary" id="recordPaymentBtn">تسجيل دفعة</button>` : `<button class="btn btn-primary" id="rentOutBtn">تأجير الوحدة</button>`}
      </div>
      <div style="padding:18px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;color:var(--text-dim);font-size:.88rem;">
        <div>الشارع<br><strong style="color:var(--text);">${unit.street || "—"}</strong></div>
        <div>المستأجر<br><strong style="color:var(--text);">${contract ? tenantName(contract.tenantId) : "—"}</strong></div>
        <div>تاريخ بدء الإيجار (هجري)<br><strong style="color:var(--text);">${contract ? toHijri(contract.start) : "—"}</strong></div>
        <div>عدد الأقساط<br><strong style="color:var(--text);">${contract ? contract.installments : "—"}</strong></div>
      </div>
    </div>

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
  `;

  const recordBtn = document.getElementById("recordPaymentBtn");
  if (recordBtn) recordBtn.addEventListener("click", () => openRecordPaymentModal(contract.id, () => renderUnitDetails(unitId)));
  const rentOutBtn = document.getElementById("rentOutBtn");
  if (rentOutBtn) rentOutBtn.addEventListener("click", () => openRentOutModal(unit.id, () => renderUnitDetails(unitId)));
}

/* ---------- لوحة المعلومات (dashboard overview) ---------- */
function renderOverview() {
  const units = DataStore.getUnits();
  const contracts = DataStore.getContracts();

  const occupiedUnits = units.filter((u) => u.status === "occupied");
  const occupancyRate = units.length ? Math.round((occupiedUnits.length / units.length) * 100) : 0;

  const totalRent = contracts.reduce((s, c) => s + c.rent, 0);
  const totalPaid = contracts.reduce((s, c) => s + contractPaidAmount(c), 0);
  const totalRemaining = contracts.reduce((s, c) => s + Math.max(0, c.rent - contractPaidAmount(c)), 0);
  const collectionRate = totalRent ? Math.round((totalPaid / totalRent) * 100) : 0;

  const topRemaining = contracts
    .map((c) => ({ c, remaining: Math.max(0, c.rent - contractPaidAmount(c)) }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 5);

  els.content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">إجمالي الوحدات</div><div class="stat-value">${units.length}</div></div>
      <div class="stat-card"><div class="stat-label">نسبة الإشغال</div><div class="stat-value">${occupancyRate}%</div></div>
      <div class="stat-card accent"><div class="stat-label">إجمالي المحصّل</div><div class="stat-value">${money(totalPaid)}</div></div>
      <div class="stat-card warn"><div class="stat-label">إجمالي المتبقي</div><div class="stat-value">${money(totalRemaining)}</div></div>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="stat-card"><div class="stat-label">إجمالي قيمة العقود السارية</div><div class="stat-value">${money(totalRent)}</div></div>
      <div class="stat-card accent"><div class="stat-label">نسبة التحصيل</div><div class="stat-value">${collectionRate}%</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>أعلى الوحدات مبالغ متبقية</h2></div>
      ${topRemaining.length ? `
        <table class="data-table">
          <thead><tr><th>المستأجر</th><th>الوحدة</th><th>المبلغ المتبقي</th><th>حالة الدفع</th></tr></thead>
          <tbody>
            ${topRemaining.map(({ c, remaining }) => {
              const unit = units.find((u) => u.id === c.unitId);
              return `
                <tr>
                  <td>${tenantName(c.tenantId)}</td>
                  <td>${unit ? `${propertyName(unit.propertyId)} - ${unit.number}` : "—"}</td>
                  <td>${money(remaining)}</td>
                  <td>${statusBadge(paymentStatusOf(c))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد مبالغ متبقية حاليًا. 👍</div>`}
    </div>
  `;
}

/* ---------- الإدارة (admin: delete properties & units) ---------- */
function deleteProperty(propertyId) {
  const units = DataStore.getUnits();
  const removedUnitIds = units.filter((u) => u.propertyId === propertyId).map((u) => u.id);

  DataStore.saveProperties(DataStore.getProperties().filter((p) => p.id !== propertyId));
  DataStore.saveUnits(units.filter((u) => u.propertyId !== propertyId));
  DataStore.saveTenants(DataStore.getTenants().filter((t) => !removedUnitIds.includes(t.unitId)));
  DataStore.saveContracts(DataStore.getContracts().filter((c) => !removedUnitIds.includes(c.unitId)));
}
function deleteUnit(unitId) {
  DataStore.saveUnits(DataStore.getUnits().filter((u) => u.id !== unitId));
  DataStore.saveTenants(DataStore.getTenants().filter((t) => t.unitId !== unitId));
  DataStore.saveContracts(DataStore.getContracts().filter((c) => c.unitId !== unitId));
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

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    properties: DataStore.getProperties(),
    units: DataStore.getUnits(),
    tenants: DataStore.getTenants(),
    contracts: DataStore.getContracts(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aqari-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    const isValid = ["properties", "units", "tenants", "contracts"].every((k) => Array.isArray(payload[k]));
    if (!isValid) {
      showMessage("خطأ", "صيغة الملف غير متوافقة مع هذا الموقع.");
      return;
    }
    openConfirmModal(
      "سيتم استبدال جميع البيانات الحالية (العقارات، الوحدات، المستأجرين، والعقود) بالبيانات الموجودة في الملف المستورد. لا يمكن التراجع عن هذا الإجراء.",
      () => {
        DataStore.saveProperties(payload.properties);
        DataStore.saveUnits(payload.units);
        DataStore.saveTenants(payload.tenants);
        DataStore.saveContracts(payload.contracts);
        renderAdmin();
      }
    );
  };
  reader.readAsText(file);
}

function renderAdmin() {
  const properties = DataStore.getProperties();
  const units = DataStore.getUnits();

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>نسخ احتياطي للبيانات</h2>
        <div class="table-actions">
          <button class="btn btn-outline" id="exportDataBtn">تصدير البيانات</button>
          <button class="btn btn-outline" id="importDataBtn">استيراد البيانات</button>
          <input type="file" id="importFileInput" accept="application/json,.json" style="display:none">
        </div>
      </div>
      <div style="padding:18px 22px;color:var(--text-dim);font-size:.85rem;line-height:1.7;">
        البيانات محفوظة في متصفحك فقط. استخدم "تصدير" لحفظ نسخة كملف على جهازك، و"استيراد" لاستعادتها لاحقًا أو نقلها إلى متصفح أو جهاز آخر.
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>العقارات (${properties.length})</h2></div>
      ${properties.length ? `
        <table class="data-table">
          <thead><tr><th>اسم العقار</th><th>المدينة</th><th>عدد الوحدات</th><th></th></tr></thead>
          <tbody>
            ${properties.map((p) => {
              const count = units.filter((u) => u.propertyId === p.id).length;
              return `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.city}</td>
                  <td>${count}</td>
                  <td class="table-actions">
                    <button class="link-btn" data-view-property="${p.id}">التفاصيل</button>
                    <button class="link-btn" data-edit-property="${p.id}">تعديل</button>
                    <button class="link-btn link-danger" data-del-property="${p.id}">حذف العقار</button>
                  </td>
                </tr>
              `;
            }).join("")}
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
                <td>${propertyName(u.propertyId)}</td>
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
    btn.addEventListener("click", () => openEditPropertyModal(btn.dataset.editProperty));
  });
  els.content.querySelectorAll("[data-edit-unit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditUnitModal(btn.dataset.editUnit));
  });

  els.content.querySelectorAll("[data-del-property]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delProperty;
      const property = properties.find((p) => p.id === id);
      const affectedUnits = units.filter((u) => u.propertyId === id).length;
      const message = affectedUnits
        ? `سيتم حذف العقار "${property.name}" نهائيًا، بالإضافة إلى ${affectedUnits} وحدة وكل بيانات المستأجرين والعقود المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.`
        : `سيتم حذف العقار "${property.name}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.`;
      openConfirmModal(message, () => { deleteProperty(id); renderAdmin(); });
    });
  });

  els.content.querySelectorAll("[data-del-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delUnit;
      const unit = units.find((u) => u.id === id);
      const hasContract = !!contractForUnit(id);
      const message = hasContract
        ? `سيتم حذف الوحدة "${unit.number}" نهائيًا، بالإضافة إلى بيانات المستأجر والعقد المرتبطين بها. لا يمكن التراجع عن هذا الإجراء.`
        : `سيتم حذف الوحدة "${unit.number}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.`;
      openConfirmModal(message, () => { deleteUnit(id); renderAdmin(); });
    });
  });
}

function openEditPropertyModal(propertyId) {
  const properties = DataStore.getProperties();
  const property = properties.find((p) => p.id === propertyId);
  if (!property) return;

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
    property.name = f.name.value.trim();
    property.city = f.city.value.trim();
    DataStore.saveProperties(properties);
    closeModal();
    renderAdmin();
  });
}

function openEditUnitModal(unitId) {
  const properties = DataStore.getProperties();
  const units = DataStore.getUnits();
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return;

  const contracts = DataStore.getContracts();
  const contract = contracts.filter((c) => c.unitId === unitId).sort((a, b) => b.start.localeCompare(a.start))[0];
  const tenants = DataStore.getTenants();
  const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;

  const startParts = contract ? getHijriParts(new Date(contract.start + "T00:00:00")) : todayHijri();

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
      ${tenant && contract ? `
        <label>اسم المستأجر <input type="text" name="tenantName" value="${tenant.name}" required></label>
        <label>رقم الجوال <input type="text" name="phone" value="${tenant.phone}" required></label>
        <label>تاريخ بدء الإيجار (هجري)
          ${hijriPickerHTML("start", startParts)}
        </label>
        <label>قيمة الإيجار السنوي <input type="number" name="rent" min="1" value="${contract.rent}" required></label>
        <label>عدد الأقساط <input type="number" name="installments" min="1" value="${contract.installments}" required></label>
        <p style="margin:-4px 0 0;font-size:.78rem;color:var(--text-dim);">المبلغ المدفوع (${money(contractPaidAmount(contract))}) يُدار من سجل الدفعات — استخدم "تسجيل دفعة" في صفحة الوحدات أو تفاصيل العقار لإضافة دفعة جديدة.</p>
      ` : ""}
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
      </div>
    </form>
  `);
  document.getElementById("editUnitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;

    unit.propertyId = f.propertyId.value;
    unit.number = f.number.value.trim();
    unit.street = f.street.value.trim();
    DataStore.saveUnits(units);

    if (tenant && contract) {
      tenant.name = f.tenantName.value.trim();
      tenant.phone = f.phone.value.trim();
      DataStore.saveTenants(tenants);

      const rent = Number(f.rent.value);
      contract.start = readHijriPicker(f, "start");
      contract.rent = rent;
      contract.installments = Number(f.installments.value);
      DataStore.saveContracts(contracts);
      unit.rent = rent;
      DataStore.saveUnits(units);
    }

    closeModal();
    renderAdmin();
  });
}

router();

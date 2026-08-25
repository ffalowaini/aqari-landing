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
function contractForUnit(unitId) {
  return DataStore.getContracts()
    .filter((c) => c.unitId === unitId)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
}
function paymentStatusOf(contract) {
  if (!contract) return "vacant";
  if (contract.paidAmount <= 0) return "not_started";
  if (contract.paidAmount >= contract.rent) return "paid_full";
  return "partial";
}
function statusBadge(status) {
  const map = {
    vacant: ["شاغرة", "badge-gray"],
    not_started: ["لم يبدأ السداد", "badge-red"],
    partial: ["سداد جزئي", "badge-orange"],
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

/* ---------- router ---------- */
const routes = {
  units: { title: "الوحدات", render: renderUnits },
  overview: { title: "لوحة المعلومات", render: renderOverview },
};

function router() {
  const hash = (window.location.hash || "#units").slice(1);
  const route = routes[hash] || routes.units;
  els.title.textContent = route.title;
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === hash);
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
    const paid = contract ? contract.paidAmount : 0;
    const remaining = contract ? Math.max(0, contract.rent - contract.paidAmount) : 0;
    return `
      <tr>
        <td>${propertyName(u.propertyId)}</td>
        <td>${u.number}</td>
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
            ? `<button class="link-btn" data-update-paid="${contract.id}">تحديث المبلغ المدفوع</button>`
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

  els.content.querySelectorAll("[data-update-paid]").forEach((btn) => {
    btn.addEventListener("click", () => openUpdatePaidModal(btn.dataset.updatePaid));
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

function openRentOutModal(unitId) {
  openModal(`
    <h3>تأجير الوحدة</h3>
    <form class="modal-form" id="rentOutForm">
      <label>اسم المستأجر <input type="text" name="tenantName" required></label>
      <label>رقم الجوال <input type="text" name="phone" required></label>
      <label>تاريخ بدء الإيجار
        <input type="date" name="start" required>
      </label>
      <p style="margin:-6px 0 0;font-size:.76rem;color:var(--text-dim);">سيُعرض التاريخ في صفحة الوحدات بالتقويم الهجري تلقائيًا.</p>
      <label>قيمة الإيجار السنوي <input type="number" name="rent" min="1" required></label>
      <label>عدد الأقساط <input type="number" name="installments" min="1" value="1" required></label>
      <label>المبلغ المدفوع مقدمًا <input type="number" name="paidAmount" min="0" value="0" required></label>
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

    const tenants = DataStore.getTenants();
    const tenant = { id: DataStore.uid("t"), name: f.tenantName.value.trim(), phone: f.phone.value.trim(), unitId };
    tenants.push(tenant);
    DataStore.saveTenants(tenants);

    const contracts = DataStore.getContracts();
    contracts.push({
      id: DataStore.uid("c"),
      tenantId: tenant.id,
      unitId,
      start: f.start.value,
      rent,
      installments: Number(f.installments.value),
      paidAmount,
    });
    DataStore.saveContracts(contracts);

    const units = DataStore.getUnits();
    const unit = units.find((u) => u.id === unitId);
    if (unit) { unit.status = "occupied"; unit.rent = rent; }
    DataStore.saveUnits(units);

    closeModal();
    renderUnits();
  });
}

function openUpdatePaidModal(contractId) {
  const contract = DataStore.getContracts().find((c) => c.id === contractId);
  if (!contract) return;
  openModal(`
    <h3>تحديث المبلغ المدفوع</h3>
    <p style="margin-top:-8px;font-size:.85rem;color:var(--text-dim);">قيمة الإيجار: ${money(contract.rent)}</p>
    <form class="modal-form" id="paidForm">
      <label>المبلغ المدفوع <input type="number" name="paidAmount" min="0" value="${contract.paidAmount}" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `);
  document.getElementById("paidForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = Math.max(0, Number(e.target.paidAmount.value));
    const contracts = DataStore.getContracts();
    const c = contracts.find((x) => x.id === contractId);
    if (c) c.paidAmount = value;
    DataStore.saveContracts(contracts);
    closeModal();
    renderUnits();
  });
}

/* ---------- لوحة المعلومات (dashboard overview) ---------- */
function renderOverview() {
  const units = DataStore.getUnits();
  const contracts = DataStore.getContracts();

  const occupiedUnits = units.filter((u) => u.status === "occupied");
  const occupancyRate = units.length ? Math.round((occupiedUnits.length / units.length) * 100) : 0;

  const totalRent = contracts.reduce((s, c) => s + c.rent, 0);
  const totalPaid = contracts.reduce((s, c) => s + c.paidAmount, 0);
  const totalRemaining = contracts.reduce((s, c) => s + Math.max(0, c.rent - c.paidAmount), 0);
  const collectionRate = totalRent ? Math.round((totalPaid / totalRent) * 100) : 0;

  const topRemaining = contracts
    .map((c) => ({ c, remaining: Math.max(0, c.rent - c.paidAmount) }))
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

router();

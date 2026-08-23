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
function unitLabel(id) {
  const u = DataStore.getUnits().find((x) => x.id === id);
  if (!u) return "—";
  return `${propertyName(u.propertyId)} - وحدة ${u.number}`;
}
function tenantName(id) {
  const t = DataStore.getTenants().find((x) => x.id === id);
  return t ? t.name : "—";
}
function statusBadge(status) {
  const map = {
    occupied: ["مؤجرة", "badge-green"],
    vacant: ["شاغرة", "badge-gray"],
    active: ["ساري", "badge-green"],
    expiring: ["ينتهي قريبًا", "badge-orange"],
    ended: ["منتهٍ", "badge-gray"],
    paid: ["مدفوع", "badge-green"],
    due: ["مستحق", "badge-blue"],
    late: ["متأخر", "badge-red"],
    open: ["مفتوح", "badge-red"],
    in_progress: ["قيد التنفيذ", "badge-orange"],
    closed: ["مغلق", "badge-green"],
  };
  const [label, cls] = map[status] || [status, "badge-gray"];
  return `<span class="badge ${cls}">${label}</span>`;
}
function openModal(html) {
  els.modalBody.innerHTML = html;
  els.modalOverlay.classList.add("open");
}
function closeModal() {
  els.modalOverlay.classList.remove("open");
  els.modalBody.innerHTML = "";
}

/* ---------- router ---------- */
const routes = {
  overview: { title: "نظرة عامة", render: renderOverview },
  properties: { title: "العقارات والوحدات", render: renderProperties },
  tenants: { title: "المستأجرون", render: renderTenants },
  contracts: { title: "العقود", render: renderContracts },
  collections: { title: "التحصيلات", render: renderCollections },
  maintenance: { title: "الصيانة", render: renderMaintenance },
  ai: { title: "المساعد الذكي", render: renderAI },
};

function router() {
  const hash = (window.location.hash || "#overview").slice(1);
  const route = routes[hash] || routes.overview;
  els.title.textContent = route.title;
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === hash);
  });
  els.content.innerHTML = "";
  route.render();
  els.sidebar.classList.remove("open");
}
window.addEventListener("hashchange", router);

/* ---------- overview ---------- */
function renderOverview() {
  const units = DataStore.getUnits();
  const payments = DataStore.getPayments();
  const maintenance = DataStore.getMaintenance();

  const occupied = units.filter((u) => u.status === "occupied").length;
  const occupancyRate = units.length ? Math.round((occupied / units.length) * 100) : 0;
  const paidThisMonth = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const lateCount = payments.filter((p) => p.status === "late").length;
  const openMaintenance = maintenance.filter((m) => m.status !== "closed").length;

  const upcoming = payments
    .filter((p) => p.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  els.content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card accent"><div class="stat-label">التحصيلات المدفوعة هذا الشهر</div><div class="stat-value">${money(paidThisMonth)}</div></div>
      <div class="stat-card"><div class="stat-label">نسبة الإشغال</div><div class="stat-value">${occupancyRate}%</div></div>
      <div class="stat-card warn"><div class="stat-label">دفعات متأخرة</div><div class="stat-value">${lateCount}</div></div>
      <div class="stat-card"><div class="stat-label">طلبات صيانة مفتوحة</div><div class="stat-value">${openMaintenance}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>الدفعات القادمة</h2></div>
      ${upcoming.length ? `
        <table class="data-table">
          <thead><tr><th>المستأجر</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>الحالة</th></tr></thead>
          <tbody>
            ${upcoming.map((p) => `
              <tr>
                <td>${tenantName(p.tenantId)}</td>
                <td>${money(p.amount)}</td>
                <td>${p.dueDate}</td>
                <td>${statusBadge(p.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد دفعات قادمة.</div>`}
    </div>
  `;
}

/* ---------- properties ---------- */
function renderProperties() {
  const properties = DataStore.getProperties();
  const units = DataStore.getUnits();

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>العقارات (${properties.length})</h2>
        <button class="btn btn-primary" id="addPropertyBtn">+ إضافة عقار</button>
      </div>
      <table class="data-table">
        <thead><tr><th>اسم العقار</th><th>المدينة</th><th>عدد الوحدات</th><th>نسبة الإشغال</th></tr></thead>
        <tbody>
          ${properties.map((p) => {
            const pUnits = units.filter((u) => u.propertyId === p.id);
            const occ = pUnits.filter((u) => u.status === "occupied").length;
            const rate = pUnits.length ? Math.round((occ / pUnits.length) * 100) : 0;
            return `<tr><td>${p.name}</td><td>${p.city}</td><td>${pUnits.length || p.unitsCount}</td><td>${rate}%</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>الوحدات (${units.length})</h2></div>
      <table class="data-table">
        <thead><tr><th>العقار</th><th>رقم الوحدة</th><th>الإيجار السنوي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${units.map((u) => `
            <tr>
              <td>${propertyName(u.propertyId)}</td>
              <td>${u.number}</td>
              <td>${money(u.rent)}</td>
              <td>${statusBadge(u.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("addPropertyBtn").addEventListener("click", () => {
    openModal(`
      <h3>إضافة عقار جديد</h3>
      <form class="modal-form" id="propertyForm">
        <label>اسم العقار <input type="text" name="name" required></label>
        <label>المدينة <input type="text" name="city" required></label>
        <label>عدد الوحدات <input type="number" name="unitsCount" min="1" value="1" required></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
          <button type="submit" class="btn btn-primary">حفظ</button>
        </div>
      </form>
    `);
    document.getElementById("cancelModal").addEventListener("click", closeModal);
    document.getElementById("propertyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const properties = DataStore.getProperties();
      properties.push({
        id: DataStore.uid("p"),
        name: f.name.value.trim(),
        city: f.city.value.trim(),
        unitsCount: Number(f.unitsCount.value),
      });
      DataStore.saveProperties(properties);
      closeModal();
      renderProperties();
    });
  });
}

/* ---------- tenants ---------- */
function renderTenants() {
  const tenants = DataStore.getTenants();
  const units = DataStore.getUnits();

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>المستأجرون (${tenants.length})</h2>
        <button class="btn btn-primary" id="addTenantBtn">+ إضافة مستأجر</button>
      </div>
      ${tenants.length ? `
        <table class="data-table">
          <thead><tr><th>الاسم</th><th>الجوال</th><th>الوحدة</th></tr></thead>
          <tbody>
            ${tenants.map((t) => `
              <tr><td>${t.name}</td><td>${t.phone}</td><td>${unitLabel(t.unitId)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا يوجد مستأجرون بعد.</div>`}
    </div>
  `;

  document.getElementById("addTenantBtn").addEventListener("click", () => {
    const vacant = units.filter((u) => u.status === "vacant");
    openModal(`
      <h3>إضافة مستأجر جديد</h3>
      <form class="modal-form" id="tenantForm">
        <label>الاسم <input type="text" name="name" required></label>
        <label>رقم الجوال <input type="text" name="phone" required></label>
        <label>الوحدة
          <select name="unitId" required>
            ${vacant.length ? vacant.map((u) => `<option value="${u.id}">${unitLabel(u.id)}</option>`).join("") : `<option value="">لا توجد وحدات شاغرة</option>`}
          </select>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
          <button type="submit" class="btn btn-primary">حفظ</button>
        </div>
      </form>
    `);
    document.getElementById("cancelModal").addEventListener("click", closeModal);
    document.getElementById("tenantForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.unitId.value) { closeModal(); return; }
      const tenants2 = DataStore.getTenants();
      tenants2.push({ id: DataStore.uid("t"), name: f.name.value.trim(), phone: f.phone.value.trim(), unitId: f.unitId.value });
      DataStore.saveTenants(tenants2);

      const units2 = DataStore.getUnits();
      const unit = units2.find((u) => u.id === f.unitId.value);
      if (unit) unit.status = "occupied";
      DataStore.saveUnits(units2);

      closeModal();
      renderTenants();
    });
  });
}

/* ---------- contracts ---------- */
function renderContracts() {
  const contracts = DataStore.getContracts();
  const tenants = DataStore.getTenants();

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>العقود (${contracts.length})</h2>
        <button class="btn btn-primary" id="addContractBtn">+ عقد جديد</button>
      </div>
      ${contracts.length ? `
        <table class="data-table">
          <thead><tr><th>المستأجر</th><th>الوحدة</th><th>البداية</th><th>النهاية</th><th>الإيجار</th><th>الحالة</th></tr></thead>
          <tbody>
            ${contracts.map((c) => `
              <tr>
                <td>${tenantName(c.tenantId)}</td>
                <td>${unitLabel(c.unitId)}</td>
                <td>${c.start}</td>
                <td>${c.end}</td>
                <td>${money(c.rent)}</td>
                <td>${statusBadge(c.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد عقود بعد.</div>`}
    </div>
  `;

  document.getElementById("addContractBtn").addEventListener("click", () => {
    if (!tenants.length) { openModal(`<h3>لا يوجد مستأجرون</h3><p style="color:var(--text-dim);font-size:.88rem;">أضف مستأجرًا أولًا قبل إنشاء عقد.</p><div class="modal-actions"><button class="btn btn-outline" id="cancelModal">إغلاق</button></div>`); document.getElementById("cancelModal").addEventListener("click", closeModal); return; }
    openModal(`
      <h3>إنشاء عقد جديد</h3>
      <form class="modal-form" id="contractForm">
        <label>المستأجر
          <select name="tenantId" required>
            ${tenants.map((t) => `<option value="${t.id}" data-unit="${t.unitId}">${t.name}</option>`).join("")}
          </select>
        </label>
        <label>تاريخ البداية <input type="date" name="start" required></label>
        <label>تاريخ النهاية <input type="date" name="end" required></label>
        <label>الإيجار السنوي <input type="number" name="rent" min="0" required></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
          <button type="submit" class="btn btn-primary">حفظ</button>
        </div>
      </form>
    `);
    document.getElementById("cancelModal").addEventListener("click", closeModal);
    document.getElementById("contractForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const tenant = tenants.find((t) => t.id === f.tenantId.value);
      const contracts2 = DataStore.getContracts();
      contracts2.push({
        id: DataStore.uid("c"),
        tenantId: f.tenantId.value,
        unitId: tenant ? tenant.unitId : "",
        start: f.start.value,
        end: f.end.value,
        rent: Number(f.rent.value),
        status: "active",
      });
      DataStore.saveContracts(contracts2);
      closeModal();
      renderContracts();
    });
  });
}

/* ---------- collections ---------- */
function renderCollections() {
  const payments = DataStore.getPayments().sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>سجل التحصيلات (${payments.length})</h2></div>
      ${payments.length ? `
        <table class="data-table">
          <thead><tr><th>المستأجر</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${payments.map((p) => `
              <tr>
                <td>${tenantName(p.tenantId)}</td>
                <td>${money(p.amount)}</td>
                <td>${p.dueDate}</td>
                <td>${statusBadge(p.status)}</td>
                <td class="table-actions">
                  ${p.status !== "paid" ? `<button class="link-btn" data-pay="${p.id}">تحديد كمدفوع</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد دفعات مسجلة.</div>`}
    </div>
  `;

  els.content.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = DataStore.getPayments();
      const pay = list.find((p) => p.id === btn.dataset.pay);
      if (pay) pay.status = "paid";
      DataStore.savePayments(list);
      renderCollections();
    });
  });
}

/* ---------- maintenance ---------- */
function renderMaintenance() {
  const items = DataStore.getMaintenance();
  const nextStatus = { open: "in_progress", in_progress: "closed" };
  const nextLabel = { open: "بدء التنفيذ", in_progress: "إغلاق الطلب" };

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>طلبات الصيانة (${items.length})</h2>
        <button class="btn btn-primary" id="addMaintenanceBtn">+ طلب صيانة</button>
      </div>
      ${items.length ? `
        <table class="data-table">
          <thead><tr><th>الوحدة</th><th>الوصف</th><th>تاريخ الطلب</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${items.map((m) => `
              <tr>
                <td>${unitLabel(m.unitId)}</td>
                <td>${m.title}</td>
                <td>${m.createdAt}</td>
                <td>${statusBadge(m.status)}</td>
                <td class="table-actions">
                  ${nextStatus[m.status] ? `<button class="link-btn" data-advance="${m.id}">${nextLabel[m.status]}</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">لا توجد طلبات صيانة.</div>`}
    </div>
  `;

  els.content.querySelectorAll("[data-advance]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = DataStore.getMaintenance();
      const item = list.find((m) => m.id === btn.dataset.advance);
      if (item && nextStatus[item.status]) item.status = nextStatus[item.status];
      DataStore.saveMaintenance(list);
      renderMaintenance();
    });
  });

  document.getElementById("addMaintenanceBtn").addEventListener("click", () => {
    const units = DataStore.getUnits();
    openModal(`
      <h3>طلب صيانة جديد</h3>
      <form class="modal-form" id="maintenanceForm">
        <label>الوحدة
          <select name="unitId" required>
            ${units.map((u) => `<option value="${u.id}">${unitLabel(u.id)}</option>`).join("")}
          </select>
        </label>
        <label>وصف العطل <input type="text" name="title" required></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
          <button type="submit" class="btn btn-primary">إرسال</button>
        </div>
      </form>
    `);
    document.getElementById("cancelModal").addEventListener("click", closeModal);
    document.getElementById("maintenanceForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const list = DataStore.getMaintenance();
      list.push({
        id: DataStore.uid("m"),
        unitId: f.unitId.value,
        title: f.title.value.trim(),
        status: "open",
        createdAt: new Date().toISOString().slice(0, 10),
      });
      DataStore.saveMaintenance(list);
      closeModal();
      renderMaintenance();
    });
  });
}

/* ---------- AI assistant (local, rule-based — no external API) ---------- */
function renderAI() {
  els.content.innerHTML = `
    <div class="chat-panel">
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">
          أهلًا ${session.name}! أنا مساعدك الذكي. اسألني عن المتأخرات، نسبة الإشغال، العقود المنتهية، أو طلبات الصيانة المفتوحة.
        </div>
      </div>
      <div class="chat-suggestions">
        <button class="chat-chip" data-q="من المستأجرين المتأخرين؟">من المستأجرين المتأخرين؟</button>
        <button class="chat-chip" data-q="ما نسبة الإشغال؟">ما نسبة الإشغال؟</button>
        <button class="chat-chip" data-q="ما العقود التي تنتهي قريبًا؟">عقود تنتهي قريبًا</button>
        <button class="chat-chip" data-q="ما طلبات الصيانة المفتوحة؟">طلبات الصيانة المفتوحة</button>
      </div>
      <form class="chat-input-row" id="chatForm">
        <input type="text" id="chatInput" placeholder="اكتب طلبك هنا..." autocomplete="off">
        <button type="submit" class="btn btn-primary">إرسال</button>
      </form>
    </div>
  `;

  const messages = document.getElementById("chatMessages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");

  document.querySelectorAll(".chat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.q;
      form.dispatchEvent(new Event("submit"));
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    setTimeout(() => addMsg(answerQuery(text), "bot"), 300);
  });

  function addMsg(html, who) {
    const div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function answerQuery(text) {
    const q = text.toLowerCase();
    const payments = DataStore.getPayments();
    const units = DataStore.getUnits();
    const contracts = DataStore.getContracts();
    const maintenance = DataStore.getMaintenance();

    if (q.includes("متأخر")) {
      const late = payments.filter((p) => p.status === "late");
      if (!late.length) return "لا يوجد مستأجرون متأخرون حاليًا. 👍";
      return `وجدت ${late.length} دفعة متأخرة:<ul>${late.map((p) => `<li>${tenantName(p.tenantId)} — ${money(p.amount)} (استحق في ${p.dueDate})</li>`).join("")}</ul>هل تريد إرسال تذكير دفع لهم؟ (هذا عرض توضيحي فقط)`;
    }
    if (q.includes("إشغال") || q.includes("اشغال")) {
      const occ = units.filter((u) => u.status === "occupied").length;
      const rate = units.length ? Math.round((occ / units.length) * 100) : 0;
      return `نسبة الإشغال الحالية هي <strong>${rate}%</strong> (${occ} من أصل ${units.length} وحدة).`;
    }
    if (q.includes("عقد") || q.includes("تجديد") || q.includes("تنتهي")) {
      const expiring = contracts.filter((c) => c.status === "expiring");
      if (!expiring.length) return "لا توجد عقود تنتهي قريبًا.";
      return `لديك ${expiring.length} عقد على وشك الانتهاء:<ul>${expiring.map((c) => `<li>${tenantName(c.tenantId)} — ${unitLabel(c.unitId)} (ينتهي في ${c.end})</li>`).join("")}</ul>`;
    }
    if (q.includes("صيانة")) {
      const open = maintenance.filter((m) => m.status !== "closed");
      if (!open.length) return "لا توجد طلبات صيانة مفتوحة حاليًا. 👍";
      return `يوجد ${open.length} طلب صيانة قيد المتابعة:<ul>${open.map((m) => `<li>${unitLabel(m.unitId)} — ${m.title} (${m.status === "open" ? "مفتوح" : "قيد التنفيذ"})</li>`).join("")}</ul>`;
    }
    return `لم أفهم طلبك بعد. جرّب أحد الأسئلة المقترحة أدناه، أو اسأل عن "المتأخرات" أو "نسبة الإشغال" أو "الصيانة" أو "العقود".`;
  }
}

router();

/*
  Data layer for the Aqari Zaki demo.
  Everything is stored in localStorage — this is a local, front-end-only
  demo with no real backend, so passwords are stored in plain text.
  Never do this in a real product; a real app must hash passwords server-side.
*/

const DB_KEYS = {
  users: "aqari_users",
  session: "aqari_session",
  properties: "aqari_properties",
  units: "aqari_units",
  tenants: "aqari_tenants",
  contracts: "aqari_contracts",
  payments: "aqari_payments",
  maintenance: "aqari_maintenance",
  seeded: "aqari_seeded",
};

function readDB(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}
function writeDB(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function seedIfNeeded() {
  if (localStorage.getItem(DB_KEYS.seeded)) return;

  const properties = [
    { id: "p1", name: "برج الواحة", city: "الرياض", unitsCount: 24 },
    { id: "p2", name: "مجمع الشروق السكني", city: "جدة", unitsCount: 16 },
    { id: "p3", name: "أبراج النخيل", city: "الدمام", unitsCount: 10 },
  ];

  const units = [
    { id: "u1", propertyId: "p1", number: "101", rent: 32000, status: "occupied" },
    { id: "u2", propertyId: "p1", number: "102", rent: 34000, status: "occupied" },
    { id: "u3", propertyId: "p1", number: "103", rent: 30000, status: "vacant" },
    { id: "u4", propertyId: "p2", number: "A1", rent: 22000, status: "occupied" },
    { id: "u5", propertyId: "p2", number: "A2", rent: 21000, status: "occupied" },
    { id: "u6", propertyId: "p3", number: "201", rent: 27000, status: "vacant" },
  ];

  const tenants = [
    { id: "t1", name: "عبدالله المطيري", phone: "0501234567", unitId: "u1" },
    { id: "t2", name: "سارة القحطاني", phone: "0559876543", unitId: "u2" },
    { id: "t3", name: "فهد العتيبي", phone: "0561122334", unitId: "u4" },
    { id: "t4", name: "منيرة الدوسري", phone: "0533344556", unitId: "u5" },
  ];

  const contracts = [
    { id: "c1", tenantId: "t1", unitId: "u1", start: "2025-09-01", end: "2026-08-31", rent: 32000, status: "active" },
    { id: "c2", tenantId: "t2", unitId: "u2", start: "2025-10-15", end: "2026-09-14", rent: 34000, status: "active" },
    { id: "c3", tenantId: "t3", unitId: "u4", start: "2025-11-01", end: "2026-09-05", rent: 22000, status: "expiring" },
    { id: "c4", tenantId: "t4", unitId: "u5", start: "2025-08-01", end: "2026-07-31", rent: 21000, status: "active" },
  ];

  const payments = [
    { id: "pay1", tenantId: "t1", amount: 32000, dueDate: "2026-08-05", status: "paid" },
    { id: "pay2", tenantId: "t2", amount: 34000, dueDate: "2026-08-10", status: "late" },
    { id: "pay3", tenantId: "t3", amount: 22000, dueDate: "2026-08-20", status: "due" },
    { id: "pay4", tenantId: "t4", amount: 21000, dueDate: "2026-08-01", status: "late" },
    { id: "pay5", tenantId: "t1", amount: 32000, dueDate: "2026-09-05", status: "due" },
  ];

  const maintenance = [
    { id: "m1", unitId: "u2", title: "تسريب مياه في المطبخ", status: "open", createdAt: "2026-08-18" },
    { id: "m2", unitId: "u4", title: "عطل في مكيف الصالة", status: "in_progress", createdAt: "2026-08-15" },
    { id: "m3", unitId: "u1", title: "صيانة باب المدخل", status: "closed", createdAt: "2026-08-02" },
  ];

  writeDB(DB_KEYS.properties, properties);
  writeDB(DB_KEYS.units, units);
  writeDB(DB_KEYS.tenants, tenants);
  writeDB(DB_KEYS.contracts, contracts);
  writeDB(DB_KEYS.payments, payments);
  writeDB(DB_KEYS.maintenance, maintenance);
  localStorage.setItem(DB_KEYS.seeded, "1");
}

const DataStore = {
  keys: DB_KEYS,
  uid,
  seedIfNeeded,

  getUsers() { return readDB(DB_KEYS.users); },
  saveUsers(list) { writeDB(DB_KEYS.users, list); },

  getSession() {
    const raw = localStorage.getItem(DB_KEYS.session);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(user) {
    localStorage.setItem(DB_KEYS.session, JSON.stringify({ id: user.id, name: user.name, email: user.email }));
  },
  clearSession() { localStorage.removeItem(DB_KEYS.session); },

  getProperties() { return readDB(DB_KEYS.properties); },
  saveProperties(list) { writeDB(DB_KEYS.properties, list); },

  getUnits() { return readDB(DB_KEYS.units); },
  saveUnits(list) { writeDB(DB_KEYS.units, list); },

  getTenants() { return readDB(DB_KEYS.tenants); },
  saveTenants(list) { writeDB(DB_KEYS.tenants, list); },

  getContracts() { return readDB(DB_KEYS.contracts); },
  saveContracts(list) { writeDB(DB_KEYS.contracts, list); },

  getPayments() { return readDB(DB_KEYS.payments); },
  savePayments(list) { writeDB(DB_KEYS.payments, list); },

  getMaintenance() { return readDB(DB_KEYS.maintenance); },
  saveMaintenance(list) { writeDB(DB_KEYS.maintenance, list); },
};

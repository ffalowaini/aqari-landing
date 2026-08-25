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
  seeded: "aqari_seeded_v2",
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

  // Data left over from the previous (v1) schema — patch it up in place
  // instead of wiping out anything a returning visitor already added.
  const existingUnits = readDB(DB_KEYS.units);
  const existingContracts = readDB(DB_KEYS.contracts);
  if (existingUnits.length || existingContracts.length) {
    existingUnits.forEach((u) => { if (u.street === undefined) u.street = "غير محدد"; });
    existingContracts.forEach((c) => {
      if (c.installments === undefined) c.installments = 12;
      if (c.paidAmount === undefined) c.paidAmount = 0;
    });
    writeDB(DB_KEYS.units, existingUnits);
    writeDB(DB_KEYS.contracts, existingContracts);
    localStorage.removeItem("aqari_payments");
    localStorage.removeItem("aqari_maintenance");
    localStorage.setItem(DB_KEYS.seeded, "1");
    return;
  }

  const properties = [
    { id: "p1", name: "برج الواحة", city: "الرياض", unitsCount: 24 },
    { id: "p2", name: "مجمع الشروق السكني", city: "جدة", unitsCount: 16 },
    { id: "p3", name: "أبراج النخيل", city: "الدمام", unitsCount: 10 },
  ];

  const units = [
    { id: "u1", propertyId: "p1", number: "101", street: "شارع الأمير سلطان", rent: 32000, status: "occupied" },
    { id: "u2", propertyId: "p1", number: "102", street: "شارع الأمير سلطان", rent: 34000, status: "occupied" },
    { id: "u3", propertyId: "p1", number: "103", street: "شارع الأمير سلطان", rent: 30000, status: "vacant" },
    { id: "u4", propertyId: "p2", number: "A1", street: "شارع فلسطين", rent: 22000, status: "occupied" },
    { id: "u5", propertyId: "p2", number: "A2", street: "شارع فلسطين", rent: 21000, status: "occupied" },
    { id: "u6", propertyId: "p3", number: "201", street: "شارع الملك فهد", rent: 27000, status: "vacant" },
  ];

  const tenants = [
    { id: "t1", name: "عبدالله المطيري", phone: "0501234567", unitId: "u1" },
    { id: "t2", name: "سارة القحطاني", phone: "0559876543", unitId: "u2" },
    { id: "t3", name: "فهد العتيبي", phone: "0561122334", unitId: "u4" },
    { id: "t4", name: "منيرة الدوسري", phone: "0533344556", unitId: "u5" },
  ];

  const contracts = [
    { id: "c1", tenantId: "t1", unitId: "u1", start: "2025-09-01", rent: 32000, installments: 12, paidAmount: 32000 },
    { id: "c2", tenantId: "t2", unitId: "u2", start: "2025-10-15", rent: 34000, installments: 4, paidAmount: 17000 },
    { id: "c3", tenantId: "t3", unitId: "u4", start: "2025-11-01", rent: 22000, installments: 2, paidAmount: 0 },
    { id: "c4", tenantId: "t4", unitId: "u5", start: "2025-08-01", rent: 21000, installments: 12, paidAmount: 21000 },
  ];

  writeDB(DB_KEYS.properties, properties);
  writeDB(DB_KEYS.units, units);
  writeDB(DB_KEYS.tenants, tenants);
  writeDB(DB_KEYS.contracts, contracts);
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
};

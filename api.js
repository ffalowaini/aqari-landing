/*
  API client for the Aqari Zaki Spring Boot backend.
  Replaces the old localStorage-based DataStore — all reads/writes now
  go over HTTP to a real server backed by a SQL database.

  The backend runs locally by default (see aqari-backend/README.md for
  how to start it). If you deploy it somewhere, change API_BASE_URL.
*/
const API_BASE_URL = "http://localhost:8081";

const TOKEN_KEY = "aqari_token";
const USER_KEY = "aqari_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function getSessionUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  let response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError("تعذّر الاتصال بالخادم. تأكد أن الخادم المحلي يعمل على " + API_BASE_URL, 0);
  }

  if (response.status === 401) {
    clearSession();
    window.location.href = "login.html";
    throw new ApiError("انتهت الجلسة", 401);
  }

  if (!response.ok) {
    let message = "حدث خطأ غير متوقع.";
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (e) { /* ignore parse failure, keep default message */ }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const Api = {
  ApiError,
  getToken,
  getSessionUser,
  clearSession,

  async signup(name, email, password) {
    const data = await request("POST", "/api/auth/signup", { name, email, password });
    setSession(data.token, { id: data.userId, name: data.name, email: data.email });
    return data;
  },
  async login(email, password) {
    const data = await request("POST", "/api/auth/login", { email, password });
    setSession(data.token, { id: data.userId, name: data.name, email: data.email });
    return data;
  },

  getProperties() { return request("GET", "/api/properties"); },
  createProperty(name, city) { return request("POST", "/api/properties", { name, city }); },
  updateProperty(id, name, city) { return request("PUT", `/api/properties/${id}`, { name, city }); },
  deleteProperty(id) { return request("DELETE", `/api/properties/${id}`); },
  getPropertyDetail(id) { return request("GET", `/api/properties/${id}`); },

  getUnits() { return request("GET", "/api/units"); },
  createUnit(propertyId, number, street) { return request("POST", "/api/units", { propertyId, number, street }); },
  updateUnit(id, propertyId, number, street) { return request("PUT", `/api/units/${id}`, { propertyId, number, street }); },
  deleteUnit(id) { return request("DELETE", `/api/units/${id}`); },
  getUnitDetail(id) { return request("GET", `/api/units/${id}`); },
  rentOut(unitId, payload) { return request("POST", `/api/units/${unitId}/rent-out`, payload); },
  renew(unitId, payload) { return request("POST", `/api/units/${unitId}/renew`, payload); },
  endLease(unitId) { return request("POST", `/api/units/${unitId}/end-lease`, {}); },

  recordPayment(contractId, amount, method, date) {
    return request("POST", `/api/contracts/${contractId}/payments`, { amount, method, date });
  },
  updateContract(contractId, start, rent, installments) {
    return request("PUT", `/api/contracts/${contractId}`, { start, rent, installments });
  },
  updateTenant(tenantId, name, phone) {
    return request("PUT", `/api/tenants/${tenantId}`, { name, phone });
  },

  getOverview() { return request("GET", "/api/dashboard/overview"); },

  exportData() { return request("GET", "/api/data/export"); },
  importData(bundle) { return request("POST", "/api/data/import", bundle); },
};

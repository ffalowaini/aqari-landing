/* Hijri (Umm al-Qura) calendar helpers and the Hijri date picker used in forms. */

import { appToday } from "../core/app-clock.js";

export const HIJRI_MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

export function getHijriParts(date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const obj = {};
  parts.forEach((p) => { if (p.type !== "literal") obj[p.type] = parseInt(p.value, 10); });
  return { y: obj.year, m: obj.month, d: obj.day };
}

export function todayHijri() {
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

export function hijriPickerHTML(prefix, defaultParts, yearsBack = 3, yearsAhead = 2) {
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

export function readHijriPicker(form, prefix) {
  const hy = Number(form[prefix + "Year"].value);
  const hm = Number(form[prefix + "Month"].value);
  const hd = Number(form[prefix + "Day"].value);
  return hijriToGregorianISO(hy, hm, hd);
}

/* Reusable contract display pieces: current lease period and rent history. */

import { money, toHijri } from "../utils/format.js";
import { HIJRI_MONTHS, getHijriParts } from "../utils/hijri.js";

/* Start of the contract's current annual cycle (full start → end on hover), with which year of the lease it is and the original start underneath. */
export function currentPeriodHTML(c) {
  return `<div style="white-space:nowrap;" title="${toHijri(c.currentPeriodStart)} ← ${toHijri(c.currentPeriodEnd)}">${toHijri(c.currentPeriodStart)}</div>`
    + `<div style="font-size:.75rem;color:var(--text-dim);">السنة ${c.currentYearNumber} · بدأ ${toHijri(c.start)}</div>`;
}

/* Hijri label for the first day of lease year N (same day/month as the start, N-1 years later). */
export function leaseYearStartLabel(contract, year) {
  const p = getHijriParts(new Date(contract.start + "T00:00:00"));
  return `${p.d} ${HIJRI_MONTHS[p.m - 1]} ${p.y + year - 1} هـ`;
}

/* Rent history: year 1 price plus every change, each with the lease years it covers. */
export function rentHistoryHTML(c) {
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

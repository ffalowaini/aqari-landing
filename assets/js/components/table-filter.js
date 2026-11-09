/* Client-side table filters: search box + dropdowns above any table. */

import { escapeAttr, normalizeArabic } from "../utils/text.js";

/* filterBarHTML(key, selects) renders a search box + dropdowns above the table
   marked data-filter-table="key". Dropdowns match a row's data-f-<field>
   attribute exactly; the search box matches any
   text in the row. Chosen filters are remembered per table while the app is
   open, so re-rendering after e.g. recording a payment keeps them. */
const filterState = {};

export function filterBarHTML(key, selects = []) {
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
export function statusOptions(values, order) {
  const present = new Set(values);
  const labels = { vacant: "شاغرة", late: "متأخر", on_track: "قيد السداد", not_started: "لم يبدأ السداد", paid_full: "مكتمل السداد",
    committed: "ملتزم", semi_committed: "شبه ملتزم", delinquent: "مماطل", paid: "مدفوع", overdue: "متأخر", upcoming: "قادم", occupied: "مؤجرة" };
  return order.filter((v) => present.has(v)).map((v) => ({ value: v, label: labels[v] || v }));
}

export function uniqueOptions(values) {
  return [...new Set(values.filter((v) => v != null && v !== ""))].map((v) => ({ value: v, label: v }));
}

export function wireTableFilters(root) {
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

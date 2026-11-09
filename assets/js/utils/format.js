/* Display formatting: money (with the Saudi Riyal symbol), Hijri dates, status badges. */

/* Official Saudi Riyal symbol (SAMA, Feb 2025 / Unicode U+20C1). Most fonts
   don't have the glyph yet, so it's embedded as an inline vector icon
   instead of relying on font support — renders identically everywhere. */
const RIYAL_ICON = '<svg viewBox="0 0 1124.14 1256.39" style="width:.72em;height:.8em;display:inline-block;vertical-align:-0.05em;fill:currentColor;" aria-hidden="true"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>';

export function money(n) {
  return Number(n).toLocaleString("ar-SA-u-nu-latn") + " " + RIYAL_ICON;
}

export function toHijri(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
  }).format(d);
}

export function statusBadge(status) {
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

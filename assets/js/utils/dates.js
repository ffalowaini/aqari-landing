/* Gregorian ISO date helpers (yyyy-mm-dd). */

/* ISO date one day before the given ISO date. */
export function dayBefore(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

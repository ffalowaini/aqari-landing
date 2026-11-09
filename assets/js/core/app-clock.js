/* The app's notion of "today" on the client. Normally the real date; when the
   backend's test clock is set (local dev only), it follows that simulated date
   so date pickers default to it too. */

let appTodayISO = null; // simulated "today" (yyyy-mm-dd), null = the real date

export function appToday() {
  return appTodayISO ? new Date(appTodayISO + "T00:00:00") : new Date();
}
export function getAppTodayISO() {
  return appTodayISO;
}
export function setAppTodayISO(iso) {
  appTodayISO = iso;
}

/* Test-date button (local dev only).
   Lets you pretend "today" is a later date so you can see how installments,
   arrears and statuses change over time. The backend does the date math, so
   the override lives there (in memory — it resets when the server restarts),
   and the button only appears when the backend has the test clock enabled
   (local dev; it's switched off on the live Render deployment). */

import { Api } from "../core/api.js";
import { appToday, getAppTodayISO, setAppTodayISO } from "../core/app-clock.js";
import { els } from "../components/dom.js";
import { closeModal, openModal, safely } from "../components/modal.js";
import { router } from "../router.js";
import { isoDate } from "../utils/dates.js";
import { toHijri } from "../utils/format.js";
import { hijriPickerHTML, readHijriPicker, todayHijri } from "../utils/hijri.js";

function applyTestClockState(state) {
  setAppTodayISO(state.overridden ? state.today : null);
  const btn = document.getElementById("testClockBtn");
  if (!btn) return;
  btn.classList.toggle("active", state.overridden);
  btn.innerHTML = state.overridden
    ? `🧪 اليوم التجريبي: ${toHijri(state.today)}`
    : "🧪 تغيير تاريخ اليوم";
  btn.title = state.overridden
    ? "التطبيق يعمل الآن بتاريخ تجريبي — اضغط للتغيير أو للعودة لتاريخ اليوم الحقيقي"
    : "اختبار التطبيق بتاريخ مستقبلي";
}

async function changeTestClock(action) {
  await safely(async () => {
    const state = await action();
    applyTestClockState(state);
    closeModal();
    await router();
  });
}

function openTestClockModal() {
  const presets = [
    [1, "+ شهر"],
    [3, "+ 3 أشهر"],
    [6, "+ 6 أشهر"],
    [12, "+ سنة"],
  ];
  openModal(`
    <h3>🧪 تغيير تاريخ اليوم (للاختبار)</h3>
    <p style="color:var(--text-dim);font-size:.88rem;line-height:1.7;margin-bottom:12px;">
      يحسب التطبيق الأقساط والمتأخرات وحالة السداد ولوحة المعلومات كأن اليوم هو التاريخ الذي تختاره.
      لا تتغير أي بيانات محفوظة، ويعود التاريخ الحقيقي عند الضغط على "العودة لتاريخ اليوم" أو عند إعادة تشغيل الخادم.
    </p>
    <div class="test-clock-presets">
      ${presets.map(([m, label]) => `<button type="button" class="btn btn-outline" data-months="${m}">${label}</button>`).join("")}
    </div>
    <form class="modal-form" id="testClockForm">
      <label>أو اختر تاريخًا (هجري)
        ${hijriPickerHTML("clock", todayHijri(), 1, 6)}
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="cancelModal">إلغاء</button>
        ${getAppTodayISO() ? `<button type="button" class="btn btn-outline" id="resetTestClock">العودة لتاريخ اليوم</button>` : ""}
        <button type="submit" class="btn btn-primary">تطبيق</button>
      </div>
    </form>
  `);
  els.modalBody.querySelectorAll("[data-months]").forEach((b) => {
    b.addEventListener("click", () => {
      const d = appToday();
      d.setMonth(d.getMonth() + Number(b.dataset.months));
      changeTestClock(() => Api.setTestClock(isoDate(d)));
    });
  });
  const resetBtn = document.getElementById("resetTestClock");
  if (resetBtn) resetBtn.addEventListener("click", () => changeTestClock(() => Api.resetTestClock()));
  document.getElementById("testClockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    changeTestClock(() => Api.setTestClock(readHijriPicker(e.target, "clock")));
  });
}

export async function initTestClock() {
  let state;
  try {
    state = await Api.getTestClock();
  } catch (e) {
    return; // backend without the test clock (e.g. the live site) — no button
  }
  if (!state || !state.enabled) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "testClockBtn";
  btn.className = "btn btn-outline test-clock-btn";
  btn.addEventListener("click", openTestClockModal);
  els.user.parentNode.insertBefore(btn, els.user);
  applyTestClockState(state);
}

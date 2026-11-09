/* Text helpers: Arabic-tolerant search normalization and HTML attribute escaping. */

export function normalizeArabic(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")          // tashkeel + tatweel
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function escapeAttr(v) {
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

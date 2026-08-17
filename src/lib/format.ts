export function formatSSP(amount: number, lang: "en" | "ar" = "en"): string {
  const num = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(Math.round(amount));
  const label = lang === "ar" ? "جنيه" : "SSP";
  return lang === "ar" ? `${num} ${label}` : `${label} ${num}`;
}

export const CATEGORY_ICONS = {
  "Baufinanzierung": "🏠", "Computer/Internet/Medien": "💻", "Fernsehen / Internet": "📺",
  "Festnetz": "☎️", "Fitnessstudio": "💪", "Gas": "🔥", "Gesundheit": "❤️",
  "Girokonto": "🏦", "Hilfsorganisationen": "🤝", "KFZ-Versicherung": "🚗",
  "Kreditkarte": "💳", "Mobilfunk": "📱", "Nebenkosten (Haus)": "🏡",
  "Pay-TV": "📡", "Riester Rente": "👴", "Sparplan": "💰",
  "Sport und Freizeit": "⚽", "Strom": "⚡", "Transport": "🚌",
  "Versicherung / Steuern": "🛡️", "Wasser": "💧", "Webservices": "🌐",
  "Zeitungen": "📰", "Telefon": "📞",
};

export const CATEGORY_COLORS = {
  "Baufinanzierung": "#E74C3C", "Fernsehen / Internet": "#3498DB", "Festnetz": "#1ABC9C",
  "Girokonto": "#F39C12", "Hilfsorganisationen": "#E91E63", "Mobilfunk": "#9B59B6",
  "Nebenkosten (Haus)": "#2ECC71", "Sparplan": "#FF9800", "Sport und Freizeit": "#00BCD4",
  "Versicherung / Steuern": "#607D8B", "Computer/Internet/Medien": "#3498DB",
  "Fitnessstudio": "#E67E22", "Gas": "#E74C3C", "Gesundheit": "#E91E63",
  "KFZ-Versicherung": "#795548", "Kreditkarte": "#FF5722", "Pay-TV": "#673AB7",
  "Riester Rente": "#4CAF50", "Strom": "#FFC107", "Transport": "#009688",
  "Wasser": "#2196F3", "Webservices": "#00BCD4", "Zeitungen": "#9E9E9E", "Telefon": "#3F51B5",
};

export function toMonthly(cost, interval) {
  if (!cost || !interval) return 0;
  if (interval === "monatlich") return cost;
  if (interval === "jährlich") return cost / 12;
  if (interval === "vierteljährlich") return cost / 3;
  return cost;
}

export function formatCurrency(v) {
  return v != null
    ? v.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
    : "—";
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

export function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getWarningLevel(contract) {
  const days = getDaysUntil(contract.naechsteKuendigung);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 30) return "warning";
  if (days <= 90) return "info";
  return "none";
}

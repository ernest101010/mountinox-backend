export const locales = ["hy", "ru", "en"] as const;
export type Locale = (typeof locales)[number];

export type Translation = Record<Locale, string>;

export type SellingMode = "in_stock" | "preorder" | "out_of_stock";
export type OrderStatus =
  | "new"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cod" | "bank_transfer" | "instagram";
export type OrderChannel = "site" | "instagram";
export type AddressKind = "yerevan" | "marz";

export function pickTranslation(value: Translation, locale: Locale): string {
  return value[locale] || value.hy;
}

export function formatAmd(amount: number, locale: Locale = "hy"): string {
  const tag = locale === "hy" ? "hy-AM" : locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "AMD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function cashbackFromSubtotal(subtotalAmd: number, cashbackBps: number): number {
  return Math.round((subtotalAmd * cashbackBps) / 10000);
}

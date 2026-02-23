import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import type { ReservationStatus, DepartureStatus, CurrencyCode } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, fmt = "MMM d, yyyy"): string {
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy HH:mm");
  } catch {
    return dateStr;
  }
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatShortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  DRAFT: "Draft",
  RESERVED: "Reserved",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  RESERVED: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export const DEPARTURE_STATUS_COLORS: Record<DepartureStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  CARD: "Card",
  OTHER: "Other",
};

export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  OVERRIDE_UNIT_PRICE: "Override Unit Price",
  DISCOUNT_AMOUNT: "Discount (Amount)",
  DISCOUNT_PERCENT: "Discount (%)",
  SURCHARGE_AMOUNT: "Surcharge (Amount)",
};

export const TOUR_ITEM_KIND_LABELS: Record<string, string> = {
  BASE: "Base",
  FEE: "Fee",
  ADDON: "Add-on",
};

export const CHARGE_TYPE_LABELS: Record<string, string> = {
  PER_PERSON: "Per Person",
  PER_BOOKING: "Per Booking",
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  STAFF: "Staff",
  STAFF_PRICING: "Staff (Pricing)",
  VIEWER: "Viewer",
};

export function hasRole(
  userRole: string,
  requiredRole: "VIEWER" | "STAFF" | "STAFF_PRICING" | "OWNER"
): boolean {
  const hierarchy = { VIEWER: 0, STAFF: 1, STAFF_PRICING: 2, OWNER: 3 };
  return (
    (hierarchy[userRole as keyof typeof hierarchy] ?? -1) >=
    hierarchy[requiredRole]
  );
}

// Enums
export type CurrencyCode = "USD" | "ARS";
export type ReservationStatus =
  | "DRAFT"
  | "RESERVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CONFIRMED"
  | "CANCELLED";
export type TourItemKind = "BASE" | "FEE" | "ADDON";
export type ChargeType = "PER_PERSON" | "PER_BOOKING";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
export type DepartureStatus = "ACTIVE" | "CLOSED" | "CANCELLED";
export type PaymentStatus = "RECEIVED" | "VOID";
export type AdjustmentType =
  | "OVERRIDE_UNIT_PRICE"
  | "DISCOUNT_AMOUNT"
  | "DISCOUNT_PERCENT"
  | "SURCHARGE_AMOUNT";
export type UserRole = "OWNER" | "STAFF" | "STAFF_PRICING" | "VIEWER";
export type UserStatus = "ACTIVE" | "INACTIVE";

// Agency / Auth
export interface Agency {
  id: string;
  name: string;
  role: UserRole;
}

export interface AgencyUser {
  user_id: string;
  full_name: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
}

// Tour
export interface Tour {
  id: string;
  code?: string;
  name: string;
  description?: string;
  duration_minutes?: number;
  active: boolean;
}

// Tour Item
export interface TourItem {
  id: string;
  tour_id: string;
  code: string;
  name: string;
  kind: TourItemKind;
  charge_type: ChargeType;
  is_optional: boolean;
  default_quantity: number;
  active: boolean;
}

// Passenger Category
export interface PassengerCategory {
  id: string;
  code: string;
  name: string;
  min_age_years?: number;
  max_age_years?: number;
  base_price_multiplier: number;
  occupies_capacity: boolean;
  active: boolean;
}

// Price Book
export interface PriceBook {
  id: string;
  currency: CurrencyCode;
  name: string;
  active: boolean;
}

// Tour Item Price (validity range)
export interface TourItemPrice {
  id: string;
  tour_item_id: string;
  price_book_id: string;
  valid_from: string;
  valid_to?: string | null;
  unit_price: number;
  active: boolean;
}

// Category Rule
export interface CategoryRule {
  id: string;
  tour_item_id: string;
  passenger_category_id: string;
  passenger_category?: PassengerCategory;
  multiplier: number;
  active: boolean;
}

// Departure
export interface Departure {
  id: string;
  tour_id: string;
  tour?: Tour;
  start_at: string;
  capacity_total: number;
  capacity_used: number;
  capacity_remaining: number;
  is_overbooked: boolean;
  status: DepartureStatus;
  notes?: string;
}

// Customer
export interface Customer {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  lodging_address?: string;
}

// Reservation Passenger
export interface ReservationPassenger {
  id: string;
  first_name: string;
  last_name: string;
  document_id: string;
  birth_date?: string;
  category_code: string;
  email?: string;
  phone?: string;
  lodging_address?: string;
}

// Reservation Item (snapshot)
export interface ReservationItem {
  id: string;
  tour_item_id: string;
  name_snapshot: string;
  kind_snapshot: TourItemKind;
  charge_type_snapshot: ChargeType;
  quantity: number;
  unit_price_snapshot: number;
  total_price_snapshot: number;
  pricing_meta?: Record<string, unknown>;
}

// Adjustment
export interface Adjustment {
  id: string;
  reservation_item_id: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  created_at: string;
  created_by?: string;
}

// Payment
export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  reference?: string;
  received_at: string;
  status: PaymentStatus;
  refunds?: PaymentRefund[];
}

// Refund
export interface PaymentRefund {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

// Reservation Totals
export interface ReservationTotals {
  total_snapshot: number;
  total_final: number;
  total_paid: number;
  total_refunded: number;
  net_paid: number;
  balance_due: number;
}

// Reservation (list item)
export interface ReservationListItem {
  id: string;
  departure_id: string;
  departure?: {
    start_at: string;
    tour?: Tour;
  };
  status: ReservationStatus;
  currency: CurrencyCode;
  customer?: Customer;
  total_snapshot: number;
  total_final: number;
  net_paid: number;
  balance_due: number;
  capacity_override?: boolean;
  created_at: string;
}

// Reservation (detail)
export interface ReservationDetail {
  id: string;
  departure_id: string;
  departure?: Departure;
  status: ReservationStatus;
  currency: CurrencyCode;
  customer: Customer;
  passengers: ReservationPassenger[];
  items: ReservationItem[];
  adjustments: Adjustment[];
  payments: Payment[];
  refunds: PaymentRefund[];
  totals: ReservationTotals;
  capacity_override?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Audit Log
export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes?: Record<string, unknown>;
  created_by: string;
  created_by_profile?: { full_name?: string };
  created_at: string;
}

// API response envelopes
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

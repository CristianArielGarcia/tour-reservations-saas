import { supabase } from "./supabase";
import type {
  Agency,
  AgencyUser,
  Tour,
  TourItem,
  PassengerCategory,
  PriceBook,
  TourItemPrice,
  CategoryRule,
  Departure,
  ReservationListItem,
  ReservationDetail,
  Payment,
  PaymentRefund,
  AuditEntry,
  ApiResponse,
  ApiListResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const agencyId = localStorage.getItem("selectedAgencyId");
  if (agencyId) {
    headers["X-Agency-Id"] = agencyId;
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: "unknown", message: response.statusText },
    }));
    throw Object.assign(new Error(errorBody?.error?.message || "Request failed"), {
      status: response.status,
      code: errorBody?.error?.code,
      details: errorBody?.error?.details,
    });
  }

  return response.json();
}

// ---- Agencies ----
export const agenciesApi = {
  getMyAgencies: (): Promise<ApiResponse<Agency[]>> =>
    request("/me/agencies"),

  listUsers: (agencyId: string): Promise<ApiResponse<AgencyUser[]>> =>
    request(`/agencies/${agencyId}/users`),

  inviteUser: (
    agencyId: string,
    data: { email: string; role: string }
  ): Promise<ApiResponse<{ invited: boolean }>> =>
    request(`/agencies/${agencyId}/users/invite`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (
    agencyId: string,
    userId: string,
    data: { role?: string; status?: string }
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/agencies/${agencyId}/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ---- Tours ----
export const toursApi = {
  list: (params?: { active?: boolean }): Promise<ApiResponse<Tour[]>> => {
    const q = params?.active !== undefined ? `?active=${params.active}` : "";
    return request(`/tours${q}`);
  },

  get: (tourId: string): Promise<ApiResponse<Tour>> =>
    request(`/tours/${tourId}`),

  create: (data: Partial<Tour>): Promise<ApiResponse<{ id: string }>> =>
    request("/tours", { method: "POST", body: JSON.stringify(data) }),

  update: (
    tourId: string,
    data: Partial<Tour>
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/tours/${tourId}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ---- Tour Items ----
export const tourItemsApi = {
  list: (tourId: string): Promise<ApiResponse<TourItem[]>> =>
    request(`/tours/${tourId}/items`),

  create: (
    tourId: string,
    data: Partial<TourItem>
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/tours/${tourId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    itemId: string,
    data: Partial<TourItem>
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/tour-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ---- Passenger Categories ----
export const passengerCategoriesApi = {
  list: (): Promise<ApiResponse<PassengerCategory[]>> =>
    request("/passenger-categories"),

  create: (
    data: Partial<PassengerCategory>
  ): Promise<ApiResponse<{ id: string }>> =>
    request("/passenger-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    categoryId: string,
    data: Partial<PassengerCategory>
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/passenger-categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ---- Price Books ----
export const priceBooksApi = {
  list: (): Promise<ApiResponse<PriceBook[]>> => request("/price-books"),

  create: (data: {
    currency: string;
    name: string;
  }): Promise<ApiResponse<{ id: string }>> =>
    request("/price-books", { method: "POST", body: JSON.stringify(data) }),
};

// ---- Tour Item Prices ----
export const tourItemPricesApi = {
  list: (
    itemId: string,
    priceBookId: string
  ): Promise<ApiResponse<TourItemPrice[]>> =>
    request(`/tour-items/${itemId}/prices?price_book_id=${priceBookId}`),

  create: (
    itemId: string,
    data: {
      price_book_id: string;
      valid_from: string;
      valid_to?: string;
      unit_price: number;
    }
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/tour-items/${itemId}/prices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  close: (
    priceId: string,
    data: { valid_to: string }
  ): Promise<ApiResponse<{ closed: boolean }>> =>
    request(`/tour-item-prices/${priceId}/close`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    priceId: string,
    data: { active: boolean }
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/tour-item-prices/${priceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ---- Category Rules ----
export const categoryRulesApi = {
  list: (itemId: string): Promise<ApiResponse<CategoryRule[]>> =>
    request(`/tour-items/${itemId}/category-rules`),

  create: (
    itemId: string,
    data: { passenger_category_id: string; multiplier: number }
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/tour-items/${itemId}/category-rules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    ruleId: string,
    data: { multiplier?: number; active?: boolean }
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/tour-item-category-rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ---- Departures ----
export const departuresApi = {
  list: (params: {
    from: string;
    to: string;
    tour_id?: string;
    status?: string;
  }): Promise<ApiResponse<Departure[]>> => {
    const q = new URLSearchParams({
      from: params.from,
      to: params.to,
      ...(params.tour_id ? { tour_id: params.tour_id } : {}),
      ...(params.status ? { status: params.status } : {}),
    });
    return request(`/departures?${q}`);
  },

  get: (departureId: string): Promise<ApiResponse<Departure>> =>
    request(`/departures/${departureId}`),

  create: (data: {
    tour_id: string;
    start_at: string;
    capacity_total: number;
    notes?: string;
  }): Promise<ApiResponse<{ id: string }>> =>
    request("/departures", { method: "POST", body: JSON.stringify(data) }),

  update: (
    departureId: string,
    data: Partial<{
      start_at: string;
      capacity_total: number;
      notes: string;
      status: string;
      capacity_change_reason: string;
      date_change_reason: string;
    }>
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/departures/${departureId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  close: (
    departureId: string,
    data: { reason?: string }
  ): Promise<ApiResponse<{ closed: boolean }>> =>
    request(`/departures/${departureId}/close`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---- Reservations ----
export const reservationsApi = {
  list: (params?: {
    from?: string;
    to?: string;
    status?: string;
    tour_id?: string;
    departure_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiListResponse<ReservationListItem>> => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.status) q.set("status", params.status);
    if (params?.tour_id) q.set("tour_id", params.tour_id);
    if (params?.departure_id) q.set("departure_id", params.departure_id);
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    return request(`/reservations?${q}`);
  },

  get: (reservationId: string): Promise<ApiResponse<ReservationDetail>> =>
    request(`/reservations/${reservationId}`),

  create: (data: {
    departure_id: string;
    currency: string;
    customer: {
      full_name: string;
      email?: string;
      phone?: string;
      lodging_address?: string;
    };
    passengers: Array<{
      first_name: string;
      last_name: string;
      document_id: string;
      birth_date?: string;
      category_code: string;
      email?: string;
      phone?: string;
      lodging_address?: string;
    }>;
    selected_addons?: Array<{ tour_item_code: string; quantity: number }>;
    capacity_override?: { enabled: boolean; reason?: string };
    notes?: string;
  }): Promise<ApiResponse<{ id: string; status: string; total_snapshot: number; total_final: number }>> =>
    request("/reservations", { method: "POST", body: JSON.stringify(data) }),

  update: (
    reservationId: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<{ updated: boolean }>> =>
    request(`/reservations/${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  changeStatus: (
    reservationId: string,
    data: { status: string; reason?: string }
  ): Promise<ApiResponse<{ status: string }>> =>
    request(`/reservations/${reservationId}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addAdjustment: (
    reservationId: string,
    data: {
      reservation_item_id: string;
      type: string;
      amount: number;
      reason: string;
    }
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/reservations/${reservationId}/adjustments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteAdjustment: (
    adjustmentId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> =>
    request(`/adjustments/${adjustmentId}`, { method: "DELETE" }),

  addPayment: (
    reservationId: string,
    data: {
      amount: number;
      currency: string;
      method: string;
      reference?: string;
      received_at: string;
    }
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/reservations/${reservationId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPayments: (
    reservationId: string
  ): Promise<ApiResponse<Payment[]>> =>
    request(`/reservations/${reservationId}/payments`),

  addRefund: (
    paymentId: string,
    data: { amount: number; reason: string; created_at?: string }
  ): Promise<ApiResponse<{ id: string }>> =>
    request(`/payments/${paymentId}/refunds`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---- Audit ----
export const auditApi = {
  list: (params?: {
    entity_type?: string;
    entity_id?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiListResponse<AuditEntry>> => {
    const q = new URLSearchParams();
    if (params?.entity_type) q.set("entity_type", params.entity_type);
    if (params?.entity_id) q.set("entity_id", params.entity_id);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    return request(`/audit?${q}`);
  },
};

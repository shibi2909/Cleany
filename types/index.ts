// Domain types shared by server and client code. Column names mirror the database.

export const BHK_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK"] as const;
export type BhkType = (typeof BHK_TYPES)[number];

export const BOOKING_STATUSES = [
  "REQUESTED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "TEAM_ON_THE_WAY",
  "CLEANING",
  "COMPLETED",
  "RESCHEDULE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["PENDING", "PAYMENT_VERIFICATION_PENDING", "PAID", "REJECTED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = ["NOT_APPLICABLE", "PENDING", "PROCESSING", "COMPLETED", "REJECTED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type PricingType = "BHK_BASE" | "PER_BATHROOM" | "FIXED";
export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  is_demo: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  pricing_type: PricingType;
  price: number;
  unit_label: string | null;
  image_url: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  is_default_selected: boolean;
  is_popular: boolean;
  sort_order: number;
}

export interface BhkPricing {
  bhk_type: BhkType;
  label: string;
  base_price: number;
  typical_sqft: number;
  description: string;
  duration_label: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AreaPricing {
  id: string;
  label: string;
  min_sqft: number;
  max_sqft: number | null;
  surcharge: number;
  is_active: boolean;
  sort_order: number;
}

export interface BathroomPricing {
  bathroom_count: number;
  label: string;
  price_per_bathroom: number;
}

export interface Discount {
  id: string;
  name: string;
  description: string;
  discount_type: "PERCENTAGE" | "FIXED";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

export interface Staff {
  id: string;
  full_name: string;
  phone: string;
  status: "AVAILABLE" | "ON_JOB" | "ON_LEAVE";
  service_area: string;
  is_active: boolean;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  bhk_type: BhkType;
  area_sqft: number;
  area_is_approximate: boolean;
  area_range_label: string | null;
  bathroom_count: number;
  address: string;
  landmark: string | null;
  pincode: string;
  latitude: number;
  longitude: number;
  distance_from_center: number;
  serviceable: boolean;
  booking_date: string;
  time_slot: string;
  slot_start: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  refund_status: RefundStatus;
  assigned_staff_id: string | null;
  reschedule_count: number;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  service_id: string | null;
  item_type: "SERVICE" | "AREA_SURCHARGE";
  service_name_snapshot: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  sort_order: number;
}

export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  reference: string | null;
  proof_path: string | null;
  submitted_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  booking_id: string;
  kind: "BOOKING" | "PAYMENT" | "REFUND" | "RESCHEDULE" | "CANCELLATION" | "STAFF" | "NOTE";
  old_status: string | null;
  new_status: string | null;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface RescheduleRequest {
  id: string;
  booking_id: string;
  user_id: string;
  old_date: string;
  old_time_slot: string;
  requested_date: string;
  requested_time_slot: string;
  reason: string | null;
  status: RequestStatus;
  previous_booking_status: BookingStatus;
  fee_amount: number;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CancellationRequest {
  id: string;
  booking_id: string;
  user_id: string;
  reason: string;
  comment: string | null;
  status: RequestStatus;
  requires_approval: boolean;
  previous_booking_status: BookingStatus;
  fee_amount: number;
  refund_amount: number;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Refund {
  id: string;
  booking_id: string;
  payment_id: string | null;
  amount: number;
  status: Exclude<RefundStatus, "NOT_APPLICABLE">;
  reason: string | null;
  processed_by: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Result shape returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

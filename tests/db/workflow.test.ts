import { beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb, createUser, makeAdmin, type TestDb } from "./harness";

let db: TestDb;
let customerA: string;
let customerB: string;
let admin: string;
let staffId: string;

function futureDate(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function slot(date: string, start = "09:00") {
  return `${date}T${start}:00+05:30`;
}

async function createBooking(userId: string, date = futureDate(5), start = "09:00", capacity = 3) {
  const booking = {
    user_id: userId,
    customer_name: "Demo Customer",
    customer_phone: "9000000001",
    customer_email: "demo@example.com",
    bhk_type: "2BHK",
    area_sqft: 1200,
    area_range_label: "1000–1200 sq.ft",
    bathroom_count: 2,
    address: "12, Demo Street, Indiranagar",
    landmark: "Near demo park",
    pincode: "560038",
    latitude: 12.9784,
    longitude: 77.6408,
    distance_from_center: 4.9,
    serviceable: true,
    booking_date: date,
    time_slot: start === "09:00" ? "9 AM – 12 PM" : "12 PM – 3 PM",
    slot_start: slot(date, start),
    subtotal: 4395,
    discount: 0,
    total: 4395,
    notes: "",
  };
  const items = [
    { name: "Deep Home Cleaning (2 BHK)", unit_price: 2799, quantity: 1 },
    { name: "Bathroom Deep Cleaning", unit_price: 299, quantity: 2 },
    { name: "Kitchen Deep Cleaning", unit_price: 499, quantity: 1 },
    { name: "Sofa Cleaning", unit_price: 499, quantity: 1 },
  ];
  const res = await db.query<{ create_booking: { id: string; booking_number: string } }>(
    `select public.create_booking($1::jsonb, $2::jsonb, $3)`,
    [JSON.stringify(booking), JSON.stringify(items), capacity],
  );
  return res.rows[0].create_booking;
}

async function getBooking(id: string) {
  const res = await db.query<Record<string, any>>(`select * from public.bookings where id = $1`, [id]);
  return res.rows[0];
}

async function history(id: string) {
  const res = await db.query<{ kind: string; old_status: string | null; new_status: string | null; note: string | null }>(
    `select kind, old_status, new_status, note from public.booking_status_history where booking_id = $1 order by created_at`,
    [id],
  );
  return res.rows;
}

async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toThrow(code);
}

beforeAll(async () => {
  db = await createTestDb();
  customerA = await createUser(db, "a@example.com", { full_name: "Customer A", role: "admin" });
  customerB = await createUser(db, "b@example.com", { full_name: "Customer B" });
  admin = await createUser(db, "admin@example.com", { full_name: "Admin" });
  await makeAdmin(db, admin);
  const s = await db.query<{ id: string }>(
    `insert into public.staff (full_name, phone, service_area) values ('Demo Staff', '9000000009', 'East') returning id`,
  );
  staffId = s.rows[0].id;
});

describe("schema & defaults", () => {
  it("seeds default catalogue and settings", async () => {
    const bhk = await db.query(`select * from public.bhk_pricing`);
    const services = await db.query(`select * from public.services`);
    const settings = await db.query<{ key: string }>(`select key from public.settings order by key`);
    expect(bhk.rows).toHaveLength(4);
    expect(services.rows).toHaveLength(11);
    expect(settings.rows.map((r) => r.key)).toEqual(
      ["booking", "business", "cancellation", "payment", "reschedule", "service_area", "whatsapp"],
    );
  });

  it("creates new users as customers even if metadata claims admin", async () => {
    const res = await db.query<{ role: string; full_name: string }>(`select role, full_name from public.profiles where id = $1`, [customerA]);
    expect(res.rows[0]).toEqual({ role: "customer", full_name: "Customer A" });
  });
});

describe("booking creation", () => {
  it("creates a booking with ID, items, pending payment and history", async () => {
    const { id, booking_number } = await createBooking(customerA);
    expect(booking_number).toMatch(/^CLN-\d{4}-\d{5}$/);
    const b = await getBooking(id);
    expect(b.booking_status).toBe("REQUESTED");
    expect(b.payment_status).toBe("PENDING");
    expect(b.refund_status).toBe("NOT_APPLICABLE");
    expect(b.total).toBe(4395);
    const items = await db.query(`select * from public.booking_items where booking_id = $1`, [id]);
    expect(items.rows).toHaveLength(4);
    const payments = await db.query<{ status: string; amount: number }>(`select status, amount from public.payments where booking_id = $1`, [id]);
    expect(payments.rows).toEqual([{ status: "PENDING", amount: 4395 }]);
    expect(await history(id)).toEqual([{ kind: "BOOKING", old_status: null, new_status: "REQUESTED", note: "Booking requested" }]);
  });

  it("generates unique booking numbers", async () => {
    const a = await createBooking(customerA, futureDate(6));
    const b = await createBooking(customerA, futureDate(6));
    expect(a.booking_number).not.toBe(b.booking_number);
  });

  it("rejects mismatched prices", async () => {
    const booking = {
      user_id: customerA, customer_name: "X", customer_phone: "9", customer_email: "x@example.com",
      bhk_type: "1BHK", area_sqft: 700, bathroom_count: 1, address: "x", pincode: "560001",
      latitude: 12.97, longitude: 77.59, distance_from_center: 0, serviceable: true,
      booking_date: futureDate(7), time_slot: "9 AM – 12 PM", slot_start: slot(futureDate(7)),
      subtotal: 10, discount: 0, total: 10,
    };
    await expectError(
      db.query(`select public.create_booking($1::jsonb, $2::jsonb, 3)`, [
        JSON.stringify(booking), JSON.stringify([{ name: "Deep", unit_price: 1999, quantity: 1 }]),
      ]),
      "PRICE_MISMATCH",
    );
  });

  it("rejects non-serviceable locations at the database level", async () => {
    const booking = {
      user_id: customerA, customer_name: "X", customer_phone: "9", customer_email: "x@example.com",
      bhk_type: "1BHK", area_sqft: 700, bathroom_count: 1, address: "Mysuru", pincode: "570001",
      latitude: 12.29, longitude: 76.63, distance_from_center: 128, serviceable: false,
      booking_date: futureDate(7), time_slot: "9 AM – 12 PM", slot_start: slot(futureDate(7), "12:00"),
      subtotal: 1999, discount: 0, total: 1999,
    };
    await expect(
      db.query(`select public.create_booking($1::jsonb, $2::jsonb, 3)`, [
        JSON.stringify(booking), JSON.stringify([{ name: "Deep", unit_price: 1999, quantity: 1 }]),
      ]),
    ).rejects.toThrow();
  });

  it("enforces slot capacity", async () => {
    const date = futureDate(9);
    await createBooking(customerA, date, "09:00", 2);
    await createBooking(customerB, date, "09:00", 2);
    await expectError(createBooking(customerA, date, "09:00", 2), "SLOT_FULL");
  });

  it("never deletes bookings", async () => {
    const { id } = await createBooking(customerA, futureDate(10));
    await expectError(db.query(`delete from public.bookings where id = $1`, [id]), "HISTORY_IS_IMMUTABLE");
  });
});

describe("payment verification", () => {
  it("customer proof → verification pending → admin verifies → PAID + CONFIRMED", async () => {
    const { id } = await createBooking(customerA, futureDate(11));
    await db.query(`select public.update_booking_status($1, $2, 'PAYMENT_PENDING', 'UPI details sent')`, [id, admin]);
    await db.query(`select public.submit_payment_proof($1, $2, 'UTR123', 'a/b/proof.png')`, [id, customerA]);
    expect((await getBooking(id)).payment_status).toBe("PAYMENT_VERIFICATION_PENDING");

    await db.query(`select public.review_payment($1, $2, true, null, 'Checked bank statement')`, [id, admin]);
    const b = await getBooking(id);
    expect(b.payment_status).toBe("PAID");
    expect(b.booking_status).toBe("CONFIRMED");
    const h = await history(id);
    expect(h.map((r) => `${r.old_status}->${r.new_status}`)).toEqual([
      "null->REQUESTED", "REQUESTED->PAYMENT_PENDING", "PENDING->PAYMENT_VERIFICATION_PENDING",
      "PAYMENT_VERIFICATION_PENDING->PAID", "PAYMENT_PENDING->CONFIRMED",
    ]);
  });

  it("admin can verify a payment received on WhatsApp without an upload", async () => {
    const { id } = await createBooking(customerA, futureDate(11), "12:00");
    await db.query(`select public.review_payment($1, $2, true, 'UTR999', null)`, [id, admin]);
    const pay = await db.query<{ status: string; reference: string }>(`select status, reference from public.payments where booking_id = $1`, [id]);
    expect(pay.rows).toEqual([{ status: "PAID", reference: "UTR999" }]);
  });

  it("rejected payment allows a new attempt and keeps the old one", async () => {
    const { id } = await createBooking(customerB, futureDate(12));
    await db.query(`select public.submit_payment_proof($1, $2, 'BAD', 'x')`, [id, customerB]);
    await db.query(`select public.review_payment($1, $2, false, null, 'Amount mismatch')`, [id, admin]);
    expect((await getBooking(id)).payment_status).toBe("REJECTED");
    await db.query(`select public.submit_payment_proof($1, $2, 'GOOD', 'y')`, [id, customerB]);
    const pay = await db.query<{ status: string }>(`select status from public.payments where booking_id = $1 order by created_at`, [id]);
    expect(pay.rows.map((r) => r.status)).toEqual(["REJECTED", "PAYMENT_VERIFICATION_PENDING"]);
  });

  it("customer cannot submit proof for someone else's booking", async () => {
    const { id } = await createBooking(customerA, futureDate(12), "12:00");
    await expectError(db.query(`select public.submit_payment_proof($1, $2, 'X', 'x')`, [id, customerB]), "NOT_FOUND");
  });

  it("blocks invalid operational transitions", async () => {
    const { id } = await createBooking(customerA, futureDate(13));
    await expectError(db.query(`select public.update_booking_status($1, $2, 'CONFIRMED', null)`, [id, admin]), "INVALID_TRANSITION");
    await expectError(db.query(`select public.update_booking_status($1, $2, 'COMPLETED', null)`, [id, admin]), "INVALID_TRANSITION");
  });

  it("runs the full operational flow to COMPLETED", async () => {
    const { id } = await createBooking(customerA, futureDate(13), "12:00");
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    await db.query(`select public.assign_staff($1, $2, $3)`, [id, admin, staffId]);
    for (const s of ["TEAM_ON_THE_WAY", "CLEANING", "COMPLETED"]) {
      await db.query(`select public.update_booking_status($1, $2, $3, null)`, [id, admin, s]);
    }
    const b = await getBooking(id);
    expect(b.booking_status).toBe("COMPLETED");
    expect(b.assigned_staff_id).toBe(staffId);
    expect(b.completed_at).not.toBeNull();
  });
});

describe("rescheduling", () => {
  it("request → admin approves → date/time change and history records old and new", async () => {
    const { id } = await createBooking(customerA, futureDate(14));
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    const newDate = futureDate(16);
    const r = await db.query<{ request_reschedule: { request_id: string; status: string } }>(
      `select public.request_reschedule($1, $2, $3::date, '12 PM – 3 PM', $4::timestamptz, 'Travelling', 0, true, 2, 3)`,
      [id, customerA, newDate, slot(newDate, "12:00")],
    );
    expect(r.rows[0].request_reschedule.status).toBe("PENDING");
    expect((await getBooking(id)).booking_status).toBe("RESCHEDULE_REQUESTED");

    await db.query(`select public.review_reschedule($1, $2, true, null, 3)`, [r.rows[0].request_reschedule.request_id, admin]);
    const b = await getBooking(id);
    expect(b.booking_status).toBe("CONFIRMED");
    expect(b.time_slot).toBe("12 PM – 3 PM");
    expect(b.reschedule_count).toBe(1);
    const note = (await history(id)).find((h) => h.note?.startsWith("Booking rescheduled from"))?.note;
    expect(note).toContain("9 AM – 12 PM");
    expect(note).toContain("12 PM – 3 PM");
  });

  it("rejection keeps the original schedule", async () => {
    const date = futureDate(15);
    const { id } = await createBooking(customerA, date);
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    const newDate = futureDate(17);
    const r = await db.query<{ request_reschedule: { request_id: string } }>(
      `select public.request_reschedule($1, $2, $3::date, '12 PM – 3 PM', $4::timestamptz, null, 0, true, 2, 3)`,
      [id, customerA, newDate, slot(newDate, "12:00")],
    );
    await db.query(`select public.review_reschedule($1, $2, false, 'That time slot is already unavailable.', 3)`, [
      r.rows[0].request_reschedule.request_id, admin,
    ]);
    const b = await getBooking(id);
    expect(b.booking_status).toBe("CONFIRMED");
    expect(b.time_slot).toBe("9 AM – 12 PM");
    const req = await db.query<{ status: string; admin_note: string }>(`select status, admin_note from public.reschedule_requests where booking_id = $1`, [id]);
    expect(req.rows[0]).toEqual({ status: "REJECTED", admin_note: "That time slot is already unavailable." });
  });

  it("auto-approves when policy does not require approval and enforces the limit", async () => {
    const { id } = await createBooking(customerB, futureDate(18));
    const d1 = futureDate(19);
    const r = await db.query<{ request_reschedule: { status: string } }>(
      `select public.request_reschedule($1, $2, $3::date, '12 PM – 3 PM', $4::timestamptz, null, 0, false, 1, 3)`,
      [id, customerB, d1, slot(d1, "12:00")],
    );
    expect(r.rows[0].request_reschedule.status).toBe("APPROVED");
    expect((await getBooking(id)).booking_status).toBe("REQUESTED");
    const d2 = futureDate(20);
    await expectError(
      db.query(`select public.request_reschedule($1, $2, $3::date, '9 AM – 12 PM', $4::timestamptz, null, 0, false, 1, 3)`,
        [id, customerB, d2, slot(d2)]),
      "RESCHEDULE_LIMIT",
    );
  });

  it("customer can withdraw a pending request", async () => {
    const { id } = await createBooking(customerA, futureDate(21));
    const d = futureDate(22);
    const r = await db.query<{ request_reschedule: { request_id: string } }>(
      `select public.request_reschedule($1, $2, $3::date, '12 PM – 3 PM', $4::timestamptz, null, 0, true, 2, 3)`,
      [id, customerA, d, slot(d, "12:00")],
    );
    await db.query(`select public.withdraw_reschedule_request($1, $2)`, [r.rows[0].request_reschedule.request_id, customerA]);
    expect((await getBooking(id)).booking_status).toBe("REQUESTED");
  });
});

describe("cancellation & refunds", () => {
  it("cancellation before payment → CANCELLED, refund NOT_APPLICABLE", async () => {
    const { id } = await createBooking(customerA, futureDate(23));
    const r = await db.query<{ request_cancellation: { status: string; refund_status: string } }>(
      `select public.request_cancellation($1, $2, 'Change of plans', 'Travelling', false, 0, 0)`, [id, customerA],
    );
    expect(r.rows[0].request_cancellation).toMatchObject({ status: "APPROVED", refund_status: "NOT_APPLICABLE" });
    const b = await getBooking(id);
    expect(b.booking_status).toBe("CANCELLED");
    expect(b.refund_status).toBe("NOT_APPLICABLE");
    expect(b.cancelled_at).not.toBeNull();
    expect(await getBooking(id)).toBeTruthy(); // booking retained
  });

  it("cancellation after payment → refund PENDING → PROCESSING → COMPLETED", async () => {
    const { id } = await createBooking(customerA, futureDate(24));
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    await db.query(`select public.request_cancellation($1, $2, 'Price', null, false, 0, 4395)`, [id, customerA]);
    let b = await getBooking(id);
    expect(b.booking_status).toBe("CANCELLED");
    expect(b.payment_status).toBe("PAID");
    expect(b.refund_status).toBe("PENDING");

    const refund = await db.query<{ id: string; amount: number; status: string }>(`select id, amount, status from public.refunds where booking_id = $1`, [id]);
    expect(refund.rows[0]).toMatchObject({ amount: 4395, status: "PENDING" });
    await db.query(`select public.update_refund($1, $2, 'PROCESSING', 'Initiated via UPI', null)`, [refund.rows[0].id, admin]);
    expect((await getBooking(id)).refund_status).toBe("PROCESSING");
    await db.query(`select public.update_refund($1, $2, 'COMPLETED', 'UPI ref RF123', null)`, [refund.rows[0].id, admin]);
    b = await getBooking(id);
    expect(b.refund_status).toBe("COMPLETED");
    expect(b.payment_status).toBe("REFUNDED");
    await expectError(db.query(`select public.update_refund($1, $2, 'PENDING', null, null)`, [refund.rows[0].id, admin]), "INVALID_TRANSITION");
  });

  it("approval-required cancellation can be rejected (restores status) or approved", async () => {
    const { id } = await createBooking(customerB, futureDate(25));
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    const r1 = await db.query<{ request_cancellation: { request_id: string; status: string } }>(
      `select public.request_cancellation($1, $2, 'Timing doesn''t work', null, true, 0, 4395)`, [id, customerB],
    );
    expect(r1.rows[0].request_cancellation.status).toBe("PENDING");
    expect((await getBooking(id)).booking_status).toBe("CANCELLATION_REQUESTED");
    await db.query(`select public.review_cancellation($1, $2, false, 'Team already dispatched', null)`, [r1.rows[0].request_cancellation.request_id, admin]);
    expect((await getBooking(id)).booking_status).toBe("CONFIRMED");

    const r2 = await db.query<{ request_cancellation: { request_id: string } }>(
      `select public.request_cancellation($1, $2, 'Other', null, true, 0, 4395)`, [id, customerB],
    );
    await db.query(`select public.review_cancellation($1, $2, true, null, 4000)`, [r2.rows[0].request_cancellation.request_id, admin]);
    const b = await getBooking(id);
    expect(b.booking_status).toBe("CANCELLED");
    expect(b.refund_status).toBe("PENDING");
    const refund = await db.query<{ amount: number }>(`select amount from public.refunds where booking_id = $1`, [id]);
    expect(refund.rows[0].amount).toBe(4000);
  });

  it("forces approval when a payment proof is still unverified", async () => {
    const { id } = await createBooking(customerA, futureDate(26));
    await db.query(`select public.submit_payment_proof($1, $2, 'UTR', 'p')`, [id, customerA]);
    const r = await db.query<{ request_cancellation: { status: string } }>(
      `select public.request_cancellation($1, $2, 'Other', null, false, 0, 0)`, [id, customerA],
    );
    expect(r.rows[0].request_cancellation.status).toBe("PENDING");
  });

  it("cannot cancel a completed booking", async () => {
    const { id } = await createBooking(customerA, futureDate(27));
    await db.query(`select public.review_payment($1, $2, true, 'UTR', null)`, [id, admin]);
    await db.query(`select public.assign_staff($1, $2, $3)`, [id, admin, staffId]);
    for (const s of ["TEAM_ON_THE_WAY", "CLEANING", "COMPLETED"]) {
      await db.query(`select public.update_booking_status($1, $2, $3, null)`, [id, admin, s]);
    }
    await expectError(db.query(`select public.request_cancellation($1, $2, 'Other', null, false, 0, 0)`, [id, customerA]), "INVALID_STATE");
  });
});

describe("row level security", () => {
  it("customers see only their own bookings", async () => {
    const own = await asRole(db, "authenticated", customerB, () =>
      db.query<{ user_id: string }>(`select user_id from public.bookings`),
    );
    expect(own.rows.length).toBeGreaterThan(0);
    expect(own.rows.every((r) => r.user_id === customerB)).toBe(true);
  });

  it("anonymous users see no bookings but can read the catalogue", async () => {
    const bookings = await asRole(db, "anon", null, () => db.query(`select * from public.bookings`));
    expect(bookings.rows).toHaveLength(0);
    const services = await asRole(db, "anon", null, () => db.query(`select * from public.services`));
    expect(services.rows.length).toBe(11);
  });

  it("admins see all bookings", async () => {
    const all = await asRole(db, "authenticated", admin, () => db.query(`select distinct user_id from public.bookings`));
    expect(all.rows.length).toBe(2);
  });

  it("customers cannot write bookings, payments or call workflow functions", async () => {
    const { id } = await createBooking(customerA, futureDate(28));
    await asRole(db, "authenticated", customerA, async () => {
      const upd = await db.query(`update public.bookings set payment_status = 'PAID' where id = $1`, [id]);
      expect(upd.affectedRows ?? 0).toBe(0);
      await expect(db.query(`insert into public.payments (booking_id, user_id, amount, status) values ($1, $2, 1, 'PAID')`, [id, customerA])).rejects.toThrow();
      await expect(db.query(`select public.review_payment($1, $2, true, null, null)`, [id, customerA])).rejects.toThrow(/permission denied/);
    });
    expect((await getBooking(id)).payment_status).toBe("PENDING");
  });

  it("customers cannot make themselves admin", async () => {
    await asRole(db, "authenticated", customerA, async () => {
      const upd = await db.query(`update public.profiles set role = 'admin' where id = $1`, [customerA]);
      expect(upd.affectedRows ?? 0).toBe(0);
    });
    const res = await db.query<{ role: string }>(`select role from public.profiles where id = $1`, [customerA]);
    expect(res.rows[0].role).toBe("customer");
  });

  it("staff records are admin-only", async () => {
    const c = await asRole(db, "authenticated", customerA, () => db.query(`select * from public.staff`));
    expect(c.rows).toHaveLength(0);
    const a = await asRole(db, "authenticated", admin, () => db.query(`select * from public.staff`));
    expect(a.rows).toHaveLength(1);
  });
});

import { request } from "../../services/api";
import type { Booking, CreateBookingPayload } from "../types";

const BASE = "/bookings";

function normalizeBooking(raw: any): Booking {
  return raw;
}

export async function getBookings(_userId: string): Promise<Booking[]> {
  const res = await request<Booking[] | { data: Booking[] }>(BASE);
  const list = Array.isArray(res) ? res : (res as any).data ?? [];
  return list.map(normalizeBooking);
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const res = await request<Booking | { data: Booking }>(BASE, {
    method: "POST",
    body: {
      tailor_id: payload.tailorId,
      service_id: payload.serviceId,
      date: payload.date,
      time: payload.time,
      notes: payload.notes ?? "",
    },
  });
  return normalizeBooking((res as any).data ?? res);
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const res = await request<Booking | { data: Booking }>(
    `${BASE}/${bookingId}/cancel`,
    { method: "PATCH" }
  );
  return normalizeBooking((res as any).data ?? res);
}

export async function rescheduleBooking(bookingId: string, date: string, time: string): Promise<Booking> {
  const res = await request<Booking | { data: Booking }>(
    `${BASE}/${bookingId}/reschedule`,
    { method: "PATCH", body: { date, time } }
  );
  return normalizeBooking((res as any).data ?? res);
}

import { create } from "zustand";
import type { Booking, CreateBookingPayload } from "../types";
import {
  getBookings,
  createBooking,
  cancelBooking,
  rescheduleBooking,
} from "../services/bookingService";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface BookingState {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchBookings: (userId: string, forceRefresh?: boolean) => Promise<void>;
  createBooking: (payload: CreateBookingPayload) => Promise<Booking | null>;
  cancelBooking: (bookingId: string) => Promise<void>;
  rescheduleBooking: (bookingId: string, date: string, time: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchBookings: async (userId, forceRefresh = false) => {
    const { lastFetched, loading } = get();
    const isCacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;
    if (loading) return;

    set({ loading: true, error: null });
    try {
      const bookings = await getBookings(userId);
      set({ bookings, loading: false, lastFetched: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load bookings",
      });
    }
  },

  createBooking: async (payload) => {
    set({ loading: true, error: null });
    try {
      const newBooking = await createBooking(payload);
      set((state) => ({ bookings: [newBooking, ...state.bookings], loading: false }));
      return newBooking;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to create booking",
      });
      return null;
    }
  },

  cancelBooking: async (bookingId) => {
    const prevBookings = get().bookings;
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === bookingId ? { ...b, status: "cancelled" as const } : b
      ),
    }));
    try {
      await cancelBooking(bookingId);
    } catch (err) {
      set({
        bookings: prevBookings,
        error: err instanceof Error ? err.message : "Failed to cancel booking",
      });
    }
  },

  rescheduleBooking: async (bookingId, date, time) => {
    set({ loading: true, error: null });
    try {
      const updated = await rescheduleBooking(bookingId, date, time);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to reschedule",
      });
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ bookings: [], loading: false, error: null, lastFetched: null }),
}));

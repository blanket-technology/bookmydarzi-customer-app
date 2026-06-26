import { create } from "zustand";
import type {
  FAQ,
  SupportTicket,
  SupportTicketCreatePayload,
  SupportTicketListItem,
} from "../types/engagement";
import {
  createTicket,
  getTicket,
  listFaqs,
  listTickets,
  replyToTicket,
} from "../services/supportService";

interface SupportState {
  tickets: SupportTicketListItem[];
  activeTicket: SupportTicket | null;
  faqs: FAQ[];
  loading: boolean;
  loadingTicket: boolean;
  saving: boolean;
  error: string | null;

  fetchTickets: () => Promise<void>;
  fetchTicket: (ticketId: number) => Promise<void>;
  fetchFaqs: (category?: string) => Promise<void>;
  raiseTicket: (payload: SupportTicketCreatePayload) => Promise<SupportTicket | null>;
  reply: (ticketId: number, message: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

export const useSupportStore = create<SupportState>((set, get) => ({
  tickets: [],
  activeTicket: null,
  faqs: [],
  loading: false,
  loadingTicket: false,
  saving: false,
  error: null,

  fetchTickets: async () => {
    set({ loading: true, error: null });
    try {
      const { tickets } = await listTickets();
      set({ tickets, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load tickets",
      });
    }
  },

  fetchTicket: async (ticketId) => {
    set({ loadingTicket: true, error: null });
    try {
      const ticket = await getTicket(ticketId);
      set({ activeTicket: ticket, loadingTicket: false });
    } catch (err) {
      set({
        loadingTicket: false,
        error: err instanceof Error ? err.message : "Failed to load ticket",
      });
    }
  },

  fetchFaqs: async (category) => {
    try {
      const faqs = await listFaqs(category);
      set({ faqs });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load FAQs" });
    }
  },

  raiseTicket: async (payload) => {
    set({ saving: true, error: null });
    try {
      const ticket = await createTicket(payload);
      set((state) => ({
        saving: false,
        activeTicket: ticket,
        tickets: [
          {
            id: ticket.id,
            ticket_code: ticket.ticket_code,
            subject: ticket.subject,
            category: ticket.category,
            status: ticket.status,
            order_id: ticket.order_id,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at,
          },
          ...state.tickets,
        ],
      }));
      return ticket;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to create ticket",
      });
      return null;
    }
  },

  reply: async (ticketId, message) => {
    set({ saving: true, error: null });
    try {
      const msg = await replyToTicket(ticketId, message);
      set((state) => ({
        saving: false,
        activeTicket:
          state.activeTicket && state.activeTicket.id === ticketId
            ? { ...state.activeTicket, messages: [...state.activeTicket.messages, msg] }
            : state.activeTicket,
      }));
      return true;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to send reply",
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
  reset: () =>
    set({
      tickets: [],
      activeTicket: null,
      faqs: [],
      loading: false,
      loadingTicket: false,
      saving: false,
      error: null,
    }),
}));

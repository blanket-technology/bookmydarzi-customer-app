import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

interface ToastState {
  message: string | null;
  type: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: "success",
  visible: false,
  show: (message, type = "success") => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, type, visible: true });
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ visible: false, message: null });
  },
}));

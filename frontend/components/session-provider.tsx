"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Session } from "@/lib/learning-api";

const STORAGE_KEY = "lms-session";

// Store nhỏ đọc/ghi localStorage, dùng useSyncExternalStore để tránh setState trong effect
// và tránh lệch hydration. Trước đây phiên chỉ nằm trong bộ nhớ nên F5 là mất đăng nhập.
let current: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readSession(): Session | null {
  if (!loaded) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      current = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      current = null;
    }
    loaded = true;
  }
  return current;
}

function writeSession(next: Session | null): void {
  current = next;
  loaded = true;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage có thể bị chặn */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const getServerSnapshot = (): Session | null => null;

const SessionContext = createContext<{
  session: Session | null;
  setSession: (session: Session | null) => void;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribe,
    readSession,
    getServerSnapshot,
  );
  const setSession = useCallback((next: Session | null) => writeSession(next), []);

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider is missing");
  return context;
}

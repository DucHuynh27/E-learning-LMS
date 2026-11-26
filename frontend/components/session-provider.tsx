"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Session } from "@/lib/learning-api";

const SessionContext = createContext<{
  session: Session | null;
  setSession: (session: Session | null) => void;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

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

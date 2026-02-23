"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Agency, UserRole } from "@/types";
import { agenciesApi } from "./api-client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  agencies: Agency[];
  selectedAgency: Agency | null;
  selectAgency: (agency: Agency) => void;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  agencies: [],
  selectedAgency: null,
  selectAgency: () => {},
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgencies = useCallback(async () => {
    try {
      const res = await agenciesApi.getMyAgencies();
      setAgencies(res.data);

      // Restore from localStorage
      const savedId = localStorage.getItem("selectedAgencyId");
      const found = res.data.find((a) => a.id === savedId);
      if (found) {
        setSelectedAgency(found);
      } else if (res.data.length === 1) {
        setSelectedAgency(res.data[0]);
        localStorage.setItem("selectedAgencyId", res.data[0].id);
      }
    } catch {
      // user may not have agencies yet
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        loadAgencies();
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        loadAgencies();
      } else {
        setAgencies([]);
        setSelectedAgency(null);
        localStorage.removeItem("selectedAgencyId");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAgencies]);

  const selectAgency = useCallback((agency: Agency) => {
    setSelectedAgency(agency);
    localStorage.setItem("selectedAgencyId", agency.id);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("selectedAgencyId");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        agencies,
        selectedAgency,
        selectAgency,
        role: selectedAgency?.role ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

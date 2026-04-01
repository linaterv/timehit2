"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface GlobalFilter {
  clientId: string;
  contractorId: string;
  setGlobalClient: (id: string) => void;
  setGlobalContractor: (id: string) => void;
  clearFilters: () => void;
}

const STORAGE_KEY = "timehit_global_filter";

const GlobalFilterContext = createContext<GlobalFilter>({
  clientId: "",
  contractorId: "",
  setGlobalClient: () => {},
  setGlobalContractor: () => {},
  clearFilters: () => {},
});

function readStorage(): { clientId: string; contractorId: string } {
  if (typeof window === "undefined") return { clientId: "", contractorId: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { clientId: "", contractorId: "" };
}

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientId] = useState(() => readStorage().clientId);
  const [contractorId, setContractorId] = useState(() => readStorage().contractorId);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, contractorId }));
  }, [clientId, contractorId]);

  const setGlobalClient = (id: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId: id, contractorId }));
    window.location.reload();
  };
  const setGlobalContractor = (id: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, contractorId: id }));
    window.location.reload();
  };
  const clearFilters = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId: "", contractorId: "" }));
    window.location.reload();
  };

  return (
    <GlobalFilterContext.Provider value={{ clientId, contractorId, setGlobalClient, setGlobalContractor, clearFilters }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  return useContext(GlobalFilterContext);
}

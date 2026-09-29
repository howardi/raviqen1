import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const CompanyProfileContext = createContext(null);

export function CompanyProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const records = await base44.entities.CompanyProfile.list("-created_date", 1);
      setProfile(records[0] || null);
    } catch (e) {
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, []);

  return (
    <CompanyProfileContext.Provider value={{ profile, setProfile, loadProfile, loading }}>
      {children}
    </CompanyProfileContext.Provider>
  );
}

export function useCompanyProfile() {
  const ctx = useContext(CompanyProfileContext);
  if (!ctx) return { profile: null, setProfile: () => {}, loadProfile: async () => {}, loading: false };
  return ctx;
}
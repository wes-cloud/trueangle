"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clearActiveCompanyId,
  getActiveCompanyId,
  setActiveCompanyId,
} from "@/lib/activeCompany";

type CompanyOption = {
  company_id: string;
  role: string | null;
  companies:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompanies() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("company_members")
        .select(
          `
          company_id,
          role,
          companies (
            name
          )
        `
        )
        .eq("user_id", user.id);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const rawRows = data as CompanyOption[];

      // Only show client switcher for bookkeeper/client access.
      // Owners/contractors should not see this.
      const bookkeeperRows = rawRows.filter(
        (row) => row.role && row.role !== "owner"
      );

      if (bookkeeperRows.length === 0) {
        clearActiveCompanyId();
        setCompanies([]);
        setLoading(false);
        return;
      }

      const uniqueRows = Array.from(
        new Map(bookkeeperRows.map((row) => [row.company_id, row])).values()
      );

      setCompanies(uniqueRows);

      const savedCompanyId = getActiveCompanyId();
      const savedIsValid =
        savedCompanyId &&
        uniqueRows.some((row) => row.company_id === savedCompanyId);

      const nextCompanyId =
        savedIsValid && savedCompanyId
          ? savedCompanyId
          : uniqueRows[0]?.company_id || "";

      if (nextCompanyId) {
        setActiveCompanyId(nextCompanyId);
        setActiveCompanyIdState(nextCompanyId);
      }

      setLoading(false);
    }

    loadCompanies();
  }, []);

  function getCompanyName(company: CompanyOption) {
    const companyData = Array.isArray(company.companies)
      ? company.companies[0]
      : company.companies;

    return companyData?.name || "Unnamed Company";
  }

  function handleCompanyChange(companyId: string) {
    setActiveCompanyId(companyId);
    setActiveCompanyIdState(companyId);
    window.location.reload();
  }

  if (loading || companies.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <label className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Viewing
      </label>

      <select
        value={activeCompanyId}
        onChange={(e) => handleCompanyChange(e.target.value)}
        className="max-w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950"
      >
        {companies.map((company) => (
          <option key={company.company_id} value={company.company_id}>
            {getCompanyName(company)}
          </option>
        ))}
      </select>
    </div>
  );
}
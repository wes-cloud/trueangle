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
  name: string;
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

      const res = await fetch("/api/company/list-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.companies) {
        setLoading(false);
        return;
      }

      const rows = data.companies as CompanyOption[];

      if (rows.length === 0) {
        clearActiveCompanyId();
        setCompanies([]);
        setLoading(false);
        return;
      }

      setCompanies(rows);

      const savedCompanyId = getActiveCompanyId();
      const savedIsValid =
        savedCompanyId &&
        rows.some((company) => company.company_id === savedCompanyId);

      const nextCompanyId =
        savedIsValid && savedCompanyId
          ? savedCompanyId
          : rows[0]?.company_id || "";

      if (nextCompanyId) {
        setActiveCompanyId(nextCompanyId);
        setActiveCompanyIdState(nextCompanyId);
      }

      setLoading(false);
    }

    loadCompanies();
  }, []);

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
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );
}
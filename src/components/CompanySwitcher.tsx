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

      const { data: memberships, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id);

      if (membershipError || !memberships) {
        setLoading(false);
        return;
      }

      const bookkeeperMemberships = memberships.filter(
        (membership) => membership.role && membership.role !== "owner"
      );

      if (bookkeeperMemberships.length === 0) {
        clearActiveCompanyId();
        setCompanies([]);
        setLoading(false);
        return;
      }

      const uniqueMemberships = Array.from(
        new Map(
          bookkeeperMemberships.map((membership) => [
            membership.company_id,
            membership,
          ])
        ).values()
      );

      const companyIds = uniqueMemberships
        .map((membership) => membership.company_id)
        .filter(Boolean);

      const { data: companyRows } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      const options: CompanyOption[] = uniqueMemberships.map((membership) => {
        const matchingCompany = companyRows?.find(
          (company) => company.id === membership.company_id
        );

        return {
          company_id: membership.company_id,
          role: membership.role,
          name: matchingCompany?.name || "Unnamed Company",
        };
      });

      setCompanies(options);

      const savedCompanyId = getActiveCompanyId();
      const savedIsValid =
        savedCompanyId &&
        options.some((company) => company.company_id === savedCompanyId);

      const nextCompanyId =
        savedIsValid && savedCompanyId
          ? savedCompanyId
          : options[0]?.company_id || "";

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
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ChecklistState = {
  hasEstimates: boolean;
  hasInvoices: boolean;
  hasExpenses: boolean;
  hasMileageLogs: boolean;
};

export default function OnboardingChecklist() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ChecklistState>({
    hasEstimates: false,
    hasInvoices: false,
    hasExpenses: false,
    hasMileageLogs: false,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const [estimateResult, invoiceResult, expenseResult, mileageResult] =
          await Promise.all([
            supabase
              .from("estimates")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("invoices")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("expenses")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("mileage_logs")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id),
          ]);

        setState({
          hasEstimates: (estimateResult.count ?? 0) > 0,
          hasInvoices: (invoiceResult.count ?? 0) > 0,
          hasExpenses: (expenseResult.count ?? 0) > 0,
          hasMileageLogs: (mileageResult.count ?? 0) > 0,
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return null;

  const steps = [
    state.hasEstimates,
    state.hasInvoices,
    state.hasExpenses,
    state.hasMileageLogs,
  ];

  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = steps.length;

  if (completedSteps === totalSteps) return null;

  return (
    <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">
        Get Started ({completedSteps}/{totalSteps})
      </h2>

      <p className="mt-2 text-sm font-medium text-slate-600">
        Set up the basic money path: estimate, invoice, expenses, and mileage.
      </p>

      <div className="mt-5 space-y-3">
        <ChecklistItem
          completed={state.hasEstimates}
          label="Create your first estimate"
          helper="Start with a real job or a test project."
          href="/estimates/new"
        />

        <ChecklistItem
          completed={state.hasInvoices}
          label="Create or convert your first invoice"
          helper="Client-approved estimates can become invoices automatically."
          href="/invoices"
        />

        <ChecklistItem
          completed={state.hasExpenses}
          label="Add your first job expense"
          helper="Track materials, fuel, labor, tools, and other job costs."
          href="/expenses"
        />

        <ChecklistItem
          completed={state.hasMileageLogs}
          label="Log your first mileage trip"
          helper="Track business, personal, commute, and adjustment miles."
          href="/mileage"
        />
      </div>
    </div>
  );
}

function ChecklistItem({
  completed,
  label,
  helper,
  href,
}: {
  completed: boolean;
  label: string;
  helper: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl border p-4 transition hover:bg-slate-50"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-bold ${
            completed
              ? "border-green-600 bg-green-600 text-white"
              : "border-slate-300 text-transparent"
          }`}
        >
          ✓
        </div>

        <div>
          <p
            className={`font-bold ${
              completed ? "text-slate-400 line-through" : "text-slate-950"
            }`}
          >
            {label}
          </p>
          <p className="mt-1 text-sm text-slate-600">{helper}</p>
        </div>
      </div>

      <span className="shrink-0 text-sm font-bold text-blue-700">Go</span>
    </a>
  );
}
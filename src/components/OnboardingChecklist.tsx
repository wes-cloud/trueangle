"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ChecklistState = {
  hasExpenses: boolean;
  hasInvoices: boolean;
  hasTransactions: boolean;
};

export default function OnboardingChecklist() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ChecklistState>({
    hasExpenses: false,
    hasInvoices: false,
    hasTransactions: false,
  });

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { count: expenseCount } = await supabase
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: invoiceCount } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: transactionCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setState({
        hasExpenses: (expenseCount ?? 0) > 0,
        hasInvoices: (invoiceCount ?? 0) > 0,
        hasTransactions: (transactionCount ?? 0) > 0,
      });

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) return null;

  const totalSteps = 3;
  const completedSteps = [
    state.hasExpenses,
    state.hasInvoices,
    state.hasTransactions,
  ].filter(Boolean).length;

  if (completedSteps === totalSteps) return null;

  return (
    <div className="bg-white shadow-md rounded-xl p-6 mb-6 border">
      <h2 className="text-xl font-semibold mb-2">
        Get Started ({completedSteps}/{totalSteps})
      </h2>

      <p className="text-gray-600 mb-4">
        Complete these steps to start tracking real profit.
      </p>

      <div className="space-y-3">
        <ChecklistItem
          completed={state.hasTransactions}
          label="Connect your bank account"
          href="/dashboard/banking"
        />

        <ChecklistItem
          completed={state.hasExpenses}
          label="Add your first expense"
          href="/dashboard/expenses"
        />

        <ChecklistItem
          completed={state.hasInvoices}
          label="Create your first invoice"
          href="/dashboard/invoices"
        />
      </div>
    </div>
  );
}

function ChecklistItem({
  completed,
  label,
  href,
}: {
  completed: boolean;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
            completed
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300"
          }`}
        >
          {completed && "✓"}
        </div>

        <span className={completed ? "line-through text-gray-400" : ""}>
          {label}
        </span>
      </div>

      <span className="text-sm text-blue-600">Go</span>
    </a>
  );
}
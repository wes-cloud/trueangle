"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { supabase } from "@/lib/supabase";
import TrialBanner from "@/components/TrialBanner";

type AuthUser = {
  id: string;
  email?: string | null;
};

type Expense = {
  id: string;
  amount: number | null;
  category: string | null;
};

type Income = {
  id: string;
  amount: number | null;
  match_status?: string | null;
};

type Payment = {
  id: string;
  amount: number | null;
  match_status?: string | null;
};

type Invoice = {
  id: string;
  amount: number | null;
  status: string | null;
};

type Estimate = {
  id: string;
  amount: number | null;
  status: string | null;
};

type PlaidTransaction = {
  id: string;
  amount: number | null;
  imported_to_expenses: boolean | null;
  imported_to_income?: boolean | null;
  ignored: boolean | null;
  match_status?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function getBarPercent(value: number, maxValue: number) {
  if (maxValue <= 0) return 0;
  return Math.max(4, Math.round((value / maxValue) * 100));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [workingSampleData, setWorkingSampleData] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);

  async function loadDashboard(currentUserId: string) {
    const [
      { data: expensesData, error: expensesError },
      { data: incomeData, error: incomeError },
      { data: paymentsData, error: paymentsError },
      { data: invoicesData, error: invoicesError },
      { data: estimatesData, error: estimatesError },
      { data: transactionsData, error: transactionsError },
    ] = await Promise.all([
      supabase
        .from("expenses")
        .select("id, amount, category")
        .eq("user_id", currentUserId),

      supabase
        .from("income")
        .select("id, amount, match_status")
        .eq("user_id", currentUserId),

      supabase
        .from("payments")
        .select("id, amount, match_status")
        .eq("user_id", currentUserId),

      supabase
        .from("invoices")
        .select("id, amount, status")
        .eq("user_id", currentUserId),

      supabase
        .from("estimates")
        .select("id, amount, status")
        .eq("user_id", currentUserId),

      supabase
        .from("plaid_transactions")
        .select(
          "id, amount, imported_to_expenses, imported_to_income, ignored, match_status"
        )
        .eq("user_id", currentUserId),
    ]);

    if (expensesError) {
      setMessage(`Error loading expenses: ${expensesError.message}`);
      return;
    }

    if (incomeError) {
      setMessage(`Error loading income: ${incomeError.message}`);
      return;
    }

    if (paymentsError) {
      setMessage(`Error loading payments: ${paymentsError.message}`);
      return;
    }

    if (invoicesError) {
      setMessage(`Error loading invoices: ${invoicesError.message}`);
      return;
    }

    if (estimatesError) {
      setMessage(`Error loading estimates: ${estimatesError.message}`);
      return;
    }

    if (transactionsError) {
      setMessage(`Error loading bank transactions: ${transactionsError.message}`);
      return;
    }

    setExpenses((expensesData || []) as Expense[]);
    setIncome((incomeData || []) as Income[]);
    setPayments((paymentsData || []) as Payment[]);
    setInvoices((invoicesData || []) as Invoice[]);
    setEstimates((estimatesData || []) as Estimate[]);
    setTransactions((transactionsData || []) as PlaidTransaction[]);
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const safeUser = authUser
        ? {
            id: authUser.id,
            email: authUser.email ?? null,
          }
        : null;

      setUser(safeUser);

      if (safeUser) {
        await loadDashboard(safeUser.id);
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleAddSampleData() {
    if (!user) return;

    setWorkingSampleData(true);
    setMessage("");

    const sampleInvoices = [
      { user_id: user.id, amount: 4200, status: "paid" },
      { user_id: user.id, amount: 5800, status: "paid" },
      { user_id: user.id, amount: 5000, status: "paid" },
    ];

    const sampleExpenses = [
      { user_id: user.id, amount: 1250, category: "Materials" },
      { user_id: user.id, amount: 950, category: "Materials" },
      { user_id: user.id, amount: 725, category: "Fuel" },
      { user_id: user.id, amount: 680, category: "Tools" },
      { user_id: user.id, amount: 540, category: "Dump Fees" },
      { user_id: user.id, amount: 825, category: "Labor" },
      { user_id: user.id, amount: 610, category: "Supplies" },
      { user_id: user.id, amount: 500, category: "Equipment Rental" },
      { user_id: user.id, amount: 470, category: "Permits" },
      { user_id: user.id, amount: 450, category: "Insurance" },
    ];

    const { data: createdInvoices, error: invoiceError } = await supabase
      .from("invoices")
      .insert(sampleInvoices)
      .select("id, amount");

    if (invoiceError) {
      setMessage(`Error adding sample invoices: ${invoiceError.message}`);
      setWorkingSampleData(false);
      return;
    }

    const samplePayments = (createdInvoices || []).map((invoice) => ({
      user_id: user.id,
      invoice_id: invoice.id,
      amount: invoice.amount,
      match_status: "matched",
    }));

    const { error: paymentError } = await supabase
      .from("payments")
      .insert(samplePayments);

    if (paymentError) {
      setMessage(`Error adding sample payments: ${paymentError.message}`);
      setWorkingSampleData(false);
      return;
    }

    const { error: expenseError } = await supabase
      .from("expenses")
      .insert(sampleExpenses);

    if (expenseError) {
      setMessage(`Error adding sample expenses: ${expenseError.message}`);
      setWorkingSampleData(false);
      return;
    }

    await loadDashboard(user.id);

    setMessage(
      "Sample data added. Revenue: $15,000. Expenses: $7,000. Profit: $8,000."
    );

    setWorkingSampleData(false);
  }

  async function handleClearSampleData() {
    if (!user) return;

    setWorkingSampleData(true);
    setMessage("");

    const { error: paymentError } = await supabase
      .from("payments")
      .delete()
      .eq("user_id", user.id);

    if (paymentError) {
      setMessage(`Error clearing payments: ${paymentError.message}`);
      setWorkingSampleData(false);
      return;
    }

    const { error: expenseError } = await supabase
      .from("expenses")
      .delete()
      .eq("user_id", user.id);

    if (expenseError) {
      setMessage(`Error clearing expenses: ${expenseError.message}`);
      setWorkingSampleData(false);
      return;
    }

    const { error: invoiceError } = await supabase
      .from("invoices")
      .delete()
      .eq("user_id", user.id);

    if (invoiceError) {
      setMessage(`Error clearing invoices: ${invoiceError.message}`);
      setWorkingSampleData(false);
      return;
    }

    await loadDashboard(user.id);

    setMessage("Sample data cleared. Fresh start — no shame, we all need a reset.");
    setWorkingSampleData(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
  }

  const totals = useMemo(() => {
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + Math.abs(Number(item.amount || 0)),
      0
    );

    const unmatchedIncome = income.filter(
      (item) => (item.match_status || "unmatched") !== "matched"
    );

    const totalIncome = unmatchedIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalPayments = payments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const realRevenue = totalIncome + totalPayments;
    const realProfit = realRevenue - totalExpenses;

    const openInvoices = invoices.filter(
      (invoice) => invoice.status !== "paid"
    );

    const openInvoiceAmount = openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0
    );

    const totalEstimateAmount = estimates.reduce(
      (sum, estimate) => sum + Number(estimate.amount || 0),
      0
    );

    const bankTransactionsToReview = transactions.filter((txn) => {
      const matchStatus = txn.match_status || "unmatched";

      return (
        !txn.imported_to_expenses &&
        !txn.imported_to_income &&
        !txn.ignored &&
        matchStatus !== "matched"
      );
    });

    const matchedDeposits = transactions.filter(
      (txn) => txn.match_status === "matched"
    );

    return {
      totalExpenses,
      totalIncome,
      totalPayments,
      realRevenue,
      realProfit,
      openInvoiceAmount,
      totalEstimateAmount,
      bankTransactionsToReview: bankTransactionsToReview.length,
      matchedDeposits: matchedDeposits.length,
      invoiceCount: invoices.length,
      estimateCount: estimates.length,
    };
  }, [expenses, income, payments, invoices, estimates, transactions]);

  const expenseBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();

    expenses.forEach((expense) => {
      const category = expense.category || "Uncategorized";
      const amount = Math.abs(Number(expense.amount || 0));
      grouped.set(category, (grouped.get(category) || 0) + amount);
    });

    return Array.from(grouped.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [expenses]);

  const maxBarValue = Math.max(
    totals.realRevenue,
    totals.totalExpenses,
    Math.abs(totals.realProfit),
    1
  );

  const hasFullSampleStyleData =
    expenses.length > 0 && invoices.length > 0 && payments.length > 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-slate-900">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-slate-950">TrueAngle</h1>
          <p className="mt-3 text-slate-700">
            Please sign in to view your dashboard.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <AppNav onSignOut={handleSignOut} />
      <TrialBanner />

      <button
  onClick={async () => {
    if (!user) return;

    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      body: JSON.stringify({
        customerId: user.id, // adjust if you store stripe_customer_id
      }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }
  }}
  className="text-sm font-semibold text-blue-600 hover:underline"
>
  Manage Subscription
</button>

      <div className="mx-auto max-w-7xl space-y-8">
        <OnboardingChecklist />

        <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-300">
                New here?
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Kick the tires without wrecking your real numbers.
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
                Add sample invoices, payments, and expenses so the dashboard
                actually shows how TrueAngle works. Clear it when you’re ready
                to run your real business through it.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {!hasFullSampleStyleData && (
                <button
                  onClick={handleAddSampleData}
                  disabled={workingSampleData}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {workingSampleData ? "Working..." : "Add Sample Data"}
                </button>
              )}

              <button
                onClick={handleClearSampleData}
                disabled={workingSampleData}
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workingSampleData ? "Working..." : "Clear Sample Data"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-r from-white to-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            TrueAngle Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Know what you actually made.
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Revenue counts invoice payments plus unmatched income deposits, so
            matched bank deposits do not double count.
          </p>
        </section>

        {message && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">{message}</p>
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            label="Real Revenue"
            value={formatCurrency(totals.realRevenue)}
            helper="Invoice payments + unmatched income"
            valueClassName="text-green-700"
          />

          <DashboardCard
            label="Expenses"
            value={formatCurrency(totals.totalExpenses)}
            helper="Imported and entered expenses"
            valueClassName="text-red-700"
          />

          <DashboardCard
            label="Real Profit"
            value={formatCurrency(totals.realProfit)}
            helper="Revenue minus expenses"
            valueClassName={
              totals.realProfit >= 0 ? "text-slate-950" : "text-red-700"
            }
          />

          <DashboardCard
            label="Open Invoices"
            value={formatCurrency(totals.openInvoiceAmount)}
            helper="Not marked paid"
            valueClassName="text-slate-950"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Revenue vs Expenses
            </h2>

            <div className="mt-6 space-y-5">
              <BarRow
                label="Revenue"
                value={totals.realRevenue}
                maxValue={maxBarValue}
              />
              <BarRow
                label="Expenses"
                value={totals.totalExpenses}
                maxValue={maxBarValue}
              />
              <BarRow
                label="Profit"
                value={Math.max(totals.realProfit, 0)}
                maxValue={maxBarValue}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Expense Breakdown
            </h2>

            {expenseBreakdown.length === 0 ? (
              <p className="mt-6 text-sm font-medium text-slate-600">
                No expenses yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {expenseBreakdown.map((item) => {
                  const percent =
                    totals.totalExpenses > 0
                      ? Math.round((item.amount / totals.totalExpenses) * 100)
                      : 0;

                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-sm font-bold text-slate-800">
                        <span>{item.category}</span>
                        <span>
                          {formatCurrency(item.amount)} ({percent}%)
                        </span>
                      </div>

                      <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{
                            width: `${percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            label="Invoice Payments"
            value={formatCurrency(totals.totalPayments)}
          />

          <DashboardCard
            label="Unmatched Income"
            value={formatCurrency(totals.totalIncome)}
          />

          <DashboardCard
            label="Matched Deposits"
            value={String(totals.matchedDeposits)}
          />

          <DashboardCard
            label="Bank Items To Review"
            value={String(totals.bankTransactionsToReview)}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Business Snapshot
            </h2>

            <div className="mt-6 space-y-4">
              <SnapshotRow label="Total Estimates" value={totals.estimateCount} />
              <SnapshotRow
                label="Estimate Value"
                value={formatCurrency(totals.totalEstimateAmount)}
              />
              <SnapshotRow label="Total Invoices" value={totals.invoiceCount} />
              <SnapshotRow
                label="Open Invoice Amount"
                value={formatCurrency(totals.openInvoiceAmount)}
                last
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">Revenue Rule</h2>

            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="font-bold text-green-900">
                Matched bank deposits are not counted twice.
              </p>
              <p className="mt-2 text-sm font-medium text-green-900">
                Once a deposit is matched to an invoice payment, the dashboard
                counts the invoice payment as revenue and excludes that matched
                bank deposit from additional income totals.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  label,
  value,
  helper,
  valueClassName = "text-slate-950",
}: {
  label: string;
  value: string;
  helper?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueClassName}`}>{value}</p>
      {helper && (
        <p className="mt-2 text-xs font-medium text-slate-600">{helper}</p>
      )}
    </div>
  );
}

function BarRow({
  label,
  value,
  maxValue,
}: {
  label: string;
  value: number;
  maxValue: number;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-4 text-sm font-bold text-slate-800">
        <span className="truncate">{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <div className="h-5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{ width: `${getBarPercent(value, maxValue)}%` }}
        />
      </div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string | number;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        last ? "" : "border-b border-slate-200 pb-3"
      }`}
    >
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}
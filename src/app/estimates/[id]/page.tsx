"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type Estimate = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  job_name: string | null;
  project_description: string | null;
  notes: string | null;
  exclusions: string | null;
  valid_until: string | null;
  estimate_number: string | null;
  amount: number | null;
  markup_percent: number | null;
  created_at: string | null;
  status: string | null;
};

type Expense = {
  id: string;
  description?: string | null;
  vendor?: string | null;
  category?: string | null;
  amount: number | null;
  expense_date: string | null;
  created_at: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  notes?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US");
}

function formatStatus(status: string | null) {
  if (!status) return "Draft";

  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "accepted":
      return "Accepted";
    case "completed":
      return "Completed";
    case "invoiced":
      return "Invoiced";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function buildInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `INV-${y}${m}${d}-${rand}`;
}

export default function EstimateDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const estimateId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!estimateId || typeof estimateId !== "string") {
      setError("Invalid estimate ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data: estimateData, error: estimateError } = await supabase
      .from("estimates")
      .select(
        `
        id,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        job_name,
        project_description,
        notes,
        exclusions,
        valid_until,
        estimate_number,
        amount,
        markup_percent,
        created_at,
        status
      `
      )
      .eq("id", estimateId)
      .eq("user_id", user.id)
      .single();

    if (estimateError || !estimateData) {
      setError(estimateError?.message || "Estimate not found.");
      setLoading(false);
      return;
    }

    setEstimate(estimateData as Estimate);

    if (estimateData.customer_id) {
      const { data: customerData } = await supabase
        .from("customers")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          address
        `
        )
        .eq("id", estimateData.customer_id)
        .eq("user_id", user.id)
        .single();

      setCustomer((customerData as Customer) || null);
    } else {
      setCustomer(null);
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .select(
        `
        id,
        description,
        vendor,
        category,
        amount,
        expense_date,
        created_at,
        customer_id,
        estimate_id,
        notes
      `
      )
      .eq("estimate_id", estimateId)
      .eq("user_id", user.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (expenseError) {
      setError(expenseError.message);
      setLoading(false);
      return;
    }

    setExpenses((expenseData || []) as Expense[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [estimateId]);

  async function updateStatus(newStatus: string) {
    if (!estimate) return;

    setStatusLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be signed in.");
      setStatusLoading(false);
      return;
    }

    const { error } = await supabase
      .from("estimates")
      .update({ status: newStatus })
      .eq("id", estimate.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error updating status: ${error.message}`);
      setStatusLoading(false);
      return;
    }

    setMessage(`Status updated to ${formatStatus(newStatus)}.`);
    await loadData();
    setStatusLoading(false);
  }

  async function handleCreateInvoice() {
    if (!estimate) return;

    setStatusLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be signed in.");
      setStatusLoading(false);
      return;
    }

    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", user.id)
      .eq("estimate_id", estimate.id)
      .maybeSingle();

    if (existingInvoiceError) {
      setMessage(`Error checking invoices: ${existingInvoiceError.message}`);
      setStatusLoading(false);
      return;
    }

    if (existingInvoice?.id) {
      window.location.href = `/invoices?invoice_id=${existingInvoice.id}`;
      return;
    }

    const newInvoiceNumber = buildInvoiceNumber();
    const today = new Date().toISOString().slice(0, 10);

    const { data: newInvoice, error: createInvoiceError } = await supabase
      .from("invoices")
      .insert([
        {
          user_id: user.id,
          customer_id: estimate.customer_id || null,
          estimate_id: estimate.id,
          invoice_number: newInvoiceNumber,
          title: estimate.job_name || "Invoice",
          description: estimate.project_description || null,
          amount: Number(estimate.amount || 0),
          status: "draft",
          issue_date: today,
          due_date: null,
          notes: estimate.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();

    if (createInvoiceError || !newInvoice) {
      setMessage(
        `Error creating invoice: ${createInvoiceError?.message || "Unknown error"}`
      );
      setStatusLoading(false);
      return;
    }

    const { error: statusError } = await supabase
      .from("estimates")
      .update({ status: "invoiced" })
      .eq("id", estimate.id)
      .eq("user_id", user.id);

    if (statusError) {
      setMessage(`Invoice created, but estimate status failed to update.`);
      window.location.href = `/invoices?invoice_id=${newInvoice.id}`;
      return;
    }

    window.location.href = `/invoices?invoice_id=${newInvoice.id}`;
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    window.location.href = "/";
  }

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => {
      return sum + Number(expense.amount || 0);
    }, 0);
  }, [expenses]);

  const estimateAmount = Number(estimate?.amount || 0);
  const projectProfit = estimateAmount - totalExpenses;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav onSignOut={handleSignOut} />
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-900">Loading project...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav onSignOut={handleSignOut} />
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <p className="text-red-600">Error: {error}</p>
            <Link href="/estimates" className="text-blue-600 underline">
              Back to Estimates
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!estimate) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav onSignOut={handleSignOut} />
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-900">Project not found.</p>
            <Link href="/estimates" className="text-blue-600 underline">
              Back to Estimates
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-700">Project / Estimate</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {estimate.job_name || estimate.customer_name || "Project"}
            </h1>
            <p className="text-sm text-gray-700">
              Estimate #: {estimate.estimate_number || "—"}
            </p>
            <p className="text-sm text-gray-700">
              Created: {formatDate(estimate.created_at)}
            </p>
            <p className="text-sm text-gray-700">
              Status:{" "}
              <span className="font-semibold text-gray-900">
                {formatStatus(estimate.status)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/estimates"
              className="rounded border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm"
            >
              Back
            </Link>

            <Link
              href={`/expenses?estimate_id=${estimate.id}`}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              + Add Expense
            </Link>

            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={statusLoading}
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Create Invoice
            </button>

            <a
              href={`/estimates/${estimate.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-black px-4 py-2 text-white"
            >
              Print
            </a>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => updateStatus("sent")}
              disabled={statusLoading}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm disabled:opacity-50"
            >
              Mark as Sent
            </button>

            <button
              type="button"
              onClick={() => updateStatus("accepted")}
              disabled={statusLoading}
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Mark as Accepted
            </button>

            <button
              type="button"
              onClick={() => updateStatus("completed")}
              disabled={statusLoading}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Mark as Completed
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-gray-900">{message}</p>}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-700">Estimate Total</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(estimateAmount)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-700">Project Expenses</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-700">Projected Profit</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(projectProfit)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Estimate Info
            </h2>

            <div>
              <p className="text-sm text-gray-700">Customer Name</p>
              <p className="text-gray-900">{estimate.customer_name || "—"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Job Name</p>
              <p className="text-gray-900">{estimate.job_name || "—"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Project Description</p>
              <p className="text-gray-900">
                {estimate.project_description || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Markup</p>
              <p className="text-gray-900">
                {Number(estimate.markup_percent || 0)}%
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Valid Until</p>
              <p className="text-gray-900">{formatDate(estimate.valid_until)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Notes</p>
              <p className="text-gray-900">{estimate.notes || "—"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-700">Exclusions</p>
              <p className="text-gray-900">{estimate.exclusions || "—"}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Linked Customer
            </h2>

            {customer ? (
              <>
                <div>
                  <p className="text-sm text-gray-700">Name</p>
                  <p className="text-gray-900">{customer.full_name || "—"}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-700">Email</p>
                  <p className="text-gray-900">{customer.email || "—"}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-700">Phone</p>
                  <p className="text-gray-900">{customer.phone || "—"}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-700">Address</p>
                  <p className="text-gray-900">{customer.address || "—"}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-800">No linked customer record found.</p>

                <div>
                  <p className="text-sm text-gray-700">Estimate Email</p>
                  <p className="text-gray-900">{estimate.customer_email || "—"}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-700">Estimate Phone</p>
                  <p className="text-gray-900">{estimate.customer_phone || "—"}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-700">Estimate Address</p>
                  <p className="text-gray-900">
                    {estimate.customer_address || "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Project Expenses
            </h2>

            <Link
              href={`/expenses?estimate_id=${estimate.id}`}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              + Add Expense
            </Link>
          </div>

          {expenses.length === 0 ? (
            <p className="text-gray-800">
              No expenses linked to this project yet.
            </p>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {expense.description || expense.vendor || "Untitled expense"}
                    </p>
                    <p className="text-sm text-gray-800">
                      Category: {expense.category || "Uncategorized"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      Project: {estimate.job_name || "Untitled Job"}
                    </p>
                    {customer && (
                      <p className="text-sm text-gray-800">
                        Customer: {customer.full_name}
                      </p>
                    )}
                    <p className="text-sm text-gray-800">
                      {formatDate(expense.expense_date || expense.created_at)}
                    </p>
                    {expense.notes && (
                      <p className="mt-1 text-sm text-gray-800">
                        {expense.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right font-semibold text-gray-900">
                    {formatCurrency(Number(expense.amount || 0))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
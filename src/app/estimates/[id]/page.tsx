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
  approval_required: boolean | null;
  approval_token: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
  agreement_terms: string | null;
  converted_invoice_id: string | null;
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

const defaultAgreementTerms = `This estimate is for the work listed above. By approving this estimate, the client confirms they have reviewed the scope and pricing and would like the contractor to move forward with scheduling the work.

Approval of this estimate does not replace a formal contract. The contractor may send a separate invoice, contract, or payment terms before work begins.`;

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
  switch (status) {
    case "sent":
      return "Sent to Client";
    case "approved":
      return "Approved Internally";
    case "declined":
      return "Declined";
    case "converted":
      return "Converted to Invoice";
    case "draft":
    default:
      return "Draft";
  }
}

function getStatusClass(status: string | null) {
  switch (status) {
    case "sent":
      return "bg-yellow-100 text-yellow-900 ring-yellow-200";
    case "approved":
      return "bg-blue-100 text-blue-900 ring-blue-200";
    case "converted":
      return "bg-green-100 text-green-900 ring-green-200";
    case "declined":
      return "bg-red-100 text-red-900 ring-red-200";
    default:
      return "bg-gray-100 text-gray-800 ring-gray-200";
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
  const [savingApproval, setSavingApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [agreementTerms, setAgreementTerms] = useState("");

  const approvalLink =
    origin && estimate?.approval_token
      ? `${origin}/approve-estimate/${estimate.approval_token}`
      : "";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
        status,
        approval_required,
        approval_token,
        approved_at,
        approved_by_name,
        approved_by_email,
        agreement_terms,
        converted_invoice_id
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

    const safeEstimate = estimateData as Estimate;

    setEstimate(safeEstimate);
    setApprovalRequired(Boolean(safeEstimate.approval_required));
    setAgreementTerms(safeEstimate.agreement_terms || defaultAgreementTerms);

    if (safeEstimate.customer_id) {
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, address")
        .eq("id", safeEstimate.customer_id)
        .eq("user_id", user.id)
        .maybeSingle();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleSaveApprovalSettings() {
    if (!estimate) return;

    setSavingApproval(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be signed in.");
      setSavingApproval(false);
      return;
    }

    const { error } = await supabase
      .from("estimates")
      .update({
        approval_required: approvalRequired,
        agreement_terms: agreementTerms || defaultAgreementTerms,
      })
      .eq("id", estimate.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error saving approval settings: ${error.message}`);
      setSavingApproval(false);
      return;
    }

    setMessage("Approval settings saved.");
    await loadData();
    setSavingApproval(false);
  }

  async function handleSendForApproval() {
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
      .update({
        status: "sent",
        approval_required: true,
        agreement_terms: agreementTerms || defaultAgreementTerms,
      })
      .eq("id", estimate.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error sending for approval: ${error.message}`);
      setStatusLoading(false);
      return;
    }

    setMessage("Estimate is ready. Copy the approval link and send it to your client.");
    await loadData();
    setStatusLoading(false);
  }

  async function copyApprovalLink() {
    if (!approvalLink) return;

    await navigator.clipboard.writeText(approvalLink);
    setMessage("Approval link copied.");
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
      .update({
        status: "converted",
        converted_invoice_id: newInvoice.id,
      })
      .eq("id", estimate.id)
      .eq("user_id", user.id);

    if (statusError) {
      setMessage("Invoice created, but estimate status failed to update.");
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
  const isConverted = Boolean(estimate?.converted_invoice_id);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav onSignOut={handleSignOut} />
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-900">Loading estimate...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !estimate) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav onSignOut={handleSignOut} />
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <p className="text-red-600">
              Error: {error || "Estimate not found."}
            </p>
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
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Estimate
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {estimate.job_name || estimate.customer_name || "Project"}
              </h1>

              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <p>Estimate #: {estimate.estimate_number || "—"}</p>
                <p>Created: {formatDate(estimate.created_at)}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClass(
                    estimate.status
                  )}`}
                >
                  {formatStatus(estimate.status)}
                </span>

                {isConverted && (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 ring-1 ring-green-100">
                    Invoice Created
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/estimates"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm"
              >
                Back
              </Link>

              <Link
                href={`/expenses?estimate_id=${estimate.id}`}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white"
              >
                + Expense
              </Link>

              {estimate.converted_invoice_id ? (
                <Link
                  href={`/invoices?invoice_id=${estimate.converted_invoice_id}`}
                  className="rounded-xl bg-green-600 px-4 py-2 text-white"
                >
                  View Invoice
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={statusLoading}
                  className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  Convert to Invoice
                </button>
              )}

              <a
                href={`/estimates/${estimate.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Print
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-700">Estimate Total</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(estimateAmount)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-700">Project Expenses</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-700">Projected Profit</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(projectProfit)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-gray-900">
              Estimate Workflow
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Send the estimate to the client for review. When they approve it
              through the link, TrueAngle creates the invoice automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => updateStatus("draft")}
              disabled={statusLoading || isConverted}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm disabled:opacity-50"
            >
              Mark Draft
            </button>

            <button
              type="button"
              onClick={() => updateStatus("sent")}
              disabled={statusLoading || isConverted}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm disabled:opacity-50"
            >
              Mark Sent
            </button>

            <button
              type="button"
              onClick={() => updateStatus("approved")}
              disabled={statusLoading || isConverted}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Approve Internally
            </button>

            <button
              type="button"
              onClick={() => updateStatus("declined")}
              disabled={statusLoading || isConverted}
              className="rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Mark Declined
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            “Approve Internally” only updates the estimate status. To create an
            invoice, use the client approval link or the “Convert to Invoice”
            button.
          </p>

          {message && <p className="mt-4 text-sm text-gray-900">{message}</p>}
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Client Approval Link
              </h2>
              <p className="mt-1 text-sm text-gray-700">
                Use this when you want the client to review the estimate and
                approve moving forward. Approval automatically creates a draft
                invoice.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(event) => setApprovalRequired(event.target.checked)}
                disabled={isConverted}
                className="h-4 w-4"
              />
              Require client approval before moving forward
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Approval Terms
              </label>
              <textarea
                value={agreementTerms}
                onChange={(event) => setAgreementTerms(event.target.value)}
                disabled={isConverted}
                className="min-h-[180px] w-full rounded-lg border p-3 text-gray-900 disabled:bg-gray-100"
              />
              <p className="mt-2 text-xs text-gray-600">
                These terms set expectations for estimate approval. They are not
                a replacement for a formal contract.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveApprovalSettings}
                disabled={savingApproval || isConverted}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                Save Approval Settings
              </button>

              <button
                type="button"
                onClick={handleSendForApproval}
                disabled={statusLoading || isConverted}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Send for Approval
              </button>

              {approvalLink && !isConverted && (
                <button
                  type="button"
                  onClick={copyApprovalLink}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm"
                >
                  Copy Approval Link
                </button>
              )}
            </div>

            {approvalLink && !isConverted && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">
                  Approval Link
                </p>
                <p className="mt-1 break-all text-sm text-blue-700">
                  {approvalLink}
                </p>
              </div>
            )}

            {estimate.approved_at && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-900">
                  Approved by {estimate.approved_by_name || "client"}
                </p>
                <p className="text-sm text-green-800">
                  {formatDate(estimate.approved_at)}
                </p>
                {estimate.approved_by_email && (
                  <p className="text-sm text-green-800">
                    {estimate.approved_by_email}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Estimate Info
            </h2>

            <InfoRow label="Customer Name" value={estimate.customer_name} />
            <InfoRow label="Job Name" value={estimate.job_name} />
            <InfoRow
              label="Project Description"
              value={estimate.project_description}
            />
            <InfoRow
              label="Markup"
              value={`${Number(estimate.markup_percent || 0)}%`}
            />
            <InfoRow label="Valid Until" value={formatDate(estimate.valid_until)} />
            <InfoRow label="Notes" value={estimate.notes} />
            <InfoRow label="Exclusions" value={estimate.exclusions} />
          </div>

          <div className="space-y-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Linked Customer
            </h2>

            {customer ? (
              <>
                <InfoRow label="Name" value={customer.full_name} />
                <InfoRow label="Email" value={customer.email} />
                <InfoRow label="Phone" value={customer.phone} />
                <InfoRow label="Address" value={customer.address} />
              </>
            ) : (
              <>
                <p className="text-gray-800">No linked customer record found.</p>
                <InfoRow label="Estimate Email" value={estimate.customer_email} />
                <InfoRow label="Estimate Phone" value={estimate.customer_phone} />
                <InfoRow
                  label="Estimate Address"
                  value={estimate.customer_address}
                />
              </>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Project Expenses
            </h2>

            <Link
              href={`/expenses?estimate_id=${estimate.id}`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white"
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-sm text-gray-700">{label}</p>
      <p className="whitespace-pre-wrap text-gray-900">{value || "—"}</p>
    </div>
  );
}
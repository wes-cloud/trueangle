"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Estimate = {
  id: string;
  job_name: string | null;
  customer_name: string | null;
  project_description: string | null;
  amount: number | null;
  agreement_terms: string | null;
  status: string | null;
  markup_percent?: number | null;
};

type LineItem = {
  id: string;
  estimate_id: string;
  type: string;
  description?: string | null;
  quantity: number;
  rate: number;
  show_quantity_rate?: boolean | null;
  tax_enabled?: boolean | null;
  tax_label?: string | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
};

export default function ApproveEstimatePage() {
  const params = useParams();
  const token = Array.isArray(params?.token)
    ? params.token[0]
    : params?.token;

  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    async function loadEstimate() {
      if (!token) return;

      const { data, error } = await supabase
        .from("estimates")
        .select(
          `
          id,
          job_name,
          customer_name,
          project_description,
          amount,
          agreement_terms,
          status,
          markup_percent
        `
        )
        .eq("approval_token", token)
        .single();

      if (error || !data) {
        setError("This approval link is invalid, expired, or already approved.");
        setLoading(false);
        return;
      }

      setEstimate(data);
      const { data: lineItemsData } = await supabase
  .from("line_items")
  .select(
    `
    id,
    estimate_id,
    type,
    description,
    quantity,
    rate,
    show_quantity_rate,
    tax_enabled,
    tax_label,
    tax_rate,
    tax_amount
    `
  )
  .eq("estimate_id", data.id);

setLineItems((lineItemsData || []) as LineItem[]);
      setLoading(false);
    }

    loadEstimate();
  }, [token]);

  async function handleApprove() {
    if (!estimate || !token) return;

    if (!clientName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error } = await supabase.rpc("approve_estimate_and_create_invoice", {
      approval_token_input: token,
      approved_name_input: clientName.trim(),
      approved_email_input: clientEmail.trim(),
    });

    if (error) {
      setError(error.message || "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setApproved(true);
    setSubmitting(false);
  }

  function formatCurrency(value: number | null) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  }
  const subtotal = lineItems.reduce(
  (sum, item) =>
    sum + Number(item.quantity || 0) * Number(item.rate || 0),
  0
);

const totalTax = lineItems.reduce(
  (sum, item) => sum + Number(item.tax_amount || 0),
  0
);

const markupPercent = Number(estimate?.markup_percent || 0);
const markupAmount = subtotal * (markupPercent / 100);
const finalTotal = Number(estimate?.amount || subtotal + markupAmount + totalTax);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>Loading...</p>
      </main>
    );
  }

  if (error && !estimate) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow">
          <h1 className="mb-3 text-2xl font-bold text-gray-900">
            Link Unavailable
          </h1>
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  if (approved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Estimate Approved
          </h1>
          <p className="text-gray-700">
            Thank you. The contractor can now follow up with scheduling,
            invoice details, and any contract or payment terms before work
            begins.
          </p>
        </div>
      </main>
    );
  }

  return (
  <main className="min-h-screen bg-slate-100">
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="bg-slate-950 px-6 py-10 text-white sm:px-10">
          <div className="flex items-center gap-4">
            <img
              src="/trueangle-logo.png"
              alt="TrueAngle"
              className="h-14 w-14 rounded-2xl object-cover"
            />

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
                TrueAngle Estimate
              </p>

              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                Review Your Estimate
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-sm font-medium text-slate-300 sm:text-base">
            Review the scope, pricing, and project details below. Approving this
            estimate lets the contractor know you’re ready to move forward with
            scheduling and next steps.
          </p>
        </div>

        <div className="space-y-8 p-6 sm:p-10">
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Project
              </p>

              <p className="mt-2 text-2xl font-black text-slate-950">
                {estimate?.job_name || "Project"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Estimate Total
              </p>

              <p className="mt-2 text-3xl font-black text-green-700">
                {formatCurrency(estimate?.amount || 0)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Customer
            </p>

            <p className="mt-2 text-lg font-semibold text-slate-950">
              {estimate?.customer_name || "—"}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Project Description
            </p>

            <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-800">
              {estimate?.project_description || "—"}
            </p>
          </section>

<section className="rounded-2xl border border-slate-200 p-6">
  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
    Estimate Breakdown
  </p>

  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
    <table className="w-full border-collapse">
      <thead className="bg-slate-100">
        <tr>
          <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">
            Description
          </th>

          <th className="px-4 py-3 text-right text-sm font-bold text-slate-700">
            Qty
          </th>

          <th className="px-4 py-3 text-right text-sm font-bold text-slate-700">
            Rate
          </th>

          <th className="px-4 py-3 text-right text-sm font-bold text-slate-700">
            Total
          </th>
        </tr>
      </thead>

      <tbody>
        {lineItems.map((item) => {
          const lineTotal =
            Number(item.quantity || 0) *
            Number(item.rate || 0);

          const showQtyRate =
            item.show_quantity_rate ?? true;

          return (
            <tr
              key={item.id}
              className="border-t border-slate-200"
            >
              <td className="px-4 py-4 text-sm text-slate-900">
                <p className="font-bold">
                  {item.type}
                </p>

                {item.description && (
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">
                    {item.description}
                  </p>
                )}
              </td>

              <td className="px-4 py-4 text-right text-sm text-slate-900">
                {showQtyRate ? item.quantity : ""}
              </td>

              <td className="px-4 py-4 text-right text-sm text-slate-900">
                {showQtyRate
                  ? formatCurrency(Number(item.rate || 0))
                  : ""}
              </td>

              <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                {formatCurrency(lineTotal)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>

  <div className="ml-auto mt-6 max-w-sm space-y-2">
    <div className="flex items-center justify-between text-sm text-slate-700">
      <span>Subtotal</span>
      <span>{formatCurrency(subtotal)}</span>
    </div>

    <div className="flex items-center justify-between text-sm text-slate-700">
  <span>Markup ({markupPercent}%)</span>
  <span>{formatCurrency(markupAmount)}</span>
</div>

    {Object.entries(
      lineItems.reduce<Record<string, number>>((acc, item) => {
        if (!item.tax_enabled) return acc;

        const label = `${item.tax_label || "Tax"} ${
          Number(item.tax_rate || 0)
        }%`;

        acc[label] =
          (acc[label] || 0) +
          Number(item.tax_amount || 0);

        return acc;
      }, {})
    ).map(([label, amount]) => (
      <div
        key={label}
        className="flex items-center justify-between text-sm text-slate-700"
      >
        <span>{label}</span>

        <span>
          {formatCurrency(amount)}
        </span>
      </div>
    ))}

    <div className="flex items-center justify-between border-t border-slate-300 pt-3 text-lg font-black text-slate-950">
      <span>Total</span>

      <span>
        {formatCurrency(finalTotal)}
      </span>
    </div>
  </div>
</section>

          <section className="rounded-2xl border border-slate-200 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Approval Terms
            </p>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {estimate?.agreement_terms ||
                "This estimate is for the work listed above. By approving this estimate, the client confirms they have reviewed the scope and pricing and would like the contractor to move forward with scheduling the work.\n\nApproval of this estimate does not replace a formal contract. The contractor may send a separate invoice, contract, or payment terms before work begins."}
            </p>
          </section>

          <section className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Approve This Estimate
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Enter your name below to confirm you reviewed the estimate and
              would like to move forward.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Your Full Name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950"
              />

              <input
                type="email"
                placeholder="Your Email (optional)"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none transition focus:border-slate-950"
              />
            </div>

            {error && (
              <p className="mt-4 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}

            <button
              onClick={handleApprove}
              disabled={submitting}
              className="mt-6 w-full rounded-2xl bg-green-600 py-4 text-lg font-black text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Approving..." : "Approve Estimate"}
            </button>

            <p className="mt-4 text-center text-xs font-medium text-slate-500">
              Approval confirms review and intent to move forward. Final
              invoice, contract, payment terms, or scheduling details may
              follow.
            </p>
          </section>
        </div>
      </div>
    </div>
  </main>
);
}
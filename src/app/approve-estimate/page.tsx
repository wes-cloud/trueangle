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
};

export default function ApproveEstimatePage() {
  const params = useParams();
  const token = Array.isArray(params?.token)
    ? params.token[0]
    : params?.token;

  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
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
          status
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
    <main className="flex min-h-screen justify-center bg-gray-100 p-6">
      <div className="w-full max-w-xl space-y-6 rounded-xl bg-white p-6 shadow">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Estimate</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review the scope and pricing below. Approval lets the contractor
            know you want to move forward with scheduling and next steps.
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Project</p>
          <p className="text-lg font-semibold text-gray-900">
            {estimate?.job_name || "Project"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Customer</p>
          <p className="text-gray-900">{estimate?.customer_name || "—"}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Description</p>
          <p className="text-gray-900">
            {estimate?.project_description || "—"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Estimate Total</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(estimate?.amount || 0)}
          </p>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">
            Approval Terms
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">
            {estimate?.agreement_terms ||
              "This estimate is for the work listed above. By approving this estimate, the client confirms they have reviewed the scope and pricing and would like the contractor to move forward with scheduling the work.\n\nApproval of this estimate does not replace a formal contract. The contractor may send a separate invoice, contract, or payment terms before work begins."}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded border p-3 text-gray-900"
          />

          <input
            type="email"
            placeholder="Your Email (optional)"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="w-full rounded border p-3 text-gray-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleApprove}
          disabled={submitting}
          className="w-full rounded bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Approving..." : "Approve Estimate"}
        </button>

        <p className="text-center text-xs text-gray-500">
          Approval confirms review and intent to move forward. Final invoice,
          contract, payment terms, or scheduling details may follow.
        </p>
      </div>
    </main>
  );
}
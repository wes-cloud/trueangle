"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

type Estimate = {
  id: string;
  customer_name: string | null;
  job_name: string | null;
  estimate_number: string | null;
  amount: number | null;
  created_at: string | null;
  status: string | null;
  converted_invoice_id: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatStatus(status: string | null) {
  switch (status) {
    case "sent":
      return "Sent";
    case "approved":
      return "Approved";
    case "converted":
      return "Converted";
    case "declined":
      return "Declined";
    case "draft":
    default:
      return "Draft";
  }
}

function getStatusColor(status: string | null) {
  switch (status) {
    case "sent":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "converted":
      return "bg-green-100 text-green-800";
    case "declined":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadEstimates() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        setEstimates([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("estimates")
        .select(
          "id, customer_name, job_name, estimate_number, amount, created_at, status, converted_invoice_id"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setEstimates((data || []) as Estimate[]);
    } catch (err) {
      const error = err as Error;
      setMessage(error.message || "Unable to load estimates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEstimates();
  }, []);

  async function handleDeleteEstimate(estimate: Estimate) {
    const confirmed = window.confirm(
      `Delete this estimate?\n\n${
        estimate.job_name || estimate.customer_name || "Untitled estimate"
      }\n\nThis will delete the estimate and its line items. It will not delete any invoice that was already created.`
    );

    if (!confirmed) return;

    setDeletingId(estimate.id);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be signed in.");
      }

      const { error: lineItemsError } = await supabase
        .from("line_items")
        .delete()
        .eq("estimate_id", estimate.id);

      if (lineItemsError) {
        throw new Error(`Error deleting line items: ${lineItemsError.message}`);
      }

      const { error: estimateError } = await supabase
        .from("estimates")
        .delete()
        .eq("id", estimate.id)
        .eq("user_id", user.id);

      if (estimateError) {
        throw new Error(`Error deleting estimate: ${estimateError.message}`);
      }

      setMessage("Estimate deleted.");
      await loadEstimates();
    } catch (err) {
      const error = err as Error;
      setMessage(error.message || "Unable to delete estimate.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav />
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
          <p>Loading estimates...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <AppNav />

      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Estimates</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track estimates from draft to client approval to invoice.
            </p>
          </div>

          <Link
            href="/estimates/new"
            className="rounded bg-black px-4 py-2 text-white"
          >
            + New Estimate
          </Link>
        </div>

        {message && (
          <div className="rounded-xl bg-white p-4 text-sm font-semibold text-gray-900 shadow">
            {message}
          </div>
        )}

        {estimates.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p>No estimates yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {estimates.map((estimate) => {
              const isConverted = !!estimate.converted_invoice_id;

              return (
                <div key={estimate.id} className="rounded-xl bg-white p-5 shadow">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {estimate.customer_name || "No Customer"}
                      </p>

                      <p className="text-gray-700">
                        {estimate.job_name || "No Job Name"}
                      </p>

                      <p className="text-sm text-gray-700">
                        Estimate #: {estimate.estimate_number || "—"}
                      </p>

                      <p className="text-sm text-gray-700">
                        Created: {formatDate(estimate.created_at)}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                            estimate.status
                          )}`}
                        >
                          {formatStatus(estimate.status)}
                        </span>

                        {isConverted && (
                          <span className="rounded bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">
                            Invoice Created
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-semibold text-gray-900">
                        {formatCurrency(Number(estimate.amount || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/estimates/${estimate.id}`}
                      className="rounded bg-black px-3 py-1 text-white"
                    >
                      View
                    </Link>

                    <Link
                      href={`/estimates/new?id=${estimate.id}`}
                      className="rounded bg-blue-600 px-3 py-1 text-white"
                    >
                      Edit
                    </Link>

                    {estimate.converted_invoice_id && (
                      <Link
                        href={`/invoices?invoice_id=${estimate.converted_invoice_id}`}
                        className="rounded bg-green-600 px-3 py-1 text-white"
                      >
                        View Invoice
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteEstimate(estimate)}
                      disabled={deletingId === estimate.id}
                      className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                    >
                      {deletingId === estimate.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
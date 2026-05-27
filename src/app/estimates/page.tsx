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
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
    case "approved":
      return "bg-blue-50 text-blue-800 ring-1 ring-blue-200";
    case "converted":
      return "bg-green-50 text-green-800 ring-1 ring-green-200";
    case "declined":
      return "bg-red-50 text-red-800 ring-1 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <AppNav />
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-700">Loading estimates...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <AppNav />

      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-white to-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Estimates
              </p>

              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Customer Estimates
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-700">
                Track estimates from draft to approval to invoice conversion.
              </p>
            </div>

            <Link
              href="/estimates/new"
              className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800"
            >
              + New Estimate
            </Link>
          </div>
        </section>

        {message && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">{message}</p>
          </section>
        )}

        {estimates.length === 0 ? (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="font-medium text-slate-600">No estimates yet.</p>
          </section>
        ) : (
          <section className="space-y-4">
            {estimates.map((estimate) => {
              const isConverted = !!estimate.converted_invoice_id;

              return (
                <div
                  key={estimate.id}
                  className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-slate-950">
                          {estimate.customer_name || "No Customer"}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusColor(
                            estimate.status
                          )}`}
                        >
                          {formatStatus(estimate.status)}
                        </span>

                        {isConverted && (
                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800 ring-1 ring-green-200">
                            Invoice Created
                          </span>
                        )}
                      </div>

                      <p className="mt-1 font-medium text-slate-700">
                        {estimate.job_name || "No Job Name"}
                      </p>

                      <p className="mt-2 text-sm font-medium text-slate-700">
                        Estimate #: {estimate.estimate_number || "—"}
                      </p>

                      <p className="text-sm font-medium text-slate-700">
                        Created: {formatDate(estimate.created_at)}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-2xl font-black text-slate-950">
                        {formatCurrency(Number(estimate.amount || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/estimates/${estimate.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-slate-800 hover:bg-slate-100"
                    >
                      View
                    </Link>

                    <Link
                      href={`/estimates/new?id=${estimate.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-slate-800 hover:bg-slate-100"
                    >
                      Edit
                    </Link>

                    {estimate.converted_invoice_id && (
                      <Link
                        href={`/invoices?invoice_id=${estimate.converted_invoice_id}`}
                        className="rounded-xl bg-slate-950 px-3 py-1 text-white hover:bg-slate-800"
                      >
                        View Invoice
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteEstimate(estimate)}
                      disabled={deletingId === estimate.id}
                      className="rounded-xl border border-red-300 bg-white px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === estimate.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
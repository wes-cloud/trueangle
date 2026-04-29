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

function getStatusColor(status: string | null) {
  switch (status) {
    case "sent":
      return "bg-yellow-100 text-yellow-800";
    case "accepted":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "invoiced":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEstimates() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("estimates")
        .select(
          "id, customer_name, job_name, estimate_number, amount, created_at, status"
        )
        .eq("user_id", user.id)
        .neq("status", "invoiced")
        .order("created_at", { ascending: false });

      setEstimates((data || []) as Estimate[]);
      setLoading(false);
    }

    loadEstimates();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
        <AppNav />
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <AppNav />

      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Estimates</h1>

          <Link
            href="/estimates/new"
            className="rounded bg-black px-4 py-2 text-white"
          >
            + New Estimate
          </Link>
        </div>

        {estimates.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p>No active estimates right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {estimates.map((estimate) => (
              <div
                key={estimate.id}
                className="rounded-xl bg-white p-5 shadow"
              >
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

                    <span
                      className={`mt-2 inline-block rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                        estimate.status
                      )}`}
                    >
                      {formatStatus(estimate.status)}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-semibold text-gray-900">
                      {formatCurrency(Number(estimate.amount))}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/estimates/${estimate.id}`}
                    className="rounded bg-black px-3 py-1 text-white"
                  >
                    View Project
                  </Link>

                  <Link
                    href={`/estimates/new?id=${estimate.id}`}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
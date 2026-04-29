"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CompanySettings = {
  company_name: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  license_number: string | null;
  default_terms: string | null;
};

type Estimate = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  customer_name: string | null;
  customer_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  job_name: string | null;
  project_description?: string | null;
  notes?: string | null;
  exclusions?: string | null;
  valid_until?: string | null;
  estimate_number?: string | null;
  amount: number | null;
  markup_percent?: number | null;
  created_at: string | null;
};

type LineItem = {
  id: string;
  estimate_id: string;
  type: string;
  quantity: number;
  rate: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function getLineItemsTotal(items: { quantity: number; rate: number }[]) {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0),
    0
  );
}

export default function EstimatePrintPage() {
  const params = useParams();
  const rawId = params?.id;
  const estimateId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(
    null
  );

  useEffect(() => {
    async function loadPrintPage() {
      if (!estimateId || typeof estimateId !== "string") {
        setError("Invalid estimate ID.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be signed in.");
        setLoading(false);
        return;
      }

      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .select(
          `
          id,
          user_id,
          customer_id,
          customer_name,
          customer_address,
          customer_email,
          customer_phone,
          job_name,
          project_description,
          notes,
          exclusions,
          valid_until,
          estimate_number,
          amount,
          markup_percent,
          created_at
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

      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from("line_items")
        .select("id, estimate_id, type, quantity, rate")
        .eq("estimate_id", estimateId);

      if (lineItemsError) {
        setError(lineItemsError.message);
        setLoading(false);
        return;
      }

      const { data: settingsData } = await supabase
        .from("company_settings")
        .select(
          `
          company_name,
          logo_url,
          phone,
          email,
          address,
          tax_id,
          license_number,
          default_terms
        `
        )
        .eq("user_id", user.id)
        .maybeSingle();

      setEstimate(estimateData as Estimate);
      setLineItems((lineItemsData || []) as LineItem[]);
      setCompanySettings((settingsData as CompanySettings) || null);
      setLoading(false);
    }

    loadPrintPage();
  }, [estimateId]);

  const subtotal = useMemo(() => getLineItemsTotal(lineItems), [lineItems]);

  const markupPercent = Number(estimate?.markup_percent || 0);
  const markupAmount = subtotal * (markupPercent / 100);
  const calculatedTotal = subtotal + markupAmount;
  const finalTotal = Number(estimate?.amount || calculatedTotal || 0);

  if (loading) {
    return (
      <main
        className="min-h-screen p-8"
        style={{ backgroundColor: "#ffffff", color: "#000000", opacity: 1 }}
      >
        <p>Loading printable estimate...</p>
      </main>
    );
  }

  if (error || !estimate) {
    return (
      <main
        className="min-h-screen p-8"
        style={{ backgroundColor: "#ffffff", color: "#000000", opacity: 1 }}
      >
        <p style={{ color: "#dc2626" }}>
          Error: {error || "Estimate not found."}
        </p>
      </main>
    );
  }

  const companyName = companySettings?.company_name || "WW Contracting";
  const companyPhone = companySettings?.phone || "";
  const companyEmail = companySettings?.email || "";
  const companyAddress = companySettings?.address || "";
  const companyTaxId = companySettings?.tax_id || "";
  const companyLicense = companySettings?.license_number || "";
  const defaultTerms = companySettings?.default_terms || "";

  return (
    <>
      <style jsx global>{`
        html,
        body {
          background: #ffffff !important;
          color: #000000 !important;
          opacity: 1 !important;
          filter: none !important;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            opacity: 1 !important;
            filter: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <main
        className="min-h-screen p-8"
        style={{ backgroundColor: "#ffffff", color: "#000000", opacity: 1 }}
      >
        <div className="no-print mx-auto mb-6 flex max-w-5xl gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Print / Save PDF
          </button>

          <button
            type="button"
            onClick={() => window.close()}
            className="rounded border border-gray-300 px-4 py-2 text-black"
          >
            Close
          </button>
        </div>

        <div
          className="mx-auto max-w-5xl rounded-2xl p-10 shadow print:shadow-none"
          style={{
            backgroundColor: "#ffffff",
            color: "#000000",
            opacity: 1,
            filter: "none",
            border: "1px solid #e5e7eb",
          }}
        >
          <div className="mb-10 flex items-start justify-between gap-8">
            <div className="max-w-[60%]">
              {companySettings?.logo_url ? (
                <img
                  src={companySettings.logo_url}
                  alt="Company logo"
                  className="mb-4 max-h-20"
                  style={{ opacity: 1 }}
                />
              ) : null}

              <h1 className="text-3xl font-bold" style={{ color: "#000000" }}>
                {companyName}
              </h1>

              {companyAddress && (
                <p className="mt-2 text-sm" style={{ color: "#111827" }}>
                  {companyAddress}
                </p>
              )}

              <div className="mt-2 space-y-1 text-sm" style={{ color: "#111827" }}>
                {companyPhone && <p>{companyPhone}</p>}
                {companyEmail && <p>{companyEmail}</p>}
                {companyTaxId && <p>Tax ID / EIN: {companyTaxId}</p>}
                {companyLicense && <p>License #: {companyLicense}</p>}
              </div>
            </div>

            <div
              className="min-w-[240px] rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Estimate
              </p>
              <p style={{ color: "#111827" }}>
                <span style={{ fontWeight: 600, color: "#000000" }}>
                  Estimate #:
                </span>{" "}
                {estimate.estimate_number || "—"}
              </p>
              <p style={{ color: "#111827" }}>
                <span style={{ fontWeight: 600, color: "#000000" }}>Date:</span>{" "}
                {formatDate(estimate.created_at)}
              </p>
              <p style={{ color: "#111827" }}>
                <span style={{ fontWeight: 600, color: "#000000" }}>
                  Valid Until:
                </span>{" "}
                {formatDate(estimate.valid_until)}
              </p>
            </div>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Customer
              </p>
              <p style={{ fontWeight: 600, color: "#000000" }}>
                {estimate.customer_name || "—"}
              </p>
              {estimate.customer_address && (
                <p className="text-sm" style={{ color: "#111827" }}>
                  {estimate.customer_address}
                </p>
              )}
              {estimate.customer_phone && (
                <p className="text-sm" style={{ color: "#111827" }}>
                  {estimate.customer_phone}
                </p>
              )}
              {estimate.customer_email && (
                <p className="text-sm" style={{ color: "#111827" }}>
                  {estimate.customer_email}
                </p>
              )}
            </div>

            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Project
              </p>
              <p style={{ fontWeight: 600, color: "#000000" }}>
                {estimate.job_name || "—"}
              </p>
              {estimate.project_description && (
                <p className="text-sm" style={{ color: "#111827" }}>
                  {estimate.project_description}
                </p>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-3 text-xl font-bold" style={{ color: "#000000" }}>
              Line Items
            </h2>

            <div
              className="overflow-hidden rounded-xl"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th
                      className="px-4 py-3 text-left text-sm"
                      style={{ color: "#000000" }}
                    >
                      Description
                    </th>
                    <th
                      className="px-4 py-3 text-right text-sm"
                      style={{ color: "#000000" }}
                    >
                      Qty
                    </th>
                    <th
                      className="px-4 py-3 text-right text-sm"
                      style={{ color: "#000000" }}
                    >
                      Rate
                    </th>
                    <th
                      className="px-4 py-3 text-right text-sm"
                      style={{ color: "#000000" }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-4 text-sm"
                        style={{ color: "#1f2937" }}
                      >
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item) => {
                      const lineTotal =
                        Number(item.quantity || 0) * Number(item.rate || 0);

                      return (
                        <tr key={item.id} style={{ borderTop: "1px solid #d1d5db" }}>
                          <td
                            className="px-4 py-3 text-sm"
                            style={{ color: "#111827" }}
                          >
                            {item.type}
                          </td>
                          <td
                            className="px-4 py-3 text-right text-sm"
                            style={{ color: "#111827" }}
                          >
                            {item.quantity}
                          </td>
                          <td
                            className="px-4 py-3 text-right text-sm"
                            style={{ color: "#111827" }}
                          >
                            {formatCurrency(Number(item.rate || 0))}
                          </td>
                          <td
                            className="px-4 py-3 text-right text-sm"
                            style={{ color: "#111827" }}
                          >
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="ml-auto mt-6 w-full max-w-sm space-y-2">
              <div
                className="flex items-center justify-between"
                style={{ color: "#111827" }}
              >
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div
                className="flex items-center justify-between"
                style={{ color: "#111827" }}
              >
                <span>Markup ({markupPercent}%)</span>
                <span>{formatCurrency(markupAmount)}</span>
              </div>

              <div
                className="flex items-center justify-between pt-3 text-lg font-bold"
                style={{ color: "#000000", borderTop: "1px solid #000000" }}
              >
                <span>Total</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>

          {estimate.notes && (
            <div
              className="mb-6 rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Notes
              </p>
              <p className="text-sm" style={{ color: "#111827" }}>
                {estimate.notes}
              </p>
            </div>
          )}

          {estimate.exclusions && (
            <div
              className="mb-6 rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Exclusions
              </p>
              <p className="text-sm" style={{ color: "#111827" }}>
                {estimate.exclusions}
              </p>
            </div>
          )}

          {defaultTerms && (
            <div
              className="mb-10 rounded-xl p-4"
              style={{ border: "1px solid #d1d5db", opacity: 1 }}
            >
              <p
                className="mb-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "#1f2937" }}
              >
                Terms
              </p>
              <p
                className="whitespace-pre-line text-sm"
                style={{ color: "#111827" }}
              >
                {defaultTerms}
              </p>
            </div>
          )}

          <div className="mt-16">
            <p
              className="mb-4 text-xs font-bold uppercase tracking-wide"
              style={{ color: "#1f2937" }}
            >
              Acceptance
            </p>
            <p className="mb-10 text-sm" style={{ color: "#111827" }}>
              By signing below, the customer accepts this estimate and authorizes
              work to proceed according to the terms outlined above.
            </p>

            <div className="flex flex-wrap gap-12">
              <div className="w-72">
                <div
                  className="pt-2 text-sm"
                  style={{ borderTop: "1px solid #000000", color: "#111827" }}
                >
                  Customer Signature
                </div>
              </div>

              <div className="w-48">
                <div
                  className="pt-2 text-sm"
                  style={{ borderTop: "1px solid #000000", color: "#111827" }}
                >
                  Date
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
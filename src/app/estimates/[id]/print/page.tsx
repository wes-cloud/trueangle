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
  approved_by_name?: string | null;
  approved_by_email?: string | null;
  signature_data?: string | null;
  signed_at?: string | null;
  created_at: string | null;
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

type EstimatePhoto = {
  id: string;
  image_url: string;
  caption: string | null;
};

const BRAND_NAVY = "#0f172a";
const BRAND_ORANGE = "#f97316";
const BRAND_SLATE = "#475569";

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

function formatDateTime(value?: string | null) {
  if (!value) return "Date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US");
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
  const [photos, setPhotos] = useState<EstimatePhoto[]>([]);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);

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
          approved_by_name,
          approved_by_email,
          signature_data,
          signed_at,
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
        .select(
          "id, estimate_id, type, description, quantity, rate, show_quantity_rate, tax_enabled, tax_label, tax_rate, tax_amount"
        )
        .eq("estimate_id", estimateId);

      if (lineItemsError) {
        setError(lineItemsError.message);
        setLoading(false);
        return;
      }

      const { data: photoData, error: photoError } = await supabase
        .from("estimate_photos")
        .select("id, image_url, caption")
        .eq("estimate_id", estimateId)
        .order("created_at", { ascending: false });

      if (photoError) {
        setError(photoError.message);
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
      setPhotos((photoData || []) as EstimatePhoto[]);
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
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        <p>Loading printable estimate...</p>
      </main>
    );
  }

  if (error || !estimate) {
    return (
      <main
        className="min-h-screen p-8"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
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

          img,
          .photo-card,
          .signature-card,
          .total-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <main
        className="min-h-screen p-8"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
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
          className="mx-auto max-w-5xl overflow-hidden rounded-2xl shadow print:shadow-none"
          style={{
            backgroundColor: "#ffffff",
            color: "#000000",
            border: "1px solid #e5e7eb",
          }}
        >
<div className="p-10">
            <div className="mb-10 flex items-start justify-between gap-8">
              <div className="max-w-[60%]">
                {companySettings?.logo_url ? (
                  <img
                    src={companySettings.logo_url}
                    alt="Company logo"
                    className="mb-4 max-h-20"
                  />
                ) : null}

                <h1
                  className="text-3xl font-bold"
                  style={{ color: BRAND_NAVY }}
                >
                  {companyName}
                </h1>

                {companyAddress && (
                  <p className="mt-2 text-sm" style={{ color: "#111827" }}>
                    {companyAddress}
                  </p>
                )}

                <div
                  className="mt-2 space-y-1 text-sm"
                  style={{ color: "#111827" }}
                >
                  {companyPhone && <p>{companyPhone}</p>}
                  {companyEmail && <p>{companyEmail}</p>}
                  {companyTaxId && <p>Tax ID / EIN: {companyTaxId}</p>}
                  {companyLicense && <p>License #: {companyLicense}</p>}
                </div>
              </div>

              <div
                className="min-w-[260px] overflow-hidden rounded-xl"
                style={{ border: `1px solid ${BRAND_NAVY}` }}
              >
                <div
                  className="px-4 py-3"
                  style={{ backgroundColor: BRAND_NAVY }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-white">
                    Estimate
                  </p>
                </div>

                <div className="space-y-1 p-4 text-sm">
                  <p style={{ color: "#111827" }}>
                    <span style={{ fontWeight: 700, color: BRAND_NAVY }}>
                      Estimate #:
                    </span>{" "}
                    {estimate.estimate_number || "—"}
                  </p>
                  <p style={{ color: "#111827" }}>
                    <span style={{ fontWeight: 700, color: BRAND_NAVY }}>
                      Date:
                    </span>{" "}
                    {formatDate(estimate.created_at)}
                  </p>
                  <p style={{ color: "#111827" }}>
                    <span style={{ fontWeight: 700, color: BRAND_NAVY }}>
                      Valid Until:
                    </span>{" "}
                    {formatDate(estimate.valid_until)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-8 grid gap-6 md:grid-cols-2">
              <div
                className="rounded-xl p-4"
                style={{
                  border: "1px solid #d1d5db",
                  borderLeft: `5px solid ${BRAND_ORANGE}`,
                }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: BRAND_NAVY }}
                >
                  Customer
                </p>
                <p style={{ fontWeight: 700, color: BRAND_NAVY }}>
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
                style={{
                  border: "1px solid #d1d5db",
                  borderLeft: `5px solid ${BRAND_ORANGE}`,
                }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: BRAND_NAVY }}
                >
                  Project
                </p>
                <p style={{ fontWeight: 700, color: BRAND_NAVY }}>
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
              <h2
                className="mb-3 text-xl font-bold"
                style={{ color: BRAND_NAVY }}
              >
                Line Items
              </h2>

              <div
                className="overflow-hidden rounded-xl"
                style={{ border: "1px solid #d1d5db" }}
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: BRAND_NAVY }}>
                      <th className="px-4 py-3 text-left text-sm text-white">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-sm text-white">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-sm text-white">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right text-sm text-white">
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
                          style={{ color: BRAND_NAVY }}
                        >
                          No line items.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item) => {
                        const lineTotal =
                          Number(item.quantity || 0) * Number(item.rate || 0);

                        const showQtyRate = item.show_quantity_rate ?? true;

                        return (
                          <tr
                            key={item.id}
                            style={{ borderTop: "1px solid #d1d5db" }}
                          >
                            <td
                              className="px-4 py-3 text-sm"
                              style={{ color: "#111827" }}
                            >
                              <p style={{ fontWeight: 700, color: BRAND_NAVY }}>
                                {item.type}
                              </p>

                              {item.description && (
                                <p
                                  className="mt-1 whitespace-pre-line text-xs"
                                  style={{ color: BRAND_SLATE }}
                                >
                                  {item.description}
                                </p>
                              )}
                            </td>

                            <td
                              className="px-4 py-3 text-right text-sm"
                              style={{ color: "#111827" }}
                            >
                              {showQtyRate ? item.quantity : ""}
                            </td>

                            <td
                              className="px-4 py-3 text-right text-sm"
                              style={{ color: "#111827" }}
                            >
                              {showQtyRate
                                ? formatCurrency(Number(item.rate || 0))
                                : ""}
                            </td>

                            <td
                              className="px-4 py-3 text-right text-sm font-semibold"
                              style={{ color: BRAND_NAVY }}
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

              <div
                className="total-card ml-auto mt-6 w-full max-w-sm space-y-2 rounded-xl p-5"
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="flex items-center justify-between text-sm"
                  style={{ color: "#111827" }}
                >
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                <div
                  className="flex items-center justify-between text-sm"
                  style={{ color: "#111827" }}
                >
                  <span>Markup ({markupPercent}%)</span>
                  <span>{formatCurrency(markupAmount)}</span>
                </div>

                {lineItems.some((item) => item.tax_enabled) && (
                  <div className="space-y-1">
                    {Object.entries(
                      lineItems.reduce<Record<string, number>>((acc, item) => {
                        if (!item.tax_enabled) return acc;

                        const label = `${item.tax_label || "Tax"} ${Number(
                          item.tax_rate || 0
                        )}%`;

                        acc[label] =
                          (acc[label] || 0) + Number(item.tax_amount || 0);

                        return acc;
                      }, {})
                    ).map(([label, amount]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between text-sm"
                        style={{ color: "#111827" }}
                      >
                        <span>{label}</span>
                        <span>{formatCurrency(amount)}</span>
                      </div>
                    ))}

                    <div
                      className="flex items-center justify-between text-sm"
                      style={{ color: "#111827" }}
                    >
                      <span>Total Tax</span>
                      <span>
                        {formatCurrency(
                          lineItems.reduce(
                            (sum, item) => sum + Number(item.tax_amount || 0),
                            0
                          )
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <div
                  className="flex items-center justify-between pt-4 text-xl font-black"
                  style={{
                    color: BRAND_NAVY,
                    borderTop: `3px solid ${BRAND_ORANGE}`,
                    marginTop: "12px",
                  }}
                >
                  <span>Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>

            {photos.length > 0 && (
              <div className="mb-8">
                <h2
                  className="mb-4 text-xl font-bold"
                  style={{ color: BRAND_NAVY }}
                >
                  Project Photos
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="photo-card overflow-hidden rounded-xl"
                      style={{
                        border: "1px solid #d1d5db",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.caption || "Project photo"}
                        className="h-64 w-full object-cover"
                      />

                      {photo.caption && (
                        <div className="p-3">
                          <p className="text-sm" style={{ color: "#111827" }}>
                            {photo.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {estimate.notes && (
              <div
                className="mb-6 rounded-xl p-4"
                style={{ border: "1px solid #d1d5db" }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: BRAND_NAVY }}
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
                style={{ border: "1px solid #d1d5db" }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: BRAND_NAVY }}
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
                style={{ border: "1px solid #d1d5db" }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-wide"
                  style={{ color: BRAND_NAVY }}
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

            <div
              className="signature-card mt-16 rounded-xl p-6"
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <p
                className="mb-4 text-xs font-bold uppercase tracking-wide"
                style={{ color: BRAND_NAVY }}
              >
                Acceptance
              </p>

              <p className="mb-10 text-sm" style={{ color: "#111827" }}>
                By signing below, the customer accepts this estimate and
                authorizes work to proceed according to the terms outlined
                above.
              </p>

              <div className="flex flex-wrap gap-12">
                <div className="w-80">
                  {estimate.signature_data ? (
                    <div>
                      <img
                        src={estimate.signature_data}
                        alt="Customer signature"
                        className="mb-2 h-32 object-contain"
                      />

                      <div
                        className="pt-2 text-sm"
                        style={{
                          borderTop: `2px solid ${BRAND_NAVY}`,
                          color: "#111827",
                        }}
                      >
                        {estimate.approved_by_name || "Customer Signature"}
                      </div>

                      {estimate.approved_by_email && (
                        <>
                          <p className="mt-1 text-xs text-slate-500">
                            {estimate.approved_by_email}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Electronically signed via TrueAngle
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div
                      className="pt-2 text-sm"
                      style={{
                        borderTop: `2px solid ${BRAND_NAVY}`,
                        color: "#111827",
                      }}
                    >
                      Customer Signature
                    </div>
                  )}
                </div>

                <div className="w-56">
                  <div
                    className="pt-2 text-sm"
                    style={{
                      borderTop: `2px solid ${BRAND_NAVY}`,
                      color: "#111827",
                    }}
                  >
                    {formatDateTime(estimate.signed_at)}
                  </div>
                </div>
              </div>
            </div>

            <p
              className="mt-8 text-center text-[11px]"
              style={{ color: BRAND_SLATE }}
            >
              Generated securely with TrueAngle
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
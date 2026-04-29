"use client";

import { useEffect, useState } from "react";
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

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type Estimate = {
  id: string;
  job_name: string | null;
  estimate_number: string | null;
};

type Invoice = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  invoice_number: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string | null;
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

function formatStatus(status?: string | null) {
  if (!status) return "Draft";

  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export default function InvoicePrintPage() {
  const params = useParams();
  const rawId = params?.id;
  const invoiceId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(
    null
  );

  useEffect(() => {
    async function loadPrintPage() {
      if (!invoiceId || typeof invoiceId !== "string") {
        setError("Invalid invoice ID.");
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

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(
          `
          id,
          user_id,
          customer_id,
          estimate_id,
          invoice_number,
          title,
          description,
          amount,
          status,
          issue_date,
          due_date,
          notes,
          created_at
        `
        )
        .eq("id", invoiceId)
        .eq("user_id", user.id)
        .single();

      if (invoiceError || !invoiceData) {
        setError(invoiceError?.message || "Invoice not found.");
        setLoading(false);
        return;
      }

      setInvoice(invoiceData as Invoice);

      if (invoiceData.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("id, full_name, email, phone, address")
          .eq("id", invoiceData.customer_id)
          .eq("user_id", user.id)
          .maybeSingle();

        setCustomer((customerData as Customer) || null);
      }

      if (invoiceData.estimate_id) {
        const { data: estimateData } = await supabase
          .from("estimates")
          .select("id, job_name, estimate_number")
          .eq("id", invoiceData.estimate_id)
          .eq("user_id", user.id)
          .maybeSingle();

        setEstimate((estimateData as Estimate) || null);
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

      setCompanySettings((settingsData as CompanySettings) || null);
      setLoading(false);
    }

    loadPrintPage();
  }, [invoiceId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8 text-gray-900">
        <p>Loading printable invoice...</p>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="min-h-screen bg-white p-8 text-gray-900">
        <p className="text-red-600">Error: {error || "Invoice not found."}</p>
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
        }

        @media print {
          .no-print {
            display: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <main className="min-h-screen bg-white p-8 text-gray-900">
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
            className="rounded border border-gray-300 px-4 py-2 text-gray-900"
          >
            Close
          </button>
        </div>

        <div className="mx-auto max-w-5xl rounded-2xl border border-gray-200 bg-white p-10 shadow print:shadow-none">
          <div className="mb-10 flex items-start justify-between gap-8">
            <div className="max-w-[60%]">
              {companySettings?.logo_url ? (
                <img
                  src={companySettings.logo_url}
                  alt="Company logo"
                  className="mb-4 max-h-20"
                />
              ) : null}

              <h1 className="text-3xl font-bold text-black">{companyName}</h1>

              {companyAddress && (
                <p className="mt-2 text-sm text-gray-900">{companyAddress}</p>
              )}

              <div className="mt-2 space-y-1 text-sm text-gray-900">
                {companyPhone && <p>{companyPhone}</p>}
                {companyEmail && <p>{companyEmail}</p>}
                {companyTaxId && <p>Tax ID / EIN: {companyTaxId}</p>}
                {companyLicense && <p>License #: {companyLicense}</p>}
              </div>
            </div>

            <div className="min-w-[260px] rounded-xl border border-gray-300 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                Invoice
              </p>
              <p className="text-gray-900">
                <span className="font-semibold text-black">Invoice #:</span>{" "}
                {invoice.invoice_number || "—"}
              </p>
              <p className="text-gray-900">
                <span className="font-semibold text-black">Issue Date:</span>{" "}
                {formatDate(invoice.issue_date || invoice.created_at)}
              </p>
              <p className="text-gray-900">
                <span className="font-semibold text-black">Due Date:</span>{" "}
                {formatDate(invoice.due_date)}
              </p>
              <p className="text-gray-900">
                <span className="font-semibold text-black">Status:</span>{" "}
                {formatStatus(invoice.status)}
              </p>
            </div>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-gray-300 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                Bill To
              </p>
              <p className="font-semibold text-black">
                {customer?.full_name || "—"}
              </p>
              {customer?.address && (
                <p className="text-sm text-gray-900">{customer.address}</p>
              )}
              {customer?.phone && (
                <p className="text-sm text-gray-900">{customer.phone}</p>
              )}
              {customer?.email && (
                <p className="text-sm text-gray-900">{customer.email}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-300 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                Project
              </p>
              <p className="font-semibold text-black">
                {estimate?.job_name || invoice.title || "—"}
              </p>
              {estimate?.estimate_number && (
                <p className="text-sm text-gray-900">
                  Estimate #: {estimate.estimate_number}
                </p>
              )}
              {invoice.description && (
                <p className="mt-2 text-sm text-gray-900">
                  {invoice.description}
                </p>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-3 text-xl font-bold text-black">Invoice Summary</h2>

            <div className="overflow-hidden rounded-xl border border-gray-300">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left text-sm text-black">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-sm text-black">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-300">
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {invoice.title || estimate?.job_name || "Invoice"}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(Number(invoice.amount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ml-auto mt-6 w-full max-w-sm space-y-2">
              <div className="flex items-center justify-between border-t border-black pt-3 text-lg font-bold text-black">
                <span>Amount Due</span>
                <span>{formatCurrency(Number(invoice.amount || 0))}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-6 rounded-xl border border-gray-300 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                Notes
              </p>
              <p className="whitespace-pre-line text-sm text-gray-900">
                {invoice.notes}
              </p>
            </div>
          )}

          {defaultTerms && (
            <div className="mb-10 rounded-xl border border-gray-300 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                Terms
              </p>
              <p className="whitespace-pre-line text-sm text-gray-900">
                {defaultTerms}
              </p>
            </div>
          )}

          <div className="mt-16">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-800">
              Payment
            </p>
            <p className="mb-10 text-sm text-gray-900">
              Please remit payment by the due date listed above. Thank you for
              your business.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
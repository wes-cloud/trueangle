"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  email?: string | null;
};

type CompanySettings = {
  company_name: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  license_number: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date?: string | null;
  created_at?: string | null;
  vendor?: string | null;
  category?: string | null;
};

type InvoiceRow = {
  id: string;
  amount: number;
  created_at?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  invoice_number?: string | null;
  title?: string | null;
  status?: string | null;
};

type PaymentRow = {
  id: string;
  invoice_id?: string | null;
  amount: number;
  payment_date?: string | null;
  created_at?: string | null;
};

type MileageLogRow = {
  id: string;
  total_miles: number;
  trip_date?: string | null;
  created_at?: string | null;
  vehicle_name?: string | null;
  purpose?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatMiles(value: number) {
  return `${Number(value || 0).toFixed(1)} mi`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function getQuarter(date: Date) {
  const month = date.getMonth();
  if (month <= 2) return 1;
  if (month <= 5) return 2;
  if (month <= 8) return 3;
  return 4;
}

function isInYear(dateValue: string | null | undefined, year: number) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === year;
}

function isInQuarter(
  dateValue: string | null | undefined,
  year: number,
  quarter: number
) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === year && getQuarter(date) === quarter;
}

export default function ReportsPrintPage() {
  const searchParams = useSearchParams();

  const selectedYear =
    Number(searchParams.get("year")) || new Date().getFullYear();
  const selectedQuarter = Number(searchParams.get("quarter")) || 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLogRow[]>([]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        setError("You must be signed in.");
        setLoading(false);
        return;
      }

      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
      });

      const [
        { data: settingsData },
        { data: expensesData, error: expensesError },
        { data: invoicesData, error: invoicesError },
        { data: paymentsData, error: paymentsError },
        { data: mileageData, error: mileageError },
      ] = await Promise.all([
        supabase
          .from("company_settings")
          .select(
            "company_name, logo_url, phone, email, address, tax_id, license_number"
          )
          .eq("user_id", authUser.id)
          .maybeSingle(),

        supabase
          .from("expenses")
          .select("id, amount, expense_date, created_at, vendor, category")
          .eq("user_id", authUser.id),

        supabase
          .from("invoices")
          .select(
            "id, amount, created_at, issue_date, due_date, invoice_number, title, status"
          )
          .eq("user_id", authUser.id),

        supabase
          .from("payments")
          .select("id, invoice_id, amount, payment_date, created_at")
          .eq("user_id", authUser.id),

        supabase
          .from("mileage_logs")
          .select("id, total_miles, trip_date, created_at, vehicle_name, purpose")
          .eq("user_id", authUser.id),
      ]);

      if (expensesError || invoicesError || paymentsError || mileageError) {
        setError(
          expensesError?.message ||
            invoicesError?.message ||
            paymentsError?.message ||
            mileageError?.message ||
            "Error loading report data."
        );
        setLoading(false);
        return;
      }

      setCompanySettings((settingsData as CompanySettings) || null);
      setExpenses((expensesData || []) as ExpenseRow[]);
      setInvoices((invoicesData || []) as InvoiceRow[]);
      setPayments((paymentsData || []) as PaymentRow[]);
      setMileageLogs((mileageData || []) as MileageLogRow[]);
      setLoading(false);
    }

    loadData();
  }, [selectedYear, selectedQuarter]);

  function getPaidAmountForInvoice(invoiceId: string) {
    return payments
      .filter((payment) => payment.invoice_id === invoiceId)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  const quarterlyExpenses = useMemo(() => {
    return expenses.filter((item) =>
      isInQuarter(item.expense_date || item.created_at, selectedYear, selectedQuarter)
    );
  }, [expenses, selectedYear, selectedQuarter]);

  const yearlyExpenses = useMemo(() => {
    return expenses.filter((item) =>
      isInYear(item.expense_date || item.created_at, selectedYear)
    );
  }, [expenses, selectedYear]);

  const quarterlyInvoices = useMemo(() => {
    return invoices.filter((item) =>
      isInQuarter(item.issue_date || item.created_at, selectedYear, selectedQuarter)
    );
  }, [invoices, selectedYear, selectedQuarter]);

  const yearlyInvoices = useMemo(() => {
    return invoices.filter((item) =>
      isInYear(item.issue_date || item.created_at, selectedYear)
    );
  }, [invoices, selectedYear]);

  const quarterlyPayments = useMemo(() => {
    return payments.filter((item) =>
      isInQuarter(item.payment_date || item.created_at, selectedYear, selectedQuarter)
    );
  }, [payments, selectedYear, selectedQuarter]);

  const yearlyPayments = useMemo(() => {
    return payments.filter((item) =>
      isInYear(item.payment_date || item.created_at, selectedYear)
    );
  }, [payments, selectedYear]);

  const quarterlyMileageLogs = useMemo(() => {
    return mileageLogs.filter((item) =>
      isInQuarter(item.trip_date || item.created_at, selectedYear, selectedQuarter)
    );
  }, [mileageLogs, selectedYear, selectedQuarter]);

  const yearlyMileageLogs = useMemo(() => {
    return mileageLogs.filter((item) =>
      isInYear(item.trip_date || item.created_at, selectedYear)
    );
  }, [mileageLogs, selectedYear]);

  const quarterlyInvoiced = quarterlyInvoices.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const quarterlyPaid = quarterlyPayments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const quarterlyExpenseTotal = quarterlyExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const quarterlyProfit = quarterlyInvoiced - quarterlyExpenseTotal;

  const quarterlyMileage = quarterlyMileageLogs.reduce(
    (sum, item) => sum + Number(item.total_miles || 0),
    0
  );

  const yearlyInvoiced = yearlyInvoices.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const yearlyPaid = yearlyPayments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const yearlyExpenseTotal = yearlyExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const yearlyProfit = yearlyInvoiced - yearlyExpenseTotal;

  const yearlyMileage = yearlyMileageLogs.reduce(
    (sum, item) => sum + Number(item.total_miles || 0),
    0
  );

  const quarterlyBalanceDue = quarterlyInvoices.reduce((sum, invoice) => {
    const invoiceAmount = Number(invoice.amount || 0);
    const paidAmount = getPaidAmountForInvoice(invoice.id);
    return sum + Math.max(invoiceAmount - paidAmount, 0);
  }, 0);

  const yearlyBalanceDue = yearlyInvoices.reduce((sum, invoice) => {
    const invoiceAmount = Number(invoice.amount || 0);
    const paidAmount = getPaidAmountForInvoice(invoice.id);
    return sum + Math.max(invoiceAmount - paidAmount, 0);
  }, 0);

  const overdueInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return invoices.filter((invoice) => {
      if (!invoice.due_date) return false;

      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const invoiceAmount = Number(invoice.amount || 0);
      const paidAmount = getPaidAmountForInvoice(invoice.id);
      const balance = invoiceAmount - paidAmount;

      return dueDate < today && balance > 0;
    });
  }, [invoices, payments]);

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceAmount = Number(invoice.amount || 0);
      const paidAmount = getPaidAmountForInvoice(invoice.id);
      return invoiceAmount - paidAmount > 0;
    });
  }, [invoices, payments]);

  const yearlyExpenseBreakdown = useMemo(() => {
    const grouped = yearlyExpenses.reduce<Record<string, number>>((acc, expense) => {
      const category = expense.category?.trim() || "Uncategorized";
      acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [yearlyExpenses]);

  const quarterlyExpenseBreakdown = useMemo(() => {
    const grouped = quarterlyExpenses.reduce<Record<string, number>>((acc, expense) => {
      const category = expense.category?.trim() || "Uncategorized";
      acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [quarterlyExpenses]);

  const companyName = companySettings?.company_name || "WW Contracting";

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8 text-gray-900">
        <p>Loading report...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-8 text-gray-900">
        <p className="text-red-600">Error: {error}</p>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        html,
        body {
          background: #ffffff !important;
          color: #000000 !important;
          font-size: 13px;
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

          .print-break {
            page-break-before: always;
          }
        }
      `}</style>

      <main className="min-h-screen bg-white p-6 text-gray-900">
        <div className="no-print mx-auto mb-4 flex max-w-6xl gap-3">
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

        <div className="mx-auto max-w-6xl bg-white p-2">
          <div className="border-b border-gray-300 pb-4">
            <div className="flex items-start justify-between gap-8">
              <div className="max-w-[60%]">
                {companySettings?.logo_url ? (
                  <img
                    src={companySettings.logo_url}
                    alt="Company logo"
                    className="mb-3 max-h-16"
                  />
                ) : null}

                <h1 className="text-2xl font-bold text-black">{companyName}</h1>

                <div className="mt-2 space-y-0.5 text-sm text-gray-900">
                  {companySettings?.address && <p>{companySettings.address}</p>}
                  {companySettings?.phone && <p>{companySettings.phone}</p>}
                  {companySettings?.email && <p>{companySettings.email}</p>}
                  {companySettings?.tax_id && (
                    <p>Tax ID / EIN: {companySettings.tax_id}</p>
                  )}
                  {companySettings?.license_number && (
                    <p>License #: {companySettings.license_number}</p>
                  )}
                </div>
              </div>

              <div className="min-w-[260px] text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-700">
                  Financial Report
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Year:</span> {selectedYear}
                </p>
                <p>
                  <span className="font-semibold">Quarter:</span> Q{selectedQuarter}
                </p>
                <p>
                  <span className="font-semibold">Generated:</span>{" "}
                  {formatDate(new Date().toISOString())}
                </p>
                <p>
                  <span className="font-semibold">Prepared For:</span>{" "}
                  Bookkeeping / Tax Review
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-black">
              Quarterly Summary — {selectedYear} Q{selectedQuarter}
            </h2>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Metric
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-black">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Invoiced", quarterlyInvoiced],
                    ["Paid", quarterlyPaid],
                    ["Expenses", quarterlyExpenseTotal],
                    ["Profit", quarterlyProfit],
                    ["Balance Due", quarterlyBalanceDue],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-t border-gray-300">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {label}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {formatCurrency(Number(value))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-300">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      Mileage
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {formatMiles(quarterlyMileage)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-black">
              Yearly Summary — {selectedYear}
            </h2>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Metric
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-black">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Invoiced", yearlyInvoiced],
                    ["Paid", yearlyPaid],
                    ["Expenses", yearlyExpenseTotal],
                    ["Profit", yearlyProfit],
                    ["Balance Due", yearlyBalanceDue],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-t border-gray-300">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {label}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {formatCurrency(Number(value))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-300">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      Mileage
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {formatMiles(yearlyMileage)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold text-black">
                Quarterly Expense Breakdown
              </h2>

              <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-black">
                        Category
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-black">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterlyExpenseBreakdown.length === 0 ? (
                      <tr className="border-t border-gray-300">
                        <td className="px-4 py-3 text-gray-900" colSpan={2}>
                          No expenses in this quarter.
                        </td>
                      </tr>
                    ) : (
                      quarterlyExpenseBreakdown.map((item) => (
                        <tr
                          key={item.category}
                          className="border-t border-gray-300"
                        >
                          <td className="px-4 py-2 text-gray-900">
                            {item.category}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-black">
                Yearly Expense Breakdown
              </h2>

              <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-black">
                        Category
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-black">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyExpenseBreakdown.length === 0 ? (
                      <tr className="border-t border-gray-300">
                        <td className="px-4 py-3 text-gray-900" colSpan={2}>
                          No expenses in this year.
                        </td>
                      </tr>
                    ) : (
                      yearlyExpenseBreakdown.map((item) => (
                        <tr
                          key={item.category}
                          className="border-t border-gray-300"
                        >
                          <td className="px-4 py-2 text-gray-900">
                            {item.category}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold text-black">
                Invoice Health Summary
              </h2>

              <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-black">
                        Metric
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-black">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-300">
                      <td className="px-4 py-2 text-gray-900">Unpaid Invoices</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {unpaidInvoices.length}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-300">
                      <td className="px-4 py-2 text-gray-900">Overdue Invoices</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {overdueInvoices.length}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-300">
                      <td className="px-4 py-2 text-gray-900">Unpaid Balance</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {formatCurrency(yearlyBalanceDue)}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-300">
                      <td className="px-4 py-2 text-gray-900">Yearly Mileage</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {formatMiles(yearlyMileage)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-black">Notes</h2>

              <div className="mt-3 rounded-lg border border-gray-300 p-4 text-sm text-gray-900">
                <p>
                  This report summarizes invoiced income, payments received,
                  expenses recorded, estimated profit, outstanding balances, and
                  business mileage for the selected quarter and year.
                </p>
                <p className="mt-2">
                  Expense categories are based on the categories currently assigned
                  to saved expenses in the app.
                </p>
              </div>
            </div>
          </div>

          <div className="print-break mt-8">
            <h2 className="text-lg font-bold text-black">Unpaid Invoices Detail</h2>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Title
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-black">
                      Balance Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.length === 0 ? (
                    <tr className="border-t border-gray-300">
                      <td colSpan={4} className="px-4 py-3 text-gray-900">
                        No unpaid invoices.
                      </td>
                    </tr>
                  ) : (
                    unpaidInvoices.map((invoice) => {
                      const invoiceAmount = Number(invoice.amount || 0);
                      const paidAmount = getPaidAmountForInvoice(invoice.id);
                      const balance = Math.max(invoiceAmount - paidAmount, 0);

                      return (
                        <tr key={invoice.id} className="border-t border-gray-300">
                          <td className="px-4 py-2 text-gray-900">
                            {invoice.invoice_number || "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {invoice.title || "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {formatDate(invoice.due_date)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatCurrency(balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-black">Overdue Invoices Detail</h2>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Title
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-black">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-black">
                      Balance Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overdueInvoices.length === 0 ? (
                    <tr className="border-t border-gray-300">
                      <td colSpan={4} className="px-4 py-3 text-gray-900">
                        No overdue invoices.
                      </td>
                    </tr>
                  ) : (
                    overdueInvoices.map((invoice) => {
                      const invoiceAmount = Number(invoice.amount || 0);
                      const paidAmount = getPaidAmountForInvoice(invoice.id);
                      const balance = Math.max(invoiceAmount - paidAmount, 0);

                      return (
                        <tr key={invoice.id} className="border-t border-gray-300">
                          <td className="px-4 py-2 text-gray-900">
                            {invoice.invoice_number || "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {invoice.title || "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {formatDate(invoice.due_date)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatCurrency(balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  email?: string | null;
};

type EstimateRow = {
  id: string;
  amount: number;
  created_at: string;
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

function csvEscape(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(1);

  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLogRow[]>([]);

  async function loadData(currentUserId: string) {
    setMessage("");

    const [
      { data: estimatesData, error: estimatesError },
      { data: expensesData, error: expensesError },
      { data: invoicesData, error: invoicesError },
      { data: paymentsData, error: paymentsError },
      { data: mileageData, error: mileageError },
    ] = await Promise.all([
      supabase
        .from("estimates")
        .select("id, amount, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),

      supabase
        .from("expenses")
        .select("id, amount, expense_date, created_at, vendor, category")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),

      supabase
        .from("invoices")
        .select(
          "id, amount, created_at, issue_date, due_date, invoice_number, title, status"
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),

      supabase
        .from("payments")
        .select("id, invoice_id, amount, payment_date, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),

      supabase
        .from("mileage_logs")
        .select("id, total_miles, trip_date, created_at, vehicle_name, purpose")
        .eq("user_id", currentUserId)
        .order("trip_date", { ascending: false }),
    ]);

    if (estimatesError) {
      setMessage(`Error loading estimates: ${estimatesError.message}`);
      return;
    }

    if (expensesError) {
      setMessage(`Error loading expenses: ${expensesError.message}`);
      return;
    }

    if (invoicesError) {
      setMessage(`Error loading invoices: ${invoicesError.message}`);
      return;
    }

    if (paymentsError) {
      setMessage(`Error loading payments: ${paymentsError.message}`);
      return;
    }

    if (mileageError) {
      setMessage(`Error loading mileage: ${mileageError.message}`);
      return;
    }

    setEstimates((estimatesData || []) as EstimateRow[]);
    setExpenses((expensesData || []) as ExpenseRow[]);
    setInvoices((invoicesData || []) as InvoiceRow[]);
    setPayments((paymentsData || []) as PaymentRow[]);
    setMileageLogs((mileageData || []) as MileageLogRow[]);
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(error.message);
        setAuthLoading(false);
        return;
      }

      const safeUser = authUser
        ? {
            id: authUser.id,
            email: authUser.email ?? null,
          }
        : null;

      setUser(safeUser);

      if (safeUser) {
        await loadData(safeUser.id);
      }

      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? null,
          }
        : null;

      setUser(nextUser);

      if (nextUser) {
        await loadData(nextUser.id);
      } else {
        setEstimates([]);
        setExpenses([]);
        setInvoices([]);
        setPayments([]);
        setMileageLogs([]);
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    setEstimates([]);
    setExpenses([]);
    setInvoices([]);
    setPayments([]);
    setMileageLogs([]);
    setMessage("Signed out.");
  }

  const allYears = useMemo(() => {
    const years = new Set<number>();

    estimates.forEach((item) => {
      if (item.created_at) years.add(new Date(item.created_at).getFullYear());
    });

    expenses.forEach((item) => {
      const dateToUse = item.expense_date || item.created_at;
      if (dateToUse) years.add(new Date(dateToUse).getFullYear());
    });

    invoices.forEach((item) => {
      const dateToUse = item.issue_date || item.created_at;
      if (dateToUse) years.add(new Date(dateToUse).getFullYear());
    });

    payments.forEach((item) => {
      const dateToUse = item.payment_date || item.created_at;
      if (dateToUse) years.add(new Date(dateToUse).getFullYear());
    });

    mileageLogs.forEach((item) => {
      const dateToUse = item.trip_date || item.created_at;
      if (dateToUse) years.add(new Date(dateToUse).getFullYear());
    });

    years.add(currentYear);

    return Array.from(years).sort((a, b) => b - a);
  }, [estimates, expenses, invoices, payments, mileageLogs, currentYear]);

  function getPaidAmountForInvoice(invoiceId: string) {
    return payments
      .filter((payment) => payment.invoice_id === invoiceId)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  const yearlyInvoiced = useMemo(() => {
    return invoices
      .filter((item) => isInYear(item.issue_date || item.created_at, selectedYear))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [invoices, selectedYear]);

  const yearlyPaid = useMemo(() => {
    return payments
      .filter((item) => isInYear(item.payment_date || item.created_at, selectedYear))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [payments, selectedYear]);

  const yearlyExpenses = useMemo(() => {
    return expenses
      .filter((item) => isInYear(item.expense_date || item.created_at, selectedYear))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenses, selectedYear]);

  const yearlyProfit = yearlyInvoiced - yearlyExpenses;

  const yearlyBalanceDue = useMemo(() => {
    return invoices
      .filter((item) => isInYear(item.issue_date || item.created_at, selectedYear))
      .reduce((sum, invoice) => {
        const invoiceAmount = Number(invoice.amount || 0);
        const paidAmount = getPaidAmountForInvoice(invoice.id);
        return sum + Math.max(invoiceAmount - paidAmount, 0);
      }, 0);
  }, [invoices, payments, selectedYear]);

  const yearlyMileage = useMemo(() => {
    return mileageLogs
      .filter((item) => isInYear(item.trip_date || item.created_at, selectedYear))
      .reduce((sum, item) => sum + Number(item.total_miles || 0), 0);
  }, [mileageLogs, selectedYear]);

  const quarterlyInvoiced = useMemo(() => {
    return invoices
      .filter((item) =>
        isInQuarter(item.issue_date || item.created_at, selectedYear, selectedQuarter)
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [invoices, selectedYear, selectedQuarter]);

  const quarterlyPaid = useMemo(() => {
    return payments
      .filter((item) =>
        isInQuarter(item.payment_date || item.created_at, selectedYear, selectedQuarter)
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [payments, selectedYear, selectedQuarter]);

  const quarterlyExpenses = useMemo(() => {
    return expenses
      .filter((item) =>
        isInQuarter(item.expense_date || item.created_at, selectedYear, selectedQuarter)
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenses, selectedYear, selectedQuarter]);

  const quarterlyProfit = quarterlyInvoiced - quarterlyExpenses;

  const quarterlyBalanceDue = useMemo(() => {
    return invoices
      .filter((item) =>
        isInQuarter(item.issue_date || item.created_at, selectedYear, selectedQuarter)
      )
      .reduce((sum, invoice) => {
        const invoiceAmount = Number(invoice.amount || 0);
        const paidAmount = getPaidAmountForInvoice(invoice.id);
        return sum + Math.max(invoiceAmount - paidAmount, 0);
      }, 0);
  }, [invoices, payments, selectedYear, selectedQuarter]);

  const quarterlyMileage = useMemo(() => {
    return mileageLogs
      .filter((item) =>
        isInQuarter(item.trip_date || item.created_at, selectedYear, selectedQuarter)
      )
      .reduce((sum, item) => sum + Number(item.total_miles || 0), 0);
  }, [mileageLogs, selectedYear, selectedQuarter]);

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
    const grouped = expenses
      .filter((item) => isInYear(item.expense_date || item.created_at, selectedYear))
      .reduce<Record<string, number>>((acc, expense) => {
        const category = expense.category?.trim() || "Uncategorized";
        acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
        return acc;
      }, {});

    return Object.entries(grouped)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, selectedYear]);

  function handleExportCsv() {
    const rows: string[] = [];

    rows.push(
      [
        csvEscape("Report Type"),
        csvEscape("Period"),
        csvEscape("Metric"),
        csvEscape("Value"),
      ].join(",")
    );

    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Invoiced"),
        csvEscape(quarterlyInvoiced),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Paid"),
        csvEscape(quarterlyPaid),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Expenses"),
        csvEscape(quarterlyExpenses),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Profit"),
        csvEscape(quarterlyProfit),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Balance Due"),
        csvEscape(quarterlyBalanceDue),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Quarterly Summary"),
        csvEscape(`${selectedYear} Q${selectedQuarter}`),
        csvEscape("Mileage"),
        csvEscape(quarterlyMileage),
      ].join(",")
    );

    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Invoiced"),
        csvEscape(yearlyInvoiced),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Paid"),
        csvEscape(yearlyPaid),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Expenses"),
        csvEscape(yearlyExpenses),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Profit"),
        csvEscape(yearlyProfit),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Balance Due"),
        csvEscape(yearlyBalanceDue),
      ].join(",")
    );
    rows.push(
      [
        csvEscape("Yearly Summary"),
        csvEscape(`${selectedYear}`),
        csvEscape("Mileage"),
        csvEscape(yearlyMileage),
      ].join(",")
    );

    rows.push("");
    rows.push(
      [
        csvEscape("Expense Breakdown"),
        csvEscape("Year"),
        csvEscape("Category"),
        csvEscape("Total"),
      ].join(",")
    );

    yearlyExpenseBreakdown.forEach((item) => {
      rows.push(
        [
          csvEscape("Expense Breakdown"),
          csvEscape(selectedYear),
          csvEscape(item.category),
          csvEscape(item.total),
        ].join(",")
      );
    });

    rows.push("");
    rows.push(
      [
        csvEscape("Unpaid Invoices"),
        csvEscape("Invoice Number"),
        csvEscape("Title"),
        csvEscape("Due Date"),
        csvEscape("Balance Due"),
        csvEscape("Status"),
      ].join(",")
    );

    unpaidInvoices.forEach((invoice) => {
      const invoiceAmount = Number(invoice.amount || 0);
      const paidAmount = getPaidAmountForInvoice(invoice.id);
      const balance = Math.max(invoiceAmount - paidAmount, 0);

      rows.push(
        [
          csvEscape("Unpaid Invoices"),
          csvEscape(invoice.invoice_number || ""),
          csvEscape(invoice.title || ""),
          csvEscape(invoice.due_date || ""),
          csvEscape(balance),
          csvEscape(invoice.status || ""),
        ].join(",")
      );
    });

    rows.push("");
    rows.push(
      [
        csvEscape("Overdue Invoices"),
        csvEscape("Invoice Number"),
        csvEscape("Title"),
        csvEscape("Due Date"),
        csvEscape("Balance Due"),
        csvEscape("Status"),
      ].join(",")
    );

    overdueInvoices.forEach((invoice) => {
      const invoiceAmount = Number(invoice.amount || 0);
      const paidAmount = getPaidAmountForInvoice(invoice.id);
      const balance = Math.max(invoiceAmount - paidAmount, 0);

      rows.push(
        [
          csvEscape("Overdue Invoices"),
          csvEscape(invoice.invoice_number || ""),
          csvEscape(invoice.title || ""),
          csvEscape(invoice.due_date || ""),
          csvEscape(balance),
          csvEscape(invoice.status || ""),
        ].join(",")
      );
    });

    rows.push("");
    rows.push(
      [
        csvEscape("Mileage Logs"),
        csvEscape("Trip Date"),
        csvEscape("Vehicle"),
        csvEscape("Purpose"),
        csvEscape("Total Miles"),
      ].join(",")
    );

    mileageLogs
      .filter((item) => isInYear(item.trip_date || item.created_at, selectedYear))
      .forEach((log) => {
        rows.push(
          [
            csvEscape("Mileage Logs"),
            csvEscape(log.trip_date || ""),
            csvEscape(log.vehicle_name || ""),
            csvEscape(log.purpose || ""),
            csvEscape(log.total_miles || 0),
          ].join(",")
        );
      });

    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `reports_${selectedYear}_Q${selectedQuarter}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage("CSV exported successfully.");
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-gray-900">Loading reports...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="mt-3 text-gray-600">
            You need to sign in from the dashboard first.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl bg-gradient-to-r from-white to-gray-50 p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Reports
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Bookkeeper Summary
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900"
              >
                {allYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900"
              >
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
              </select>

              <a
                href={`/reports/print?year=${selectedYear}&quarter=${selectedQuarter}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Print / Save PDF
              </a>

              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <p>{message}</p>
          </div>
        )}

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Quarterly Summary — {selectedYear} Q{selectedQuarter}
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Invoiced</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(quarterlyInvoiced)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Paid</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(quarterlyPaid)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Expenses</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(quarterlyExpenses)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Profit</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(quarterlyProfit)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Balance Due</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(quarterlyBalanceDue)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Mileage</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMiles(quarterlyMileage)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Yearly Summary — {selectedYear}
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Invoiced</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(yearlyInvoiced)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Paid</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(yearlyPaid)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Expenses</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(yearlyExpenses)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Profit</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(yearlyProfit)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Balance Due</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(yearlyBalanceDue)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Mileage</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMiles(yearlyMileage)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Unpaid Invoices</h2>

            <div className="mt-6 space-y-4">
              {unpaidInvoices.length === 0 ? (
                <p className="text-gray-600">No unpaid invoices right now.</p>
              ) : (
                unpaidInvoices.slice(0, 8).map((invoice) => {
                  const invoiceAmount = Number(invoice.amount || 0);
                  const paidAmount = getPaidAmountForInvoice(invoice.id);
                  const balance = Math.max(invoiceAmount - paidAmount, 0);

                  return (
                    <div
                      key={invoice.id}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <p className="font-bold text-gray-900">
                        {invoice.invoice_number || "No Invoice Number"}
                      </p>
                      <p className="text-sm text-gray-700">
                        {invoice.title || "No title"}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        Balance Due: {formatCurrency(balance)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due: {formatDate(invoice.due_date)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Overdue Invoices</h2>

            <div className="mt-6 space-y-4">
              {overdueInvoices.length === 0 ? (
                <p className="text-gray-600">No overdue invoices right now.</p>
              ) : (
                overdueInvoices.slice(0, 8).map((invoice) => {
                  const invoiceAmount = Number(invoice.amount || 0);
                  const paidAmount = getPaidAmountForInvoice(invoice.id);
                  const balance = Math.max(invoiceAmount - paidAmount, 0);

                  return (
                    <div
                      key={invoice.id}
                      className="rounded-2xl border border-red-200 bg-red-50 p-4"
                    >
                      <p className="font-bold text-gray-900">
                        {invoice.invoice_number || "No Invoice Number"}
                      </p>
                      <p className="text-sm text-gray-700">
                        {invoice.title || "No title"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-red-700">
                        Balance Due: {formatCurrency(balance)}
                      </p>
                      <p className="text-sm text-red-700">
                        Due: {formatDate(invoice.due_date)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
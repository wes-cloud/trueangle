"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  email?: string | null;
};

type Customer = {
  id: string;
  full_name: string;
};

type Estimate = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  job_name: string | null;
  estimate_number: string | null;
};

type Expense = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  vendor: string | null;
  category: string | null;
  amount: number | null;
  expense_date: string | null;
  notes: string | null;
  created_at: string | null;
};

type CsvExpenseRow = {
  date: string;
  vendor: string;
  category: string;
  amount: string;
  notes: string;
  customer: string;
  project: string;
};

type ImportIssue = {
  rowNumber: number;
  vendor: string;
  reason: string;
};

type ImportSummary = {
  importedCount: number;
  skippedCount: number;
  unmatchedCount: number;
  issues: ImportIssue[];
};

type ExpenseFilter = "all" | "month" | "quarter" | "year";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Materials",
  "Subcontractors",
  "Equipment Rental",
  "Permit / Inspection Fees",
  "Disposal / Dump Fees",
  "Job Fuel",
  "Job Supplies",
  "Labor",
  "Job Travel",
  "Meals",
  "Office Supplies",
  "Software / Subscriptions",
  "Advertising / Marketing",
  "Insurance",
  "Accounting / Bookkeeping",
  "Bank Fees",
  "Vehicle Maintenance",
  "Fuel",
  "Tools / Small Equipment",
  "Phone / Internet",
  "Rent / Storage",
  "Training / Education",
  "Mileage",
  "Other",
];

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

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((item) => item.trim());
}

function parseCsvText(text: string): CsvExpenseRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    normalizeText(header)
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    function getValue(headerName: string) {
      const index = headers.indexOf(headerName);
      return index >= 0 ? values[index] || "" : "";
    }

    return {
      date: getValue("date"),
      vendor: getValue("vendor"),
      category: getValue("category"),
      amount: getValue("amount"),
      notes: getValue("notes"),
      customer: getValue("customer"),
      project: getValue("project"),
    };
  });
}

function getQuarter(date: Date) {
  const month = date.getMonth();
  if (month <= 2) return 1;
  if (month <= 5) return 2;
  if (month <= 8) return 3;
  return 4;
}

export default function ExpensesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [csvRows, setCsvRows] = useState<CsvExpenseRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>("all");

  const [categories, setCategories] = useState<string[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  async function fetchCustomers(currentUserId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name")
      .eq("user_id", currentUserId)
      .order("full_name", { ascending: true });

    if (error) {
      setMessage(`Error loading customers: ${error.message}`);
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function fetchEstimates(currentUserId: string) {
    const { data, error } = await supabase
      .from("estimates")
      .select("id, customer_id, customer_name, job_name, estimate_number")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading projects: ${error.message}`);
      return;
    }

    setEstimates((data || []) as Estimate[]);
  }

  async function fetchExpenses(currentUserId: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, user_id, customer_id, estimate_id, vendor, category, amount, expense_date, notes, created_at"
      )
      .eq("user_id", currentUserId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading expenses: ${error.message}`);
      return;
    }

    setExpenses((data || []) as Expense[]);
  }

  async function loadPageData(currentUserId: string) {
    setMessage("");
    await Promise.all([
      fetchCustomers(currentUserId),
      fetchEstimates(currentUserId),
      fetchExpenses(currentUserId),
    ]);
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    const exists = categories.some(
      (item) => item.toLowerCase() === trimmed.toLowerCase()
    );

    if (!exists) {
      setCategories((prev) => [...prev, trimmed]);
    }

    setCategory(trimmed);
    setNewCategory("");
    setShowAddCategory(false);
  }

  function resetForm() {
    setVendor("");
    setCategory("");
    setAmount("");
    setExpenseDate("");
    setNotes("");
    setSelectedCustomerId("");
    setSelectedEstimateId("");
    setEditingId(null);
  }

  function resetImportState() {
    setCsvRows([]);
    setCsvFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleEstimateChange(nextEstimateId: string) {
    setSelectedEstimateId(nextEstimateId);

    if (!nextEstimateId) return;

    const selectedEstimate = estimates.find((item) => item.id === nextEstimateId);
    if (!selectedEstimate) return;

    if (selectedEstimate.customer_id) {
      setSelectedCustomerId(selectedEstimate.customer_id);
    }
  }

  function handleEdit(expense: Expense) {
    setVendor(expense.vendor || "");
    setCategory(expense.category || "");
    setAmount(String(expense.amount ?? ""));
    setExpenseDate(expense.expense_date || "");
    setNotes(expense.notes || "");
    setSelectedCustomerId(expense.customer_id || "");
    setSelectedEstimateId(expense.estimate_id || "");
    setEditingId(expense.id);
    setMessage("Editing expense...");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteExpense(id: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error deleting expense: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Expense deleted successfully.");
    await loadPageData(user.id);
  }

  async function handleSaveExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!vendor.trim()) {
      setMessage("Vendor is required.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setMessage("Amount must be greater than 0.");
      return;
    }

    const payload = {
      user_id: user.id,
      customer_id: selectedCustomerId || null,
      estimate_id: selectedEstimateId || null,
      vendor: vendor.trim(),
      category: category.trim() || null,
      amount: Number(amount),
      expense_date: expenseDate || null,
      notes: notes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        setMessage(`Error updating expense: ${error.message}`);
        return;
      }

      setMessage("Expense updated successfully.");
      resetForm();
      await loadPageData(user.id);
      return;
    }

    const { error } = await supabase.from("expenses").insert([
      {
        ...payload,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage(`Error saving expense: ${error.message}`);
      return;
    }

    setMessage("Expense saved successfully.");
    resetForm();
    await loadPageData(user.id);
  }

  async function handleCsvFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text);

      if (parsedRows.length === 0) {
        setMessage("No usable rows found in CSV.");
        setCsvRows([]);
        setCsvFileName("");
        setImportSummary(null);
        return;
      }

      setCsvRows(parsedRows);
      setCsvFileName(file.name);
      setImportSummary(null);
      setMessage(`Loaded ${parsedRows.length} rows from CSV.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to read CSV file."
      );
    }
  }

  function handleDownloadTemplate() {
    const template = [
      "date,vendor,category,amount,notes,customer,project",
      "2026-01-15,Home Depot,Materials,245.80,Lumber purchase,John Smith,Kitchen Remodel",
      "2026-01-18,Shell,Job Fuel,76.12,Truck fuel,John Smith,Kitchen Remodel",
      "2026-01-20,Harbor Freight,Tools / Small Equipment,49.99,Drill bits,Sarah Jones,Bathroom Remodel",
      "2026-01-22,Cafe Rio,Meals,24.50,Lunch meeting,,",
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "expense_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  async function handleImportCsv() {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (csvRows.length === 0) {
      setMessage("Please choose a CSV file first.");
      return;
    }

    setIsImporting(true);

    try {
      const issues: ImportIssue[] = [];
      let unmatchedCount = 0;

      const inserts = csvRows
        .map((row, index) => {
          const rowNumber = index + 2;
          const parsedAmount = Number(row.amount);

          if (!row.vendor.trim()) {
            issues.push({
              rowNumber,
              vendor: row.vendor || "—",
              reason: "Missing vendor",
            });
            return null;
          }

          if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            issues.push({
              rowNumber,
              vendor: row.vendor,
              reason: "Invalid amount",
            });
            return null;
          }

          const matchedCustomer = customers.find(
            (customer) =>
              normalizeText(customer.full_name) === normalizeText(row.customer)
          );

          const matchedEstimate = estimates.find((estimate) => {
            const jobMatch =
              normalizeText(estimate.job_name) === normalizeText(row.project);
            const estimateNumberMatch =
              normalizeText(estimate.estimate_number) === normalizeText(row.project);
            return jobMatch || estimateNumberMatch;
          });

          const customerNameProvided = !!normalizeText(row.customer);
          const projectNameProvided = !!normalizeText(row.project);

          const customerUnmatched = customerNameProvided && !matchedCustomer;
          const projectUnmatched = projectNameProvided && !matchedEstimate;

          if (customerUnmatched || projectUnmatched) {
            unmatchedCount += 1;
            issues.push({
              rowNumber,
              vendor: row.vendor,
              reason:
                customerUnmatched && projectUnmatched
                  ? "Customer and project not matched"
                  : customerUnmatched
                  ? "Customer not matched"
                  : "Project not matched",
            });
          }

          const categoryValue = row.category.trim();
          if (
            categoryValue &&
            !categories.some(
              (item) => item.toLowerCase() === categoryValue.toLowerCase()
            )
          ) {
            setCategories((prev) => [...prev, categoryValue]);
          }

          return {
            user_id: user.id,
            customer_id:
              matchedCustomer?.id || matchedEstimate?.customer_id || null,
            estimate_id: matchedEstimate?.id || null,
            vendor: row.vendor.trim(),
            category: categoryValue || null,
            amount: parsedAmount,
            expense_date: row.date.trim() || null,
            notes: row.notes.trim() || null,
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (inserts.length === 0) {
        setImportSummary({
          importedCount: 0,
          skippedCount: issues.length,
          unmatchedCount,
          issues,
        });
        setMessage("No valid rows were found to import.");
        return;
      }

      const { error } = await supabase.from("expenses").insert(inserts);

      if (error) {
        setMessage(`Error importing CSV: ${error.message}`);
        return;
      }

      const summary: ImportSummary = {
        importedCount: inserts.length,
        skippedCount: issues.filter(
          (item) => item.reason === "Missing vendor" || item.reason === "Invalid amount"
        ).length,
        unmatchedCount,
        issues,
      };

      setImportSummary(summary);
      setMessage(`Imported ${inserts.length} expenses successfully.`);
      resetImportState();
      await loadPageData(user.id);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    setCustomers([]);
    setEstimates([]);
    setExpenses([]);
    setMessage("Signed out.");
  }

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (expenseFilter === "all") return expenses;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = getQuarter(now);

    return expenses.filter((expense) => {
      const dateValue = expense.expense_date || expense.created_at;
      if (!dateValue) return false;

      const expenseDateObj = new Date(dateValue);
      if (Number.isNaN(expenseDateObj.getTime())) return false;

      if (expenseFilter === "month") {
        return (
          expenseDateObj.getFullYear() === currentYear &&
          expenseDateObj.getMonth() === currentMonth
        );
      }

      if (expenseFilter === "quarter") {
        return (
          expenseDateObj.getFullYear() === currentYear &&
          getQuarter(expenseDateObj) === currentQuarter
        );
      }

      if (expenseFilter === "year") {
        return expenseDateObj.getFullYear() === currentYear;
      }

      return true;
    });
  }, [expenses, expenseFilter]);

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
        await loadPageData(safeUser.id);
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
        await loadPageData(nextUser.id);
      } else {
        setCustomers([]);
        setEstimates([]);
        setExpenses([]);
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-gray-900">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Expenses
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Job Expense Tracking
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900">CSV Import</h2>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Download Template
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            Use headers like:{" "}
            <strong>
              date, vendor, category, amount, notes, customer, project
            </strong>
          </p>

          <input
            ref={fileInputRef}
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleCsvFileChange}
            className="hidden"
          />

          <div className="space-y-2">
            <label
              htmlFor="csv-upload"
              className="inline-block cursor-pointer rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Import CSV
            </label>

            <p className="text-sm text-gray-500">
              {csvFileName ? csvFileName : "No file selected"}
            </p>
          </div>

          {csvRows.length > 0 && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {csvRows.length} row{csvRows.length === 1 ? "" : "s"} ready to
                  import
                </p>

                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={isImporting}
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                    isImporting
                      ? "cursor-not-allowed bg-gray-400"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isImporting ? "Importing..." : "Confirm Import"}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                      <th className="px-4 py-3 text-left font-semibold">Category</th>
                      <th className="px-4 py-3 text-left font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, index) => (
                      <tr
                        key={`${row.vendor}-${index}`}
                        className="border-t border-gray-200"
                      >
                        <td className="px-4 py-3">{row.date || "—"}</td>
                        <td className="px-4 py-3">{row.vendor || "—"}</td>
                        <td className="px-4 py-3">{row.category || "—"}</td>
                        <td className="px-4 py-3">{row.amount || "—"}</td>
                        <td className="px-4 py-3">{row.customer || "—"}</td>
                        <td className="px-4 py-3">{row.project || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {importSummary && (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Import Results</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-200">
                <p className="text-sm text-green-700">Imported</p>
                <p className="mt-2 text-2xl font-bold text-green-900">
                  {importSummary.importedCount}
                </p>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-5 ring-1 ring-yellow-200">
                <p className="text-sm text-yellow-700">Skipped</p>
                <p className="mt-2 text-2xl font-bold text-yellow-900">
                  {importSummary.skippedCount}
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-5 ring-1 ring-blue-200">
                <p className="text-sm text-blue-700">Unmatched</p>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {importSummary.unmatchedCount}
                </p>
              </div>
            </div>

            {importSummary.issues.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Row</th>
                      <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                      <th className="px-4 py-3 text-left font-semibold">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.issues.map((issue, index) => (
                      <tr
                        key={`${issue.rowNumber}-${index}`}
                        className="border-t border-gray-200"
                      >
                        <td className="px-4 py-3">{issue.rowNumber}</td>
                        <td className="px-4 py-3">{issue.vendor || "—"}</td>
                        <td className="px-4 py-3">{issue.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingId ? "Edit Expense" : "Add Expense"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-gray-300 px-4 py-2 text-gray-900"
              >
                Switch to New Expense
              </button>
            )}
          </div>

          <form onSubmit={handleSaveExpense} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Vendor
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="Home Depot"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Category
                </label>
                <div className="space-y-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border p-3 text-gray-900"
                  >
                    <option value="">Select category</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  {!showAddCategory ? (
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Add Category
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category"
                        className="flex-1 rounded-lg border p-2 text-sm text-gray-900"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="rounded-lg bg-black px-3 py-2 text-sm text-white"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Expense Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                >
                  <option value="">No customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Project / Estimate
                </label>
                <select
                  value={selectedEstimateId}
                  onChange={(e) => handleEstimateChange(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                >
                  <option value="">No project</option>
                  {estimates.map((estimate) => (
                    <option key={estimate.id} value={estimate.id}>
                      {estimate.job_name || "Untitled Job"}
                      {estimate.customer_name
                        ? ` - ${estimate.customer_name}`
                        : ""}
                      {estimate.estimate_number
                        ? ` (${estimate.estimate_number})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px] w-full rounded-lg border p-3 text-gray-900"
                placeholder="Optional notes"
              />
            </div>

            <div className="flex gap-3">
              <button className="rounded-xl bg-black px-4 py-2 text-white">
                {editingId ? "Update Expense" : "Save Expense"}
              </button>
            </div>

            {message && <p className="text-gray-900">{message}</p>}
          </form>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              Saved Expenses
            </h2>

            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value as ExpenseFilter)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
            >
              <option value="all">All Expenses</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>

          {filteredExpenses.length === 0 ? (
            <p className="text-gray-600">No expenses found for this filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredExpenses.map((expense) => {
                const linkedCustomer = customers.find(
                  (item) => item.id === expense.customer_id
                );
                const linkedEstimate = estimates.find(
                  (item) => item.id === expense.estimate_id
                );

                return (
                  <div
                    key={expense.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {expense.vendor || "No Vendor"}
                        </p>
                        <p className="text-sm text-gray-700">
                          {expense.category || "Uncategorized"}
                        </p>

                        {linkedCustomer && (
                          <p className="text-sm text-gray-700">
                            Customer: {linkedCustomer.full_name}
                          </p>
                        )}

                        {linkedEstimate && (
                          <p className="text-sm text-gray-700">
                            Project: {linkedEstimate.job_name || "Untitled Job"}
                          </p>
                        )}

                        {expense.notes && (
                          <p className="mt-2 text-sm text-gray-600">
                            {expense.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(Number(expense.amount || 0))}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(expense.expense_date || expense.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="rounded-xl bg-blue-600 px-3 py-1 text-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="rounded-xl bg-red-600 px-3 py-1 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
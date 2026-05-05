"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  email?: string | null;
};

type CompanyRole = "owner" | "bookkeeper" | "viewer" | null;

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole>(null);
  const [companyUserIds, setCompanyUserIds] = useState<string[]>([]);

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
  const [saving, setSaving] = useState(false);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

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

  function clearPageState() {
    setCompanyRole(null);
    setCompanyUserIds([]);
    setCustomers([]);
    setEstimates([]);
    setExpenses([]);
    setCsvRows([]);
    setCsvFileName("");
    setImportSummary(null);
  }

  async function getCompanyAccess(currentUserId: string) {
    const { data: memberships, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", currentUserId)
      .limit(1);

    if (membershipError) {
      throw new Error(`Error loading company access: ${membershipError.message}`);
    }

    const membership = memberships?.[0];

    if (!membership?.company_id) {
      return {
        role: "owner" as CompanyRole,
        userIds: [currentUserId],
      };
    }

    const { data: members, error: membersError } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", membership.company_id);

    if (membersError) {
      throw new Error(`Error loading company members: ${membersError.message}`);
    }

    const userIds =
      members?.map((member) => member.user_id).filter(Boolean) || [];

    return {
      role: (membership.role || "owner") as CompanyRole,
      userIds: userIds.length > 0 ? userIds : [currentUserId],
    };
  }

  async function loadPageData(currentUserId: string) {
    setPageLoading(true);
    setMessage("");

    try {
      const access = await getCompanyAccess(currentUserId);

      setCompanyRole(access.role);
      setCompanyUserIds(access.userIds);

      const [customersResult, estimatesResult, expensesResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, full_name")
            .in("user_id", access.userIds)
            .order("full_name", { ascending: true }),

          supabase
            .from("estimates")
            .select("id, customer_id, customer_name, job_name, estimate_number")
            .in("user_id", access.userIds)
            .order("created_at", { ascending: false }),

          supabase
            .from("expenses")
            .select(
              "id, user_id, customer_id, estimate_id, vendor, category, amount, expense_date, notes, created_at"
            )
            .in("user_id", access.userIds)
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (customersResult.error) {
        throw new Error(`Error loading customers: ${customersResult.error.message}`);
      }

      if (estimatesResult.error) {
        throw new Error(`Error loading projects: ${estimatesResult.error.message}`);
      }

      if (expensesResult.error) {
        throw new Error(`Error loading expenses: ${expensesResult.error.message}`);
      }

      setCustomers((customersResult.data || []) as Customer[]);
      setEstimates((estimatesResult.data || []) as Estimate[]);
      setExpenses((expensesResult.data || []) as Expense[]);
    } catch (err) {
      const error = err as Error;
      setMessage(error.message || "Unable to load expenses.");
    } finally {
      setPageLoading(false);
    }
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

    setMessage("");

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      if (editingId === id) {
        resetForm();
      }

      setMessage("Expense deleted.");
      await loadPageData(user.id);
    } catch (err) {
      const error = err as Error;
      setMessage(`Error deleting expense: ${error.message}`);
    }
  }

  async function handleReviewCategoryChange(expenseId: string, newCategory: string) {
    if (!user) return;

    setSavingReviewId(expenseId);
    setMessage("");

    try {
      const { error } = await supabase
        .from("expenses")
        .update({ category: newCategory || null })
        .eq("id", expenseId);

      if (error) {
        throw new Error(error.message);
      }

      await loadPageData(user.id);
    } catch (err) {
      const error = err as Error;
      setMessage(`Error updating category: ${error.message}`);
    } finally {
      setSavingReviewId(null);
    }
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

    setSaving(true);
    setMessage("");

    try {
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
          .eq("id", editingId);

        if (error) {
          throw new Error(error.message);
        }

        setMessage("Expense updated.");
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
        throw new Error(error.message);
      }

      setMessage("Expense saved.");
      resetForm();
      await loadPageData(user.id);
    } catch (err) {
      const error = err as Error;
      setMessage(`Error saving expense: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    } catch (err) {
      const error = err as Error;
      setMessage(error.message || "Unable to read CSV file.");
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
    setMessage("");

    try {
      const issues: ImportIssue[] = [];
      const newCategories = new Set<string>();
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
              normalizeText(estimate.estimate_number) ===
              normalizeText(row.project);
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
            newCategories.add(categoryValue);
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

      if (newCategories.size > 0) {
        setCategories((prev) => {
          const merged = [...prev];

          newCategories.forEach((newItem) => {
            const exists = merged.some(
              (existing) => existing.toLowerCase() === newItem.toLowerCase()
            );

            if (!exists) {
              merged.push(newItem);
            }
          });

          return merged;
        });
      }

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
        throw new Error(error.message);
      }

      const summary: ImportSummary = {
        importedCount: inserts.length,
        skippedCount: issues.filter(
          (item) =>
            item.reason === "Missing vendor" || item.reason === "Invalid amount"
        ).length,
        unmatchedCount,
        issues,
      };

      setImportSummary(summary);
      setMessage(`Imported ${inserts.length} expenses.`);
      resetImportState();
      await loadPageData(user.id);
    } catch (err) {
      const error = err as Error;
      setMessage(`Error importing CSV: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSignOut() {
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      setUser(null);
      clearPageState();
      router.push("/");
      router.refresh();
    } catch (err) {
      const error = err as Error;
      setMessage(`Sign out error: ${error.message}`);
    }
  }

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [expenses]);

  const needsReviewExpenses = useMemo(() => {
    return expenses.filter(
      (expense) =>
        !expense.category ||
        expense.category.trim() === "" ||
        expense.category === "Uncategorized"
    );
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
    let isMounted = true;

    async function loadUser() {
      setAuthLoading(true);
      setMessage("");

      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw new Error(error.message);
        }

        const safeUser = authUser
          ? {
              id: authUser.id,
              email: authUser.email ?? null,
            }
          : null;

        if (!isMounted) return;

        setUser(safeUser);

        if (safeUser) {
          await loadPageData(safeUser.id);
        } else {
          clearPageState();
        }
      } catch (err) {
        const error = err as Error;

        if (isMounted) {
          setMessage(error.message || "Unable to load expenses.");
          clearPageState();
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
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
        clearPageState();
      }

      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-slate-900">Loading expenses...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-slate-950">Expenses</h1>
          <p className="mt-3 text-slate-700">
            You need to sign in first.
          </p>
          <a
            href="/auth"
            className="mt-5 inline-block rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white"
          >
            Sign in
          </a>
          {message && (
            <p className="mt-4 text-sm font-semibold text-red-700">{message}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl bg-gradient-to-r from-white to-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Expenses
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Job Expense Tracking
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Signed in as {user.email || "User"}
                {companyRole && companyRole !== "owner"
                  ? ` · ${companyRole} access`
                  : ""}
              </p>
              {companyUserIds.length > 1 && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Showing company data across {companyUserIds.length} users.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Total Expenses
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>

          {pageLoading && (
            <p className="mt-4 text-sm font-semibold text-slate-600">
              Refreshing expenses...
            </p>
          )}
        </section>

        {message && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">{message}</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">
              {editingId ? "Edit Expense" : "Add Expense"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-950"
              >
                Switch to New Expense
              </button>
            )}
          </div>

          <form onSubmit={handleSaveExpense} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <FormField label="Vendor">
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
                  placeholder="Home Depot"
                  required
                />
              </FormField>

              <FormField label="Category">
                <div className="space-y-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
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
                      className="text-sm font-bold text-blue-700 hover:underline"
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
                        className="flex-1 rounded-lg border border-slate-300 p-2 text-sm text-slate-950"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </FormField>

              <FormField label="Amount">
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
                  placeholder="0.00"
                  required
                />
              </FormField>

              <FormField label="Expense Date">
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Customer">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
                >
                  <option value="">No customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Project / Estimate">
                <select
                  value={selectedEstimateId}
                  onChange={(e) => handleEstimateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-950"
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
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-300 p-3 text-slate-950"
                placeholder="Optional notes"
              />
            </FormField>

            <button
              disabled={saving}
              className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                  ? "Update Expense"
                  : "Save Expense"}
            </button>
          </form>
        </section>

        {needsReviewExpenses.length > 0 ? (
          <section className="rounded-3xl bg-yellow-50 p-8 shadow-sm ring-1 ring-yellow-200">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-yellow-950">
                  Needs Review ({needsReviewExpenses.length})
                </h2>
                <p className="mt-1 text-sm font-semibold text-yellow-900">
                  Categorize these so your books stay clean.
                </p>
              </div>

              <p className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-yellow-900 ring-1 ring-yellow-200">
                Bookkeeper fast lane
              </p>
            </div>

            <div className="space-y-3">
              {needsReviewExpenses.slice(0, 10).map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-yellow-100 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-950">
                      {expense.vendor || "No Vendor"}
                    </p>
                    <p className="text-sm font-medium text-slate-600">
                      {formatDate(expense.expense_date || expense.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      defaultValue={expense.category || ""}
                      onChange={(e) =>
                        handleReviewCategoryChange(expense.id, e.target.value)
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                    >
                      <option value="">Select category</option>
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <p className="min-w-28 text-left font-black text-slate-950 sm:text-right">
                      {formatCurrency(Number(expense.amount || 0))}
                    </p>

                    {savingReviewId === expense.id && (
                      <span className="text-xs font-bold text-slate-500">
                        Saving...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-green-50 p-6 shadow-sm ring-1 ring-green-200">
            <p className="font-black text-green-950">
              You’re all caught up. No expenses need review.
            </p>
            <p className="mt-1 text-sm font-semibold text-green-900">
              Nice work. Your books are clean.
            </p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">CSV Import</h2>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-50"
            >
              Download Template
            </button>
          </div>

          <p className="mb-4 text-sm font-medium text-slate-700">
            Use headers like:{" "}
            <strong>date, vendor, category, amount, notes, customer, project</strong>
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
              className="inline-block cursor-pointer rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Choose CSV
            </label>

            <p className="text-sm font-medium text-slate-500">
              {csvFileName ? csvFileName : "No file selected"}
            </p>
          </div>

          {csvRows.length > 0 && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {csvRows.length} row{csvRows.length === 1 ? "" : "s"} ready to
                  import
                </p>

                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={isImporting}
                  className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
                    isImporting
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-green-700 hover:bg-green-800"
                  }`}
                >
                  {isImporting ? "Importing..." : "Confirm Import"}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Date</th>
                      <th className="px-4 py-3 text-left font-bold">Vendor</th>
                      <th className="px-4 py-3 text-left font-bold">Category</th>
                      <th className="px-4 py-3 text-left font-bold">Amount</th>
                      <th className="px-4 py-3 text-left font-bold">Customer</th>
                      <th className="px-4 py-3 text-left font-bold">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, index) => (
                      <tr
                        key={`${row.vendor}-${index}`}
                        className="border-t border-slate-200"
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
        </section>

        {importSummary && (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black text-slate-950">
              Import Results
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <SummaryCard label="Imported" value={importSummary.importedCount} />
              <SummaryCard label="Skipped" value={importSummary.skippedCount} />
              <SummaryCard label="Unmatched" value={importSummary.unmatchedCount} />
            </div>

            {importSummary.issues.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Row</th>
                      <th className="px-4 py-3 text-left font-bold">Vendor</th>
                      <th className="px-4 py-3 text-left font-bold">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.issues.map((issue, index) => (
                      <tr
                        key={`${issue.rowNumber}-${index}`}
                        className="border-t border-slate-200"
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
          </section>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">
              Saved Expenses
            </h2>

            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value as ExpenseFilter)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-950"
            >
              <option value="all">All Expenses</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>

          {filteredExpenses.length === 0 ? (
            <p className="font-medium text-slate-600">
              No expenses found for this filter.
            </p>
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
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-950">
                          {expense.vendor || "No Vendor"}
                        </p>
                        <p className="text-sm font-semibold text-slate-700">
                          {expense.category || "Uncategorized"}
                        </p>

                        {linkedCustomer && (
                          <p className="text-sm font-medium text-slate-700">
                            Customer: {linkedCustomer.full_name}
                          </p>
                        )}

                        {linkedEstimate && (
                          <p className="text-sm font-medium text-slate-700">
                            Project: {linkedEstimate.job_name || "Untitled Job"}
                          </p>
                        )}

                        {expense.notes && (
                          <p className="mt-2 text-sm font-medium text-slate-600">
                            {expense.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-lg font-black text-slate-950">
                          {formatCurrency(Number(expense.amount || 0))}
                        </p>
                        <p className="text-sm font-medium text-slate-500">
                          {formatDate(expense.expense_date || expense.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="rounded-xl bg-blue-700 px-3 py-1 font-bold text-white hover:bg-blue-800"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="rounded-xl bg-red-700 px-3 py-1 font-bold text-white hover:bg-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-950">
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
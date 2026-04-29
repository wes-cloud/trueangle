"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { usePlaidLink } from "react-plaid-link";

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

type PlaidTransaction = {
  id: string;
  plaid_transaction_id: string | null;
  name: string | null;
  merchant_name: string | null;
  amount: number | null;
  category: string | null;
  posted_date: string | null;
  authorized_date: string | null;
  pending: boolean | null;
  imported_to_expenses: boolean | null;
  imported_to_income?: boolean | null;
  ignored: boolean | null;
  ignored_reason: string | null;
  plaid_account_id: string | null;
  matched_payment_id?: string | null;
  match_status?: string | null;
};

type Payment = {
  id: string;
  user_id: string;
  invoice_id: string;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  match_status?: string | null;
  plaid_transaction_id?: string | null;
  invoices?: {
    invoice_number: string | null;
    title: string | null;
    customer_id: string | null;
    customers?: {
      full_name: string | null;
    } | null;
  } | null;
};

type VendorMemory = {
  id: string;
  user_id: string;
  vendor_name: string;
  category: string;
};

type ExpenseCategory = {
  id: string;
  user_id: string;
  name: string;
};

type DraftValues = {
  category: string;
  customerId: string;
  estimateId: string;
  notes: string;
  suggestedFromMemory: boolean;
};

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

function normalizeVendorName(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getTransactionVendor(transaction: PlaidTransaction) {
  return (
    transaction.merchant_name?.trim() ||
    transaction.name?.trim() ||
    "Imported Transaction"
  );
}

function dedupeCategories(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function isDeposit(transaction: PlaidTransaction) {
  return Number(transaction.amount || 0) > 0;
}

function getTransactionDate(transaction: PlaidTransaction) {
  return transaction.posted_date || transaction.authorized_date || null;
}

function daysBetween(dateA?: string | null, dateB?: string | null) {
  if (!dateA || !dateB) return 9999;

  const first = new Date(dateA);
  const second = new Date(dateB);

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return 9999;
  }

  const diffMs = Math.abs(first.getTime() - second.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getPaymentLabel(payment: Payment) {
  const invoiceNumber = payment.invoices?.invoice_number || "Invoice";
  const customerName = payment.invoices?.customers?.full_name || "Customer";
  const title = payment.invoices?.title;

  return `${invoiceNumber} - ${customerName}${title ? ` - ${title}` : ""}`;
}

export default function BankingTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendorMemory, setVendorMemory] = useState<VendorMemory[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  function getMemoryCategoryForTransaction(
    transaction: PlaidTransaction,
    memories: VendorMemory[]
  ) {
    const vendorKey = normalizeVendorName(getTransactionVendor(transaction));
    if (!vendorKey) return "";

    const memory = memories.find(
      (item) => normalizeVendorName(item.vendor_name) === vendorKey
    );

    return memory?.category || "";
  }

  function findMatchingPayment(transaction: PlaidTransaction) {
    const amount = Number(transaction.amount || 0);
    const transactionDate = getTransactionDate(transaction);

    if (!isDeposit(transaction)) return null;

    const possibleMatches = payments
      .filter((payment) => {
        const paymentAmount = Number(payment.amount || 0);
        const status = payment.match_status || "unmatched";

        return paymentAmount === amount && status !== "matched";
      })
      .sort((a, b) => {
        const aDays = daysBetween(transactionDate, a.payment_date);
        const bDays = daysBetween(transactionDate, b.payment_date);
        return aDays - bDays;
      });

    return possibleMatches[0] || null;
  }

  async function saveCustomCategory(categoryName: string) {
    if (!user) return;

    const trimmed = categoryName.trim();
    if (!trimmed) return;

    const { error } = await supabase.from("expense_categories").upsert(
      {
        user_id: user.id,
        name: trimmed,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,name",
      }
    );

    if (error) {
      setMessage(`Category save failed: ${error.message}`);
    }
  }

  async function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    setCategories((prev) => dedupeCategories([...prev, trimmed]));
    await saveCustomCategory(trimmed);

    setNewCategory("");
    setShowAddCategory(false);
    setMessage(`Category "${trimmed}" added.`);
  }

  async function loadPageData(currentUserId: string) {
    const [
      { data: customersData, error: customersError },
      { data: estimatesData, error: estimatesError },
      { data: transactionsData, error: transactionsError },
      { data: paymentsData, error: paymentsError },
      { data: vendorMemoryData, error: vendorMemoryError },
      { data: customCategoriesData, error: customCategoriesError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name")
        .eq("user_id", currentUserId)
        .order("full_name", { ascending: true }),

      supabase
        .from("estimates")
        .select("id, customer_id, customer_name, job_name, estimate_number")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),

      supabase
        .from("plaid_transactions")
        .select(
          "id, plaid_transaction_id, name, merchant_name, amount, category, posted_date, authorized_date, pending, imported_to_expenses, imported_to_income, ignored, ignored_reason, plaid_account_id, matched_payment_id, match_status"
        )
        .eq("user_id", currentUserId)
        .order("posted_date", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("payments")
        .select(
          `
          id,
          user_id,
          invoice_id,
          amount,
          payment_date,
          payment_method,
          notes,
          match_status,
          plaid_transaction_id,
          invoices (
            invoice_number,
            title,
            customer_id,
            customers (
              full_name
            )
          )
        `
        )
        .eq("user_id", currentUserId)
        .order("payment_date", { ascending: false }),

      supabase
        .from("vendor_category_memory")
        .select("id, user_id, vendor_name, category")
        .eq("user_id", currentUserId),

      supabase
        .from("expense_categories")
        .select("id, user_id, name")
        .eq("user_id", currentUserId)
        .order("name", { ascending: true }),
    ]);

    if (customersError) {
      setMessage(`Error loading customers: ${customersError.message}`);
      return;
    }

    if (estimatesError) {
      setMessage(`Error loading projects: ${estimatesError.message}`);
      return;
    }

    if (transactionsError) {
      setMessage(`Error loading transactions: ${transactionsError.message}`);
      return;
    }

    if (paymentsError) {
      setMessage(`Error loading payments: ${paymentsError.message}`);
      return;
    }

    if (vendorMemoryError) {
      setMessage(`Error loading vendor memory: ${vendorMemoryError.message}`);
      return;
    }

    if (customCategoriesError) {
      setMessage(`Error loading categories: ${customCategoriesError.message}`);
      return;
    }

    const safeCustomers = (customersData || []) as Customer[];
    const safeEstimates = (estimatesData || []) as Estimate[];
    const safeTransactions = (transactionsData || []) as PlaidTransaction[];
   const safePayments = (paymentsData || []).map((payment: any) => ({
  id: payment.id,
  user_id: payment.user_id,
  invoice_id: payment.invoice_id,
  amount: payment.amount,
  payment_date: payment.payment_date,
  payment_method: payment.payment_method,
  notes: payment.notes,
  match_status: payment.match_status,
  plaid_transaction_id: payment.plaid_transaction_id,
  invoices: Array.isArray(payment.invoices)
    ? payment.invoices[0] || null
    : payment.invoices || null,
})) as Payment[];
    const safeVendorMemory = (vendorMemoryData || []) as VendorMemory[];
    const safeCustomCategories =
      (customCategoriesData || []) as ExpenseCategory[];

    setCustomers(safeCustomers);
    setEstimates(safeEstimates);
    setTransactions(safeTransactions);
    setPayments(safePayments);
    setVendorMemory(safeVendorMemory);

    const memoryCategories = safeVendorMemory.map((item) => item.category);
    const customCategories = safeCustomCategories.map((item) => item.name);

    setCategories(
      dedupeCategories([
        ...DEFAULT_EXPENSE_CATEGORIES,
        ...customCategories,
        ...memoryCategories,
      ])
    );

    setDrafts((current) => {
      const nextDrafts: Record<string, DraftValues> = { ...current };

      safeTransactions.forEach((txn) => {
        if (!nextDrafts[txn.id]) {
          const rememberedCategory = getMemoryCategoryForTransaction(
            txn,
            safeVendorMemory
          );

          nextDrafts[txn.id] = {
            category: rememberedCategory,
            customerId: "",
            estimateId: "",
            notes: "",
            suggestedFromMemory: !!rememberedCategory,
          };
        }
      });

      return nextDrafts;
    });
  }

  const createLinkToken = useCallback(async () => {
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Unable to create Plaid link token.");
        return;
      }

      setLinkToken(data.link_token || "");
    } catch {
      setMessage("Unable to create Plaid link token.");
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(error.message);
        setLoading(false);
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
        await Promise.all([loadPageData(safeUser.id), createLinkToken()]);
      }

      setLoading(false);
    }

    loadUser();
  }, [createLinkToken]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    setTransactions([]);
    setPayments([]);
    setVendorMemory([]);
  }

  const onSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      if (!user) return;

      setMessage("Bank connected. Saving account...");

      const exchangeRes = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, metadata, user_id: user.id }),
      });

      const exchangeData = await exchangeRes.json();

      if (!exchangeRes.ok) {
        setMessage(exchangeData.error || "Unable to save connected bank.");
        return;
      }

      setMessage("Bank saved. Syncing transactions...");

      const syncRes = await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        setMessage(syncData.error || "Bank connected, but sync failed.");
        return;
      }

      setMessage("Bank connected and transactions synced.");
      await loadPageData(user.id);
      await createLinkToken();
    },
    [user, createLinkToken]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) {
        setMessage(
          err.display_message ||
            err.error_message ||
            "Plaid exited with an error."
        );
      }
    },
  });

  async function handleSyncTransactions() {
    if (!user) return;

    setIsSyncing(true);
    try {
      const syncRes = await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        setMessage(syncData.error || "Unable to sync transactions.");
        return;
      }

      setMessage("Transactions synced.");
      await loadPageData(user.id);
    } finally {
      setIsSyncing(false);
    }
  }

  function updateDraft(id: string, patch: Partial<DraftValues>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
        suggestedFromMemory:
          patch.category !== undefined
            ? false
            : current[id]?.suggestedFromMemory || false,
      },
    }));
  }

  function handleEstimateChange(transactionId: string, estimateId: string) {
    const estimate = estimates.find((item) => item.id === estimateId);

    updateDraft(transactionId, {
      estimateId,
      customerId:
        estimate?.customer_id || drafts[transactionId]?.customerId || "",
    });
  }

  async function saveVendorMemory(vendorName: string, categoryValue: string) {
    if (!user) return;

    const normalizedVendor = normalizeVendorName(vendorName);
    const trimmedCategory = categoryValue.trim();

    if (!normalizedVendor || !trimmedCategory) return;

    const { data, error } = await supabase
      .from("vendor_category_memory")
      .upsert(
        {
          user_id: user.id,
          vendor_name: normalizedVendor,
          category: trimmedCategory,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,vendor_name",
        }
      )
      .select();

    if (error) {
      setMessage(`Expense saved, but vendor memory failed: ${error.message}`);
      return;
    }

    setVendorMemory((current) => {
      const existingIndex = current.findIndex(
        (item) => normalizeVendorName(item.vendor_name) === normalizedVendor
      );

      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          category: trimmedCategory,
        };
        return updated;
      }

      return [
        ...current,
        {
          id: data?.[0]?.id || crypto.randomUUID(),
          user_id: user.id,
          vendor_name: normalizedVendor,
          category: trimmedCategory,
        },
      ];
    });
  }

  async function handleMatchToPayment(
    transaction: PlaidTransaction,
    payment: Payment
  ) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    setMatchingId(transaction.id);
    setMessage("Matching bank deposit to invoice payment...");

    try {
      const now = new Date().toISOString();

      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          plaid_transaction_id: transaction.id,
          match_status: "matched",
          matched_at: now,
          matched_by: user.id,
        })
        .eq("id", payment.id)
        .eq("user_id", user.id);

      if (paymentError) {
        setMessage(`Payment match failed: ${paymentError.message}`);
        return;
      }

      const { error: transactionError } = await supabase
        .from("plaid_transactions")
        .update({
          matched_payment_id: payment.id,
          match_status: "matched",
          matched_at: now,
          matched_by: user.id,
          updated_at: now,
        })
        .eq("id", transaction.id)
        .eq("user_id", user.id);

      if (transactionError) {
        setMessage(`Transaction match failed: ${transactionError.message}`);
        return;
      }

      setMessage("Bank deposit matched to invoice payment.");
      await loadPageData(user.id);
    } finally {
      setMatchingId(null);
    }
  }

  async function handleConvertToExpense(transaction: PlaidTransaction) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const draft = drafts[transaction.id];
    if (!draft) return;

    setSavingId(transaction.id);

    try {
      const vendorName = getTransactionVendor(transaction);
      const expenseDate =
        transaction.posted_date || transaction.authorized_date || null;

      const { error: insertError } = await supabase.from("expenses").insert([
        {
          user_id: user.id,
          customer_id: draft.customerId || null,
          estimate_id: draft.estimateId || null,
          vendor: vendorName,
          category: draft.category.trim() || null,
          amount: Math.abs(Number(transaction.amount || 0)),
          expense_date: expenseDate,
          notes: draft.notes.trim() || null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        setMessage(`Error creating expense: ${insertError.message}`);
        return;
      }

      const { error: updateError } = await supabase
        .from("plaid_transactions")
        .update({
          imported_to_expenses: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("user_id", user.id);

      if (updateError) {
        setMessage(
          `Expense saved, but transaction flag failed: ${updateError.message}`
        );
        return;
      }

      await saveVendorMemory(vendorName, draft.category);
      await saveCustomCategory(draft.category);

      setMessage("Transaction added as expense.");
      await loadPageData(user.id);
    } finally {
      setSavingId(null);
    }
  }

  async function handleIgnoreTransaction(transaction: PlaidTransaction) {
    if (!user) return;

    setIgnoringId(transaction.id);

    try {
      const { error } = await supabase
        .from("plaid_transactions")
        .update({
          ignored: true,
          ignored_reason: isDeposit(transaction)
            ? "Not matched to invoice payment"
            : "Not an expense",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("user_id", user.id);

      if (error) {
        setMessage(`Error ignoring transaction: ${error.message}`);
        return;
      }

      setMessage("Transaction ignored.");
      await loadPageData(user.id);
    } finally {
      setIgnoringId(null);
    }
  }

  const pendingImportTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchStatus = txn.match_status || "unmatched";

      return (
        !txn.imported_to_expenses &&
        !txn.ignored &&
        matchStatus !== "matched"
      );
    });
  }, [transactions]);

  const importedTransactions = useMemo(() => {
    return transactions.filter((txn) => txn.imported_to_expenses);
  }, [transactions]);

  const matchedTransactions = useMemo(() => {
    return transactions.filter((txn) => txn.match_status === "matched");
  }, [transactions]);

  const ignoredTransactions = useMemo(() => {
    return transactions.filter((txn) => txn.ignored);
  }, [transactions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-gray-900">Loading transactions...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-gray-900">Banking</h1>
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

      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl bg-gradient-to-r from-white to-gray-50 p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Banking
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Imported Transactions
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Review expenses, ignore personal transactions, and match bank
                deposits to invoice payments.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => open()}
                disabled={!ready || !linkToken}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:bg-gray-400"
              >
                Connect Bank
              </button>

              <button
                type="button"
                onClick={handleSyncTransactions}
                disabled={isSyncing}
                className={`rounded-xl px-4 py-2 text-white ${
                  isSyncing
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSyncing ? "Syncing..." : "Sync Transactions"}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <p>{message}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Ready to Review</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {pendingImportTransactions.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Matched Deposits</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {matchedTransactions.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Imported Expenses</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {importedTransactions.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Ignored</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {ignoredTransactions.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Vendor Memories</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {vendorMemory.length}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Ready to Review
          </h2>

          {pendingImportTransactions.length === 0 ? (
            <p className="text-gray-600">No new bank transactions to review.</p>
          ) : (
            <div className="space-y-6">
              {pendingImportTransactions.map((transaction) => {
                const draft = drafts[transaction.id] || {
                  category: "",
                  customerId: "",
                  estimateId: "",
                  notes: "",
                  suggestedFromMemory: false,
                };

                const possiblePaymentMatch = findMatchingPayment(transaction);

                return (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-gray-200 p-5"
                  >
                    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                      <div>
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-lg font-bold text-gray-900">
                              {getTransactionVendor(transaction)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Posted: {formatDate(transaction.posted_date)}
                            </p>

                            {isDeposit(transaction) ? (
                              <p className="mt-1 text-sm font-semibold text-green-700">
                                Deposit / income transaction
                              </p>
                            ) : null}

                            {draft.suggestedFromMemory && !isDeposit(transaction) && (
                              <p className="mt-1 text-sm font-medium text-green-700">
                                Category suggested from vendor memory
                              </p>
                            )}

                            {transaction.pending ? (
                              <p className="text-sm font-medium text-amber-700">
                                Pending transaction
                              </p>
                            ) : null}
                          </div>

                          <div className="text-left md:text-right">
                            <p
                              className={`text-xl font-bold ${
                                isDeposit(transaction)
                                  ? "text-green-700"
                                  : "text-gray-900"
                              }`}
                            >
                              {formatCurrency(Number(transaction.amount || 0))}
                            </p>
                            <p className="text-sm text-gray-500">
                              Bank category: {transaction.category || "—"}
                            </p>
                          </div>
                        </div>

                        {possiblePaymentMatch && (
                          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                            <p className="text-sm font-bold text-green-900">
                              Possible invoice payment match
                            </p>
                            <p className="mt-1 text-sm text-green-900">
                              {getPaymentLabel(possiblePaymentMatch)}
                            </p>
                            <p className="text-sm text-green-900">
                              Payment date:{" "}
                              {formatDate(possiblePaymentMatch.payment_date)}
                            </p>
                            <p className="text-sm text-green-900">
                              Amount:{" "}
                              {formatCurrency(
                                Number(possiblePaymentMatch.amount || 0)
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {!isDeposit(transaction) ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-900">
                              Category
                            </label>
                            <div className="space-y-2">
                              <select
                                value={draft.category}
                                onChange={(e) =>
                                  updateDraft(transaction.id, {
                                    category: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border p-3 text-gray-900"
                              >
                                <option value="">Select category</option>
                                {categories.map((item) => (
                                  <option key={`category-${item}`} value={item}>
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
                                    onChange={(e) =>
                                      setNewCategory(e.target.value)
                                    }
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
                              Customer
                            </label>
                            <select
                              value={draft.customerId}
                              onChange={(e) =>
                                updateDraft(transaction.id, {
                                  customerId: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border p-3 text-gray-900"
                            >
                              <option value="">No customer</option>
                              {customers.map((customer) => (
                                <option
                                  key={`customer-${customer.id}`}
                                  value={customer.id}
                                >
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
                              value={draft.estimateId}
                              onChange={(e) =>
                                handleEstimateChange(
                                  transaction.id,
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border p-3 text-gray-900"
                            >
                              <option value="">No project</option>
                              {estimates.map((estimate) => (
                                <option
                                  key={`estimate-${estimate.id}`}
                                  value={estimate.id}
                                >
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

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-900">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={(e) =>
                                updateDraft(transaction.id, {
                                  notes: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border p-3 text-gray-900"
                              placeholder="Optional note"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <p className="text-sm font-semibold text-gray-900">
                            This looks like a deposit.
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Match it to an invoice payment to avoid double
                            counting revenue.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => handleIgnoreTransaction(transaction)}
                        disabled={ignoringId === transaction.id}
                        className={`rounded-xl px-4 py-2 text-white ${
                          ignoringId === transaction.id
                            ? "cursor-not-allowed bg-gray-400"
                            : "bg-gray-600 hover:bg-gray-700"
                        }`}
                      >
                        {ignoringId === transaction.id
                          ? "Ignoring..."
                          : isDeposit(transaction)
                          ? "Ignore Deposit"
                          : "Ignore / Not an Expense"}
                      </button>

                      {possiblePaymentMatch && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMatchToPayment(
                              transaction,
                              possiblePaymentMatch
                            )
                          }
                          disabled={matchingId === transaction.id}
                          className={`rounded-xl px-4 py-2 text-white ${
                            matchingId === transaction.id
                              ? "cursor-not-allowed bg-gray-400"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {matchingId === transaction.id
                            ? "Matching..."
                            : "Match to Payment"}
                        </button>
                      )}

                      {!isDeposit(transaction) && (
                        <button
                          type="button"
                          onClick={() => handleConvertToExpense(transaction)}
                          disabled={savingId === transaction.id}
                          className={`rounded-xl px-4 py-2 text-white ${
                            savingId === transaction.id
                              ? "cursor-not-allowed bg-gray-400"
                              : "bg-black hover:bg-gray-800"
                          }`}
                        >
                          {savingId === transaction.id
                            ? "Saving..."
                            : "Add as Expense"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Matched Deposits
          </h2>

          {matchedTransactions.length === 0 ? (
            <p className="text-gray-600">No matched deposits yet.</p>
          ) : (
            <div className="space-y-4">
              {matchedTransactions.slice(0, 20).map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-green-200 bg-green-50 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-green-900">
                        {getTransactionVendor(transaction)}
                      </p>
                      <p className="text-sm text-green-800">
                        Posted: {formatDate(transaction.posted_date)}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="font-semibold text-green-900">
                        {formatCurrency(Number(transaction.amount || 0))}
                      </p>
                      <p className="text-sm text-green-700">
                        Matched to invoice payment
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Already Imported
          </h2>

          {importedTransactions.length === 0 ? (
            <p className="text-gray-600">No imported transactions yet.</p>
          ) : (
            <div className="space-y-4">
              {importedTransactions.slice(0, 20).map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        {getTransactionVendor(transaction)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Posted: {formatDate(transaction.posted_date)}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(Number(transaction.amount || 0))}
                      </p>
                      <p className="text-sm text-green-700">
                        Imported to expenses
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Ignored / Not Expenses
          </h2>

          {ignoredTransactions.length === 0 ? (
            <p className="text-gray-600">No ignored transactions yet.</p>
          ) : (
            <div className="space-y-4">
              {ignoredTransactions.slice(0, 20).map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        {getTransactionVendor(transaction)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Posted: {formatDate(transaction.posted_date)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Reason: {transaction.ignored_reason || "Ignored"}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(Number(transaction.amount || 0))}
                      </p>
                      <p className="text-sm text-gray-500">Ignored</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
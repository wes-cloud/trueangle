"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  amount: number | null;
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
  updated_at: string | null;
};

type Payment = {
  id: string;
  user_id: string | null;
  invoice_id: string | null;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function buildInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `INV-${y}${m}${d}-${rand}`;
}

function formatStatus(status: string | null) {
  switch (status) {
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "overdue":
      return "Overdue";
    case "draft":
    default:
      return "Draft";
  }
}

function getStatusClass(status: string | null) {
  switch (status) {
    case "sent":
      return "bg-yellow-100 text-yellow-900 ring-yellow-200";
    case "paid":
      return "bg-green-100 text-green-900 ring-green-200";
    case "partial":
      return "bg-blue-100 text-blue-900 ring-blue-200";
    case "overdue":
      return "bg-red-100 text-red-900 ring-red-200";
    default:
      return "bg-gray-100 text-gray-800 ring-gray-200";
  }
}

function isPastDue(invoice: Invoice) {
  if (!invoice.due_date || invoice.status === "paid") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(invoice.due_date);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

export default function InvoicesPage() {
  const searchParams = useSearchParams();

  const initialEstimateId = searchParams.get("estimate_id") || "";
  const initialCustomerId = searchParams.get("customer_id") || "";
  const initialInvoiceId = searchParams.get("invoice_id") || "";

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [invoiceNumber, setInvoiceNumber] = useState(buildInvoiceNumber());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("draft");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const currentPrintId = editingId || initialInvoiceId || null;

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
      .select("id, customer_id, customer_name, job_name, estimate_number, amount")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading estimates: ${error.message}`);
      return;
    }

    setEstimates((data || []) as Estimate[]);
  }

  async function fetchInvoices(currentUserId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, user_id, customer_id, estimate_id, invoice_number, title, description, amount, status, issue_date, due_date, notes, created_at, updated_at"
      )
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading invoices: ${error.message}`);
      return;
    }

    setInvoices((data || []) as Invoice[]);
  }

  async function fetchPayments(currentUserId: string) {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, user_id, invoice_id, amount, payment_date, payment_method, notes, created_at, updated_at"
      )
      .eq("user_id", currentUserId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading payments: ${error.message}`);
      return;
    }

    setPayments((data || []) as Payment[]);
  }

  async function loadPageData(currentUserId: string) {
    setMessage("");
    await Promise.all([
      fetchCustomers(currentUserId),
      fetchEstimates(currentUserId),
      fetchInvoices(currentUserId),
      fetchPayments(currentUserId),
    ]);
  }

  function resetPaymentForm() {
    setPaymentAmount("");
    setPaymentDate("");
    setPaymentMethod("");
    setPaymentNotes("");
  }

  function resetForm() {
    setInvoiceNumber(buildInvoiceNumber());
    setTitle("");
    setDescription("");
    setAmount("");
    setStatus("draft");
    setIssueDate("");
    setDueDate("");
    setNotes("");
    setEditingId(null);
    setSelectedEstimateId(initialEstimateId || "");
    setSelectedCustomerId(initialCustomerId || "");
    resetPaymentForm();
  }

  function loadInvoiceIntoForm(invoice: Invoice) {
    setInvoiceNumber(invoice.invoice_number || buildInvoiceNumber());
    setTitle(invoice.title || "");
    setDescription(invoice.description || "");
    setAmount(String(invoice.amount ?? ""));
    setStatus(invoice.status || "draft");
    setIssueDate(invoice.issue_date || "");
    setDueDate(invoice.due_date || "");
    setNotes(invoice.notes || "");
    setSelectedCustomerId(invoice.customer_id || "");
    setSelectedEstimateId(invoice.estimate_id || "");
    setEditingId(invoice.id);
  }

  function getInvoicePayments(invoiceId: string) {
    return payments.filter((payment) => payment.invoice_id === invoiceId);
  }

  function getInvoicePaidTotal(invoiceId: string) {
    return getInvoicePayments(invoiceId).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }

  function getInvoiceBalance(invoice: Invoice) {
    return Math.max(
      Number(invoice.amount || 0) - getInvoicePaidTotal(invoice.id),
      0
    );
  }

  function handleEstimateChange(nextEstimateId: string) {
    setSelectedEstimateId(nextEstimateId);

    if (!nextEstimateId) return;

    const selectedEstimate = estimates.find((item) => item.id === nextEstimateId);
    if (!selectedEstimate) return;

    if (selectedEstimate.customer_id) {
      setSelectedCustomerId(selectedEstimate.customer_id);
    }

    if (!title && selectedEstimate.job_name) {
      setTitle(selectedEstimate.job_name);
    }

    if (!amount && selectedEstimate.amount) {
      setAmount(String(selectedEstimate.amount));
    }
  }

  function handleEdit(invoice: Invoice) {
    loadInvoiceIntoForm(invoice);
    setMessage("Editing invoice...");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteInvoice(id: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error deleting invoice: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Invoice deleted.");
    await loadPageData(user.id);
  }

  async function handleSaveInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!invoiceNumber.trim()) {
      setMessage("Invoice number is required.");
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
      invoice_number: invoiceNumber.trim(),
      title: title.trim() || null,
      description: description.trim() || null,
      amount: Number(amount),
      status: status || "draft",
      issue_date: issueDate || null,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      setMessage("Updating invoice...");

      const { error } = await supabase
        .from("invoices")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        setMessage(`Error updating invoice: ${error.message}`);
        return;
      }

      setMessage("Invoice updated.");
      await loadPageData(user.id);
      return;
    }

    setMessage("Saving invoice...");

    const { error } = await supabase.from("invoices").insert([
      {
        ...payload,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage(`Error saving invoice: ${error.message}`);
      return;
    }

    setMessage("Invoice saved.");
    resetForm();
    await loadPageData(user.id);
  }

  async function setInvoiceStatus(invoiceId: string, nextStatus: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const updatePayload: Record<string, string | null> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "sent") {
      updatePayload.issue_date = new Date().toISOString().slice(0, 10);
    }

    const { error } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error updating invoice status: ${error.message}`);
      return;
    }

    if (editingId === invoiceId) {
      setStatus(nextStatus);
    }

    setMessage(`Invoice marked ${formatStatus(nextStatus)}.`);
    await loadPageData(user.id);
  }

  async function markInvoicePaid(invoice: Invoice) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const balance = getInvoiceBalance(invoice);

    if (balance > 0) {
      const { error: paymentError } = await supabase.from("payments").insert([
        {
          user_id: user.id,
          invoice_id: invoice.id,
          amount: balance,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: "Manual",
          notes: "Marked paid from invoice page.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (paymentError) {
        setMessage(`Error recording payment: ${paymentError.message}`);
        return;
      }
    }

    await setInvoiceStatus(invoice.id, "paid");
  }

  async function updateInvoicePaymentStatus(invoiceId: string) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;

    const totalPaid = getInvoicePaidTotal(invoiceId);
    const invoiceAmount = Number(invoice.amount || 0);

    let nextStatus = "sent";

    if (totalPaid <= 0) {
      nextStatus = invoice.status === "draft" ? "draft" : "sent";
    } else if (totalPaid < invoiceAmount) {
      nextStatus = "partial";
    } else {
      nextStatus = "paid";
    }

    await supabase
      .from("invoices")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
  }

  async function handleAddPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!editingId) {
      setMessage("Open or save an invoice before adding a payment.");
      return;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setMessage("Payment amount must be greater than 0.");
      return;
    }

    setMessage("Saving payment...");

    const { error } = await supabase.from("payments").insert([
      {
        user_id: user.id,
        invoice_id: editingId,
        amount: Number(paymentAmount),
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        payment_method: paymentMethod.trim() || null,
        notes: paymentNotes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage(`Error saving payment: ${error.message}`);
      return;
    }

    resetPaymentForm();
    await loadPageData(user.id);
    await updateInvoicePaymentStatus(editingId);
    await loadPageData(user.id);
    setMessage("Payment added.");
  }

  async function handleDeletePayment(paymentId: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const payment = payments.find((item) => item.id === paymentId);

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error deleting payment: ${error.message}`);
      return;
    }

    await loadPageData(user.id);

    if (payment?.invoice_id) {
      await updateInvoicePaymentStatus(payment.invoice_id);
      await loadPageData(user.id);
    }

    setMessage("Payment deleted.");
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
    setInvoices([]);
    setPayments([]);
    setMessage("Signed out.");
  }

  const selectedEstimateLabel = useMemo(() => {
    if (!selectedEstimateId) return "";
    const match = estimates.find((item) => item.id === selectedEstimateId);
    if (!match) return "";
    return match.job_name || match.estimate_number || "Selected Project";
  }, [selectedEstimateId, estimates]);

  const currentInvoicePayments = useMemo(() => {
    if (!editingId) return [];
    return payments.filter((item) => item.invoice_id === editingId);
  }, [editingId, payments]);

  const currentInvoiceTotalPaid = useMemo(() => {
    return currentInvoicePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }, [currentInvoicePayments]);

  const currentInvoiceAmount = Number(amount || 0);
  const currentBalanceDue = Math.max(
    currentInvoiceAmount - currentInvoiceTotalPaid,
    0
  );

  const invoiceStats = useMemo(() => {
    const totalInvoiced = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0
    );

    const totalPaid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    const outstanding = invoices.reduce((sum, invoice) => {
      return sum + getInvoiceBalance(invoice);
    }, 0);

    const overdue = invoices.reduce((sum, invoice) => {
      if (!isPastDue(invoice)) return sum;
      return sum + getInvoiceBalance(invoice);
    }, 0);

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      overdue,
    };
  }, [invoices, payments]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(error.message);
        setAuthLoading(false);
        return;
      }

      const safeUser = user
        ? {
            id: user.id,
            email: user.email ?? null,
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
        setInvoices([]);
        setPayments([]);
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialEstimateId && !initialCustomerId) return;

    if (initialEstimateId) {
      setSelectedEstimateId(initialEstimateId);
    }

    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialEstimateId, initialCustomerId]);

  useEffect(() => {
    if (!selectedEstimateId) return;

    const selectedEstimate = estimates.find((item) => item.id === selectedEstimateId);
    if (!selectedEstimate) return;

    if (!selectedCustomerId && selectedEstimate.customer_id) {
      setSelectedCustomerId(selectedEstimate.customer_id);
    }

    if (!title && selectedEstimate.job_name) {
      setTitle(selectedEstimate.job_name);
    }

    if (!amount && selectedEstimate.amount) {
      setAmount(String(selectedEstimate.amount));
    }
  }, [selectedEstimateId, selectedCustomerId, title, amount, estimates]);

  useEffect(() => {
    if (!initialInvoiceId) return;
    if (invoices.length === 0) return;

    const existingInvoice = invoices.find((item) => item.id === initialInvoiceId);
    if (!existingInvoice) return;

    loadInvoiceIntoForm(existingInvoice);
    setMessage("Opened invoice.");
  }, [initialInvoiceId, invoices]);

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
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
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
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Money
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Invoices
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Track what has been billed, what has been paid, and what still
                needs to be collected.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Signed in as {user.email || "User"}
              </p>

              {selectedEstimateLabel && (
                <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                  {editingId
                    ? `Editing invoice for: ${selectedEstimateLabel}`
                    : `Creating invoice for: ${selectedEstimateLabel}`}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl bg-black px-4 py-2 font-semibold text-white"
            >
              New Invoice
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <StatCard label="Total Invoiced" value={formatCurrency(invoiceStats.totalInvoiced)} />
            <StatCard label="Paid" value={formatCurrency(invoiceStats.totalPaid)} />
            <StatCard label="Outstanding" value={formatCurrency(invoiceStats.outstanding)} />
            <StatCard label="Overdue" value={formatCurrency(invoiceStats.overdue)} danger={invoiceStats.overdue > 0} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? "Edit Invoice" : "Create Invoice"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Draft it, send it, then record payments as they come in.
              </p>
            </div>

            <div className="flex gap-2">
              {currentPrintId && (
                <a
                  href={`/invoices/${currentPrintId}/print`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-black px-4 py-2 text-white"
                >
                  Print
                </a>
              )}

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-gray-900"
                >
                  Switch to New
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveInvoice} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Invoice Number">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  required
                />
              </Field>

              <Field label="Issue Date">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </Field>

              <Field label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Customer">
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
              </Field>

              <Field label="Project / Estimate">
                <select
                  value={selectedEstimateId}
                  onChange={(e) => handleEstimateChange(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                >
                  <option value="">No project</option>
                  {estimates.map((estimate) => (
                    <option key={estimate.id} value={estimate.id}>
                      {estimate.job_name || "Untitled Job"}
                      {estimate.customer_name ? ` - ${estimate.customer_name}` : ""}
                      {estimate.estimate_number ? ` (${estimate.estimate_number})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Field label="Title">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bathroom Remodel Invoice"
                    className="w-full rounded-lg border p-3 text-gray-900"
                  />
                </Field>
              </div>

              <Field label="Amount">
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border p-3 text-gray-900"
                  required
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Invoice description"
                className="min-h-[100px] w-full rounded-lg border p-3 text-gray-900"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[52px] w-full rounded-lg border p-3 text-gray-900"
                  placeholder="Optional notes"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-xl bg-black px-4 py-2 text-white">
                {editingId ? "Update Invoice" : "Save Invoice"}
              </button>

              {editingId && (
                <>
                  <button
                    type="button"
                    onClick={() => setInvoiceStatus(editingId, "sent")}
                    className="rounded-xl bg-yellow-600 px-4 py-2 text-white"
                  >
                    Mark Sent
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const invoice = invoices.find((item) => item.id === editingId);
                      if (invoice) markInvoicePaid(invoice);
                    }}
                    className="rounded-xl bg-green-600 px-4 py-2 text-white"
                  >
                    Mark Paid
                  </button>
                </>
              )}
            </div>

            {message && <p className="text-gray-900">{message}</p>}
          </form>
        </section>

        {editingId && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard label="Invoice Total" value={formatCurrency(currentInvoiceAmount)} />
              <StatCard label="Total Paid" value={formatCurrency(currentInvoiceTotalPaid)} />
              <StatCard label="Balance Due" value={formatCurrency(currentBalanceDue)} danger={currentBalanceDue > 0} />
            </section>

            <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                Add Payment
              </h2>

              <form onSubmit={handleAddPayment} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Amount">
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full rounded-lg border p-3 text-gray-900"
                      placeholder="0.00"
                      required
                    />
                  </Field>

                  <Field label="Payment Date">
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full rounded-lg border p-3 text-gray-900"
                    />
                  </Field>

                  <Field label="Method">
                    <input
                      type="text"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-lg border p-3 text-gray-900"
                      placeholder="Cash, Check, Card, ACH"
                    />
                  </Field>

                  <Field label="Notes">
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full rounded-lg border p-3 text-gray-900"
                      placeholder="Optional"
                    />
                  </Field>
                </div>

                <button className="rounded-xl bg-green-600 px-4 py-2 text-white">
                  Add Payment
                </button>
              </form>
            </section>

            <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                Payment History
              </h2>

              {currentInvoicePayments.length === 0 ? (
                <p className="text-gray-600">No payments recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {currentInvoicePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(Number(payment.amount || 0))}
                          </p>
                          <p className="text-sm text-gray-700">
                            Date: {formatDate(payment.payment_date)}
                          </p>
                          <p className="text-sm text-gray-700">
                            Method: {payment.payment_method || "—"}
                          </p>
                          {payment.notes && (
                            <p className="mt-2 text-sm text-gray-700">
                              {payment.notes}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeletePayment(payment.id)}
                          className="rounded-xl bg-red-600 px-3 py-1 text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Saved Invoices
          </h2>

          {invoices.length === 0 ? (
            <p className="text-gray-600">No invoices yet.</p>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => {
                const linkedEstimate = estimates.find(
                  (estimate) => estimate.id === invoice.estimate_id
                );
                const linkedCustomer = customers.find(
                  (customer) => customer.id === invoice.customer_id
                );
                const paidTotal = getInvoicePaidTotal(invoice.id);
                const balance = getInvoiceBalance(invoice);
                const displayStatus =
                  isPastDue(invoice) && balance > 0 ? "overdue" : invoice.status;

                return (
                  <div
                    key={invoice.id}
                    className="rounded-2xl border border-gray-200 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold text-gray-900">
                            {invoice.invoice_number || "No Invoice Number"}
                          </p>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClass(
                              displayStatus
                            )}`}
                          >
                            {formatStatus(displayStatus)}
                          </span>

                          {invoice.estimate_id && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100">
                              From Estimate
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-gray-700">
                          {invoice.title || linkedEstimate?.job_name || "No title"}
                        </p>

                        <p className="mt-2 text-sm text-gray-700">
                          Customer: {linkedCustomer?.full_name || "—"}
                        </p>

                        <p className="text-sm text-gray-700">
                          Project: {linkedEstimate?.job_name || "—"}
                        </p>

                        <p className="mt-2 text-sm text-gray-700">
                          Issue Date: {formatDate(invoice.issue_date)}
                        </p>

                        <p className="text-sm text-gray-700">
                          Due Date: {formatDate(invoice.due_date)}
                        </p>

                        {invoice.notes && (
                          <p className="mt-2 text-sm text-gray-700">
                            {invoice.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(Number(invoice.amount || 0))}
                        </p>
                        <p className="text-sm text-gray-600">
                          Paid: {formatCurrency(paidTotal)}
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            balance > 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          Balance: {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(invoice)}
                        className="rounded-xl bg-blue-600 px-3 py-1 text-white"
                      >
                        Edit
                      </button>

                      <a
                        href={`/invoices/${invoice.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-black px-3 py-1 text-white"
                      >
                        Print
                      </a>

                      {invoice.status !== "sent" && invoice.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => setInvoiceStatus(invoice.id, "sent")}
                          className="rounded-xl bg-yellow-600 px-3 py-1 text-white"
                        >
                          Mark Sent
                        </button>
                      )}

                      {invoice.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => markInvoicePaid(invoice)}
                          className="rounded-xl bg-green-600 px-3 py-1 text-white"
                        >
                          Mark Paid
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(invoice.id)}
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
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ring-1 ${
        danger ? "bg-red-50 ring-red-200" : "bg-white ring-gray-200"
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-900">
        {label}
      </label>
      {children}
    </div>
  );
}
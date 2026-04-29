"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

const laborRates = {
  Demo: { rate: 80, unit: "per hour" },
  Framing: { rate: 30, unit: "per linear foot" },
  "Finish Carpentry": { rate: 95, unit: "per hour" },
  Electrical: { rate: 110, unit: "per hour" },
  Plumbing: { rate: 105, unit: "per hour" },
  Painting: { rate: 3.25, unit: "per sq ft" },
  Materials: { rate: 0, unit: "flat amount" },
};

const companyInfo = {
  name: "WW Contracting",
  phone: "(360) 777-6674",
  email: "wes@weswhitecontracting.com",
  address: "Mount Vernon, WA",
};

type LaborType = keyof typeof laborRates;

type AuthUser = {
  id: string;
  email?: string | null;
};

type LineItem = {
  id: string;
  estimate_id: string;
  type: string;
  quantity: number;
  rate: number;
};

type Customer = {
  id: string;
  user_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
};

type Expense = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  estimate_id?: string | null;
  vendor: string;
  description?: string | null;
  category?: string | null;
  amount: number;
  expense_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Estimate = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  job_name: string;
  project_description?: string | null;
  notes?: string | null;
  exclusions?: string | null;
  valid_until?: string | null;
  estimate_number?: string | null;
  amount: number;
  markup_percent?: number | null;
  created_at: string;
  line_items: LineItem[];
};

type DraftLineItem = {
  id: number;
  type: LaborType;
  quantity: string;
  rate: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEstimateNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `EST-${y}${m}${d}-${rand}`;
}

function getLineItemsTotal(items: { quantity: number; rate: number }[]) {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.rate),
    0
  );
}

function getEstimateExpenseTotal(expenses: Expense[], estimateId: string) {
  return expenses
    .filter((expense) => expense.estimate_id === estimateId)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function generateEstimateHtml(estimate: Estimate) {
  const subtotal = getLineItemsTotal(estimate.line_items);
  const markupPercent = Number(estimate.markup_percent ?? 0);
  const markupAmount = subtotal * (markupPercent / 100);
  const total = subtotal + markupAmount;

  const lineItemsHtml = estimate.line_items
    .map((item) => {
      const lineTotal = Number(item.quantity) * Number(item.rate);
      return `
        <tr>
          <td>${escapeHtml(item.type)}</td>
          <td style="text-align:right;">${item.quantity}</td>
          <td style="text-align:right;">${formatCurrency(Number(item.rate))}</td>
          <td style="text-align:right;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(estimate.estimate_number || "Estimate")}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 32px;
            background: #ffffff;
          }
          .page {
            max-width: 850px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 32px;
          }
          .title {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px;
          }
          .subtitle {
            font-size: 14px;
            color: #4b5563;
            margin: 0;
          }
          .section {
            margin-bottom: 24px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
          }
          .label {
            font-size: 12px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 8px;
          }
          h3 {
            margin: 0 0 10px;
            font-size: 18px;
          }
          p {
            margin: 4px 0;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th, td {
            padding: 12px 10px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
          }
          th {
            text-align: left;
            background: #f9fafb;
            font-size: 13px;
          }
          .totals {
            width: 320px;
            margin-left: auto;
            margin-top: 20px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .totals-row.total {
            border-top: 2px solid #111827;
            font-weight: 700;
            font-size: 18px;
            margin-top: 6px;
            padding-top: 12px;
          }
          .signature {
            margin-top: 48px;
          }
          .signature-line {
            margin-top: 40px;
            border-top: 1px solid #111827;
            width: 320px;
            padding-top: 8px;
          }
          @media print {
            body {
              padding: 0.5in;
            }
            .page {
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(companyInfo.name)}</h1>
              <p class="subtitle">${escapeHtml(companyInfo.address)}</p>
              <p class="subtitle">${escapeHtml(companyInfo.phone)} • ${escapeHtml(companyInfo.email)}</p>
            </div>
            <div class="card" style="min-width: 260px;">
              <div class="label">Estimate</div>
              <p><strong>Estimate #:</strong> ${escapeHtml(estimate.estimate_number || "")}</p>
              <p><strong>Date:</strong> ${formatDate(estimate.created_at)}</p>
              <p><strong>Valid Until:</strong> ${formatDate(estimate.valid_until)}</p>
            </div>
          </div>

          <div class="grid section">
            <div class="card">
              <div class="label">Customer</div>
              <p><strong>${escapeHtml(estimate.customer_name)}</strong></p>
              ${estimate.customer_address ? `<p>${escapeHtml(estimate.customer_address)}</p>` : ""}
              ${estimate.customer_phone ? `<p>${escapeHtml(estimate.customer_phone)}</p>` : ""}
              ${estimate.customer_email ? `<p>${escapeHtml(estimate.customer_email)}</p>` : ""}
            </div>

            <div class="card">
              <div class="label">Project</div>
              <p><strong>${escapeHtml(estimate.job_name)}</strong></p>
              ${estimate.project_description ? `<p>${escapeHtml(estimate.project_description)}</p>` : ""}
            </div>
          </div>

          <div class="section">
            <h3>Line Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">Rate</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${formatCurrency(subtotal)}</span>
              </div>
              <div class="totals-row">
                <span>Markup (${markupPercent}%)</span>
                <span>${formatCurrency(markupAmount)}</span>
              </div>
              <div class="totals-row total">
                <span>Total</span>
                <span>${formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          ${
            estimate.notes
              ? `
                <div class="section card">
                  <div class="label">Notes</div>
                  <p>${escapeHtml(estimate.notes)}</p>
                </div>
              `
              : ""
          }

          ${
            estimate.exclusions
              ? `
                <div class="section card">
                  <div class="label">Exclusions</div>
                  <p>${escapeHtml(estimate.exclusions)}</p>
                </div>
              `
              : ""
          }

          <div class="signature">
            <div class="label">Acceptance</div>
            <p>By signing below, the customer accepts this estimate and authorizes work to proceed according to the terms outlined above.</p>

            <div style="display:flex; gap:48px; flex-wrap:wrap; margin-top:20px;">
              <div>
                <div class="signature-line">Customer Signature</div>
              </div>
              <div>
                <div class="signature-line">Date</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export default function EstimatesNewPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(true);

  const [customer, setCustomer] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [job, setJob] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [estimateNumber, setEstimateNumber] = useState(buildEstimateNumber());
  const [markupPercent, setMarkupPercent] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    {
      id: 1,
      type: "Framing",
      quantity: "",
      rate: laborRates.Framing.rate.toString(),
    },
  ]);

  function resetForm() {
    setSelectedCustomerId("");
    setIsNewCustomer(true);
    setCustomer("");
    setCustomerAddress("");
    setCustomerEmail("");
    setCustomerPhone("");
    setJob("");
    setProjectDescription("");
    setNotes("");
    setExclusions("");
    setValidUntil("");
    setEstimateNumber(buildEstimateNumber());
    setMarkupPercent("0");
    setEditingId(null);
    setLineItems([
      {
        id: 1,
        type: "Framing",
        quantity: "",
        rate: laborRates.Framing.rate.toString(),
      },
    ]);
  }

  function clearAppState() {
    setCustomers([]);
    setExpenses([]);
    setEstimates([]);
    setMessage("");
    resetForm();
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "Framing",
        quantity: "",
        rate: laborRates.Framing.rate.toString(),
      },
    ]);
  }

  function updateLineItem(
    id: number,
    field: keyof DraftLineItem,
    value: string
  ) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (field === "type") {
          const selectedType = value as LaborType;
          return {
            ...item,
            type: selectedType,
            rate:
              selectedType === "Materials"
                ? item.rate
                : laborRates[selectedType].rate.toString(),
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function removeLineItem(id: number) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSelectCustomer(customerId: string) {
    setSelectedCustomerId(customerId);

    if (!customerId) {
      setIsNewCustomer(true);
      setCustomer("");
      setCustomerAddress("");
      setCustomerEmail("");
      setCustomerPhone("");
      return;
    }

    const selected = customers.find((c) => c.id === customerId);
    if (!selected) return;

    setIsNewCustomer(false);
    setCustomer(selected.full_name || "");
    setCustomerAddress(selected.address || "");
    setCustomerEmail(selected.email || "");
    setCustomerPhone(selected.phone || "");
  }

  const costTotal = lineItems.reduce((total, item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    return total + quantity * rate;
  }, 0);

  const markupAmount = costTotal * (Number(markupPercent || 0) / 100);
  const sellingPrice = costTotal + markupAmount;

  async function fetchCustomers(currentUserId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", currentUserId)
      .order("full_name", { ascending: true });

    if (error) {
      setMessage(`Error loading customers: ${error.message}`);
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function fetchEstimates(currentUserId: string) {
    const { data: estimatesData, error: estimatesError } = await supabase
      .from("estimates")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (estimatesError) {
      setMessage(`Error loading estimates: ${estimatesError.message}`);
      return;
    }

    const { data: lineItemsData, error: lineItemsError } = await supabase
      .from("line_items")
      .select("*");

    if (lineItemsError) {
      setMessage(`Error loading line items: ${lineItemsError.message}`);
      return;
    }

    const combinedEstimates: Estimate[] = (estimatesData || []).map(
      (estimate) => ({
        ...estimate,
        line_items: (lineItemsData || []).filter(
          (item) => item.estimate_id === estimate.id
        ),
      })
    );

    setEstimates(combinedEstimates);
  }

  async function fetchExpenses(currentUserId: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading expenses: ${error.message}`);
      return;
    }

    setExpenses((data || []) as Expense[]);
  }

  async function loadAppData(currentUserId: string) {
    await Promise.all([
      fetchCustomers(currentUserId),
      fetchEstimates(currentUserId),
      fetchExpenses(currentUserId),
    ]);
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setAuthMessage(error.message);
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
        await loadAppData(safeUser.id);
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
        await loadAppData(nextUser.id);
      } else {
        clearAppState();
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignUp() {
    setAuthMessage("Creating account...");

    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthMessage(`Sign up error: ${error.message}`);
      return;
    }

    setAuthMessage(
      "Account created. Check your email if confirmation is enabled."
    );
  }

  async function handleSignIn() {
    setAuthMessage("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthMessage(`Sign in error: ${error.message}`);
      return;
    }

    setAuthMessage("Signed in successfully!");
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    clearAppState();
    setAuthEmail("");
    setAuthPassword("");
    setAuthMessage("Signed out.");
  }

  async function getOrCreateCustomerId() {
    if (!user) {
      throw new Error("You must be signed in.");
    }

    if (!isNewCustomer && selectedCustomerId) {
      return selectedCustomerId;
    }

    if (!customer.trim()) {
      return null;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          user_id: user.id,
          full_name: customer.trim(),
          email: customerEmail.trim() || null,
          phone: customerPhone.trim() || null,
          address: customerAddress.trim() || null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    setCustomers((prev) =>
      [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name))
    );
    setSelectedCustomerId(data.id);
    setIsNewCustomer(false);

    return data.id;
  }

  async function handleSaveEstimate(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    setMessage(editingId ? "Updating estimate..." : "Saving estimate...");

    let customerId: string | null = null;

    try {
      customerId = await getOrCreateCustomerId();
    } catch (err) {
      setMessage(
        `Error saving customer: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      return;
    }

    const estimatePayload = {
      user_id: user.id,
      customer_id: customerId,
      customer_name: customer,
      customer_address: customerAddress,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      job_name: job,
      project_description: projectDescription,
      notes,
      exclusions,
      valid_until: validUntil || null,
      estimate_number: estimateNumber,
      amount: sellingPrice,
      markup_percent: Number(markupPercent),
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("estimates")
        .update(estimatePayload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (updateError) {
        setMessage(`Error updating estimate: ${updateError.message}`);
        return;
      }

      const { error: deleteOldItemsError } = await supabase
        .from("line_items")
        .delete()
        .eq("estimate_id", editingId);

      if (deleteOldItemsError) {
        setMessage(
          `Estimate updated, but old line items could not be removed: ${deleteOldItemsError.message}`
        );
        return;
      }

      const itemsToInsert = lineItems.map((item) => ({
        estimate_id: editingId,
        type: item.type,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      }));

      const { error: insertNewItemsError } = await supabase
        .from("line_items")
        .insert(itemsToInsert);

      if (insertNewItemsError) {
        setMessage(
          `Estimate updated, but new line items could not be saved: ${insertNewItemsError.message}`
        );
        return;
      }

      setMessage("Estimate updated successfully!");
      resetForm();
      await loadAppData(user.id);
      return;
    }

    const { data: estimateData, error: estimateError } = await supabase
      .from("estimates")
      .insert([estimatePayload])
      .select()
      .single();

    if (estimateError || !estimateData) {
      setMessage(
        `Error saving estimate: ${estimateError?.message || "Unknown error"}`
      );
      return;
    }

    const itemsToInsert = lineItems.map((item) => ({
      estimate_id: estimateData.id,
      type: item.type,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
    }));

    const { error: itemsError } = await supabase
      .from("line_items")
      .insert(itemsToInsert);

    if (itemsError) {
      setMessage(
        `Estimate saved, but error saving line items: ${itemsError.message}`
      );
      return;
    }

    setMessage("Estimate saved successfully!");
    resetForm();
    await loadAppData(user.id);
  }

  function handleEdit(estimate: Estimate) {
    setCustomer(estimate.customer_name);
    setCustomerAddress(estimate.customer_address || "");
    setCustomerEmail(estimate.customer_email || "");
    setCustomerPhone(estimate.customer_phone || "");
    setJob(estimate.job_name);
    setProjectDescription(estimate.project_description || "");
    setNotes(estimate.notes || "");
    setExclusions(estimate.exclusions || "");
    setValidUntil(estimate.valid_until || "");
    setEstimateNumber(estimate.estimate_number || buildEstimateNumber());
    setMarkupPercent(String(estimate.markup_percent ?? 0));
    setEditingId(estimate.id);
    setSelectedCustomerId(estimate.customer_id || "");
    setIsNewCustomer(!estimate.customer_id);

    const mappedLineItems: DraftLineItem[] = estimate.line_items.map((item) => ({
      id: Date.now() + Math.floor(Math.random() * 10000),
      type: item.type as LaborType,
      quantity: String(item.quantity),
      rate: String(item.rate),
    }));

    setLineItems(
      mappedLineItems.length > 0
        ? mappedLineItems
        : [
            {
              id: 1,
              type: "Framing",
              quantity: "",
              rate: laborRates.Framing.rate.toString(),
            },
          ]
    );

    setMessage("Editing estimate...");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteEstimate(id: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const { error: lineItemsDeleteError } = await supabase
      .from("line_items")
      .delete()
      .eq("estimate_id", id);

    if (lineItemsDeleteError) {
      setMessage(`Error deleting line items: ${lineItemsDeleteError.message}`);
      return;
    }

    const { error: estimateDeleteError } = await supabase
      .from("estimates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (estimateDeleteError) {
      setMessage(`Error deleting estimate: ${estimateDeleteError.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Estimate deleted successfully!");
    await loadAppData(user.id);
  }

  function handleDownloadPdf(estimate: Estimate) {
    const html = generateEstimateHtml(estimate);
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setMessage("Popup blocked. Please allow popups to generate the PDF.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            WW Contracting Login
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Sign in or create an account to manage estimates.
          </p>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-900"
            />

            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-900"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSignIn}
                className="rounded bg-black px-4 py-2 text-white"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={handleSignUp}
                className="rounded bg-blue-600 px-4 py-2 text-white"
              >
                Sign Up
              </button>
            </div>

            {authMessage && (
              <p className="text-sm text-gray-900">{authMessage}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {editingId ? "Edit Estimate" : "Create Estimate"}
              </h1>
              <p className="text-sm text-gray-600">
                Signed in as {user.email || "User"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveEstimate} className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900">
                Customer
              </label>

              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
              >
                <option value="">+ New Customer</option>
                {customers.map((customerOption) => (
                  <option key={customerOption.id} value={customerOption.id}>
                    {customerOption.full_name}
                  </option>
                ))}
              </select>

              {selectedCustomerId && (
                <p className="text-sm text-green-700">
                  Existing customer selected. Contact info auto-filled below.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Customer Name"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
                required
              />

              <input
                type="text"
                placeholder="Estimate Number"
                value={estimateNumber}
                onChange={(e) => setEstimateNumber(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
              />
            </div>

            <input
              type="text"
              placeholder="Customer Address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-900"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="email"
                placeholder="Customer Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
              />

              <input
                type="text"
                placeholder="Customer Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
              />
            </div>

            <input
              type="text"
              placeholder="Job Name"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-900"
              required
            />

            <textarea
              placeholder="Project Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="min-h-[100px] w-full rounded-lg border p-3 text-gray-900"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Markup %
                </label>
                <input
                  type="number"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Line Items</h2>

              {lineItems.map((item, index) => {
                const lineTotal =
                  Number(item.quantity || 0) * Number(item.rate || 0);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Item {index + 1}
                      </h3>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">
                          Type
                        </label>
                        <select
                          value={item.type}
                          onChange={(e) =>
                            updateLineItem(item.id, "type", e.target.value)
                          }
                          className="w-full rounded-lg border p-3 text-gray-900"
                        >
                          {Object.keys(laborRates).map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-sm text-gray-600">
                          {laborRates[item.type].unit}
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, "quantity", e.target.value)
                          }
                          className="w-full rounded-lg border p-3 text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">
                          Rate
                        </label>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateLineItem(item.id, "rate", e.target.value)
                          }
                          className="w-full rounded-lg border p-3 text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">
                          Line Total
                        </label>
                        <div className="rounded-lg border bg-gray-50 p-3 text-gray-900">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addLineItem}
                className="rounded bg-blue-600 px-4 py-2 text-white"
              >
                Add Line Item
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px] w-full rounded-lg border p-3 text-gray-900"
              />

              <textarea
                placeholder="Exclusions"
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                className="min-h-[120px] w-full rounded-lg border p-3 text-gray-900"
              />
            </div>

            <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-gray-900">
              <p>Cost Total: {formatCurrency(costTotal)}</p>
              <p>Markup Amount: {formatCurrency(markupAmount)}</p>
              <p className="text-xl font-bold">
                Selling Price: {formatCurrency(sellingPrice)}
              </p>
            </div>

            <div className="flex gap-3">
              <button className="rounded bg-black px-4 py-2 text-white">
                {editingId ? "Update Estimate" : "Save Estimate"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-gray-300 px-4 py-2 text-gray-900"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {message && <p className="text-gray-900">{message}</p>}
          </form>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Saved Estimates
            </h2>

            <Link
              href="/estimates"
              className="rounded border border-gray-300 px-4 py-2 text-gray-900"
            >
              View All Estimates
            </Link>
          </div>

          {estimates.length === 0 ? (
            <p className="text-gray-900">No estimates yet.</p>
          ) : (
            <div className="space-y-4">
              {estimates.map((estimate) => {
                const subtotal = getLineItemsTotal(estimate.line_items);
                const markup =
                  subtotal * (Number(estimate.markup_percent ?? 0) / 100);
                const expenseTotal = getEstimateExpenseTotal(expenses, estimate.id);
                const estimatedProfit =
                  Number(estimate.amount || 0) - expenseTotal;

                return (
                  <div
                    key={estimate.id}
                    className="rounded-xl border border-gray-200 p-4 text-gray-900"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-bold">{estimate.customer_name}</p>
                        <p>{estimate.job_name}</p>
                        <p className="text-sm text-gray-600">
                          Estimate #: {estimate.estimate_number || "—"}
                        </p>

                        {estimate.valid_until && (
                          <p className="text-sm text-gray-600">
                            Valid Until: {formatDate(estimate.valid_until)}
                          </p>
                        )}

                        {estimate.customer_id && (
                          <p className="text-sm text-gray-600">
                            Linked to customer record
                          </p>
                        )}
                      </div>

                      <div className="text-sm text-gray-600">
                        Created: {formatDate(estimate.created_at)}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Subtotal
                        </p>
                        <p className="font-semibold">{formatCurrency(subtotal)}</p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Markup
                        </p>
                        <p className="font-semibold">
                          {Number(estimate.markup_percent ?? 0)}% (
                          {formatCurrency(markup)})
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Expenses
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(expenseTotal)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Estimated Profit
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(estimatedProfit)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-base font-bold">
                        Selling Price: {formatCurrency(Number(estimate.amount))}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/estimates/${estimate.id}`}
                        className="rounded bg-black px-3 py-1 text-white"
                      >
                        View Project
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleEdit(estimate)}
                        className="rounded bg-blue-600 px-3 py-1 text-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(estimate)}
                        className="rounded bg-green-600 px-3 py-1 text-white"
                      >
                        Download PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEstimate(estimate.id)}
                        className="rounded bg-red-600 px-3 py-1 text-white"
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
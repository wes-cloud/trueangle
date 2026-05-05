"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

const defaultLaborRates: Record<string, { rate: number; unit: string }> = {
  Demo: { rate: 80, unit: "per hour" },
  Framing: { rate: 30, unit: "per linear foot" },
  Electrical: { rate: 110, unit: "per hour" },
  Plumbing: { rate: 105, unit: "per hour" },
  Drywall: { rate: 2.5, unit: "per sq ft" },
  Tile: { rate: 8, unit: "per sq ft" },
  Flooring: { rate: 4.25, unit: "per sq ft" },
  Painting: { rate: 3.25, unit: "per sq ft" },
  Roofing: { rate: 5, unit: "per sq ft" },
  Concrete: { rate: 6, unit: "per sq ft" },
  Excavation: { rate: 100, unit: "per hour" },
  Permits: { rate: 0, unit: "flat amount" },
  "Dump fees": { rate: 0, unit: "flat amount" },
  Subcontractor: { rate: 0, unit: "flat amount" },
  Labor: { rate: 65, unit: "per hour" },
  Materials: { rate: 0, unit: "flat amount" },
  Other: { rate: 0, unit: "flat amount" },
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type LineItemPreset = {
  id: string;
  user_id: string;
  name: string;
  default_rate: number;
  default_unit: string;
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
  mode: "preset" | "custom";
  type: string;
  quantity: string;
  rate: string;
  unit: string;
  saveAsPreset: boolean;
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

function makeDefaultLineItem(): DraftLineItem {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    mode: "preset",
    type: "Framing",
    quantity: "",
    rate: defaultLaborRates.Framing.rate.toString(),
    unit: defaultLaborRates.Framing.unit,
    saveAsPreset: false,
  };
}

export default function EstimatesNewPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [lineItemPresets, setLineItemPresets] = useState<LineItemPreset[]>([]);

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
    makeDefaultLineItem(),
  ]);

  const presetOptions = useMemo(() => {
    const savedOptions = lineItemPresets.reduce<
      Record<string, { rate: number; unit: string }>
    >((acc, preset) => {
      acc[preset.name] = {
        rate: Number(preset.default_rate || 0),
        unit: preset.default_unit || "flat amount",
      };
      return acc;
    }, {});

    return {
      ...defaultLaborRates,
      ...savedOptions,
    };
  }, [lineItemPresets]);

  const costTotal = lineItems.reduce((total, item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    return total + quantity * rate;
  }, 0);

  const markupAmount = costTotal * (Number(markupPercent || 0) / 100);
  const sellingPrice = costTotal + markupAmount;

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
    setLineItems([makeDefaultLineItem()]);
  }

  function clearAppState() {
    setCustomers([]);
    setExpenses([]);
    setEstimates([]);
    setLineItemPresets([]);
    setMessage("");
    resetForm();
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, makeDefaultLineItem()]);
  }

  function updateLineItem(
    id: number,
    field: keyof DraftLineItem,
    value: string | boolean
  ) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function selectPresetLineItem(id: number, presetName: string) {
    const selectedPreset = presetOptions[presetName];

    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              mode: "preset",
              type: presetName,
              rate: selectedPreset ? String(selectedPreset.rate) : item.rate,
              unit: selectedPreset?.unit || "flat amount",
              saveAsPreset: false,
            }
          : item
      )
    );
  }

  function switchToCustomLineItem(id: number) {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              mode: "custom",
              type: "",
              rate: "",
              unit: "flat amount",
              saveAsPreset: true,
            }
          : item
      )
    );
  }

  function updateCustomLineItemName(id: number, customName: string) {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              mode: "custom",
              type: customName,
              saveAsPreset: true,
            }
          : item
      )
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

  async function fetchLineItemPresets(currentUserId: string) {
    const { data, error } = await supabase
      .from("line_item_presets")
      .select("*")
      .eq("user_id", currentUserId)
      .order("name", { ascending: true });

    if (error) {
      setMessage(`Error loading saved line item types: ${error.message}`);
      return;
    }

    setLineItemPresets((data || []) as LineItemPreset[]);
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
      fetchLineItemPresets(currentUserId),
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

  async function saveReusableLineItemTypes(currentUserId: string) {
    const existingNames = new Set(
      lineItemPresets.map((preset) => preset.name.trim().toLowerCase())
    );

    const presetsToInsert = lineItems
      .filter((item) => item.mode === "custom" && item.saveAsPreset)
      .map((item) => ({
        user_id: currentUserId,
        name: item.type.trim(),
        default_rate: Number(item.rate || 0),
        default_unit: item.unit || "flat amount",
        updated_at: new Date().toISOString(),
      }))
      .filter((item) => item.name && !existingNames.has(item.name.toLowerCase()));

    if (presetsToInsert.length === 0) return;

    const { error } = await supabase
      .from("line_item_presets")
      .insert(presetsToInsert);

    if (error) {
      throw new Error(`Estimate saved, but reusable type failed: ${error.message}`);
    }
  }

  async function handleSaveEstimate(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const cleanedLineItems = lineItems
      .map((item) => ({
        type: item.type.trim(),
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
      }))
      .filter((item) => item.type && item.quantity > 0);

    if (cleanedLineItems.length === 0) {
      setMessage("Add at least one line item with a type and quantity.");
      return;
    }

    setSaving(true);
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
      setSaving(false);
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

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimatePayload)
          .eq("id", editingId)
          .eq("user_id", user.id);

        if (updateError) {
          throw new Error(`Error updating estimate: ${updateError.message}`);
        }

        const { error: deleteOldItemsError } = await supabase
          .from("line_items")
          .delete()
          .eq("estimate_id", editingId);

        if (deleteOldItemsError) {
          throw new Error(
            `Estimate updated, but old line items could not be removed: ${deleteOldItemsError.message}`
          );
        }

        const itemsToInsert = cleanedLineItems.map((item) => ({
          estimate_id: editingId,
          type: item.type,
          quantity: item.quantity,
          rate: item.rate,
        }));

        const { error: insertNewItemsError } = await supabase
          .from("line_items")
          .insert(itemsToInsert);

        if (insertNewItemsError) {
          throw new Error(
            `Estimate updated, but new line items could not be saved: ${insertNewItemsError.message}`
          );
        }

        await saveReusableLineItemTypes(user.id);

        setMessage("Estimate updated successfully!");
        resetForm();
        await loadAppData(user.id);
        setSaving(false);
        return;
      }

      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert([estimatePayload])
        .select()
        .single();

      if (estimateError || !estimateData) {
        throw new Error(
          `Error saving estimate: ${estimateError?.message || "Unknown error"}`
        );
      }

      const itemsToInsert = cleanedLineItems.map((item) => ({
        estimate_id: estimateData.id,
        type: item.type,
        quantity: item.quantity,
        rate: item.rate,
      }));

      const { error: itemsError } = await supabase
        .from("line_items")
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(
          `Estimate saved, but error saving line items: ${itemsError.message}`
        );
      }

      await saveReusableLineItemTypes(user.id);

      setMessage("Estimate saved successfully!");
      resetForm();
      await loadAppData(user.id);
      setSaving(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
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

    const mappedLineItems: DraftLineItem[] = estimate.line_items.map((item) => {
      const isSavedPreset = Boolean(presetOptions[item.type]);

      return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        mode: isSavedPreset ? "preset" : "custom",
        type: item.type,
        quantity: String(item.quantity),
        rate: String(item.rate),
        unit: presetOptions[item.type]?.unit || "flat amount",
        saveAsPreset: false,
      };
    });

    setLineItems(
      mappedLineItems.length > 0 ? mappedLineItems : [makeDefaultLineItem()]
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
            TrueAngle Login
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
          <h1 className="text-3xl font-bold text-gray-900">
            {editingId ? "Edit Estimate" : "Create Estimate"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Signed in as {user.email || "User"}
          </p>

          <form onSubmit={handleSaveEstimate} className="mt-6 space-y-6">
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
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Line Items</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Pick a saved type or choose Custom to add your own. Custom types can be saved for future estimates.
                </p>
              </div>

              {lineItems.map((item, index) => {
                const lineTotal =
                  Number(item.quantity || 0) * Number(item.rate || 0);

                const presetNames = Object.keys(presetOptions);

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
                          Work Type
                        </label>

                        <select
                          value={item.mode === "custom" ? "__custom__" : item.type}
                          onChange={(e) => {
                            const nextValue = e.target.value;

                            if (nextValue === "__custom__") {
                              switchToCustomLineItem(item.id);
                              return;
                            }

                            selectPresetLineItem(item.id, nextValue);
                          }}
                          className="w-full rounded-lg border p-3 text-gray-900"
                        >
                          {presetNames.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                          <option value="__custom__">Custom type...</option>
                        </select>

                        {item.mode === "custom" && (
                          <>
                            <input
                              type="text"
                              value={item.type}
                              onChange={(e) =>
                                updateCustomLineItemName(item.id, e.target.value)
                              }
                              placeholder="Example: Tile Shower Pan"
                              className="mt-2 w-full rounded-lg border p-3 text-gray-900"
                            />

                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) =>
                                updateLineItem(item.id, "unit", e.target.value)
                              }
                              placeholder="Unit, e.g. flat amount, per hour, per sq ft"
                              className="mt-2 w-full rounded-lg border p-3 text-gray-900"
                            />

                            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={item.saveAsPreset}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "saveAsPreset",
                                    e.target.checked
                                  )
                                }
                              />
                              Save this type for future estimates
                            </label>
                          </>
                        )}

                        <p className="mt-1 text-sm text-gray-600">
                          {item.unit || "custom"}
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
              <button
                disabled={saving}
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {saving
                  ? editingId
                    ? "Updating..."
                    : "Saving..."
                  : editingId
                    ? "Update Estimate"
                    : "Save Estimate"}
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
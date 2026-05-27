"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Invoice = {
  id: string;
  user_id: string | null;
  amount: number | null;
  invoice_number: string | null;
  title: string | null;
  status: string | null;
};

type Payment = {
  id: string;
  invoice_id: string | null;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
};

type ScheduleItem = {
  id: string;
  user_id: string;
  invoice_id: string;
  label: string;
  amount: number;
  mode: "amount" | "percent";
  percentage: number | null;
  due_date: string | null;
  status: string;
};

type Props = {
  invoice: Invoice;
  payments: Payment[];
  userId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export default function PaymentsModal({
  invoice,
  payments,
  userId,
  onClose,
  onRefresh,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "deposit" | "request" | "manual" | "history" | "schedule"
  >("deposit");

  const [requestMode, setRequestMode] = useState<"percent" | "amount">("percent");
  const [requestValue, setRequestValue] = useState("30");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualMethod, setManualMethod] = useState("Cash");
  const [manualNotes, setManualNotes] = useState("");

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleLabel, setScheduleLabel] = useState("Deposit");
  const [scheduleMode, setScheduleMode] = useState<"percent" | "amount">("percent");
  const [scheduleValue, setScheduleValue] = useState("30");
  const [scheduleDueDate, setScheduleDueDate] = useState("");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const invoiceTotal = Number(invoice.amount || 0);

  const totalPaid = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );

  const balanceDue = Math.max(invoiceTotal - totalPaid, 0);

  const requestAmount = useMemo(() => {
    const raw = Number(requestValue);
    if (!raw || raw <= 0) return 0;

    if (requestMode === "percent") {
      return Math.round(balanceDue * (raw / 100) * 100) / 100;
    }

    return Math.round(raw * 100) / 100;
  }, [requestValue, requestMode, balanceDue]);

  const scheduleAmount = useMemo(() => {
    const raw = Number(scheduleValue);
    if (!raw || raw <= 0) return 0;

    if (scheduleMode === "percent") {
      return Math.round(invoiceTotal * (raw / 100) * 100) / 100;
    }

    return Math.round(raw * 100) / 100;
  }, [scheduleValue, scheduleMode, invoiceTotal]);

  async function loadScheduleItems() {
    const { data, error } = await supabase
      .from("payment_schedule_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Error loading schedule: ${error.message}`);
      return;
    }

    setScheduleItems((data || []) as ScheduleItem[]);
  }

  useEffect(() => {
    loadScheduleItems();
  }, [invoice.id]);

  async function sendPaymentRequest(paymentType: "deposit" | "payment") {
    if (requestAmount <= 0) {
      setMessage("Payment amount must be greater than 0.");
      return;
    }

    if (requestAmount > balanceDue) {
      setMessage("Payment amount cannot exceed the balance due.");
      return;
    }

    setSending(true);
    setMessage("Sending payment request...");

    const response = await fetch("/api/send-invoice-deposit-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: requestAmount,
        paymentType,
      }),
    });

    const data = await response.json();
    setSending(false);

    if (!response.ok || !data.success) {
      setMessage(data.error || "Unable to send payment request.");
      return;
    }

    setMessage(
      `${paymentType === "deposit" ? "Deposit" : "Payment"} request sent for ${formatCurrency(
        requestAmount
      )}.`
    );
  }

  async function recordManualPayment() {
    const amount = Number(manualAmount);

    if (!amount || amount <= 0) {
      setMessage("Payment amount must be greater than 0.");
      return;
    }

    if (amount > balanceDue) {
      setMessage("Manual payment cannot exceed the balance due.");
      return;
    }

    setSending(true);

    const { error } = await supabase.from("payments").insert([
      {
        user_id: userId,
        invoice_id: invoice.id,
        amount,
        payment_date: manualDate,
        payment_method: manualMethod,
        notes: manualNotes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    setSending(false);

    if (error) {
      setMessage(`Error recording payment: ${error.message}`);
      return;
    }

    setManualAmount("");
    setManualNotes("");
    setMessage("Manual payment recorded.");
    await onRefresh();
  }

  async function addScheduleItem() {
    if (!scheduleLabel.trim()) {
      setMessage("Schedule item needs a label.");
      return;
    }

    if (scheduleAmount <= 0) {
      setMessage("Schedule amount must be greater than 0.");
      return;
    }

    const { error } = await supabase.from("payment_schedule_items").insert([
      {
        user_id: userId,
        invoice_id: invoice.id,
        label: scheduleLabel.trim(),
        amount: scheduleAmount,
        mode: scheduleMode,
        percentage: scheduleMode === "percent" ? Number(scheduleValue) : null,
        due_date: scheduleDueDate || null,
        status: "unpaid",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage(`Error adding schedule item: ${error.message}`);
      return;
    }

    setScheduleLabel("Progress Payment");
    setScheduleValue("");
    setScheduleDueDate("");
    setMessage("Schedule item added.");
    await loadScheduleItems();
  }

  async function deleteScheduleItem(id: string) {
    const { error } = await supabase
      .from("payment_schedule_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setMessage(`Error deleting schedule item: ${error.message}`);
      return;
    }

    await loadScheduleItems();
  }

  async function sendScheduledRequest(item: ScheduleItem) {
    setSending(true);
    setMessage(`Sending request for ${item.label}...`);

    const response = await fetch("/api/send-invoice-deposit-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        amount: item.amount,
        paymentType: item.label.toLowerCase().includes("deposit")
          ? "deposit"
          : "payment",
      }),
    });

    const data = await response.json();
    setSending(false);

    if (!response.ok || !data.success) {
      setMessage(data.error || "Unable to send scheduled payment request.");
      return;
    }

    await supabase
      .from("payment_schedule_items")
      .update({
        status: "requested",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", userId);

    setMessage(`${item.label} request sent.`);
    await loadScheduleItems();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage payment requests, manual payments, schedules, and history.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-xl border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryCard label="Invoice Total" value={formatCurrency(invoiceTotal)} />
            <SummaryCard label="Paid" value={formatCurrency(totalPaid)} />
            <SummaryCard
              label="Balance Due"
              value={formatCurrency(balanceDue)}
              danger={balanceDue > 0}
            />
          </div>
        </div>

        <div className="border-b border-gray-200 p-4">
          <div className="grid gap-2 md:grid-cols-5">
            <TabButton active={activeTab === "deposit"} onClick={() => {
              setActiveTab("deposit");
              setRequestMode("percent");
              setRequestValue("30");
            }}>
              Deposit
            </TabButton>

            <TabButton active={activeTab === "request"} onClick={() => {
              setActiveTab("request");
              setRequestMode("amount");
              setRequestValue(String(balanceDue));
            }}>
              Request
            </TabButton>

            <TabButton active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
              Manual
            </TabButton>

            <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
              History
            </TabButton>

            <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>
              Schedule
            </TabButton>
          </div>
        </div>

        <div className="p-6">
          {(activeTab === "deposit" || activeTab === "request") && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-gray-900">
                {activeTab === "deposit" ? "Request Deposit" : "Request Payment"}
              </h3>

              <div className="flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setRequestMode("percent")}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                    requestMode === "percent"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  Percent
                </button>

                <button
                  type="button"
                  onClick={() => setRequestMode("amount")}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                    requestMode === "amount"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  Dollar Amount
                </button>
              </div>

              <input
                type="number"
                value={requestValue}
                onChange={(e) => setRequestValue(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
              />

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Balance due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>

                <div className="mt-3 flex justify-between text-base font-bold text-gray-900">
                  <span>Request amount</span>
                  <span>{formatCurrency(requestAmount)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  sendPaymentRequest(activeTab === "deposit" ? "deposit" : "payment")
                }
                disabled={sending}
                className="rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            </div>
          )}

          {activeTab === "manual" && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-gray-900">Record Manual Payment</h3>

              <input
                type="number"
                step="0.01"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                placeholder="Amount"
              />

              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
              />

              <div className="grid gap-2 md:grid-cols-4">
                {["Cash", "Check", "ACH", "Other"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setManualMethod(method)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      manualMethod === method
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                placeholder="Notes"
              />

              <button
                type="button"
                onClick={recordManualPayment}
                disabled={sending}
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {sending ? "Recording..." : "Record Payment"}
              </button>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Payment History</h3>

              {payments.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  No payments recorded yet.
                </p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-gray-200 p-4">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(Number(payment.amount || 0))}
                    </p>
                    <p className="text-sm text-gray-600">
                      {payment.payment_method || "Payment"} ·{" "}
                      {payment.payment_date || "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-gray-900">Payment Schedule</h3>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={scheduleLabel}
                    onChange={(e) => setScheduleLabel(e.target.value)}
                    className="rounded-xl border border-gray-300 p-3 text-gray-900"
                    placeholder="Deposit, Progress Payment, Final Payment"
                  />

                  <input
                    type="date"
                    value={scheduleDueDate}
                    onChange={(e) => setScheduleDueDate(e.target.value)}
                    className="rounded-xl border border-gray-300 p-3 text-gray-900"
                  />
                </div>

                <div className="mt-3 flex rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setScheduleMode("percent")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                      scheduleMode === "percent"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    Percent
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleMode("amount")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                      scheduleMode === "amount"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    Dollar Amount
                  </button>
                </div>

                <input
                  type="number"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                  placeholder={scheduleMode === "percent" ? "30" : "5000"}
                />

                <div className="mt-3 flex justify-between rounded-xl bg-white p-3 text-sm">
                  <span>Scheduled amount</span>
                  <strong>{formatCurrency(scheduleAmount)}</strong>
                </div>

                <button
                  type="button"
                  onClick={addScheduleItem}
                  className="mt-3 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Add Schedule Item
                </button>
              </div>

              <div className="space-y-3">
                {scheduleItems.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                    No schedule items yet.
                  </p>
                ) : (
                  scheduleItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-600">
                            {item.mode === "percent"
                              ? `${item.percentage}%`
                              : "Fixed amount"}{" "}
                            · {formatCurrency(Number(item.amount || 0))}
                            {item.due_date ? ` · Due ${item.due_date}` : ""}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                            {item.status}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => sendScheduledRequest(item)}
                            className="rounded-xl bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-700"
                          >
                            Send Request
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteScheduleItem(item.id)}
                            className="rounded-xl border border-red-300 bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {message && (
            <p className="mt-5 rounded-xl bg-gray-50 p-3 text-sm font-medium text-gray-800">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-slate-900 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({
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
      className={`rounded-xl border p-4 ${
        danger ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
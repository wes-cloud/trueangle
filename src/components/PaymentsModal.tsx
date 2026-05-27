"use client";

import { useMemo, useState } from "react";
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
  user_id: string | null;
  invoice_id: string | null;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentsModalProps = {
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

export default function PaymentsModal({
  invoice,
  payments,
  userId,
  onClose,
  onRefresh,
}: PaymentsModalProps) {
  const [activeTab, setActiveTab] = useState<
    "deposit" | "request" | "manual" | "history" | "schedule"
  >("deposit");

  const [requestMode, setRequestMode] = useState<"percent" | "amount">(
    "percent"
  );
  const [requestValue, setRequestValue] = useState("30");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [manualMethod, setManualMethod] = useState("Cash");
  const [manualNotes, setManualNotes] = useState("");

  const invoiceTotal = Number(invoice.amount || 0);

  const totalPaid = useMemo(() => {
    return payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  const balanceDue = Math.max(invoiceTotal - totalPaid, 0);

  const requestAmount = useMemo(() => {
    const raw = Number(requestValue);

    if (!raw || raw <= 0) return 0;

    if (requestMode === "percent") {
      return Math.round(balanceDue * (raw / 100) * 100) / 100;
    }

    return Math.round(raw * 100) / 100;
  }, [requestValue, requestMode, balanceDue]);

  async function updateInvoiceStatus(nextPaidTotal: number) {
    let nextStatus = "sent";

    if (nextPaidTotal <= 0) {
      nextStatus = invoice.status === "draft" ? "draft" : "sent";
    } else if (nextPaidTotal < invoiceTotal) {
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
      .eq("id", invoice.id)
      .eq("user_id", userId);
  }

  async function sendPaymentRequest(paymentType: "deposit" | "payment") {
    setMessage("");

    if (balanceDue <= 0) {
      setMessage("This invoice is already paid.");
      return;
    }

    if (!requestAmount || requestAmount <= 0) {
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

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    setSending(false);

    if (!response.ok || !data.success) {
      setMessage(data.error || "Unable to send payment request.");
      return;
    }

    setMessage(`${paymentType === "deposit" ? "Deposit" : "Payment"} request sent for ${formatCurrency(requestAmount)}.`);
  }

  async function recordManualPayment() {
    setMessage("");

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
    setMessage("Recording payment...");

    const { error } = await supabase.from("payments").insert([
      {
        user_id: userId,
        invoice_id: invoice.id,
        amount,
        payment_date: manualDate || new Date().toISOString().slice(0, 10),
        payment_method: manualMethod || "Manual",
        notes: manualNotes.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setSending(false);
      setMessage(`Error recording payment: ${error.message}`);
      return;
    }

    await updateInvoiceStatus(totalPaid + amount);
    await onRefresh();

    setManualAmount("");
    setManualNotes("");
    setSending(false);
    setMessage("Manual payment recorded.");
  }

  function switchToDeposit() {
    setActiveTab("deposit");
    setRequestMode("percent");
    setRequestValue("30");
    setMessage("");
  }

  function switchToRequest() {
    setActiveTab("request");
    setRequestMode("amount");
    setRequestValue(String(balanceDue));
    setMessage("");
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
            <SummaryCard label="Balance Due" value={formatCurrency(balanceDue)} danger={balanceDue > 0} />
          </div>
        </div>

        <div className="border-b border-gray-200 p-4">
          <div className="grid gap-2 md:grid-cols-5">
            <TabButton active={activeTab === "deposit"} onClick={switchToDeposit}>
              Request Deposit
            </TabButton>
            <TabButton active={activeTab === "request"} onClick={switchToRequest}>
              Request Payment
            </TabButton>
            <TabButton active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
              Record Payment
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
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {activeTab === "deposit" ? "Request Deposit" : "Request Payment"}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Send your customer an email with a secure Stripe payment link.
                </p>
              </div>

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

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  {requestMode === "percent" ? "Percentage" : "Amount"}
                </label>

                <div className="relative">
                  {requestMode === "amount" && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                  )}

                  <input
                    type="number"
                    min="0"
                    step={requestMode === "percent" ? "1" : "0.01"}
                    value={requestValue}
                    onChange={(e) => setRequestValue(e.target.value)}
                    className={`w-full rounded-xl border border-gray-300 p-3 text-gray-900 ${
                      requestMode === "amount" ? "pl-7" : "pr-9"
                    }`}
                  />

                  {requestMode === "percent" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      %
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Balance due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>

                <div className="mt-3 flex justify-between text-base font-bold text-gray-900">
                  <span>{activeTab === "deposit" ? "Deposit request" : "Payment request"}</span>
                  <span>{formatCurrency(requestAmount)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    sendPaymentRequest(activeTab === "deposit" ? "deposit" : "payment")
                  }
                  disabled={sending}
                  className="rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {sending ? "Sending..." : activeTab === "deposit" ? "Send Deposit Request" : "Send Payment Request"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "manual" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Record Manual Payment
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Track cash, check, ACH, or other payments received outside Stripe.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Amount">
                  <input
                    type="number"
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Payment Date">
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                  />
                </Field>
              </div>

              <Field label="Method">
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
              </Field>

              <Field label="Notes">
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-900"
                  placeholder="Optional note"
                />
              </Field>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={recordManualPayment}
                  disabled={sending}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {sending ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Payment History
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  View payments recorded against this invoice.
                </p>
              </div>

              {payments.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  No payments recorded yet.
                </div>
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(Number(payment.amount || 0))}
                        </p>
                        <p className="text-sm text-gray-600">
                          {payment.payment_method || "Payment"} ·{" "}
                          {formatDate(payment.payment_date)}
                        </p>
                        {payment.notes && (
                          <p className="mt-2 text-sm text-gray-700">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Payment Schedule
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Coming next: break invoices into deposits, progress payments,
                  and final payments by percentage or dollar amount.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
                Payment schedules will let contractors create milestone-based
                billing like 30% deposit, 40% progress payment, and 30% final
                payment.
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
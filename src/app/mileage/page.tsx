"use client";

import { useEffect, useMemo, useState } from "react";
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

type MileageLog = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  vehicle_name: string | null;
  trip_date: string | null;
  start_miles: number | null;
  end_miles: number | null;
  total_miles: number | null;
  purpose: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function formatMiles(value?: number | null) {
  return `${Number(value || 0).toFixed(1)} mi`;
}

export default function MileagePage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [logs, setLogs] = useState<MileageLog[]>([]);

  const [vehicleName, setVehicleName] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");
  const [startMiles, setStartMiles] = useState("");
  const [endMiles, setEndMiles] = useState("");
  const [totalMiles, setTotalMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  async function fetchLogs(currentUserId: string) {
    const { data, error } = await supabase
      .from("mileage_logs")
      .select(
        "id, user_id, customer_id, estimate_id, vehicle_name, trip_date, start_miles, end_miles, total_miles, purpose, notes, created_at, updated_at"
      )
      .eq("user_id", currentUserId)
      .order("trip_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading mileage logs: ${error.message}`);
      return;
    }

    setLogs((data || []) as MileageLog[]);
  }

  async function loadPageData(currentUserId: string) {
    setMessage("");
    await Promise.all([
      fetchCustomers(currentUserId),
      fetchEstimates(currentUserId),
      fetchLogs(currentUserId),
    ]);
  }

  function resetForm() {
    setVehicleName("");
    setTripDate("");
    setSelectedCustomerId("");
    setSelectedEstimateId("");
    setStartMiles("");
    setEndMiles("");
    setTotalMiles("");
    setPurpose("");
    setNotes("");
    setEditingId(null);
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

  function handleEdit(log: MileageLog) {
    setVehicleName(log.vehicle_name || "");
    setTripDate(log.trip_date || "");
    setSelectedCustomerId(log.customer_id || "");
    setSelectedEstimateId(log.estimate_id || "");
    setStartMiles(String(log.start_miles ?? ""));
    setEndMiles(String(log.end_miles ?? ""));
    setTotalMiles(String(log.total_miles ?? ""));
    setPurpose(log.purpose || "");
    setNotes(log.notes || "");
    setEditingId(log.id);
    setMessage("Editing mileage log...");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteLog(id: string) {
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const { error } = await supabase
      .from("mileage_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`Error deleting mileage log: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Mileage log deleted successfully.");
    await loadPageData(user.id);
  }

  async function handleSaveLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!tripDate) {
      setMessage("Trip date is required.");
      return;
    }

    let calculatedTotal = Number(totalMiles || 0);

    if (startMiles && endMiles) {
      const start = Number(startMiles);
      const end = Number(endMiles);

      if (end < start) {
        setMessage("End miles cannot be less than start miles.");
        return;
      }

      calculatedTotal = end - start;
    }

    if (calculatedTotal <= 0) {
      setMessage("Total miles must be greater than 0.");
      return;
    }

    const payload = {
      user_id: user.id,
      customer_id: selectedCustomerId || null,
      estimate_id: selectedEstimateId || null,
      vehicle_name: vehicleName.trim() || null,
      trip_date: tripDate,
      start_miles: startMiles ? Number(startMiles) : null,
      end_miles: endMiles ? Number(endMiles) : null,
      total_miles: calculatedTotal,
      purpose: purpose.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("mileage_logs")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        setMessage(`Error updating mileage log: ${error.message}`);
        return;
      }

      setMessage("Mileage log updated successfully.");
      resetForm();
      await loadPageData(user.id);
      return;
    }

    const { error } = await supabase.from("mileage_logs").insert([
      {
        ...payload,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage(`Error saving mileage log: ${error.message}`);
      return;
    }

    setMessage("Mileage log saved successfully.");
    resetForm();
    await loadPageData(user.id);
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
    setLogs([]);
    setMessage("Signed out.");
  }

  const totalMilesAllTime = useMemo(() => {
    return logs.reduce((sum, log) => sum + Number(log.total_miles || 0), 0);
  }, [logs]);

  const totalMilesThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return logs
      .filter((log) => {
        if (!log.trip_date) return false;
        return new Date(log.trip_date).getFullYear() === currentYear;
      })
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);
  }, [logs]);

  useEffect(() => {
    if (startMiles && endMiles) {
      const start = Number(startMiles);
      const end = Number(endMiles);

      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        setTotalMiles(String((end - start).toFixed(1)));
      }
    }
  }, [startMiles, endMiles]);

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
        setLogs([]);
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
          <h1 className="text-3xl font-bold text-gray-900">Mileage</h1>
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
                Mileage
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Business Mileage Log
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">Miles This Year</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatMiles(totalMilesThisYear)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">Miles All Time</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatMiles(totalMilesAllTime)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingId ? "Edit Mileage Log" : "Add Mileage Log"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-gray-300 px-4 py-2 text-gray-900"
              >
                Switch to New Log
              </button>
            )}
          </div>

          <form onSubmit={handleSaveLog} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Vehicle Name
                </label>
                <input
                  type="text"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="Ford F-150"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Trip Date
                </label>
                <input
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Total Miles
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={totalMiles}
                  onChange={(e) => setTotalMiles(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="12.5"
                  required
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
                      {estimate.customer_name ? ` - ${estimate.customer_name}` : ""}
                      {estimate.estimate_number ? ` (${estimate.estimate_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Start Miles
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={startMiles}
                  onChange={(e) => setStartMiles(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="12000.0"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  End Miles
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={endMiles}
                  onChange={(e) => setEndMiles(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="12015.4"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Business Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-900"
                placeholder="Site visit, estimate meeting, material pickup"
              />
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
                {editingId ? "Update Log" : "Save Log"}
              </button>
            </div>

            {message && <p className="text-gray-900">{message}</p>}
          </form>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Saved Mileage Logs
          </h2>

          {logs.length === 0 ? (
            <p className="text-gray-600">No mileage logs yet.</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const linkedCustomer = customers.find(
                  (item) => item.id === log.customer_id
                );
                const linkedEstimate = estimates.find(
                  (item) => item.id === log.estimate_id
                );

                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {log.vehicle_name || "Vehicle not listed"}
                        </p>
                        <p className="text-sm text-gray-700">
                          {formatDate(log.trip_date)}
                        </p>

                        <p className="mt-2 text-sm text-gray-700">
                          Total: {formatMiles(log.total_miles)}
                        </p>

                        {log.start_miles !== null && log.end_miles !== null && (
                          <p className="text-sm text-gray-700">
                            Odometer: {Number(log.start_miles).toFixed(1)} →{" "}
                            {Number(log.end_miles).toFixed(1)}
                          </p>
                        )}

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

                        {log.purpose && (
                          <p className="mt-2 text-sm text-gray-700">
                            Purpose: {log.purpose}
                          </p>
                        )}

                        {log.notes && (
                          <p className="text-sm text-gray-600">{log.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(log)}
                          className="rounded-xl bg-blue-600 px-3 py-1 text-white"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="rounded-xl bg-red-600 px-3 py-1 text-white"
                        >
                          Delete
                        </button>
                      </div>
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
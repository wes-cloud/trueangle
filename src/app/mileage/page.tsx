"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type Vehicle = {
  id: string;
  company_id: string | null;
  user_id: string | null;
  name: string | null;
  make: string | null;
  model: string | null;
  vehicle_year: number | null;
  year_tracked: number | null;
  beginning_odom: number | null;
  ending_odometer: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TripType = "business" | "personal" | "commute" | "adjustment";

type MileageLog = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  trip_type: TripType | null;
  trip_date: string | null;
  start_miles: number | null;
  end_miles: number | null;
  total_miles: number | null;
  purpose: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const currentYear = new Date().getFullYear();

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function formatMiles(value?: number | null) {
  return `${Number(value || 0).toFixed(1)} mi`;
}

function getVehicleLabel(vehicle?: Vehicle | null) {
  if (!vehicle) return "Vehicle not listed";

  const parts = [
    vehicle.name,
    vehicle.vehicle_year,
    vehicle.make,
    vehicle.model,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Vehicle not listed";
}

export default function MileagePage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<MileageLog[]>([]);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [newVehicleName, setNewVehicleName] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleYear, setNewVehicleYear] = useState("");
  const [newVehicleBeginningOdom, setNewVehicleBeginningOdom] = useState("");

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [endingOdometer, setEndingOdometer] = useState("");

  const [tripDate, setTripDate] = useState("");
  const [tripType, setTripType] = useState<TripType>("business");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");
  const [startMiles, setStartMiles] = useState("");
  const [endMiles, setEndMiles] = useState("");
  const [totalMiles, setTotalMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  const selectedVehicleLogs = useMemo(() => {
    return logs.filter((log) => log.vehicle_id === selectedVehicleId);
  }, [logs, selectedVehicleId]);

  const totalMilesAllTime = useMemo(() => {
    return logs.reduce((sum, log) => sum + Number(log.total_miles || 0), 0);
  }, [logs]);

  const totalMilesThisYear = useMemo(() => {
    return logs
      .filter((log) => {
        if (!log.trip_date) return false;
        return new Date(log.trip_date).getFullYear() === selectedYear;
      })
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);
  }, [logs, selectedYear]);

  const reconciliation = useMemo(() => {
    if (!selectedVehicle) {
      return {
        odometerMiles: null,
        trackedMiles: 0,
        businessMiles: 0,
        personalMiles: 0,
        commuteMiles: 0,
        adjustmentMiles: 0,
        unassignedMiles: null,
      };
    }

    const trackedMiles = selectedVehicleLogs.reduce(
      (sum, log) => sum + Number(log.total_miles || 0),
      0
    );

    const businessMiles = selectedVehicleLogs
      .filter((log) => log.trip_type === "business")
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);

    const personalMiles = selectedVehicleLogs
      .filter((log) => log.trip_type === "personal")
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);

    const commuteMiles = selectedVehicleLogs
      .filter((log) => log.trip_type === "commute")
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);

    const adjustmentMiles = selectedVehicleLogs
      .filter((log) => log.trip_type === "adjustment")
      .reduce((sum, log) => sum + Number(log.total_miles || 0), 0);

    const beginning = Number(selectedVehicle.beginning_odom || 0);
    const ending = selectedVehicle.ending_odometer;

    const odometerMiles =
      ending === null || ending === undefined ? null : Number(ending) - beginning;

    const unassignedMiles =
      odometerMiles === null ? null : odometerMiles - trackedMiles;

    return {
      odometerMiles,
      trackedMiles,
      businessMiles,
      personalMiles,
      commuteMiles,
      adjustmentMiles,
      unassignedMiles,
    };
  }, [selectedVehicle, selectedVehicleLogs]);

  async function fetchCompanyId(currentUserId: string) {
    const { data } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", currentUserId)
      .limit(1)
      .maybeSingle();

    const nextCompanyId = data?.company_id || null;
    setCompanyId(nextCompanyId);
    return nextCompanyId;
  }

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

  async function fetchVehicles(currentUserId: string, currentCompanyId: string | null) {
    let query = supabase
      .from("vehicles")
      .select(
        "id, company_id, user_id, name, make, model, vehicle_year, year_tracked, beginning_odom, ending_odometer, created_at, updated_at"
      )
      .eq("year_tracked", selectedYear)
      .order("created_at", { ascending: false });

    if (currentCompanyId) {
      query = query.eq("company_id", currentCompanyId);
    } else {
      query = query.eq("user_id", currentUserId);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(`Error loading vehicles: ${error.message}`);
      return;
    }

    const nextVehicles = (data || []) as Vehicle[];
    setVehicles(nextVehicles);

    if (!selectedVehicleId && nextVehicles.length > 0) {
      setSelectedVehicleId(nextVehicles[0].id);
    }

    if (
      selectedVehicleId &&
      nextVehicles.length > 0 &&
      !nextVehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(nextVehicles[0].id);
    }

    if (nextVehicles.length === 0) {
      setSelectedVehicleId("");
    }
  }

  async function fetchLogs(currentUserId: string) {
    const { data, error } = await supabase
      .from("mileage_logs")
      .select(
        "id, user_id, customer_id, estimate_id, vehicle_id, vehicle_name, trip_type, trip_date, start_miles, end_miles, total_miles, purpose, notes, created_at, updated_at"
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

    const nextCompanyId = await fetchCompanyId(currentUserId);

    await Promise.all([
      fetchCustomers(currentUserId),
      fetchEstimates(currentUserId),
      fetchVehicles(currentUserId, nextCompanyId),
      fetchLogs(currentUserId),
    ]);
  }

  function resetForm() {
    setSelectedVehicleId(vehicles[0]?.id || "");
    setTripDate("");
    setTripType("business");
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
    setSelectedVehicleId(log.vehicle_id || "");
    setTripDate(log.trip_date || "");
    setTripType(log.trip_type || "business");
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

  async function handleCreateVehicle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!newVehicleName.trim()) {
      setMessage("Vehicle name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("vehicles").insert([
      {
        company_id: companyId,
        user_id: user.id,
        name: newVehicleName.trim(),
        make: newVehicleMake.trim() || null,
        model: newVehicleModel.trim() || null,
        vehicle_year: newVehicleYear ? Number(newVehicleYear) : null,
        year_tracked: selectedYear,
        beginning_odom: newVehicleBeginningOdom
          ? Number(newVehicleBeginningOdom)
          : 0,
        ending_odometer: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    setSaving(false);

    if (error) {
      setMessage(`Error creating vehicle: ${error.message}`);
      return;
    }

    setNewVehicleName("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setNewVehicleYear("");
    setNewVehicleBeginningOdom("");
    setMessage("Vehicle added successfully.");
    await loadPageData(user.id);
  }

  async function handleSaveEndingOdometer() {
    if (!user || !selectedVehicle) {
      setMessage("Select a vehicle first.");
      return;
    }

    if (!endingOdometer) {
      setMessage("Enter an ending odometer reading.");
      return;
    }

    const ending = Number(endingOdometer);
    const beginning = Number(selectedVehicle.beginning_odom || 0);

    if (ending < beginning) {
      setMessage("Ending odometer cannot be less than beginning odometer.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("vehicles")
      .update({
        ending_odometer: ending,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedVehicle.id);

    setSaving(false);

    if (error) {
      setMessage(`Error saving ending odometer: ${error.message}`);
      return;
    }

    setEndingOdometer("");
    setMessage("Ending odometer saved.");
    await loadPageData(user.id);
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

  async function handleSaveLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    if (!selectedVehicleId) {
      setMessage("Select or add a vehicle first.");
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

    const selectedVehicleForPayload = vehicles.find(
      (vehicle) => vehicle.id === selectedVehicleId
    );

    const payload = {
      user_id: user.id,
      customer_id: selectedCustomerId || null,
      estimate_id: selectedEstimateId || null,
      vehicle_id: selectedVehicleId,
      vehicle_name: selectedVehicleForPayload?.name || null,
      trip_type: tripType,
      trip_date: tripDate,
      start_miles: startMiles ? Number(startMiles) : null,
      end_miles: endMiles ? Number(endMiles) : null,
      total_miles: calculatedTotal,
      purpose: purpose.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    setMessage("");

    if (editingId) {
      const { error } = await supabase
        .from("mileage_logs")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      setSaving(false);

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

    setSaving(false);

    if (error) {
      setMessage(`Error saving mileage log: ${error.message}`);
      return;
    }

    setMessage("Mileage log saved successfully.");
    resetForm();
    await loadPageData(user.id);
  }

  async function handleAddReconciliationAdjustment() {
    if (!user || !selectedVehicle || reconciliation.unassignedMiles === null) {
      return;
    }

    if (reconciliation.unassignedMiles <= 0) {
      setMessage("There are no positive unassigned miles to adjust.");
      return;
    }

    const payload = {
      user_id: user.id,
      customer_id: null,
      estimate_id: null,
      vehicle_id: selectedVehicle.id,
      vehicle_name: selectedVehicle.name || null,
      trip_type: "adjustment" as TripType,
      trip_date: `${selectedYear}-12-31`,
      start_miles: null,
      end_miles: null,
      total_miles: reconciliation.unassignedMiles,
      purpose: "Mileage reconciliation adjustment",
      notes: "Unassigned year-end mileage adjustment.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);

    const { error } = await supabase.from("mileage_logs").insert([payload]);

    setSaving(false);

    if (error) {
      setMessage(`Error adding adjustment: ${error.message}`);
      return;
    }

    setMessage("Reconciliation adjustment added.");
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
    setVehicles([]);
    setLogs([]);
    setMessage("Signed out.");
  }

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
    async function reloadForYear() {
      if (user) {
        await loadPageData(user.id);
      }
    }

    reloadForYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

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
        setVehicles([]);
        setLogs([]);
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                Contractor Mileage
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">Tracking Year</p>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="mt-2 w-full rounded-lg border p-2 text-gray-900"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

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
          <h2 className="text-2xl font-bold text-gray-900">Set Vehicle</h2>
          <p className="mt-1 text-sm text-gray-600">
            Add each truck or work vehicle once per tracking year.
          </p>

          <form onSubmit={handleCreateVehicle} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Vehicle Name
                </label>
                <input
                  type="text"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="Work Truck"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Year
                </label>
                <input
                  type="number"
                  value={newVehicleYear}
                  onChange={(e) => setNewVehicleYear(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="2019"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Make
                </label>
                <input
                  type="text"
                  value={newVehicleMake}
                  onChange={(e) => setNewVehicleMake(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="Ford"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Model
                </label>
                <input
                  type="text"
                  value={newVehicleModel}
                  onChange={(e) => setNewVehicleModel(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="F-250"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Beginning Odometer
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newVehicleBeginningOdom}
                  onChange={(e) => setNewVehicleBeginningOdom(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  placeholder="45000"
                />
              </div>
            </div>

            <button
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              Add Vehicle
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? "Edit Mileage Log" : "Add Mileage Log"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Vehicle, date, and miles are required. Customer and project are optional.
              </p>
            </div>

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
                  Vehicle
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  required
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getVehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
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
                  Trip Type
                </label>
                <select
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value as TripType)}
                  className="w-full rounded-lg border p-3 text-gray-900"
                  required
                >
                  <option value="business">Business</option>
                  <option value="personal">Personal</option>
                  <option value="commute">Commute</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Purpose
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

            <button
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {editingId ? "Update Log" : "Save Log"}
            </button>

            {message && <p className="text-gray-900">{message}</p>}
          </form>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Mileage Reconciliation
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Compare odometer miles against tracked trips for the selected vehicle.
          </p>

          {selectedVehicle ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard
                  label="Beginning"
                  value={formatMiles(selectedVehicle.beginning_odom)}
                />
                <SummaryCard
                  label="Ending"
                  value={
                    selectedVehicle.ending_odometer === null
                      ? "Not set"
                      : formatMiles(selectedVehicle.ending_odometer)
                  }
                />
                <SummaryCard
                  label="Tracked"
                  value={formatMiles(reconciliation.trackedMiles)}
                />
                <SummaryCard
                  label="Unassigned"
                  value={
                    reconciliation.unassignedMiles === null
                      ? "Set ending"
                      : formatMiles(reconciliation.unassignedMiles)
                  }
                  warning={
                    reconciliation.unassignedMiles !== null &&
                    reconciliation.unassignedMiles !== 0
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard
                  label="Business"
                  value={formatMiles(reconciliation.businessMiles)}
                />
                <SummaryCard
                  label="Personal"
                  value={formatMiles(reconciliation.personalMiles)}
                />
                <SummaryCard
                  label="Commute"
                  value={formatMiles(reconciliation.commuteMiles)}
                />
                <SummaryCard
                  label="Adjustments"
                  value={formatMiles(reconciliation.adjustmentMiles)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="number"
                  step="0.1"
                  value={endingOdometer}
                  onChange={(e) => setEndingOdometer(e.target.value)}
                  className="rounded-lg border p-3 text-gray-900"
                  placeholder="Ending odometer"
                />

                <button
                  type="button"
                  onClick={handleSaveEndingOdometer}
                  disabled={saving}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-gray-900 disabled:opacity-50"
                >
                  Save Ending Odometer
                </button>

                <button
                  type="button"
                  onClick={handleAddReconciliationAdjustment}
                  disabled={
                    saving ||
                    reconciliation.unassignedMiles === null ||
                    reconciliation.unassignedMiles <= 0
                  }
                  className="rounded-xl bg-yellow-900 px-4 py-2 text-white disabled:opacity-50"
                >
                  Add Adjustment
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-gray-600">
              Add or select a vehicle to start reconciliation.
            </p>
          )}
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
                const linkedVehicle = vehicles.find(
                  (item) => item.id === log.vehicle_id
                );

                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {linkedVehicle
                            ? getVehicleLabel(linkedVehicle)
                            : log.vehicle_name || "Vehicle not listed"}
                        </p>

                        <p className="text-sm text-gray-700">
                          {formatDate(log.trip_date)} ·{" "}
                          <span className="capitalize">
                            {log.trip_type || "business"}
                          </span>
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

function SummaryCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ring-1 ${
        warning ? "bg-yellow-50 ring-yellow-300" : "bg-white ring-gray-200"
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
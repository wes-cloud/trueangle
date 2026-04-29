"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  email?: string | null;
};

type Customer = {
  id: string;
  user_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

export default function CustomersPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");

  async function loadCustomers(currentUserId: string) {
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

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(`Auth error: ${error.message}`);
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
        await loadCustomers(safeUser.id);
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
        await loadCustomers(nextUser.id);
      } else {
        setCustomers([]);
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    setCustomers([]);
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="font-semibold text-slate-900">Loading customers...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-black text-slate-950">Customers</h1>
          <p className="mt-3 text-slate-700">
            Please sign in to view your customers.
          </p>

          <div className="mt-6">
            <Link
              href="/start-trial"
              className="rounded-xl bg-black px-4 py-2 font-bold text-white hover:bg-slate-800"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl bg-gradient-to-r from-white to-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                TrueAngle Customers
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Keep your customers and job contacts organized.
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-600">
                Total Customers
              </p>
              <p className="mt-1 text-3xl font-black text-slate-950">
                {customers.length}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">{message}</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Customer List
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Customers used across estimates, invoices, and job tracking.
              </p>
            </div>

            <Link
              href="/estimates/new"
              className="rounded-xl bg-black px-4 py-2 text-center text-sm font-bold text-white hover:bg-slate-800"
            >
              Create Estimate
            </Link>
          </div>

          {customers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-lg font-black text-slate-950">
                No customers yet.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Customers will show here once you create estimates or add them
                to your workflow.
              </p>
              <Link
                href="/estimates/new"
                className="mt-5 inline-block rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                Create Your First Estimate
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {customers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-950">
                        {customer.full_name}
                      </p>

                      <div className="mt-2 space-y-1 text-sm font-medium text-slate-700">
                        {customer.email && <p>{customer.email}</p>}
                        {customer.phone && <p>{customer.phone}</p>}
                        {customer.address && <p>{customer.address}</p>}
                      </div>

                      {customer.notes && (
                        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">
                          {customer.notes}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      Added: {formatDate(customer.created_at)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { usePlaidLink } from "react-plaid-link";

type AuthUser = {
  id: string;
  email?: string | null;
};

type PlaidItem = {
  plaid_item_id: string;
  institution_name: string | null;
  institution_id: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

type PlaidAccount = {
  id: string;
  plaid_item_id: string | null;
  plaid_account_id: string | null;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  available_balance: number | null;
  current_balance: number | null;
  iso_currency_code: string | null;
  updated_at: string | null;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Never synced";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never synced";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAccountType(account: PlaidAccount) {
  const parts = [account.type, account.subtype].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Account";
}

export default function BankingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function loadConnectedBanks(userId: string) {
    const [{ data: itemData, error: itemError }, { data: accountData, error: accountError }] =
      await Promise.all([
        supabase
          .from("plaid_items")
          .select("plaid_item_id, institution_name, institution_id, last_synced_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false }),

        supabase
          .from("plaid_accounts")
          .select(
            "id, plaid_item_id, plaid_account_id, name, official_name, mask, type, subtype, available_balance, current_balance, iso_currency_code, updated_at"
          )
          .eq("user_id", userId)
          .order("updated_at", { ascending: false }),
      ]);

    if (itemError) {
      setMessage(`Error loading connected banks: ${itemError.message}`);
      return;
    }

    if (accountError) {
      setMessage(`Error loading accounts: ${accountError.message}`);
      return;
    }

    setItems((itemData || []) as PlaidItem[]);
    setAccounts((accountData || []) as PlaidAccount[]);
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const safeUser = authUser
        ? { id: authUser.id, email: authUser.email ?? null }
        : null;

      setUser(safeUser);

      if (safeUser) {
        await loadConnectedBanks(safeUser.id);
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  const createLinkToken = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
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
  }, [user]);

  useEffect(() => {
    if (user) {
      createLinkToken();
    }
  }, [user, createLinkToken]);

  async function syncTransactions() {
    if (!user) return;

    setSyncing(true);
    setMessage("Syncing bank accounts and transactions...");

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

      await loadConnectedBanks(user.id);
      setMessage("Bank accounts and transactions synced.");
    } finally {
      setSyncing(false);
    }
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

      setMessage("Bank saved. Syncing accounts and transactions...");

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

      await loadConnectedBanks(user.id);
      await createLinkToken();

      setMessage("Bank connected and synced.");
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const accountsByItem = useMemo(() => {
    const grouped: Record<string, PlaidAccount[]> = {};

    accounts.forEach((account) => {
      const key = account.plaid_item_id || "unknown";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(account);
    });

    return grouped;
  }, [accounts]);

  if (loading) {
    return <main className="min-h-screen bg-gray-100 p-8">Loading...</main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        Please sign in first.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Banking
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Connected Banks
              </h1>
              <p className="mt-2 max-w-2xl text-gray-600">
                Connect multiple banks, review linked accounts, and sync balances
                and transactions.
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
                onClick={syncTransactions}
                disabled={syncing}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
              >
                {syncing ? "Syncing..." : "Sync Accounts"}
              </button>

              <Link
                href="/banking/transactions"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Review Transactions
              </Link>
            </div>
          </div>

          {message && <p className="mt-4 text-sm text-gray-900">{message}</p>}
        </section>

        {items.length === 0 ? (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              No banks connected yet
            </h2>
            <p className="mt-2 text-gray-600">
              Connect your first bank to start importing transactions and viewing
              account balances.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {items.map((item) => {
              const itemAccounts = accountsByItem[item.plaid_item_id] || [];

              return (
                <div
                  key={item.plaid_item_id}
                  className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {item.institution_name || "Connected Bank"}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {itemAccounts.length} account
                        {itemAccounts.length === 1 ? "" : "s"} connected
                      </p>
                    </div>

                    <div className="text-left text-sm text-gray-600 md:text-right">
                      <p>Last synced</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(item.last_synced_at || item.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {itemAccounts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 p-5">
                        <p className="text-gray-600">
                          No accounts saved yet. Click Sync Accounts.
                        </p>
                      </div>
                    ) : (
                      itemAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-bold text-gray-900">
                                {account.name || account.official_name || "Account"}
                              </p>

                              <p className="mt-1 text-sm text-gray-600">
                                {formatAccountType(account)}
                                {account.mask ? ` • ****${account.mask}` : ""}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Current
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                {formatCurrency(account.current_balance)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                              <p className="text-gray-500">Available</p>
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(account.available_balance)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
                              <p className="text-gray-500">Updated</p>
                              <p className="font-semibold text-gray-900">
                                {formatDate(account.updated_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
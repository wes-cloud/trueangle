"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { usePlaidLink } from "react-plaid-link";

type AuthUser = {
  id: string;
  email?: string | null;
};

export default function BankingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const safeUser = authUser
        ? { id: authUser.id, email: authUser.email ?? null }
        : null;

      setUser(safeUser);
      setLoading(false);
    }

    loadUser();
  }, []);

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
      setMessage("Ready to connect bank.");
    } catch {
      setMessage("Unable to create Plaid link token.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      createLinkToken();
    }
  }, [user, createLinkToken]);

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
    },
    [user]
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

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">Banking</h1>
          <p className="mt-2 text-gray-600">
            Connect your bank in Plaid Sandbox first.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => open()}
              disabled={!ready || !linkToken}
              className="rounded-xl bg-black px-4 py-2 text-white disabled:bg-gray-400"
            >
              Connect Bank
            </button>

            <Link
              href="/banking/transactions"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Review Transactions
            </Link>
          </div>

          {message && <p className="mt-4 text-sm text-gray-900">{message}</p>}
        </div>
      </div>
    </main>
  );
}
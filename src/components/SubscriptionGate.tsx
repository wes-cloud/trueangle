"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { BillingAction } from "@/lib/subscription-status";

const PUBLIC_PATHS = [
  "/", "/auth", "/start-trial", "/trial-success", "/forgot-password", "/reset-password",
  "/terms", "/privacy", "/support",
];
const PUBLIC_PREFIXES = ["/approve-estimate", "/invite"];

const billingCopy: Record<BillingAction, { title: string; detail: string; button: string }> = {
  trial: {
    title: "Start your free trial",
    detail: "Get full access for 14 days. Then pay $29 per month unless you cancel before the trial ends.",
    button: "Start 14-day free trial",
  },
  reactivate: {
    title: "Welcome back",
    detail: "Reactivate to regain access to your dashboard. Your $29 monthly subscription starts when you complete Checkout.",
    button: "Reactivate subscription",
  },
  subscribe: {
    title: "Subscribe to TrueAngle",
    detail: "Your $29 monthly subscription starts when you complete Checkout. Contact support if you believe this account is eligible for an introductory trial.",
    button: "Subscribe for $29 per month",
  },
  recover: {
    title: "Review your payment information",
    detail: "Open billing to update your payment method or pay an outstanding invoice.",
    button: "Open billing",
  },
  pending: {
    title: "We’re checking your subscription",
    detail: "Check again in a moment to see your current billing options.",
    button: "Check again",
  },
};

type GateState =
  | { kind: "allowed" | "signed-out" | "error" }
  | { kind: "blocked"; action: BillingAction };

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isPublic) return children;
  return <ProtectedPage key={pathname}>{children}</ProtectedPage>;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(0);

  useEffect(() => {
    let mounted = true;
    const apply = (state: GateState) => {
      if (mounted) setState(state);
    };

    async function checkAccess() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) return apply({ kind: "signed-out" });
        const response = await fetch("/api/access/check", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (response.status === 401) return apply({ kind: "signed-out" });
        if (!response.ok) throw new Error("Could not check access.");
        const data = await response.json();
        apply(data.allowed ? { kind: "allowed" } : { kind: "blocked", action: data.action });
      } catch {
        apply({ kind: "error" });
      }
    }

    void checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        apply({ kind: "signed-out" });
        mounted = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [check]);

  function checkAgain() {
    setMessage("");
    setState(null);
    setCheck(value => value + 1);
  }

  async function openBilling(action: BillingAction) {
    if (action === "pending") return checkAgain();
    setBusy(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to continue.");
      const response = await fetch(action === "recover" ? "/api/stripe/portal" : "/api/stripe/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(action === "recover" ? { recovery: true } : { intent: action === "subscribe" ? "reactivate" : action }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Could not open billing.");
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open billing.");
      setBusy(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setMessage("Could not sign out. Please try again.");
      return;
    }
    window.location.replace("/auth");
  }

  if (state?.kind === "allowed") return children;

  const copy = state?.kind === "blocked" ? billingCopy[state.action] : null;
  const buttonClass = "mt-6 inline-block rounded-xl bg-black px-5 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold uppercase text-slate-600">TrueAngle</p>
        <h1 className="mt-2 text-3xl font-black">
          {copy?.title ?? (state?.kind === "signed-out" ? "Sign in to continue" :
            state?.kind === "error" ? "Could not check account access" : "Checking access…")}
        </h1>
        {state?.kind === "signed-out" && <Link href="/auth" className={buttonClass}>Sign in</Link>}
        {state?.kind === "error" && <button onClick={checkAgain} className={buttonClass}>Try again</button>}
        {state?.kind === "blocked" && copy && (
          <>
            <p className="mt-3 text-slate-700">{copy.detail}</p>
            <button disabled={busy} onClick={() => void openBilling(state.action)} className={buttonClass}>
              {busy ? "Opening billing…" : copy.button}
            </button>
          </>
        )}
        {message && <p role="alert" className="mt-4 text-sm text-red-800">{message}</p>}
        {state && state.kind !== "signed-out" && (
          <div className="mt-5 flex gap-5">
            {message && <button onClick={checkAgain} className="text-sm font-semibold underline">Refresh billing status</button>}
            <button onClick={() => void signOut()} className="text-sm font-semibold underline">Sign out</button>
          </div>
        )}
      </div>
      <footer className="mt-10 text-center text-sm text-slate-700">
        <Link className="mx-3 hover:underline" href="/terms">Terms</Link>
        <Link className="mx-3 hover:underline" href="/privacy">Privacy</Link>
        <Link className="mx-3 hover:underline" href="/support">Support</Link>
      </footer>
    </main>
  );
}

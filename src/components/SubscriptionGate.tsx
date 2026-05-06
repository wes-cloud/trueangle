"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SubscriptionStatus = "loading" | "allowed" | "blocked" | "signed-out";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/start-trial",
  "/trial-success",
];

const PUBLIC_PREFIXES = [
  "/approve-estimate",
];

function isPublicPath(pathname: string | null) {
  if (!pathname) return true;

  if (PUBLIC_PATHS.includes(pathname)) return true;

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function SubscriptionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkSubscription() {
      try {
        setStatus("loading");
        setMessage("");

        if (isPublicPath(pathname)) {
          if (isMounted) setStatus("allowed");
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          if (isMounted) setStatus("signed-out");
          return;
        }

        const res = await fetch("/api/access/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        });

        if (!res.ok) {
          throw new Error("Could not check account access.");
        }

        const data = await res.json();

        if (isMounted) {
          setStatus(data.allowed ? "allowed" : "blocked");
        }
      } catch (err) {
        const error = err as Error;

        if (isMounted) {
          setMessage(error.message || "Access check failed.");
          setStatus("allowed");
        }
      }
    }

    checkSubscription();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="font-semibold text-slate-900">Checking access...</p>
        </div>
      </main>
    );
  }

  if (status === "allowed" || status === "signed-out") {
    return (
      <>
        {message && (
          <div className="bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-900">
            {message}
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold uppercase text-slate-600">TrueAngle</p>

        <h1 className="mt-2 text-4xl font-black">Start your free trial.</h1>

        <p className="mt-3 text-slate-700">
          Your account does not have an active subscription or trial yet.
        </p>

        <Link
          href="/start-trial"
          className="mt-6 inline-block rounded-xl bg-black px-5 py-3 font-bold text-white hover:bg-slate-800"
        >
          Start 14-Day Free Trial
        </Link>
      </div>
      {/* FOOTER */}
<footer className="border-t bg-white px-6 py-10">
  <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-4 md:flex-row">
    
    <p className="text-sm text-slate-600">
      © {new Date().getFullYear()} TrueAngle
    </p>

    <div className="flex gap-6 text-sm font-medium text-slate-700">
      <a href="/terms" className="hover:text-slate-950">
        Terms
      </a>
      <a href="/privacy" className="hover:text-slate-950">
        Privacy
      </a>
      <a href="/support" className="hover:text-slate-950">
        Support
      </a>
    </div>

  </div>
</footer>
    </main>
  );
}
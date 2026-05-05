"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SubscriptionStatus = "loading" | "allowed" | "blocked" | "signed-out";

const PUBLIC_PATHS = ["/", "/start-trial", "/auth", "/trial-success"];

export default function SubscriptionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SubscriptionStatus>("loading");

  useEffect(() => {
    async function checkSubscription() {
      if (PUBLIC_PATHS.includes(pathname)) {
        setStatus("allowed");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("signed-out");
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

      const data = await res.json();

      if (data.allowed) {
        setStatus("allowed");
        return;
      }

      setStatus("blocked");
    }

    checkSubscription();
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
    return <>{children}</>;
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
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TrialSuccessPage() {
  const [message, setMessage] = useState("Finishing your setup...");

  useEffect(() => {
    async function finishSetup() {
      const savedLogin = sessionStorage.getItem("trueangle_pending_login");

      if (!savedLogin) {
        setMessage("Trial started. Please sign in to continue.");
        window.location.href = "/auth";
        return;
      }

      const parsed = JSON.parse(savedLogin) as {
        email?: string;
        password?: string;
      };

      if (!parsed.email || !parsed.password) {
        setMessage("Trial started. Please sign in to continue.");
        window.location.href = "/auth";
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.email,
        password: parsed.password,
      });

      sessionStorage.removeItem("trueangle_pending_login");

      if (error) {
        setMessage("Trial started. Please sign in to continue.");
        window.location.href = "/auth";
        return;
      }

      window.location.href = "/dashboard?trial=success";
    }

    finishSetup();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold uppercase text-slate-600">
          TrueAngle
        </p>
        <h1 className="mt-2 text-3xl font-black">Setting up your account</h1>
        <p className="mt-3 text-slate-700">{message}</p>
      </div>
    </main>
  );
}
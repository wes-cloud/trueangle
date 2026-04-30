"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Sending sign-in link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Check your email for the sign-in link.");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <h1 className="text-3xl font-black">Sign in to TrueAngle</h1>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3"
          />

          <button className="w-full rounded-xl bg-black px-5 py-3 font-bold text-white">
            Send Sign-In Link
          </button>
        </form>

        {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
      </div>
    </main>
  );
}
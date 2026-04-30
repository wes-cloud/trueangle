"use client";

import { useState } from "react";

export default function StartTrialPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleStartTrial(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setMessage("Starting checkout...");

    const res = await fetch("/api/stripe/start-trial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Unable to start trial.");
      return;
    }

    sessionStorage.setItem(
  "trueangle_pending_login",
  JSON.stringify({ email, password })
);

    window.location.href = data.url;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold uppercase text-slate-600">
          TrueAngle
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Start your 14-day free trial.
        </h1>

        <p className="mt-3 text-slate-700">
          Create your account, start your trial, and get your numbers squared
          away.
        </p>

        <form onSubmit={handleStartTrial} className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3"
          />

          <input
            type="password"
            required
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3"
          />

          <input
            type="password"
            required
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-black px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            Start Free Trial
          </button>
        </form>

        {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
      </div>
    </main>
  );
}
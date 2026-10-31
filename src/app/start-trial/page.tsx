"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "new" | "returning";

export default function StartTrialPage() {
  const [step, setStep] = useState<"email" | "credentials">("email");
  const [mode, setMode] = useState<Mode>("new");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function continueWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!email.trim() || !email.includes("@")) return setMessage("Enter a valid email address.");
    setStep("credentials");
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setMessage("");
    if (password.length < 8) return setMessage("Password must contain at least 8 characters.");
    if (mode === "new" && password !== confirmPassword) return setMessage("Passwords do not match.");
    setLoading(true);
    try {
      if (mode === "returning") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error("Unable to sign in. Check your details or reset your password.");
        // The dashboard handles subscription access for signed-in customers.
        window.location.assign("/dashboard");
        return;
      }
      const response = await fetch("/api/stripe/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) {
          throw new Error("Unable to create a new trial with these details. If you already have an account, choose Sign in below.");
        }
        throw new Error(result.error || "Unable to start trial.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("Your account was prepared, but sign-in failed. Please use Sign in to continue.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const field = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-xl font-black text-white">T<span className="text-orange-500">A</span></div>
          <div><p className="text-lg font-black tracking-tight">TrueAngle</p><p className="text-xs font-medium text-slate-500">Built for tradesmen. Built to work.</p></div>
        </div>
        <div className="mt-9 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-white">{step === "email" ? "1" : "2"} of 2</span>
          <span>{step === "email" ? "Your email" : "Secure account access"}</span>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{step === "email" ? "Let's get started." : mode === "new" ? "Create your account." : "Welcome back."}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{step === "email" ? "Enter your email to get started with TrueAngle." : mode === "new" ? "Create a secure password, then activate your 14-day trial." : "Sign in securely to access your TrueAngle account."}</p>

        {step === "email" ? (
          <form onSubmit={continueWithEmail} className="mt-8 space-y-5">
            <div><label htmlFor="trial-email" className="mb-2 block text-sm font-semibold">Email address</label><input id="trial-email" className={field} type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white hover:bg-slate-800">Continue →</button>
          </form>
        ) : (
          <form onSubmit={submitCredentials} className="mt-7 space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3"><span className="truncate text-sm font-medium">{email}</span><button type="button" onClick={() => {setStep("email");setMessage("");setPassword("");setConfirmPassword("");}} className="text-sm font-bold underline">Edit</button></div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Account type">
              <button type="button" aria-pressed={mode === "new"} onClick={() => {setMode("new");setMessage("");}} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "new" ? "bg-white shadow-sm" : "text-slate-600"}`}>New account</button>
              <button type="button" aria-pressed={mode === "returning"} onClick={() => {setMode("returning");setMessage("");}} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "returning" ? "bg-white shadow-sm" : "text-slate-600"}`}>Sign in</button>
            </div>
            <div><label htmlFor="trial-password" className="mb-2 block text-sm font-semibold">{mode === "new" ? "Create password" : "Password"}</label><input id="trial-password" className={field} type="password" autoComplete={mode === "new" ? "new-password" : "current-password"} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></div>
            {mode === "new" && <div><label htmlFor="trial-confirm" className="mb-2 block text-sm font-semibold">Confirm password</label><input id="trial-confirm" className={field} type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">{loading ? "Please wait..." : mode === "new" ? "Continue to free trial →" : "Sign in →"}</button>
            {mode === "returning" && <a href="/auth" className="block text-center text-sm font-semibold underline">Need help signing in?</a>}
          </form>
        )}
        {message && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950">{message}</p>}
        <p className="mt-7 text-center text-xs leading-5 text-slate-500">Your account information is protected. Trial billing details are securely handled by Stripe.</p>
      </section>
    </main>
  );
}

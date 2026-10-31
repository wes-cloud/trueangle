"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function StartTrialPage() {
  const [step, setStep] = useState<"email" | "password" | "confirm">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function continueEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!email.trim() || !email.includes("@")) return setMessage("Enter a valid email address.");
    setStep("password");
  }

  async function continuePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    setLoading(true);
    setMessage("");
    try {
      // Never look up whether an email exists. A valid password proves ownership.
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error && data.user) {
        window.location.assign("/dashboard");
        return;
      }
      // Invalid credentials and new email addresses get the same experience.
      // Confirmation is required before attempting new-account creation.
      setStep("confirm");
    } catch {
      setMessage("We couldn't continue securely. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/stripe/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) {
          throw new Error("We couldn't complete account setup with those details. If you already have an account, check your password or use password recovery.");
        }
        throw new Error(result.error || "Unable to start your trial.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("Your account was prepared, but sign-in failed. Please sign in to continue.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start your trial.");
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
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{step === "email" ? "Let's get started." : step === "password" ? "Continue securely." : "One more step."}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{step === "email" ? "Enter your email to get started with TrueAngle." : step === "password" ? "Enter your password to continue. New to TrueAngle? We'll guide you through account setup." : "If you're creating a new account, confirm your password to start your free trial. Already registered? You can retry your password or recover access."}</p>
        {step === "email" ? (
          <form onSubmit={continueEmail} className="mt-8 space-y-5">
            <div><label htmlFor="trial-email" className="mb-2 block text-sm font-semibold">Email address</label><input id="trial-email" className={field} type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white hover:bg-slate-800">Continue →</button>
          </form>
        ) : (
          <form onSubmit={step === "password" ? continuePassword : startTrial} className="mt-7 space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3"><span className="truncate text-sm font-medium">{email}</span><button type="button" onClick={() => {setStep("email");setMessage("");setPassword("");setConfirmPassword("");}} className="text-sm font-bold underline">Edit</button></div>
            <div><label htmlFor="trial-password" className="mb-2 block text-sm font-semibold">Password</label><input id="trial-password" className={field} type="password" autoComplete="current-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></div>
            {step === "confirm" && <div><label htmlFor="trial-confirm" className="mb-2 block text-sm font-semibold">Confirm password for a new account</label><input id="trial-confirm" className={field} type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">{loading ? "Please wait..." : step === "password" ? "Continue securely →" : "Start 14-day free trial →"}</button>
            {step === "confirm" && <button type="button" onClick={() => {setStep("password");setMessage("");setConfirmPassword("");}} className="block w-full text-center text-sm font-semibold underline">Retry password</button>}
            <a href="/auth" className="block text-center text-sm font-semibold underline">Sign in or reset your password</a>
          </form>
        )}
        {message && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950">{message}</p>}
        <p className="mt-7 text-center text-xs leading-5 text-slate-500">Your account information is protected. Trial billing details are securely handled by Stripe.</p>
      </section>
    </main>
  );
}

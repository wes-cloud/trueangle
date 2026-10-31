"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function StartTrialPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleStartTrial(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    setLoading(true);
    setMessage("Starting checkout...");
    try {
      const res = await fetch("/api/stripe/start-trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to start trial.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Checkout was prepared, but sign-in failed. Please sign in before trying again.");
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start trial.");
      setLoading(false);
    }
  }
  return <main className="min-h-screen bg-slate-100 p-8 text-slate-950"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow"><p className="text-sm font-bold uppercase text-slate-600">TrueAngle</p><h1 className="mt-2 text-4xl font-black">Start your 14-day free trial.</h1><p className="mt-3 text-slate-700">Create your account, start your trial, and get your numbers squared away.</p><form onSubmit={handleStartTrial} className="mt-6 space-y-4"><input type="email" required placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3"/><input type="password" required placeholder="Create password (or enter existing password)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3"/><input type="password" required placeholder="Confirm password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3"/><button type="submit" disabled={loading} className="w-full rounded-xl bg-black px-5 py-3 font-bold text-white disabled:opacity-50">{loading?"Working...":"Start Free Trial"}</button></form><p className="mt-4 text-sm">Already have an account? Enter your existing password, or <a className="underline" href="/auth">sign in</a>.</p>{message&&<p role="alert" className="mt-4 text-sm font-semibold">{message}</p>}</div></main>;
}

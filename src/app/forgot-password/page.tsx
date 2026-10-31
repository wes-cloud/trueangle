"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password"
      });
      // Do not reveal whether an address exists, including when the provider rejects it.
      if (error) console.warn("Password recovery request was not accepted.");
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-black tracking-wide">TrueAngle</p>
        <h1 className="mt-5 text-3xl font-black">Reset your password</h1>
        {sent ? (
          <div className="mt-5 space-y-5">
            <p className="text-sm leading-6 text-slate-700" role="status">If an account is associated with that email, we'll send a password reset link. Check your inbox and spam folder.</p>
            <a href="/auth" className="block text-sm font-bold underline">Return to sign in</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <p className="text-sm leading-6 text-slate-600">Enter your email address and we'll send you instructions if an account is associated with it.</p>
            <div><label htmlFor="recovery-email" className="mb-2 block text-sm font-bold">Email address</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-900" placeholder="you@company.com" /></div>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-slate-950 p-3 font-bold text-white disabled:opacity-50">{loading ? "Please wait..." : "Send reset instructions"}</button>
            {message && <p role="alert">{message}</p>}
            <a href="/auth" className="block text-center text-sm font-bold underline">Back to sign in</a>
          </form>
        )}
      </section>
    </main>
  );
}

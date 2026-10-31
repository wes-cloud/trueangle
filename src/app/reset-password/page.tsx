"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setReady(true);
    });
    // The recovery link may already have been processed before this component mounted.
    // A recovery marker is stored only in this tab, never in localStorage.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      window.sessionStorage.setItem("trueangle-recovery", "1");
    }
    if (window.sessionStorage.getItem("trueangle-recovery") === "1") {
      supabase.auth.getSession().then(({ data }) => {
        if (active && data.session) setReady(true);
      });
    }
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setMessage("Use at least 8 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Unable to update your password. Your reset link may have expired. Request a new one.");
      setLoading(false);
      return;
    }
    window.sessionStorage.removeItem("trueangle-recovery");
    await supabase.auth.signOut();
    setDone(true);
    setLoading(false);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-black">TrueAngle</p>
        <h1 className="mt-5 text-3xl font-black">{done ? "Password updated" : "Choose a new password"}</h1>
        {done ? <div className="mt-5 space-y-5"><p>Your password has been updated. Sign in with your new password.</p><a href="/auth" className="font-bold underline">Sign in</a></div> :
          ready ? <form onSubmit={submit} className="mt-6 space-y-4">
            <label htmlFor="new-password" className="block text-sm font-bold">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" />
            <label htmlFor="confirm-password" className="block text-sm font-bold">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" />
            {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-slate-950 p-3 font-bold text-white disabled:opacity-50">{loading ? "Updating..." : "Update password"}</button>
          </form> : <div className="mt-5 space-y-4"><p className="text-sm text-slate-700">Open the secure link from your password reset email to continue. If your link has expired, request another.</p><a href="/forgot-password" className="font-bold underline">Request a new reset link</a></div>}
      </section>
    </main>
  );
}

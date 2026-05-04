"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth() {
    setLoading(true);
    setMessage("");

    if (!email || !password) {
      setMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage("Account created. Now sign in.");
      setIsSignUp(false);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-600">
            TrueAngle
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isSignUp ? "Create free account" : "Sign in"}
          </h1>

          <p className="mt-2 text-sm font-medium text-slate-700">
            {isSignUp
              ? "For bookkeepers, accountants, or invited team members. Owners should start a free trial from the homepage."
              : "Welcome back. Log in and get your numbers dialed in."}
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAuth}
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {loading
                ? "Working..."
                : isSignUp
                ? "Create Account"
                : "Sign In"}
            </button>
          </div>

          {message && (
            <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-800">
              {message}
            </p>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage("");
              }}
              className="text-sm font-bold text-slate-700 underline hover:text-slate-950"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Bookkeeper or invited user? Create a free account"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
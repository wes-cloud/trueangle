"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth() {
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage("Account created. You can now sign in.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        window.location.href = "/dashboard";
      }
    } catch (err) {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isSignUp ? "Create Account" : "Sign In"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 p-3 border rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
        />

        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-3 rounded font-semibold"
        >
          {loading
            ? "Working..."
            : isSignUp
            ? "Create Account"
            : "Sign In"}
        </button>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage("");
          }}
          className="mt-4 text-sm text-slate-600 underline w-full"
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "No account? Create one"}
        </button>

        {message && (
          <p className="mt-4 text-sm text-center text-red-600">{message}</p>
        )}
      </div>
    </main>
  );
}
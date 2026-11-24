"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InviteStatus = "loading" | "ready" | "accepted" | "error";

export default function InviteAcceptPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [message, setMessage] = useState("Checking invite...");
  const [inviteEmail, setInviteEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);

useEffect(() => {
  async function loadInvite() {
    const res = await fetch("/api/company/get-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inviteToken: token,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "This invite link is invalid or expired.");
      return;
    }

    setInviteEmail(data.email || "");
    setStatus("ready");
    setMessage("Sign in or create an account to accept the invitation.");
  }

  if (token) {
    loadInvite();
  }
}, [token]);

  async function handleAcceptInvite() {
    if (!inviteEmail || working) return;
    setWorking(true);
    setMessage("Checking account…");

    try {
      const { data: auth } = await supabase.auth.getSession();
      let session = auth.session;
      if (session?.user.email?.toLowerCase() !== inviteEmail.toLowerCase()) {
        if (!password) {
          setMessage("Enter your password to sign in or create an account.");
          return;
        }
        const signIn = await supabase.auth.signInWithPassword({ email: inviteEmail, password });
        session = signIn.data.session;
        if (signIn.error && !session) {
          const signUp = await supabase.auth.signUp({
            email: inviteEmail,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
          if (signUp.error) throw new Error(signUp.error.message);
          session = signUp.data.session;
        }
      }
      if (!session) {
        setMessage("Confirm your email, then reopen this invitation to finish.");
        return;
      }

      const res = await fetch("/api/company/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Could not accept invite.");
        setWorking(false);
        return;
      }

      setStatus("accepted");
      setMessage("Invite accepted. Taking you to the dashboard...");

      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Something went wrong accepting the invite.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow ring-1 ring-slate-200">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-600">
          TrueAngle
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Bookkeeper Invite
        </h1>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          {message}
        </p>

        {status === "ready" && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                disabled
                className="w-full rounded-xl border border-slate-300 bg-slate-100 p-3 text-slate-700"
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
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
              />
            </div>

            <button
              type="button"
              onClick={handleAcceptInvite}
              disabled={working}
              className="w-full rounded-xl bg-slate-950 px-5 py-3 font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {working ? "Working..." : "Accept Invite"}
            </button>
          </div>
        )}

        {status === "accepted" && (
          <p className="mt-6 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-900">
            Invitation accepted. Redirecting…
          </p>
        )}
      </div>
    </main>
  );
}

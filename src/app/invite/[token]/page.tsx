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
      const { data, error } = await supabase
        .from("company_invites")
        .select("email, status")
        .eq("invite_token", token)
        .maybeSingle();

      if (error || !data) {
        setStatus("error");
        setMessage("This invite link is invalid or expired.");
        return;
      }

      if (data.status !== "pending") {
        setStatus("error");
        setMessage("This invite has already been used.");
        return;
      }

      setInviteEmail(data.email || "");
      setStatus("ready");
      setMessage("Create your free bookkeeper account.");
    }

    if (token) {
      loadInvite();
    }
  }, [token]);

  async function handleAcceptInvite() {
    if (!inviteEmail || !password) {
      setMessage("Enter a password to finish creating your account.");
      return;
    }

    setWorking(true);
    setMessage("Creating account...");

    try {
      const signUpResult = await supabase.auth.signUp({
        email: inviteEmail,
        password,
      });

      if (signUpResult.error) {
        setMessage(signUpResult.error.message);
        setWorking(false);
        return;
      }

      const signInResult = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password,
      });

      if (signInResult.error) {
        setMessage(
          "Account created. Please sign in from the login page to finish."
        );
        setWorking(false);
        return;
      }

      const res = await fetch("/api/company/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteToken: token,
          email: inviteEmail,
          userId: signInResult.data.user.id,
        }),
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
      setMessage("Something went wrong accepting the invite.");
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
                Create Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
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
            You're in. Redirecting...
          </p>
        )}
      </div>
    </main>
  );
}
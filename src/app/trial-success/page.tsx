"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function TrialSuccessPage() {
  const [message,setMessage]=useState("Verifying your trial...");
  useEffect(()=>{
    async function confirm() {
      try {
        const sessionId=new URLSearchParams(window.location.search).get("session_id");
        if (!sessionId) throw new Error("Missing checkout session.");
        const {data:{session}}=await supabase.auth.getSession();
        if (!session) { setMessage("Please sign in to finish setup."); return; }
        const res=await fetch("/api/stripe/confirm-trial",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({session_id:sessionId})});
        const data=await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to confirm trial.");
        window.location.replace("/dashboard?trial=success");
      } catch(error) { setMessage((error instanceof Error?error.message:"Unable to confirm trial.")+" Please contact support; do not start another checkout."); }
    }
    confirm();
  },[]);
  return <main className="min-h-screen bg-slate-100 p-8 text-slate-950"><div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow"><h1 className="text-3xl font-black">Setting up your account</h1><p className="mt-3">{message}</p><a href="/auth" className="mt-4 inline-block underline">Sign in</a></div></main>;
}

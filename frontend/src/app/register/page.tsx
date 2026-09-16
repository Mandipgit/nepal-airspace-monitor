"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Radar } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background ambient radar glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top back link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition-colors backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Radar Map</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="mb-6 flex items-center space-x-2.5 z-10">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: "10s" }} />
        </div>
        <span className="text-sm font-bold tracking-widest uppercase text-slate-200">
          Nepal Airspace Monitor
        </span>
      </div>

      {/* Centered Register Card */}
      <div className="w-full max-w-md z-10">
        <RegisterForm
          onSuccess={() => router.push("/")}
          onSwitchToLogin={() => router.push("/login")}
        />
      </div>
    </div>
  );
}

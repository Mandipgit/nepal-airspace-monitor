"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Radar } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-[#080a0f] text-slate-100 relative overflow-hidden">
      {/* Top back link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#12151c] border border-white/8 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-white/15 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Radar Map</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="mb-6 flex items-center space-x-2.5 z-10">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400">
          <Radar className="w-4 h-4 animate-spin" style={{ animationDuration: "10s" }} />
        </div>
        <span className="text-xs font-bold tracking-widest uppercase font-mono-avionics text-slate-200">
          Nepal Airspace Monitor
        </span>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-md z-10">
        <LoginForm
          onSuccess={() => router.push("/")}
          onSwitchToRegister={() => router.push("/register")}
        />
      </div>
    </div>
  );
}

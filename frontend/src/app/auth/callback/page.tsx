"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { verifyGoogleSessionApi } from "@/lib/authApi";
import { Spinner } from "@heroui/react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string>("Verifying Google authentication...");
  const processedRef = useRef<boolean>(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;

        // 1. Check for OAuth errors (e.g. user cancelled)
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          console.warn("Google OAuth callback error:", error, errorDescription);
          if (error === "access_denied" || (errorDescription && errorDescription.toLowerCase().includes("cancel"))) {
            router.replace("/login?error=" + encodeURIComponent("Google authentication was cancelled."));
          } else {
            router.replace("/login?error=" + encodeURIComponent("Google authentication failed. Please try again."));
          }
          return;
        }

        setStatusMessage("Establishing secure AeroTrace session...");
        const supabase = getSupabaseBrowserClient();

        // 2. Exchange authorization code for session (PKCE flow)
        const code = searchParams.get("code");
        let session = null;

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Supabase code exchange error:", exchangeError);
            router.replace("/login?error=" + encodeURIComponent("Unable to verify Google authentication session."));
            return;
          }
          session = data.session;
        } else {
          // Check for existing session or hash fragment
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !data.session) {
            console.error("No active session found:", sessionError);
            router.replace("/login?error=" + encodeURIComponent("No authentication session was found."));
            return;
          }
          session = data.session;
        }

        if (!session || !session.access_token) {
          router.replace("/login?error=" + encodeURIComponent("Failed to retrieve Google authentication tokens."));
          return;
        }

        // 3. Retrieve preserved application profile data (First Name & Last Name)
        let firstName: string | undefined;
        let lastName: string | undefined;

        try {
          const storedProfileJson =
            sessionStorage.getItem("aerotrace_signup_profile") ||
            getCookie("aerotrace_signup_profile");

          if (storedProfileJson) {
            const parsed = JSON.parse(storedProfileJson);
            firstName = parsed.first_name;
            lastName = parsed.last_name;
          }
        } catch (e) {
          console.debug("Could not parse stored signup profile:", e);
        }

        // 4. Verify session with FastAPI backend and create/link AeroTrace user profile
        setStatusMessage("Configuring your AeroTrace pilot profile...");
        const authResult = await verifyGoogleSessionApi(
          session.access_token,
          firstName,
          lastName
        );

        // 5. Store AeroTrace tokens in localStorage for AuthContext
        localStorage.setItem("access_token", authResult.access_token);
        if (authResult.refresh_token) {
          localStorage.setItem("refresh_token", authResult.refresh_token);
        }

        // Clean up temporary signup storage
        sessionStorage.removeItem("aerotrace_signup_profile");
        deleteCookie("aerotrace_signup_profile");

        // 6. Redirect to dashboard
        setStatusMessage("Authentication successful. Entering radar dashboard...");
        router.replace("/");
      } catch (err) {
        console.error("OAuth processing exception:", err);
        const msg = err instanceof Error ? err.message : "Authentication failed.";
        router.replace("/login?error=" + encodeURIComponent(msg));
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-[#000000] text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
        <div className="relative">
          <Spinner size="lg" className="w-8 h-8 border-[#1990f8] border-t-transparent animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Authenticating with Google
          </h2>
          <p className="text-xs text-neutral-400 font-mono-avionics">
            {statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
}

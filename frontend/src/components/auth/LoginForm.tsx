"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  TextField,
  Label,
  InputGroup,
  FieldError,
  Button,
  Spinner,
  Alert,
  Link,
  Separator,
} from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, LogIn, AlertCircle } from "lucide-react";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
}) => {
  const { login, authError, clearAuthError } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Capture callback error messages from URL search params cleanly
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        setLocalError(err);
      }
    }
  }, []);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);

    if (!validate() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      // Handled in AuthContext (authError state set)
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setLocalError(null);
    setIsGoogleLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectOrigin =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectOrigin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        console.error("Supabase Google OAuth sign-in error:", error);
        setLocalError(
          "Google authentication service is currently unavailable. Please verify your Google provider configuration."
        );
        setIsGoogleLoading(false);
      }
    } catch (err) {
      console.error("Google sign-in exception:", err);
      setLocalError("Unable to initiate Google authentication. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const activeError = localError || authError;

  return (
    <Card className="w-full max-w-md border border-white/8 bg-[#0a0a0a] text-neutral-100 shadow-2xl rounded-2xl overflow-hidden">
      {/* Header */}
      <Card.Header className="px-7 pt-7 pb-4 flex flex-col items-start gap-1.5 border-b border-white/8 bg-[#0e0e0e]">
        <div className="flex items-center space-x-2 text-neutral-300 mb-1">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <ShieldCheck className="w-4 h-4 text-neutral-300" />
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase font-mono-avionics text-neutral-400">
            Nepal Airspace Monitor
          </span>
        </div>
        <Card.Title className="text-xl font-bold tracking-tight text-white">
          Sign In
        </Card.Title>
        <Card.Description className="text-xs text-neutral-400 leading-relaxed">
          Access real-time Kathmandu FIR tracking, ADS-B telemetry, and fleet analytics.
        </Card.Description>
      </Card.Header>

      {/* Body / Form */}
      <Card.Content className="px-7 py-6">
        {/* Error Banner */}
        {activeError && (
          <div className="mb-5">
            <Alert status="danger" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
              <Alert.Content className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <Alert.Title className="font-semibold text-rose-300">
                    Authentication Notice
                  </Alert.Title>
                  <Alert.Description className="text-rose-300/90 mt-0.5">
                    {activeError}
                  </Alert.Description>
                </div>
              </Alert.Content>
            </Alert>
          </div>
        )}

        <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email Field */}
          <TextField
            isRequired
            isInvalid={!!clientErrors.email}
            className="flex flex-col gap-1.5"
          >
            <Label className="text-xs font-medium text-neutral-300">
              Email Address
            </Label>
            <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-2 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <InputGroup.Prefix className="mr-2 text-neutral-400 shrink-0">
                <Mail className="w-4 h-4" />
              </InputGroup.Prefix>
              <InputGroup.Input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                  if (clientErrors.email) {
                    setClientErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="pilot@airline.com"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
              />
            </InputGroup>
            {clientErrors.email && (
              <FieldError className="text-[11px] text-rose-400 font-medium">
                {clientErrors.email}
              </FieldError>
            )}
          </TextField>

          {/* Password Field */}
          <TextField
            isRequired
            isInvalid={!!clientErrors.password}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-neutral-300">
                Password
              </Label>
            </div>
            <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-2 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <InputGroup.Prefix className="mr-2 text-neutral-400 shrink-0">
                <Lock className="w-4 h-4" />
              </InputGroup.Prefix>
              <InputGroup.Input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setPassword(e.target.value);
                  if (clientErrors.password) {
                    setClientErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="••••••••"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
              />
              <InputGroup.Suffix className="ml-2 text-neutral-400 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-neutral-400 hover:text-neutral-200 transition-colors p-0.5 cursor-pointer focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </InputGroup.Suffix>
            </InputGroup>
            {clientErrors.password && (
              <FieldError className="text-[11px] text-rose-400 font-medium">
                {clientErrors.password}
              </FieldError>
            )}
          </TextField>

          {/* Submit Button */}
          <Button
            type="submit"
            isDisabled={isSubmitting || isGoogleLoading}
            fullWidth
            className="mt-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-white hover:bg-neutral-200 text-black shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="w-4 h-4 border-black border-t-transparent animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-black" />
                <span>Sign In</span>
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-1 flex items-center justify-center">
            <Separator orientation="horizontal" className="w-full bg-white/8" />
            <span className="absolute bg-[#0a0a0a] px-3 text-[11px] font-mono-avionics uppercase text-neutral-400">
              or
            </span>
          </div>

          {/* Continue with Google Button */}
          <Button
            type="button"
            onPress={handleGoogleSignIn}
            isDisabled={isGoogleLoading || isSubmitting}
            fullWidth
            className="flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl font-medium text-sm border border-white/12 bg-[#141414] hover:bg-white/5 active:bg-white/10 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Spinner size="sm" className="w-4 h-4 border-white border-t-transparent animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleLogo className="w-4 h-4 shrink-0" />
                <span>Continue with Google</span>
              </>
            )}
          </Button>
        </Form>
      </Card.Content>

      {/* Footer / Navigation */}
      <Card.Footer className="px-7 py-4 border-t border-white/8 bg-[#0e0e0e] flex flex-col items-center justify-center gap-3">
        <Separator orientation="horizontal" className="w-full bg-white/5" />
        <div className="text-xs text-neutral-400 flex items-center gap-1.5">
          <span>Don&apos;t have an account?</span>
          {onSwitchToRegister ? (
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-neutral-200 hover:text-white font-semibold underline underline-offset-4 transition-colors cursor-pointer"
            >
              Create an account
            </button>
          ) : (
            <Link
              href="/register"
              className="text-neutral-200 hover:text-white font-semibold underline underline-offset-4 transition-colors"
            >
              Create an account
            </Link>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
};

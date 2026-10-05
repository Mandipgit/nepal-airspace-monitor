"use client";

import React, { useState } from "react";
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
import { User as UserIcon, Mail, Lock, Eye, EyeOff, ShieldAlert, ArrowLeft } from "lucide-react";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
}) => {
  const { register, authError, clearAuthError } = useAuth();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleGoogleSignup = async () => {
    clearAuthError();
    setLocalError(null);

    const errors: { firstName?: string; lastName?: string } = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required.";
    }
    if (!lastName.trim()) {
      errors.lastName = "Last name is required.";
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});
    setIsGoogleLoading(true);

    try {
      // 1. Securely preserve user's submitted First and Last Name for the OAuth callback
      const profileData = JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem("aerotrace_signup_profile", profileData);
        document.cookie = `aerotrace_signup_profile=${encodeURIComponent(
          profileData
        )}; Path=/; Max-Age=3600; SameSite=Lax`;
      }

      // 2. Initiate real Google OAuth with Supabase
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
        console.error("Supabase Google OAuth initiation error:", error);
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

  const validateManual = (): boolean => {
    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required.";
    }
    if (!lastName.trim()) {
      errors.lastName = "Last name is required.";
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);

    if (!validateManual() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      // Handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = localError || authError;

  return (
    <Card className="w-full max-w-md border border-white/8 bg-[#0a0a0a] text-neutral-100 shadow-2xl rounded-2xl overflow-hidden">
      {/* Header */}
      <Card.Header className="relative px-7 pt-6 pb-5 flex items-center justify-center border-b border-white/8 bg-[#0e0e0e]">
        {onSwitchToLogin && (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="absolute left-7 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white transition-all duration-150 active:scale-95 shadow-sm group shrink-0 cursor-pointer"
            title="Back to Sign In"
            aria-label="Back to Sign In"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-neutral-300 group-hover:text-white" />
          </button>
        )}
        <Card.Title className="text-xl font-bold tracking-tight text-white text-center">
          Create Account
        </Card.Title>
      </Card.Header>

      {/* Body / Form */}
      <Card.Content className="px-7 py-6">
        {/* Error Banner */}
        {activeError && (
          <div className="mb-5">
            <Alert status="danger" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
              <Alert.Content className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <Alert.Title className="font-semibold text-rose-300">
                    Registration Notice
                  </Alert.Title>
                  <Alert.Description className="text-rose-300/90 mt-0.5">
                    {activeError}
                  </Alert.Description>
                </div>
              </Alert.Content>
            </Alert>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Name Row (First Name + Last Name — Required application profile info) */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              isRequired
              isInvalid={!!clientErrors.firstName}
              className="flex flex-col gap-1"
            >
              <Label className="text-xs font-medium text-neutral-300">
                First Name
              </Label>
              <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-2 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <InputGroup.Prefix className="mr-2 text-neutral-400 shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  type="text"
                  name="first_name"
                  value={firstName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFirstName(e.target.value);
                    if (clientErrors.firstName) {
                      setClientErrors((prev) => ({ ...prev, firstName: undefined }));
                    }
                  }}
                  placeholder="Ram"
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
                />
              </InputGroup>
              {clientErrors.firstName && (
                <FieldError className="text-[10px] text-rose-400 font-medium">
                  {clientErrors.firstName}
                </FieldError>
              )}
            </TextField>

            <TextField
              isRequired
              isInvalid={!!clientErrors.lastName}
              className="flex flex-col gap-1"
            >
              <Label className="text-xs font-medium text-neutral-300">
                Last Name
              </Label>
              <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-2 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <InputGroup.Input
                  type="text"
                  name="last_name"
                  value={lastName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setLastName(e.target.value);
                    if (clientErrors.lastName) {
                      setClientErrors((prev) => ({ ...prev, lastName: undefined }));
                    }
                  }}
                  placeholder="Shrestha"
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
                />
              </InputGroup>
              {clientErrors.lastName && (
                <FieldError className="text-[10px] text-rose-400 font-medium">
                  {clientErrors.lastName}
                </FieldError>
              )}
            </TextField>
          </div>

          {/* Primary Action: Continue with Google Button */}
          <Button
            type="button"
            onPress={handleGoogleSignup}
            isDisabled={isGoogleLoading || isSubmitting}
            fullWidth
            className="mt-1 flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl font-semibold text-sm border border-white/15 bg-white hover:bg-neutral-100 text-black shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Spinner size="sm" className="w-4 h-4 border-black border-t-transparent animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleLogo className="w-4 h-4 shrink-0" />
                <span>Continue with Google</span>
              </>
            )}
          </Button>

          {/* Secondary Option: Manual Email & Password Accordion/Toggle */}
          {!showManualForm ? (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                Or register with email and password
              </button>
            </div>
          ) : (
            <Form onSubmit={handleManualSubmit} className="flex flex-col gap-3 pt-2 border-t border-white/8">
              {/* Email */}
              <TextField
                isRequired
                isInvalid={!!clientErrors.email}
                className="flex flex-col gap-1"
              >
                <Label className="text-xs font-medium text-neutral-300">
                  Email Address
                </Label>
                <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
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
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
                  />
                </InputGroup>
                {clientErrors.email && (
                  <FieldError className="text-[11px] text-rose-400 font-medium">
                    {clientErrors.email}
                  </FieldError>
                )}
              </TextField>

              {/* Password */}
              <TextField
                isRequired
                isInvalid={!!clientErrors.password}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-neutral-300">
                    Password
                  </Label>
                  <span className="text-[10px] text-neutral-500">Min. 8 chars</span>
                </div>
                <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                  <InputGroup.Prefix className="mr-2 text-neutral-400 shrink-0">
                    <Lock className="w-4 h-4" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setPassword(e.target.value);
                      if (clientErrors.password) {
                        setClientErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="At least 8 characters"
                    disabled={isSubmitting}
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

              {/* Confirm Password */}
              <TextField
                isRequired
                isInvalid={!!clientErrors.confirmPassword}
                className="flex flex-col gap-1"
              >
                <Label className="text-xs font-medium text-neutral-300">
                  Confirm Password
                </Label>
                <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#141414] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                  <InputGroup.Prefix className="mr-2 text-neutral-400 shrink-0">
                    <Lock className="w-4 h-4" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm_password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setConfirmPassword(e.target.value);
                      if (clientErrors.confirmPassword) {
                        setClientErrors((prev) => ({
                          ...prev,
                          confirmPassword: undefined,
                        }));
                      }
                    }}
                    placeholder="Repeat password"
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-500 text-sm outline-none"
                  />
                  <InputGroup.Suffix className="ml-2 text-neutral-400 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="text-neutral-400 hover:text-neutral-200 transition-colors p-0.5 cursor-pointer focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </InputGroup.Suffix>
                </InputGroup>
                {clientErrors.confirmPassword && (
                  <FieldError className="text-[11px] text-rose-400 font-medium">
                    {clientErrors.confirmPassword}
                  </FieldError>
                )}
              </TextField>

              <Button
                type="submit"
                isDisabled={isSubmitting}
                fullWidth
                className="mt-2 flex items-center justify-center space-x-2 py-2 px-4 rounded-xl font-medium text-xs bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="w-3.5 h-3.5 border-white border-t-transparent animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Register with Password</span>
                )}
              </Button>
            </Form>
          )}
        </div>
      </Card.Content>

      {/* Footer / Navigation */}
      <Card.Footer className="px-7 py-4 border-t border-white/8 bg-[#0e0e0e] flex flex-col items-center justify-center gap-3">
        <Separator orientation="horizontal" className="w-full bg-white/5" />
        <div className="text-xs text-neutral-400 flex items-center gap-1.5">
          <span>Already have an account?</span>
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-neutral-200 hover:text-white font-semibold underline underline-offset-4 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          ) : (
            <Link
              href="/login"
              className="text-neutral-200 hover:text-white font-semibold underline underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
};

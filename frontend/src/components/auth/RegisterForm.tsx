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
import { User as UserIcon, Mail, Lock, Eye, EyeOff, UserPlus, ShieldAlert } from "lucide-react";

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [clientErrors, setClientErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = (): boolean => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (!validate() || isSubmitting) {
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
      // Handled in AuthContext (authError state set)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border border-white/8 bg-[#11141b] text-slate-100 shadow-2xl rounded-2xl overflow-hidden">
      {/* Header */}
      <Card.Header className="px-7 pt-7 pb-4 flex flex-col items-start gap-1.5 border-b border-white/7 bg-[#0d1017]">
        <div className="flex items-center space-x-2 text-slate-300 mb-1">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <UserPlus className="w-4 h-4 text-slate-300" />
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase font-mono-avionics text-slate-400">
            Nepal Airspace Monitor
          </span>
        </div>
        <Card.Title className="text-xl font-bold tracking-tight text-white">
          Create Account
        </Card.Title>
        <Card.Description className="text-xs text-slate-400 leading-relaxed">
          Join the Nepalese aviation monitoring community to track flights and inspect avionics.
        </Card.Description>
      </Card.Header>

      {/* Body / Form */}
      <Card.Content className="px-7 py-6">
        {/* Backend Error Banner */}
        {authError && (
          <div className="mb-5">
            <Alert status="danger" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
              <Alert.Content className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <Alert.Title className="font-semibold text-rose-300">
                    Registration Notice
                  </Alert.Title>
                  <Alert.Description className="text-rose-300/90 mt-0.5">
                    {authError}
                  </Alert.Description>
                </div>
              </Alert.Content>
            </Alert>
          </div>
        )}

        <Form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Name Row (First + Last) */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              isRequired
              isInvalid={!!clientErrors.firstName}
              className="flex flex-col gap-1"
            >
              <Label className="text-xs font-medium text-slate-300">
                First Name
              </Label>
              <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#181c26] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <InputGroup.Prefix className="mr-2 text-slate-400 shrink-0">
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
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm outline-none"
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
              <Label className="text-xs font-medium text-slate-300">
                Last Name
              </Label>
              <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#181c26] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
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
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm outline-none"
                />
              </InputGroup>
              {clientErrors.lastName && (
                <FieldError className="text-[10px] text-rose-400 font-medium">
                  {clientErrors.lastName}
                </FieldError>
              )}
            </TextField>
          </div>

          {/* Email */}
          <TextField
            isRequired
            isInvalid={!!clientErrors.email}
            className="flex flex-col gap-1"
          >
            <Label className="text-xs font-medium text-slate-300">
              Email Address
            </Label>
            <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#181c26] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <InputGroup.Prefix className="mr-2 text-slate-400 shrink-0">
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
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm outline-none"
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
              <Label className="text-xs font-medium text-slate-300">
                Password
              </Label>
              <span className="text-[10px] text-slate-500">Min. 8 chars</span>
            </div>
            <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#181c26] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <InputGroup.Prefix className="mr-2 text-slate-400 shrink-0">
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
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm outline-none"
              />
              <InputGroup.Suffix className="ml-2 text-slate-400 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 cursor-pointer focus:outline-none"
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
            <Label className="text-xs font-medium text-slate-300">
              Confirm Password
            </Label>
            <InputGroup className="flex items-center rounded-xl border border-white/8 bg-[#181c26] px-3 py-1.5 text-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <InputGroup.Prefix className="mr-2 text-slate-400 shrink-0">
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
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm outline-none"
              />
              <InputGroup.Suffix className="ml-2 text-slate-400 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 cursor-pointer focus:outline-none"
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

          {/* Submit Button */}
          <Button
            type="submit"
            isDisabled={isSubmitting}
            fullWidth
            className="mt-3 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-white hover:bg-slate-200 text-slate-950 shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="w-4 h-4 border-slate-950 border-t-transparent animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-slate-950" />
                <span>Create Account</span>
              </>
            )}
          </Button>
        </Form>
      </Card.Content>

      {/* Footer / Navigation */}
      <Card.Footer className="px-7 py-4 border-t border-white/7 bg-[#0d1017] flex flex-col items-center justify-center gap-3">
        <Separator orientation="horizontal" className="w-full bg-white/5" />
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span>Already have an account?</span>
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-slate-200 hover:text-white font-semibold underline underline-offset-4 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          ) : (
            <Link
              href="/login"
              className="text-slate-200 hover:text-white font-semibold underline underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
};

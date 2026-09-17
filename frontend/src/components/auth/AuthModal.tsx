"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { X } from "lucide-react";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, modalMode, openAuthModal } = useAuth();

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Backdrop click interceptor */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={closeAuthModal}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={closeAuthModal}
          aria-label="Close modal"
          className="absolute -top-3.5 -right-3.5 z-20 w-8 h-8 rounded-full bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-800 shadow-2xl transition-all cursor-pointer flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </Button>

        {modalMode === "login" ? (
          <LoginForm
            onSuccess={closeAuthModal}
            onSwitchToRegister={() => openAuthModal("register")}
          />
        ) : (
          <RegisterForm
            onSuccess={closeAuthModal}
            onSwitchToLogin={() => openAuthModal("login")}
          />
        )}
      </div>
    </div>
  );
};

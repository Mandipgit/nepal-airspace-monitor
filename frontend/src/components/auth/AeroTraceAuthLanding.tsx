"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AeroTraceAnimatedLogo } from "@/components/common/AeroTraceAnimatedLogo";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuth } from "@/context/AuthContext";

interface AeroTraceAuthLandingProps {
  initialMode?: "login" | "register";
}

type Stage = "animating" | "logo-moving" | "card-entrance" | "settled";

export const AeroTraceAuthLanding: React.FC<AeroTraceAuthLandingProps> = ({
  initialMode = "login",
}) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [authMode, setAuthMode] = useState<"login" | "register">(initialMode);
  const [stage, setStage] = useState<Stage>(() => {
    if (typeof window !== "undefined") {
      const alreadyPlayed = sessionStorage.getItem("aerotrace_login_anim_done");
      if (alreadyPlayed === "true") {
        return "settled";
      }
    }
    return "animating";
  });
  const [offsetY, setOffsetY] = useState<number>(240);
  const [initialScale, setInitialScale] = useState<number>(1.16);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage>("animating");

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // If already authenticated, redirect immediately to dashboard without forcing login
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Compute exact offset so the logo is dead-center in the viewport during Stage 1
  useEffect(() => {
    const updateDimensions = () => {
      // Only recalculate while the logo is in the animating state
      if (stageRef.current !== "animating") return;

      const width = window.innerWidth;
      let scale = 1.16;
      if (width < 480) {
        scale = 1.05;
      } else if (width < 768) {
        scale = 1.12;
      }
      setInitialScale(scale);

      if (mainContainerRef.current && logoWrapperRef.current) {
        const mainRect = mainContainerRef.current.getBoundingClientRect();
        const logoH = logoWrapperRef.current.offsetHeight;
        if (logoH > 0) {
          const unTransformedLogoCenter = mainRect.top + logoH / 2;
          const viewportCenter = window.innerHeight / 2;
          const calculated = viewportCenter - unTransformedLogoCenter;
          setOffsetY(calculated);
        }
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && mainContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(mainContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // When the logo animation finishes:
  const handleLogoAnimationComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aerotrace_login_anim_done", "true");
      localStorage.setItem("aerotrace_has_visited", "true");
    }
    setStage((prev) => {
      if (prev === "animating") {
        return "logo-moving";
      }
      return prev;
    });
  }, []);

  // Sequence: logo-moving -> (short natural pause) -> card-entrance -> settled
  useEffect(() => {
    if (stage === "logo-moving") {
      // Logo moves upward and scales down over 950ms.
      // After 950ms movement + 180ms natural pause = 1130ms, card enters smoothly.
      const moveTimer = setTimeout(() => {
        setStage("card-entrance");
      }, 1130);
      return () => clearTimeout(moveTimer);
    }

    if (stage === "card-entrance") {
      // Card entrance takes 750ms. Then mark settled.
      const settleTimer = setTimeout(() => {
        setStage("settled");
      }, 800);
      return () => clearTimeout(settleTimer);
    }
  }, [stage]);

  // Fallback safety timer in case tab is backgrounded
  useEffect(() => {
    const fallback = setTimeout(() => {
      setStage((prev) => (prev === "animating" ? "logo-moving" : prev));
    }, 5500);
    return () => clearTimeout(fallback);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_has_visited", "true");
    }
    router.push("/");
  }, [router]);

  if (isLoading || isAuthenticated) {
    return <div className="min-h-screen w-full bg-[#000000]" />;
  }

  // Logo transform style:
  // In 'animating': shifted to screen center, scaled to hero size
  // In 'logo-moving', 'card-entrance', 'settled': at natural position (0px), scale 1
  const isLogoCentered = stage === "animating";
  const logoTransform = isLogoCentered
    ? `translate3d(0, ${offsetY}px, 0) scale(${initialScale})`
    : `translate3d(0, 0px, 0) scale(1)`;

  const logoTransition =
    stage === "animating"
      ? "none"
      : "transform 950ms cubic-bezier(0.16, 1, 0.3, 1)";

  // Card entrance style:
  // In 'animating' & 'logo-moving': invisible, slightly lower
  // In 'card-entrance' & 'settled': visible, natural position
  const isCardVisible = stage === "card-entrance" || stage === "settled";

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#000000] text-neutral-100 flex flex-col items-center overflow-x-hidden overflow-y-auto selection:bg-[#1890f8]/30">
      {/* Centered Main Container — maintains continuous layout throughout the entire scene */}
      <div
        ref={mainContainerRef}
        className="w-full max-w-md flex flex-col items-center my-auto px-4 py-8 sm:py-12 z-10 shrink-0"
      >
        {/* Continuous AeroTrace Logo Container */}
        <div
          ref={logoWrapperRef}
          className="w-full max-w-[420px] sm:max-w-[448px] flex items-center justify-center mb-6 sm:mb-8 will-change-transform"
          style={{
            transform: logoTransform,
            transition: logoTransition,
            transformOrigin: "center center",
          }}
        >
          <AeroTraceAnimatedLogo
            width="100%"
            autoPlay={true}
            onComplete={handleLogoAnimationComplete}
          />
        </div>

        {/* Hero UI Authentication Card */}
        <div
          className="w-full will-change-transform"
          style={{
            opacity: isCardVisible ? 1 : 0,
            transform: isCardVisible
              ? "translate3d(0, 0px, 0)"
              : "translate3d(0, 18px, 0)",
            pointerEvents: stage === "settled" ? "auto" : "none",
            transition:
              "opacity 750ms cubic-bezier(0.16, 1, 0.3, 1), transform 750ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {authMode === "login" ? (
            <LoginForm
              onSuccess={handleAuthSuccess}
              onSwitchToRegister={() => setAuthMode("register")}
            />
          ) : (
            <RegisterForm
              onSuccess={handleAuthSuccess}
              onSwitchToLogin={() => setAuthMode("login")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

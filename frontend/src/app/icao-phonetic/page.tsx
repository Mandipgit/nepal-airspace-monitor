"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Button,
  Spinner,
  Card,
  CloseButton,
  ScrollShadow,
} from "@heroui/react";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Volume2,
} from "lucide-react";
import { IcaoPhoneticItem, fetchIcaoPhoneticAlphabet } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";

export default function IcaoPhoneticPage() {
  const [alphabet, setAlphabet] = useState<IcaoPhoneticItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // Fetch ICAO phonetic alphabet strictly from the backend database
  const loadAlphabet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchIcaoPhoneticAlphabet();
      setAlphabet(response.alphabet || []);
    } catch (err: unknown) {
      const msg = getUserFriendlyErrorMessage(err, "icao_phonetic");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlphabet();
  }, [loadAlphabet]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-primary)] relative font-sans">
      {/* Main Operations Container */}
      <div className="flex flex-1 w-full h-full overflow-hidden relative">
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header Section with Back Button */}
            <div className="relative flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white transition-all duration-150 active:scale-95 shadow-sm group shrink-0 cursor-pointer"
                  title="Return to Live Airspace Map"
                  aria-label="Return to Live Airspace Map"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-neutral-300 group-hover:text-white" />
                </Link>

                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#FAFAFA] font-sans">
                    ICAO Phonetic Alphabet
                  </h1>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Hero UI Primary Pill Button matching reference */}
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => setIsInfoModalOpen(true)}
                  className="rounded-full bg-[#006FEE] hover:bg-[#005bc4] text-white font-medium text-xs sm:text-sm px-4 sm:px-5 py-2 shadow-md hover:shadow-[#006FEE]/25 transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  What is ICAO Phonetic Alphabet?
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onPress={loadAlphabet}
                  isDisabled={loading}
                  className="text-xs text-neutral-300 hover:text-white hover:bg-white/5 border border-white/10 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center justify-between font-sans">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={loadAlphabet}
                  className="text-xs bg-rose-500/20 text-rose-200 border border-rose-500/30"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loading State */}
            {loading && alphabet.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Spinner size="lg" className="w-9 h-9 border-[#108AEF] border-t-transparent animate-spin" />
                <p className="text-sm text-neutral-400 font-sans">Loading ICAO phonetic records from database...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && alphabet.length === 0 && (
              <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center mx-auto text-neutral-400">
                  <Volume2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-sans">No Records Found</h3>
                <p className="text-xs text-neutral-400 font-sans max-w-sm mx-auto">
                  No ICAO phonetic alphabet entries were returned from the backend.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={loadAlphabet}
                  className="text-xs text-neutral-300 border border-white/10 hover:bg-white/5"
                >
                  Reload Dataset
                </Button>
              </div>
            )}

            {/* Responsive Balanced 26-Letter Cards Grid */}
            {alphabet.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 max-w-6xl mx-auto">
                {alphabet.map((item) => (
                  <div
                    key={item.letter}
                    className={`group aspect-square rounded-2xl bg-[#111113] hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/20 p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-all duration-150 active:scale-[0.98] select-none shadow-sm ${
                      item.letter === "V" ? "lg:col-start-2" : ""
                    }`}
                  >
                    {/* Alphabet letter in large bold typography */}
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-sans group-hover:text-amber-400 transition-colors duration-150 leading-none">
                      {item.letter}
                    </span>

                    {/* Corresponding ICAO phonetic word in blue */}
                    <span className="text-sm sm:text-base font-bold text-sky-400 group-hover:text-sky-300 mt-2 sm:mt-2.5 tracking-wide font-sans leading-tight">
                      {item.phonetic}
                    </span>

                    {/* Database Pronunciation Guide */}
                    {item.pronunciation && (
                      <span className="text-[11px] sm:text-xs font-mono font-medium text-neutral-400 mt-1 tracking-wider leading-none">
                        /{item.pronunciation}/
                      </span>
                    )}

                    {/* Subtle Morse code indicator */}
                    {item.morse_code && (
                      <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-neutral-500 group-hover:text-neutral-400 mt-1 leading-none">
                        {item.morse_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Explanatory Popup Modal Powered by Hero UI Components */}
      {isInfoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setIsInfoModalOpen(false)}
        >
          <Card
            className="w-full max-w-xl border border-white/10 bg-[#0e0e11] text-[#FAFAFA] shadow-2xl rounded-2xl overflow-hidden my-auto relative"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Compact Header: Reduced height with title and top-right close button */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#141417] flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                What is ICAO Phonetic Alphabet?
              </h3>

              <CloseButton
                onPress={() => setIsInfoModalOpen(false)}
                className="text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors cursor-pointer shrink-0"
                aria-label="Close dialog"
              />
            </div>

            {/* Hero UI Card Content with ScrollShadow */}
            <Card.Content className="p-5">
              <ScrollShadow className="max-h-[68vh] space-y-3.5 pr-1">
                {/* Definition & Purpose section - No icon */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-400 font-sans">
                    Definition &amp; Purpose
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                    The ICAO Phonetic Alphabet is the officially standardized spelling alphabet
                    used across international aviation and maritime operations. It assigns 26 code words
                    acrophonically to each English letter (from <strong className="text-white font-semibold">Alpha</strong> for A to <strong className="text-white font-semibold">Zulu</strong> for Z)
                    to eliminate acoustic ambiguity and misinterpretation over radio channels.
                  </p>
                </div>

                {/* Operational Uses section - No icon */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-sans">
                    Operational Uses
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white font-semibold">Air Traffic Control (ATC):</strong> Transmitting aircraft callsigns, tail numbers (e.g., Nepal&apos;s <em className="text-emerald-300 not-italic font-mono">9N-AEV</em> as <span className="text-neutral-200">&quot;Nine November - Alpha Echo Victor&quot;</span>), and transponder squawk codes.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white font-semibold">Navigation Points &amp; Runways:</strong> Designating waypoints, standard arrival routes, and runway clearances (e.g., Runway 02 at VNKT Kathmandu).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white font-semibold">Distinction in High-Noise Environments:</strong> Easily distinguishing phonetically similar consonants (such as <em className="text-emerald-300 not-italic font-mono">B, D, P, T</em> or <em className="text-emerald-300 not-italic font-mono">M, N</em>) through atmospheric static, engine rumble, and signal fade.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white font-semibold">Global Interoperability:</strong> Ensures flawless communication between pilots and controllers across diverse mother tongues and regional accents worldwide.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* A Short History section - No icon */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400 font-sans">
                    A Short History
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                    During and prior to World War II, various competing alphabets existed (such as Able, Baker, Charlie).
                    In 1947, the <strong className="text-white font-semibold">International Civil Aviation Organization (ICAO)</strong> partnered with linguists
                    led by Jean-Paul Vinay at the University of Montreal to scientifically research words that were universally recognizable across English, French, Spanish, and diverse languages.
                  </p>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                    After extensive worldwide operational trials, the final standardized phonetic alphabet was officially adopted on
                    <strong className="text-white font-semibold"> 1 March 1956</strong> in ICAO Annex 10 (Aeronautical Telecommunications) and subsequently made universal by NATO, the ITU, and the International Maritime Organization (IMO).
                  </p>
                </div>
              </ScrollShadow>
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}

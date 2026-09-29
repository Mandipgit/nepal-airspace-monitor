"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button, Chip, Tooltip } from "@heroui/react";
import { NepalAircraft } from "@/types/flight";
import { fetchNepalAircraftFleet } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";
import {
  ArrowLeft,
  Search,
  Plane,
  RefreshCw,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  X,
  Gauge,
  ShieldCheck,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";

export default function NepalAircraftPage() {
  const [fleet, setFleet] = useState<NepalAircraft[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [selectedAircraft, setSelectedAircraft] = useState<NepalAircraft | null>(null);

  const rowsPerPage = 12;

  // Load Nepal fleet from database via API
  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchNepalAircraftFleet({
        limit: 300,
      });
      setFleet(response.aircraft || []);
    } catch (err: unknown) {
      const msg = getUserFriendlyErrorMessage(err, "nepal_fleet");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  // Extract unique operators dynamically from the fetched database records
  const availableOperators = useMemo(() => {
    const ops = new Set<string>();
    fleet.forEach((ac) => {
      if (ac.operator && ac.operator.trim()) {
        ops.add(ac.operator.trim());
      }
    });
    return Array.from(ops).sort();
  }, [fleet]);

  // Filter fleet based on search query and operator selection
  const filteredFleet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fleet.filter((ac) => {
      // Filter by operator
      if (selectedOperator !== "all") {
        if (!ac.operator || ac.operator.trim() !== selectedOperator) {
          return false;
        }
      }

      // Filter by search query (registration, model, operator, icao24, serial)
      if (!q) return true;
      const reg = (ac.registration || "").toLowerCase();
      const model = (ac.model || "").toLowerCase();
      const op = (ac.operator || "").toLowerCase();
      const hex = (ac.icao24 || "").toLowerCase();
      const serial = (ac.serial_number || "").toLowerCase();
      const typecode = (ac.typecode || "").toLowerCase();

      return (
        reg.includes(q) ||
        model.includes(q) ||
        op.includes(q) ||
        hex.includes(q) ||
        serial.includes(q) ||
        typecode.includes(q)
      );
    });
  }, [fleet, searchQuery, selectedOperator]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedOperator]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredFleet.length / rowsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredFleet.slice(start, start + rowsPerPage);
  }, [filteredFleet, page, rowsPerPage]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)] font-sans">
      {/* Top Application Header */}
      <header className="h-14 w-full bg-[#111113] border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-neutral-600">/</span>
          <div className="flex items-center space-x-2">
            <Plane className="w-4 h-4 text-emerald-400" />
            <h1 className="text-sm font-bold text-white tracking-tight font-sans">
              Nepal Aircraft
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            {fleet.length} REGISTERED
          </span>
          <Button
            size="sm"
            variant="ghost"
            onPress={loadFleet}
            isLoading={loading}
            className="text-xs text-neutral-300 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Intro Card */}
        <div className="p-6 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                  Civil Aviation Registry (CAAN 9N)
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight font-sans">
                Nepal Registered Aircraft
              </h2>
              <p className="text-xs text-[#A1A1AA] max-w-2xl mt-1 font-sans">
                Complete database of active, commercial, and general aviation aircraft officially
                registered in Nepal. Browse fleet airframes, registration marks, airline operators,
                and linked engineering specifications.
              </p>
            </div>

            {/* Quick Stat Highlights */}
            <div className="flex items-center space-x-3 shrink-0 font-sans">
              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <span className="block text-[10px] uppercase font-bold text-[#71717A] tracking-wider font-sans">
                  Total Fleet
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {fleet.length}
                </span>
              </div>

              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <span className="block text-[10px] uppercase font-bold text-[#71717A] tracking-wider font-sans">
                  Operators
                </span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {availableOperators.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-sans">
          {/* Search Box */}
          <div className="w-full sm:w-80">
            <div className="relative flex items-center w-full h-9 bg-white/[0.05] hover:bg-white/[0.08] focus-within:bg-[#141416] border border-white/[0.08] focus-within:border-white/25 rounded-xl px-3 transition-all">
              <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search registration, model, operator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-sans text-white placeholder:text-neutral-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Operator Dropdown Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#71717A] font-medium font-sans shrink-0">
              Filter Operator:
            </span>
            <select
              aria-label="Filter by airline or operator"
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#141416] border border-white/[0.12] text-xs font-medium text-neutral-200 focus:outline-none focus:border-white/30 cursor-pointer font-sans"
            >
              <option value="all">All Airlines & Operators ({availableOperators.length})</option>
              {availableOperators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center space-x-3 font-sans">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Structured Aircraft Table */}
        <div className="rounded-2xl bg-[#111113] border border-white/[0.08] shadow-2xl overflow-hidden p-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px] font-sans">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#18181B] text-[#A1A1AA] text-xs font-semibold uppercase tracking-wider font-sans">
                  <th className="py-3.5 px-4">Registration</th>
                  <th className="py-3.5 px-4">Model & Type</th>
                  <th className="py-3.5 px-4">Airline / Operator</th>
                  <th className="py-3.5 px-4">Manufacturer & Serial</th>
                  <th className="py-3.5 px-4">Built</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#A1A1AA] font-sans">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#108AEF]" />
                        <span>Loading civil aircraft records from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#71717A] font-sans">
                      {searchQuery || selectedOperator !== "all"
                        ? "No aircraft matched your filters."
                        : "No aircraft records found in the database."}
                    </td>
                  </tr>
                ) : (
                  currentItems.map((ac) => {
                    const spec = ac.specification;
                    return (
                      <tr
                        key={ac.registration || ac.icao24 || Math.random().toString()}
                        onClick={() => setSelectedAircraft(ac)}
                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        {/* Registration */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-sm text-white group-hover:text-[#108AEF] transition-colors">
                              {ac.registration || "N/A"}
                            </span>
                            {ac.icao24 && (
                              <span className="font-mono text-[10px] text-[#108AEF] bg-[#108AEF]/15 border border-[#108AEF]/25 px-1.5 py-0.5 rounded">
                                {ac.icao24.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Model & Type */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white font-sans">
                            {ac.model || spec?.model || "Standard Airframe"}
                          </div>
                          <div className="text-[10px] font-mono text-[#71717A]">
                            {ac.typecode ? `ICAO: ${ac.typecode}` : ac.aircraft_type || "—"}
                          </div>
                        </td>

                        {/* Airline / Operator */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#E4E4E7] font-sans">
                            {ac.operator || ac.owner || "Private / Unlisted"}
                          </div>
                          {ac.operator_callsign && (
                            <div className="text-[10px] font-mono text-[#71717A]">
                              Callsign: {ac.operator_callsign}
                            </div>
                          )}
                        </td>

                        {/* Manufacturer & Serial */}
                        <td className="py-3.5 px-4">
                          <div className="text-neutral-300 font-sans">
                            {ac.manufacturer_name || "—"}
                          </div>
                          <div className="text-[10px] font-mono text-[#71717A]">
                            {ac.serial_number ? `MSN ${ac.serial_number}` : "—"}
                          </div>
                        </td>

                        {/* Built Year */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-neutral-300">
                            {ac.built_year || "—"}
                          </span>
                        </td>

                        {/* Capacity */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-neutral-300">
                            {spec?.passenger_capacity ? `${spec.passenger_capacity} seats` : "—"}
                          </span>
                        </td>

                        {/* Action Details */}
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setSelectedAircraft(ac)}
                            className="bg-white/[0.05] hover:bg-white/[0.12] text-xs font-semibold text-neutral-200 border border-white/[0.08]"
                          >
                            <span>Specs</span>
                            <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-2 font-sans">
              <span className="text-xs text-[#71717A] font-sans font-medium">
                Showing {Math.min(filteredFleet.length, (page - 1) * rowsPerPage + 1)}–
                {Math.min(filteredFleet.length, page * rowsPerPage)} of {filteredFleet.length} aircraft
              </span>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  isDisabled={page === 1}
                  className="bg-white/[0.04] text-[#A1A1AA] hover:text-white border border-white/[0.08] text-xs font-semibold rounded-lg"
                >
                  <ChevronLeftIcon className="w-3.5 h-3.5 mr-0.5" />
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && page > 3) {
                      pageNum = Math.min(totalPages - 4, page - 2) + i;
                    }
                    const isActive = page === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#108AEF] text-white shadow-sm"
                            : "bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  isDisabled={page === totalPages}
                  className="bg-white/[0.04] text-[#A1A1AA] hover:text-white border border-white/[0.08] text-xs font-semibold rounded-lg"
                >
                  Next
                  <ChevronRightIcon className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Aircraft Technical Details Modal */}
      {selectedAircraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111113] border border-white/[0.12] shadow-2xl p-6 space-y-6 font-sans">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-xl font-bold text-white font-sans">
                    {selectedAircraft.registration || "Aircraft Detail"}
                  </h2>
                  {selectedAircraft.icao24 && (
                    <span className="font-mono text-xs text-[#108AEF] bg-[#108AEF]/15 border border-[#108AEF]/25 px-2 py-0.5 rounded">
                      {selectedAircraft.icao24.toUpperCase()}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    9N Registry
                  </span>
                </div>
                <p className="text-xs text-[#A1A1AA] mt-1 font-sans">
                  {selectedAircraft.operator || selectedAircraft.owner || "Nepal Civil Airframe"}
                </p>
              </div>

              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setSelectedAircraft(null)}
                className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  Model
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-sans">
                  {selectedAircraft.model || selectedAircraft.specification?.model || "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  ICAO Type
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-mono">
                  {selectedAircraft.typecode || "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  Serial Number
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-mono">
                  {selectedAircraft.serial_number ? `MSN ${selectedAircraft.serial_number}` : "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  Built Year
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-mono">
                  {selectedAircraft.built_year || "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  Capacity
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-mono">
                  {selectedAircraft.specification?.passenger_capacity
                    ? `${selectedAircraft.specification.passenger_capacity} passengers`
                    : "—"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-[#71717A] tracking-wider block font-sans">
                  Engine Type
                </span>
                <span className="text-xs font-bold text-white block mt-0.5 font-sans">
                  {selectedAircraft.engines || selectedAircraft.specification?.engine_type || "—"}
                </span>
              </div>
            </div>

            {/* Performance Characteristics if Linked */}
            {selectedAircraft.specification && (
              <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] font-sans">
                  Performance Characteristics
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] font-semibold uppercase text-[#71717A] block font-sans">
                      Max Takeoff Weight
                    </span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">
                      {selectedAircraft.specification.mtow_kg
                        ? `${selectedAircraft.specification.mtow_kg.toLocaleString()} kg`
                        : "—"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] font-semibold uppercase text-[#71717A] block font-sans">
                      Cruise Speed
                    </span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">
                      {selectedAircraft.specification.cruise_speed_kts
                        ? `${selectedAircraft.specification.cruise_speed_kts} kts`
                        : "—"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] font-semibold uppercase text-[#71717A] block font-sans">
                      Nominal Range
                    </span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">
                      {selectedAircraft.specification.nominal_range_nm
                        ? `${selectedAircraft.specification.nominal_range_nm} nm`
                        : "—"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] font-semibold uppercase text-[#71717A] block font-sans">
                      Takeoff Runway
                    </span>
                    <span className="font-mono text-xs font-bold text-white block mt-0.5">
                      {selectedAircraft.specification.takeoff_field_length_m
                        ? `${selectedAircraft.specification.takeoff_field_length_m} m`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Operator & Registry Notes */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs text-[#A1A1AA] font-sans">
              <span className="font-semibold text-white">Owner / Operator Information:</span>
              <p>
                Registered to <strong>{selectedAircraft.owner || selectedAircraft.operator || "Civil Aviation Registry"}</strong>.
                {selectedAircraft.operator_callsign ? ` Operating under telephony callsign "${selectedAircraft.operator_callsign}".` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
}

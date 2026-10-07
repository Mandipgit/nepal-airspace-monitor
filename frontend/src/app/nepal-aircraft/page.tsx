"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button, Dropdown } from "@heroui/react";
import { NepalAircraft } from "@/types/flight";
import { fetchNepalAircraftFleet } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";

export default function NepalAircraftPage() {
  const [fleet, setFleet] = useState<NepalAircraft[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("aerotrace_fleet_search") || "";
    }
    return "";
  });
  const [selectedOperator, setSelectedOperator] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("aerotrace_fleet_operator") || "all";
    }
    return "all";
  });
  const [selectedAircraft, setSelectedAircraft] = useState<NepalAircraft | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aerotrace_fleet_search", searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aerotrace_fleet_operator", selectedOperator);
    }
  }, [selectedOperator]);

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-primary)] relative font-sans">
      {/* Operations Workspace Container */}
      <div className="flex flex-1 w-full h-full overflow-hidden relative">
        {/* Main Content Area with smooth scrolling */}
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header Section with Route Aircraft Analyzer Back Button */}
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
                    Nepal Aircraft
                  </h1>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-white/[0.06] border border-white/[0.12] text-neutral-300">
                  {fleet.length} Aircraft
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={loadFleet}
                  isDisabled={loading}
                  className="text-xs text-neutral-300 hover:text-white hover:bg-white/5 border border-white/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
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
                <Dropdown>
                  <Dropdown.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] hover:border-white/20 text-xs font-semibold text-neutral-200 hover:text-white transition-all duration-200 cursor-pointer font-sans shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006FEE] max-w-[260px]">
                    <span className="truncate">
                      {selectedOperator === "all"
                        ? `All Airlines & Operators (${availableOperators.length})`
                        : selectedOperator}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200" />
                  </Dropdown.Trigger>
                  <Dropdown.Popover
                    placement="bottom end"
                    className="z-50 min-w-[240px] max-h-72 overflow-y-auto p-1.5 rounded-2xl bg-[#141416]/98 border border-white/12 shadow-2xl backdrop-blur-xl font-sans transition-all duration-300 ease-out data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[entering]:duration-300 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95 data-[exiting]:duration-200"
                  >
                    <Dropdown.Menu
                      aria-label="Filter by airline or operator"
                      selectionMode="single"
                      selectedKeys={new Set([selectedOperator])}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0];
                        if (val) setSelectedOperator(String(val));
                      }}
                      className="outline-none space-y-0.5"
                    >
                      <Dropdown.Item
                        key="all"
                        id="all"
                        textValue={`All Airlines & Operators (${availableOperators.length})`}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer outline-none transition-colors duration-150 data-[focused]:bg-white/[0.08] data-[focused]:text-white ${
                          selectedOperator === "all"
                            ? "bg-[#006FEE]/15 text-[#006FEE] font-semibold"
                            : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
                        }`}
                      >
                        <span className="truncate">All Airlines & Operators ({availableOperators.length})</span>
                        {selectedOperator === "all" && (
                          <Check className="w-3.5 h-3.5 text-[#006FEE] shrink-0 ml-2" />
                        )}
                      </Dropdown.Item>

                      {availableOperators.map((op) => {
                        const isSelected = selectedOperator === op;
                        return (
                          <Dropdown.Item
                            key={op}
                            id={op}
                            textValue={op}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer outline-none transition-colors duration-150 data-[focused]:bg-white/[0.08] data-[focused]:text-white ${
                              isSelected
                                ? "bg-[#006FEE]/15 text-[#006FEE] font-semibold"
                                : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
                            }`}
                          >
                            <span className="truncate">{op}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#006FEE] shrink-0 ml-2" />
                            )}
                          </Dropdown.Item>
                        );
                      })}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
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
                    ) : filteredFleet.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#71717A] font-sans">
                          {searchQuery || selectedOperator !== "all"
                            ? "No aircraft matched your filters."
                            : "No aircraft records found in the database."}
                        </td>
                      </tr>
                    ) : (
                      filteredFleet.map((ac, idx) => {
                        const spec = ac.specification;
                        const rowKey = `nepal-ac-${ac.id ?? ac.registration ?? ac.icao24 ?? "item"}-${idx}`;
                        return (
                          <tr
                            key={rowKey}
                            onClick={() => setSelectedAircraft(ac)}
                            className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                          >
                            {/* Registration (Callsign only, NO ICAO HEX) */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-sm text-white group-hover:text-[#108AEF] transition-colors">
                                {ac.registration || "N/A"}
                              </span>
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
                                variant="ghost"
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

              {/* Table Footer Summary */}
              <div className="p-4 border-t border-white/[0.08] flex items-center justify-between font-sans">
                <span className="text-xs text-[#71717A] font-sans font-medium">
                  Showing {filteredFleet.length} of {fleet.length} registered aircraft
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-white/10 border border-white/15 text-neutral-300">
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

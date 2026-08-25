"use client";

import React from "react";
import { Navbar } from "../_components/Navbar";
import { CareNetworkSection } from "../_components/CareNetworkSection";
import { EmergencyHospitalLocator } from "../_components/EmergencyHospitalLocator";
import { Footer } from "../_components/Footer";

export default function CarePage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* SPATIAL CARE NETWORK MAP */}
        <div className="pt-8">
          <CareNetworkSection />
        </div>

        {/* FULL GPS EMERGENCY HOSPITAL LOCATOR DIRECTORY */}
        <div id="nearest-hospitals" className="relative z-10">
          <EmergencyHospitalLocator />
        </div>
      </div>

      <Footer />
    </div>
  );
}

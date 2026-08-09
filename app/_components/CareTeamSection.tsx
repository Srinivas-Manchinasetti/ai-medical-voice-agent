"use client";

import React from "react";
import { ArrowRight, CheckCircle2, ShieldAlert, Users, HeartHandshake } from "lucide-react";

export function CareTeamSection() {
  return (
    <section id="care-teams" className="w-full py-20 bg-white border-t border-[#16302B]/5">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3.5 py-1 rounded-full">
            For Your Care Team
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#16302B] sm:text-4xl mt-3">
            Removing Phone Friction, Restoring Human Care
          </h2>
          <p className="mt-2 text-base text-[#60716D]">
            Give your clinical and front-desk staff relief from hold lines and administrative phone overload.
          </p>
        </div>

        {/* Before vs With MediVoice Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {/* Before */}
          <div className="rounded-3xl bg-[#F7FAF9] p-8 border border-[#16302B]/10">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2.5 w-2.5 rounded-full bg-[#60716D]"></span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#60716D]">
                Traditional Patient Intake
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#16302B]/5">
                <span className="font-mono text-xs font-bold text-[#60716D]">01</span>
                <p className="text-xs text-[#60716D]">15–20 minutes waiting on hold in a phone queue</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#16302B]/5">
                <span className="font-mono text-xs font-bold text-[#60716D]">02</span>
                <p className="text-xs text-[#60716D]">Manual phone intake by busy front-desk staff</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#16302B]/5">
                <span className="font-mono text-xs font-bold text-[#60716D]">03</span>
                <p className="text-xs text-[#60716D]">Repeated symptom questions during clinic visit</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#16302B]/5">
                <span className="font-mono text-xs font-bold text-[#60716D]">04</span>
                <p className="text-xs text-[#60716D]">Delayed charting and after-hours backlog</p>
              </div>
            </div>
          </div>

          {/* With MediVoice */}
          <div className="rounded-3xl bg-[#E8F6F3]/50 p-8 border border-[#0F9F8F]/30 shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0F9F8F]"></span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0F9F8F]">
                With MediVoice Assistant
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#0F9F8F]/20">
                <CheckCircle2 className="h-4 w-4 text-[#0F9F8F] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#16302B]">Patient speaks naturally with zero queue wait</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#0F9F8F]/20">
                <CheckCircle2 className="h-4 w-4 text-[#0F9F8F] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#16302B]">Conversation is automatically understood and captured</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#0F9F8F]/20">
                <CheckCircle2 className="h-4 w-4 text-[#0F9F8F] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#16302B]">Important clinical details are structured clearly</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#0F9F8F]/20">
                <CheckCircle2 className="h-4 w-4 text-[#0F9F8F] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#16302B]">Staff receives a concise summary ready for review</p>
              </div>
            </div>
          </div>
        </div>

        {/* Human Escalation & Safety Section */}
        <div className="warm-card rounded-3xl p-8 md:p-10 border border-[#16302B]/10">
          <div className="max-w-xl mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3 py-1 rounded-full">
              Safety Boundaries
            </span>
            <h3 className="text-2xl font-bold text-[#16302B] mt-3">
              When a Human Needs to Step In, MediVoice Knows.
            </h3>
            <p className="text-xs text-[#60716D] mt-2 leading-relaxed">
              MediVoice does not replace healthcare staff. It acts as an attentive front door, recognizing when to handle routine items automatically and when to involve human clinicians.
            </p>
          </div>

          {/* Clean Flow Visual */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-[#F7FAF9] border border-[#16302B]/5 text-center">
              <span className="text-xs font-bold text-[#16302B] block mb-1">Patient Call</span>
              <span className="text-[11px] text-[#60716D]">Speaks naturally</span>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-[#E8F6F3] border border-[#0F9F8F]/30 text-center">
              <span className="text-xs font-bold text-[#0F9F8F] block mb-1">MediVoice Engine</span>
              <span className="text-[11px] text-[#60716D]">Evaluates request & safety</span>
            </div>

            {/* Step 3: Outcomes (Span 2) */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#16302B]/10 text-xs">
                <span className="font-semibold text-[#16302B]">Routine Task</span>
                <span className="text-[#0F9F8F] font-medium">→ Automated resolution</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#16302B]/10 text-xs">
                <span className="font-semibold text-[#16302B]">Clinical Review Needed</span>
                <span className="text-[#60716D] font-medium">→ Sent to Care Team queue</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF5F5] border border-[#D94A4A]/20 text-xs">
                <span className="font-semibold text-[#D94A4A]">Urgent / Emergency</span>
                <span className="text-[#D94A4A] font-medium">→ Immediate escalation protocol</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

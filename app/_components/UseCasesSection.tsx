"use client";

import React from "react";
import { ClipboardList, Calendar, Pill, AlertCircle } from "lucide-react";

export function UseCasesSection() {
  const USE_CASES = [
    {
      icon: <ClipboardList className="h-6 w-6 text-[#0F9F8F]" />,
      title: "Patient Intake",
      subtitle: "Collect the story before the appointment",
      description: "Gather chief complaints, symptom timelines, and medical history over a quick phone conversation prior to office visits.",
    },
    {
      icon: <Calendar className="h-6 w-6 text-[#0F9F8F]" />,
      title: "Appointment Coordination",
      subtitle: "Book, reschedule & confirm without queues",
      description: "Allow patients to schedule, change, or confirm appointments 24/7 without waiting on hold for front-desk staff.",
    },
    {
      icon: <Pill className="h-6 w-6 text-[#0F9F8F]" />,
      title: "Prescription Requests",
      subtitle: "Capture refills & route to provider workflow",
      description: "Verify patient pharmacy preferences, check active prescriptions, and queue authorization requests for doctor review.",
    },
    {
      icon: <AlertCircle className="h-6 w-6 text-[#D94A4A]" />,
      title: "Urgent Symptom Recognition",
      subtitle: "Recognize red flags & escalate safely",
      description: "Identify concerning symptoms early and follow clinical protocol to connect patients directly to triage nurses or emergency services.",
    },
  ];

  return (
    <section id="use-cases" className="w-full py-20 bg-[#F7FAF9]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3.5 py-1 rounded-full">
            Healthcare Solutions
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#16302B] sm:text-4xl mt-3">
            One Voice Assistant. Many Healthcare Conversations.
          </h2>
          <p className="mt-2 text-base text-[#60716D]">
            Purpose-built to handle common patient phone interactions smoothly and safely.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {USE_CASES.map((uc, i) => (
            <div
              key={i}
              className="warm-card rounded-3xl p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F6F3]">
                    {uc.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#16302B]">{uc.title}</h3>
                    <p className="text-xs font-medium text-[#0F9F8F]">{uc.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-[#60716D] leading-relaxed">{uc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

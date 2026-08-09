"use client";

import React from "react";
import { Phone, Ear, Brain, CheckCircle, UserCheck } from "lucide-react";

export function WorkflowSection() {
  const STEPS = [
    {
      num: "01",
      title: "Patient calls",
      description: "Patients call their clinic number—no app download or online form required.",
      icon: <Phone className="h-5 w-5 text-[#0F9F8F]" />,
    },
    {
      num: "02",
      title: "MediVoice listens",
      description: "Natural conversational speech recognition listens empathetically without interrupting.",
      icon: <Ear className="h-5 w-5 text-[#0F9F8F]" />,
    },
    {
      num: "03",
      title: "Understands request",
      description: "Identifies symptoms, reason for call, urgency, and relevant context.",
      icon: <Brain className="h-5 w-5 text-[#0F9F8F]" />,
    },
    {
      num: "04",
      title: "Takes appropriate action",
      description: "Books appointments, queues refills, or alerts emergency on-call staff.",
      icon: <CheckCircle className="h-5 w-5 text-[#0F9F8F]" />,
    },
    {
      num: "05",
      title: "Care team gets context",
      description: "Clinicians receive a concise, structured summary ready in their workflow.",
      icon: <UserCheck className="h-5 w-5 text-[#0F9F8F]" />,
    },
  ];

  return (
    <section id="how-it-works" className="w-full py-20 bg-white border-y border-[#16302B]/5">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3.5 py-1 rounded-full">
            Simple Workflow
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#16302B] sm:text-4xl mt-3">
            From Conversation to Care
          </h2>
          <p className="mt-2 text-base text-[#60716D]">
            A seamless bridge connecting patient phone calls directly to structured clinical action.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="warm-card rounded-2xl p-5 flex flex-col justify-between relative group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F6F3]">
                    {step.icon}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#60716D]">{step.num}</span>
                </div>
                <h3 className="text-sm font-bold text-[#16302B] mb-2">{step.title}</h3>
                <p className="text-xs text-[#60716D] leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

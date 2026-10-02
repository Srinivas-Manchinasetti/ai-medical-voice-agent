import React from "react";
import {
  Hospital,
  Leaf,
  HeartPulse,
  Brain,
  Ribbon,
  Bone,
  Baby,
  HeartHandshake,
  Droplets,
  Wind,
  Eye,
  Siren,
  Microscope,
  Ear,
  Bandage,
  Syringe,
  Smile,
  Activity,
  LucideProps,
} from "lucide-react";

export interface SpecialtyIconProps extends LucideProps {
  id: string;
}

export const SPECIALTY_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  all: Hospital,
  ayurveda: Leaf,
  cardiology: HeartPulse,
  neurology: Brain,
  cancer: Ribbon,
  orthopedics: Bone,
  pediatrics: Baby,
  maternity: HeartHandshake,
  kidney: Droplets,
  pulmonology: Wind,
  eye: Eye,
  emergency: Siren,
  gastroenterology: Microscope,
  ent: Ear,
  dermatology: Bandage,
  diabetes: Syringe,
  dental: Smile,
};

export const SPECIALTY_COLOR_MAP: Record<string, string> = {
  all: "text-teal-700",
  ayurveda: "text-emerald-700",
  cardiology: "text-rose-600",
  neurology: "text-purple-600",
  cancer: "text-amber-600",
  orthopedics: "text-sky-600",
  pediatrics: "text-amber-500",
  maternity: "text-pink-600",
  kidney: "text-red-500",
  pulmonology: "text-teal-600",
  eye: "text-indigo-600",
  emergency: "text-red-600",
  gastroenterology: "text-emerald-600",
  ent: "text-amber-600",
  dermatology: "text-cyan-600",
  diabetes: "text-blue-600",
  dental: "text-violet-600",
};

export function SpecialtyIcon({ id, className, ...props }: SpecialtyIconProps) {
  const normId = id ? id.toLowerCase().trim() : "all";
  const IconComponent = SPECIALTY_ICON_MAP[normId] || Activity;
  const defaultColor = SPECIALTY_COLOR_MAP[normId] || "text-[#0F6B6D]";
  
  return (
    <IconComponent
      className={className || `w-3.5 h-3.5 shrink-0 ${defaultColor}`}
      {...props}
    />
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/consult");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-slate-600 text-xs font-mono">
      <span>Redirecting to Voice Consultation Room...</span>
    </div>
  );
}

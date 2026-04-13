"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 -mt-2 mb-1"
    >
      <ArrowLeft size={14} />
      Back
    </button>
  );
}

import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  CLIENT_APPROVED: "bg-green-100 text-green-700",
  APPROVED: "bg-green-100 text-green-700",
  ISSUED: "bg-green-100 text-green-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  VOIDED: "bg-gray-200 text-gray-600",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-gray-200 text-gray-600",
  CORRECTED: "bg-amber-100 text-amber-700",
  CLIENT_INVOICE: "bg-blue-100 text-blue-700",
  CONTRACTOR_INVOICE: "bg-purple-100 text-purple-700",
  AVAILABLE: "bg-green-100 text-green-700",
  PROPOSED: "bg-blue-100 text-blue-700",
  INTERVIEW: "bg-purple-100 text-purple-700",
  OFFERED: "bg-amber-100 text-amber-700",
  PLACED: "bg-emerald-100 text-emerald-700",
  UNAVAILABLE: "bg-red-100 text-red-700",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      data-testid={`status-${value}`}
      className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", COLORS[value] || "bg-gray-100 text-gray-700")}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

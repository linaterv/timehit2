"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/utils";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ year, month, onChange }: Props) {
  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };
  const next = () => {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };

  return (
    <div data-testid="month-selector" className="flex items-center gap-2">
      <button data-testid="month-prev" onClick={prev} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={18} /></button>
      <span className="text-sm font-medium min-w-[140px] text-center">{formatMonth(year, month)}</span>
      <button data-testid="month-next" onClick={next} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={18} /></button>
    </div>
  );
}

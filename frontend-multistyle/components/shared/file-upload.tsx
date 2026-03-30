"use client";

import { useCallback, useRef } from "react";
import { Upload } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileUpload({ onUpload, accept, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload, disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div
      data-testid="file-upload"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-brand-600 hover:bg-brand-50/30"}`}
    >
      <Upload className="mx-auto mb-2 text-gray-400" size={24} />
      <p className="text-sm text-gray-500">Drop a file here or click to upload</p>
      <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={handleChange} />
    </div>
  );
}

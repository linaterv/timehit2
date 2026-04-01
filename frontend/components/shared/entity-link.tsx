"use client";

import Link from "next/link";

/**
 * EntityLink — clickable link to entity detail page.
 * Uses Next.js Link for client-side navigation.
 * Supports right-click / middle-click / cmd+click open in new tab.
 */
export function EntityLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.stopPropagation(); // prevent row click from firing
        onClick?.(e);
      }}
      className={`text-brand-600 hover:text-brand-800 hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * RelationshipSummary — shows 2 most recent items as links + "N total" link.
 * The "N total" link opens the parent detail page with ?tab= param.
 */
export function RelationshipSummary({
  items,
  totalCount,
  totalHref,
}: {
  items: { label: string; href: string }[];
  totalCount: number;
  totalHref: string;
}) {
  if (totalCount === 0) return null;
  return (
    <div className="text-sm">
      {items.slice(0, 2).map((item, i) => (
        <div key={i} className="truncate max-w-[220px]">
          <EntityLink href={item.href}>{item.label}</EntityLink>
        </div>
      ))}
      <EntityLink href={totalHref} className="text-xs text-gray-400 hover:text-brand-600">
        {totalCount} total
      </EntityLink>
    </div>
  );
}

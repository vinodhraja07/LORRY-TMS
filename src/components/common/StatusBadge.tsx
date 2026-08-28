import React from "react";
import { LorryStatus } from "../../types";
import { AlertCircle, Clock, CheckCircle2, Truck, Wrench, ShieldAlert } from "lucide-react";

interface StatusBadgeProps {
  status: LorryStatus | "Valid" | "Expiring Soon" | "Expired" | string;
  daysRemaining?: number;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  daysRemaining,
  showIcon = true,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
    lg: "px-3 py-1.5 text-sm font-semibold",
  }[size];

  // Document Expiry Badges
  if (status === "Expired" || (daysRemaining !== undefined && daysRemaining < 0)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-800/60 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
        <span>Expired</span>
        {daysRemaining !== undefined && (
          <span className="font-normal opacity-80">({Math.abs(daysRemaining)}d overdue)</span>
        )}
      </span>
    );
  }

  if (status === "Expiring Soon" || (daysRemaining !== undefined && daysRemaining <= 30)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/60 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        <span>Expiring Soon</span>
        {daysRemaining !== undefined && (
          <span className="font-normal opacity-80">({daysRemaining}d left)</span>
        )}
      </span>
    );
  }

  if (status === "Valid" || (daysRemaining !== undefined && daysRemaining > 30)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
        <span>Valid</span>
        {daysRemaining !== undefined && (
          <span className="font-normal opacity-80">({daysRemaining}d)</span>
        )}
      </span>
    );
  }

  // Vehicle Fleet Statuses
  if (status === "Available") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
        <span>Available</span>
      </span>
    );
  }

  if (status === "On Trip") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-blue-950/60 text-blue-400 border border-blue-800/60 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
        <span>On Trip</span>
      </span>
    );
  }

  if (status === "Inactive") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-zinc-800/90 text-zinc-400 border border-zinc-700 ${sizeClasses} whitespace-nowrap`}
      >
        {showIcon && <Wrench className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
        <span>Inactive / Service</span>
      </span>
    );
  }

  // Default fallback
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-zinc-800/90 text-zinc-400 border border-zinc-700 ${sizeClasses} whitespace-nowrap`}
    >
      <span>{status}</span>
    </span>
  );
};

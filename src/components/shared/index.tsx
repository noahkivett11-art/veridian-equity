import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowUp, ArrowDown, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency } from "../../lib/utils";

// ─── Card ───────────────────────────────────────────────────────────

export const Card = ({
  title,
  children,
  className = "",
  rightContent,
  noPadding = false,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  rightContent?: React.ReactNode;
  noPadding?: boolean;
}) => (
  <div className={`card ${noPadding ? "" : "p-5"} ${className}`}>
    {title && (
      <div className="flex items-center justify-between mb-5">
        <h4 className="card-header">{title}</h4>
        {rightContent}
      </div>
    )}
    {children}
  </div>
);

// ─── Page Header ────────────────────────────────────────────────────

export const PageHeader = ({
  title,
  subtitle,
  icon,
  rightContent,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
}) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print">
    <div className="flex items-center gap-4">
      {icon && (
        <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center text-surface-950 shrink-0">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-2xl font-display font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {rightContent}
  </div>
);

// ─── Loading / Empty / Error States ─────────────────────────────────

export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`skeleton ${className}`} />
);

export const LoadingState = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
    <span className="text-sm text-slate-500">{message}</span>
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
      <Icon className="w-7 h-7 text-slate-600" />
    </div>
    <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
    {action}
  </div>
);

export const ErrorMessage = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <AlertCircle className="w-8 h-8 text-danger/60 mb-3" />
    <p className="text-sm text-slate-400 mb-4">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-secondary flex items-center gap-2 text-xs">
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    )}
  </div>
);

// ─── Live Price Display ─────────────────────────────────────────────

export const LivePriceDisplay = ({
  value,
  formatter = formatCurrency,
  stale = false,
  className = "",
}: {
  value: number | string | null | undefined;
  formatter?: (v: any) => string;
  stale?: boolean;
  className?: string;
}) => {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value !== prevValue && typeof value === "number" && typeof prevValue === "number") {
      setFlash(value > prevValue ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 800);
      setPrevValue(value);
      return () => clearTimeout(timer);
    }
    if (prevValue === undefined || prevValue === null) setPrevValue(value);
  }, [value, prevValue]);

  const flashClass =
    flash === "up"
      ? "text-accent bg-accent/10"
      : flash === "down"
      ? "text-danger bg-danger/10"
      : "";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1 rounded transition-colors duration-500 ${flashClass} ${
        stale ? "opacity-50" : ""
      } ${className}`}
    >
      {formatter(value)}
      {flash && (
        <span className="inline-flex">
          {flash === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        </span>
      )}
    </span>
  );
};

// ─── Input Field ────────────────────────────────────────────────────

export const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  step,
  min,
  max,
  suffix,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="stat-label">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className="input-field"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

// ─── Range Input Pair ───────────────────────────────────────────────

export const RangeInput = ({
  label,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  step = 1,
}: {
  label: string;
  minVal: number | null;
  maxVal: number | null;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
  step?: number;
}) => (
  <div className="space-y-1.5">
    <label className="stat-label">{label}</label>
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        placeholder="Min"
        value={minVal ?? ""}
        onChange={(e) => onMinChange(e.target.value ? parseFloat(e.target.value) : null)}
        step={step}
        className="input-field text-xs"
      />
      <input
        type="number"
        placeholder="Max"
        value={maxVal ?? ""}
        onChange={(e) => onMaxChange(e.target.value ? parseFloat(e.target.value) : null)}
        step={step}
        className="input-field text-xs"
      />
    </div>
  </div>
);

// ─── Stat Item (key-value row) ──────────────────────────────────────

export const StatRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number | null;
  highlight?: boolean;
}) => (
  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className={`text-sm font-mono font-medium ${highlight ? "text-info" : "text-white"}`}>
      {value !== null && value !== undefined ? value : "—"}
    </span>
  </div>
);

// ─── Tab Bar ────────────────────────────────────────────────────────

export const TabBar = ({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) => (
  <div className="flex gap-1 bg-surface-800/50 p-1 rounded-lg border border-white/[0.04] w-fit">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
          active === tab
            ? "bg-accent text-surface-950"
            : "text-slate-500 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

// ─── Change Badge ───────────────────────────────────────────────────

export const ChangeBadge = ({ value, suffix = "%" }: { value: number | null; suffix?: string }) => {
  if (value === null || value === undefined) return <span className="text-slate-600">—</span>;
  const isPositive = value >= 0;
  return (
    <span
      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
        isPositive ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
      }`}
    >
      {isPositive ? "+" : ""}
      {typeof value === "number" ? value.toFixed(2) : value}
      {suffix}
    </span>
  );
};

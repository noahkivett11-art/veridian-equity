/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSafe(value: number | null | undefined, decimals: number = 2, fallback: string = "Data unavailable"): string {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return value.toFixed(decimals);
}

export function formatNumber(value: number | string | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  console.log('[FORMATTER] formatNumber input:', { value, type: typeof value });
  
  if (value === null || value === undefined || value === "Data unavailable") return "Data unavailable";
  
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) {
    console.warn('[FORMATTER] formatNumber NaN result for:', value);
    return "Data unavailable";
  }
  
  const result = num.toLocaleString(undefined, options);
  console.log('[FORMATTER] formatNumber output:', result);
  return result;
}

export function parseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "Data unavailable") return 0;
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

export function formatPercent(value: number | string | null | undefined): string {
  console.log('[FORMATTER] formatPercent input:', { value, type: typeof value });
  
  if (value === null || value === undefined || value === "Data unavailable") return "Data unavailable";
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return "Data unavailable";
  
  const result = `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  console.log('[FORMATTER] formatPercent output:', result);
  return result;
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "Data unavailable") return "Data unavailable";
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return "Data unavailable";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

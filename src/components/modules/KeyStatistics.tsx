import React, { useState, useEffect } from "react";
import { Card, StatRow, Skeleton } from "../shared";
import { CompanyDataService, KeyStatistics } from "../../services/companyService";
import { formatNumber, formatCurrency } from "../../lib/utils";

interface KeyStatisticsPanelProps {
  symbol: string;
  preloadedStats?: KeyStatistics | null;
}

export const KeyStatisticsPanel: React.FC<KeyStatisticsPanelProps> = ({ symbol, preloadedStats }) => {
  const [stats, setStats] = useState<KeyStatistics | null>(preloadedStats ?? null);
  const [loading, setLoading] = useState(preloadedStats === undefined);

  useEffect(() => {
    // If preloadedStats was supplied by the parent, use it — no extra fetch
    if (preloadedStats !== undefined) {
      setStats(preloadedStats);
      setLoading(false);
      return;
    }
    // Standalone usage: fetch our own data
    setLoading(true);
    CompanyDataService.getInstance().fetchKeyStatistics(symbol).then(data => {
      setStats(data);
      setLoading(false);
    });
  }, [symbol, preloadedStats]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <Skeleton className="h-4 w-1/3 mb-4" />
            {[1, 2, 3, 4, 5].map((j) => <Skeleton key={j} className="h-8 w-full" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Market & Trading">
          <div>
            <StatRow label="Previous Close" value={formatCurrency(stats?.previousClose)} />
            <StatRow label="Open" value={formatCurrency(stats?.open)} />
            <StatRow label="Day's Range" value={stats?.dayRange || "—"} />
            <StatRow label="52 Week Range" value={stats?.fiftyTwoWeekRange || "—"} />
            <StatRow label="Volume" value={stats?.volume || "—"} />
            <StatRow label="Avg. Volume" value={stats?.avgVolume || "—"} />
          </div>
        </Card>
        <Card title="Valuation & Fundamentals">
          <div>
            <StatRow label="Market Cap" value={stats?.marketCap || "—"} highlight />
            <StatRow label="Beta (5Y Monthly)" value={formatNumber(stats?.beta, { minimumFractionDigits: 2 })} highlight />
            <StatRow label="PE Ratio (TTM)" value={formatNumber(stats?.peRatio, { minimumFractionDigits: 2 })} highlight />
            <StatRow label="EPS (TTM)" value={formatNumber(stats?.eps, { minimumFractionDigits: 2 })} highlight />
            <StatRow label="Dividend Yield" value={stats?.dividendYield || "—"} highlight />
            <StatRow label="Revenue Growth" value={stats?.revenueGrowth ? `${stats.revenueGrowth}%` : "—"} highlight />
          </div>
        </Card>
      </div>
      {stats?.provider && (
        <div className="text-right">
          <span className="text-[9px] text-slate-600 font-mono">Source: {stats.provider}</span>
        </div>
      )}
    </div>
  );
};

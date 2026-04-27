import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, Card, StatRow } from "../../shared";
import { EventService, EarningsResult, CatalystEvent, EventImpactSummary } from "../../../services/eventService";
import { formatSafe } from "../../../lib/utils";

const TYPE_STYLES: Record<string, string> = {
  Earnings:   "bg-accent/10 text-accent",
  Dividend:   "bg-blue-500/10 text-blue-400",
  Product:    "bg-purple-500/10 text-purple-400",
  Macro:      "bg-warning/10 text-warning",
  Conference: "bg-slate-700/60 text-slate-300",
  Legal:      "bg-danger/10 text-danger",
};

const IMPACT_STYLES: Record<string, string> = {
  High:   "text-danger",
  Medium: "text-warning",
  Low:    "text-slate-400",
};

export const EarningsEventsModule: React.FC<{ symbol?: string | null }> = ({ symbol }) => {
  const [earnings, setEarnings] = useState<EarningsResult[]>([]);
  const [catalysts, setCatalysts] = useState<CatalystEvent[]>([]);
  const [summary, setSummary] = useState<EventImpactSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const svc = EventService.getInstance();
    setLoading(true);
    Promise.all([
      svc.fetchEarningsData(symbol),
      svc.fetchCatalysts(symbol),
      svc.getEventImpactSummary(symbol),
    ]).then(([e, c, s]) => {
      setEarnings(e);
      setCatalysts(c);
      setSummary(s);
      setLoading(false);
    });
  }, [symbol]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Earnings & Events"
        subtitle="Earnings calendar, surprises, and catalyst tracking"
        icon={<Bell className="w-5 h-5" />}
        rightContent={
          symbol ? (
            <span className="text-xs font-mono font-semibold text-accent bg-accent/10 px-3 py-1 rounded-lg">
              {symbol}
            </span>
          ) : undefined
        }
      />

      {!symbol ? (
        <EmptyState
          icon={Bell}
          title="Select a Company"
          description="Navigate to Company Research and select a ticker, then come back here to view earnings history and upcoming catalysts."
        />
      ) : loading ? (
        <LoadingState message={`Loading events for ${symbol}…`} />
      ) : (
        <div className="space-y-6">
          {summary && (
            <Card title="Event Impact Summary">
              <StatRow label="Recent Catalyst"         value={summary.recentCatalyst} />
              <StatRow label="Market Reaction"         value={summary.marketReaction} />
              <StatRow label="Risk Level"              value={summary.riskLevel} highlight />
              <StatRow label="Upcoming Significance"   value={summary.upcomingSignificance} />
              <StatRow label="Volatility Context"      value={summary.volatilityContext} />
            </Card>
          )}

          <Card title={`Earnings History — ${symbol}`} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["Quarter", "Date", "EPS Est.", "EPS Actual", "Surprise", "Surprise %", "Rev Est.", "Rev Actual", "Price Rxn."].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.quarter} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-semibold text-white">{e.quarter}</td>
                      <td className="px-4 py-2.5 text-slate-400">{e.date}</td>
                      <td className="px-4 py-2.5">${formatSafe(e.epsEstimate, 2)}</td>
                      <td className="px-4 py-2.5">
                        {e.epsActual != null
                          ? `$${formatSafe(e.epsActual, 2)}`
                          : <span className="text-slate-500">Upcoming</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.surprise != null ? (
                          <span className={e.surprise >= 0 ? "text-accent" : "text-danger"}>
                            {e.surprise >= 0 ? "+" : ""}${formatSafe(e.surprise, 2)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.surprisePercent != null ? (
                          <span className={e.surprisePercent >= 0 ? "text-accent" : "text-danger"}>
                            {e.surprisePercent >= 0 ? "+" : ""}{formatSafe(e.surprisePercent, 1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.revenueEstimate != null ? `$${(e.revenueEstimate / 1000).toFixed(1)}B` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.revenueActual != null
                          ? `$${(e.revenueActual / 1000).toFixed(1)}B`
                          : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.priceReaction != null ? (
                          <span className={e.priceReaction >= 0 ? "text-accent" : "text-danger"}>
                            {e.priceReaction >= 0 ? "+" : ""}{formatSafe(e.priceReaction, 1)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Catalyst Calendar">
            <div className="space-y-3">
              {catalysts.map((c) => {
                const isPast = new Date(c.date) < new Date();
                return (
                  <div
                    key={c.id}
                    className={`flex items-start gap-4 p-3 rounded-lg border transition-opacity ${
                      isPast ? "border-white/[0.04] opacity-50" : "border-accent/20 bg-accent/[0.03]"
                    }`}
                  >
                    <div className="text-center min-w-[44px]">
                      <div className="text-[10px] text-slate-500 uppercase leading-none">
                        {new Date(c.date).toLocaleDateString("en-US", { month: "short" })}
                      </div>
                      <div className="text-2xl font-bold text-white leading-none mt-0.5">
                        {new Date(c.date).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[c.type] ?? "bg-slate-700/60 text-slate-300"}`}>
                          {c.type}
                        </span>
                        <span className={`text-[10px] font-semibold ${IMPACT_STYLES[c.impact] ?? "text-slate-400"}`}>
                          {c.impact} Impact
                        </span>
                        {isPast && <span className="text-[10px] text-slate-600 font-medium ml-auto">Past</span>}
                      </div>
                      <div className="text-sm font-semibold text-white">{c.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

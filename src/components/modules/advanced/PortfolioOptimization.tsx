import React, { useState, useEffect } from "react";
import { Zap, RefreshCw } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import { PageHeader, EmptyState, LoadingState, Card, StatRow } from "../../shared";
import { PortfolioService, Portfolio } from "../../../services/portfolioService";
import {
  OptimizationService,
  OptimizationResult,
  OptimizationObjective,
  OptimizationConstraints,
} from "../../../services/optimizationService";
import { formatSafe } from "../../../lib/utils";

export const PortfolioOptimizationModule: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [objective, setObjective] = useState<OptimizationObjective>("Max Sharpe");
  const [maxWeight, setMaxWeight] = useState(40);
  const [minWeight, setMinWeight] = useState(5);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const all = PortfolioService.getInstance().getPortfolios();
    setPortfolios(all);
    if (all.length > 0) setSelectedId(all[0].id);
  }, []);

  const selectedPortfolio = portfolios.find((p) => p.id === selectedId) ?? null;
  const canOptimize = selectedPortfolio && selectedPortfolio.positions.length >= 2;

  const run = async () => {
    if (!selectedPortfolio) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const constraints: OptimizationConstraints = {
        maxWeight: maxWeight / 100,
        minWeight: minWeight / 100,
        includeCash: false,
        sectorMaxExposure: {},
      };
      const r = await OptimizationService.getInstance().optimizePortfolio(selectedPortfolio, objective, constraints);
      if (!r) setError("Optimization failed — ensure positions have at least 10 days of overlapping historical data.");
      else setResult(r);
    } catch {
      setError("An error occurred during optimization.");
    }
    setLoading(false);
  };

  const frontierData = result?.efficientFrontier.map((p) => ({
    x: +(p.expectedVolatility * 100).toFixed(2),
    y: +(p.expectedReturn * 100).toFixed(2),
  })) ?? [];

  if (portfolios.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Portfolio Optimization"
          subtitle="Mean-variance optimization and efficient frontier"
          icon={<Zap className="w-5 h-5" />}
        />
        <EmptyState
          icon={Zap}
          title="No Portfolio Found"
          description="Add at least 2 positions to your Portfolio Tracker first, then return here to optimize for the efficient frontier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio Optimization"
        subtitle="Mean-variance optimization and efficient frontier"
        icon={<Zap className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Optimization Settings">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="stat-label">Portfolio</label>
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setResult(null); }}
                className="input-field"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.positions.length} positions)
                  </option>
                ))}
              </select>
              {!canOptimize && (
                <p className="text-xs text-warning mt-1">Need at least 2 positions to optimize.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Objective</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as OptimizationObjective)}
                className="input-field"
              >
                {(["Max Sharpe", "Min Variance"] as OptimizationObjective[]).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Max Weight per Asset (%)</label>
              <input
                type="number" value={maxWeight} min={1} max={100}
                onChange={(e) => setMaxWeight(+e.target.value)}
                className="input-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Min Weight per Asset (%)</label>
              <input
                type="number" value={minWeight} min={0} max={50}
                onChange={(e) => setMinWeight(+e.target.value)}
                className="input-field"
              />
            </div>

            <button
              onClick={run}
              disabled={loading || !canOptimize}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Optimizing…</>
                : "Run Optimization"}
            </button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {loading && <LoadingState message="Running portfolio simulations…" />}

          {error && !loading && (
            <div className="card p-5 text-center text-sm text-danger border border-danger/20">{error}</div>
          )}

          {!loading && !result && !error && (
            <div className="card p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
              <Zap className="w-10 h-10 text-slate-700 mb-4" />
              <p className="text-sm text-slate-500 max-w-xs">
                Configure the settings on the left and run optimization to see the efficient frontier and suggested weights.
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <Card title="Current Portfolio">
                  <StatRow label="Expected Return" value={`${(result.current.expectedReturn * 100).toFixed(1)}%`} />
                  <StatRow label="Volatility"      value={`${(result.current.expectedVolatility * 100).toFixed(1)}%`} />
                  <StatRow label="Sharpe Ratio"    value={formatSafe(result.current.sharpeRatio, 2)} highlight />
                </Card>
                <Card title={`Optimized (${objective})`}>
                  <StatRow label="Expected Return" value={`${(result.optimized.expectedReturn * 100).toFixed(1)}%`} />
                  <StatRow label="Volatility"      value={`${(result.optimized.expectedVolatility * 100).toFixed(1)}%`} />
                  <StatRow label="Sharpe Ratio"    value={formatSafe(result.optimized.sharpeRatio, 2)} highlight />
                </Card>
              </div>

              <Card title="Efficient Frontier">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis
                        dataKey="x" name="Volatility" unit="%" type="number"
                        stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                        label={{ value: "Volatility (%)", position: "insideBottom", offset: -10, fontSize: 10, fill: "#475569" }}
                      />
                      <YAxis
                        dataKey="y" name="Return" unit="%" type="number"
                        stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                      />
                      <ZAxis range={[16, 16]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(v: number, name: string) => [`${v}%`, name === "x" ? "Volatility" : "Return"]}
                      />
                      <Scatter data={frontierData} fill="#22c55e" fillOpacity={0.5} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Optimized Weights">
                <div className="space-y-3">
                  {(Object.entries(result.optimized.weights) as Array<[string, number]>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sym, w]) => (
                      <div key={sym}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{sym}</span>
                          <span className="text-sm font-mono text-accent">{(w * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${w * 100}%` }} />
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

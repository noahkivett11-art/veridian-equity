import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, PageHeader, InputField } from "../../shared";
import { MonteCarloService, SimulationInputs, SimulationResult } from "../../../services/monteCarloService";
import { formatSafe, formatCurrency } from "../../../lib/utils";

export const MonteCarloSimulationModule: React.FC = () => {
  const [inputs, setInputs] = useState<SimulationInputs>({
    initialValue: 100000, years: 10, numSimulations: 1000,
    annualContribution: 5000, targetValue: 200000,
    expectedReturnOverride: 0.08, volatilityOverride: 0.18,
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const r = await MonteCarloService.getInstance().runPortfolioSimulation(inputs);
    setResult(r);
    setLoading(false);
  };

  const update = (key: keyof SimulationInputs, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setInputs((p) => ({ ...p, [key]: n }));
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Monte Carlo Simulation" subtitle="Simulate portfolio return paths with configurable parameters" icon={<TrendingUp className="w-5 h-5" />} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Simulation Parameters">
          <div className="space-y-4">
            <InputField label="Initial Value ($)" value={inputs.initialValue} onChange={(v) => update("initialValue", v)} type="number" />
            <InputField label="Annual Contribution ($)" value={inputs.annualContribution} onChange={(v) => update("annualContribution", v)} type="number" />
            <InputField label="Time Horizon (Years)" value={inputs.years} onChange={(v) => update("years", v)} type="number" />
            <InputField label="Target Value ($)" value={inputs.targetValue} onChange={(v) => update("targetValue", v)} type="number" />
            <InputField label="Expected Return (%)" value={(inputs.expectedReturnOverride ?? 0) * 100} onChange={(v) => update("expectedReturnOverride", String(parseFloat(v) / 100))} type="number" suffix="%" />
            <InputField label="Volatility (%)" value={(inputs.volatilityOverride ?? 0) * 100} onChange={(v) => update("volatilityOverride", String(parseFloat(v) / 100))} type="number" suffix="%" />
            <InputField label="Simulations" value={inputs.numSimulations} onChange={(v) => update("numSimulations", v)} type="number" />
            <button onClick={run} disabled={loading} className="btn-primary w-full">{loading ? "Running..." : "Run Simulation"}</button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {result && (
            <>
              <Card title="Simulation Fan Chart">
                <div className="h-[350px]">
                  {(() => {
                    const sorted = [...result.paths].sort((a, b) => {
                      const aT = a.data[a.data.length - 1]?.value ?? 0;
                      const bT = b.data[b.data.length - 1]?.value ?? 0;
                      return aT - bT;
                    });
                    const n = sorted.length;
                    const low = sorted[Math.max(0, Math.floor(n * 0.05))];
                    const mid = sorted[Math.floor(n * 0.5)];
                    const high = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
                    const chartData = (mid || low || high)?.data.map((d, i) => ({
                      year: d.year,
                      p5: low?.data[i]?.value,
                      p50: mid?.data[i]?.value,
                      p95: high?.data[i]?.value,
                    })) ?? [];
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="year" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 10, fill: "#475569" }} />
                          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [formatCurrency(v)]} />
                          <Area type="monotone" dataKey="p5" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={1} name="5th %ile" />
                          <Area type="monotone" dataKey="p50" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} name="Median" />
                          <Area type="monotone" dataKey="p95" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1} name="95th %ile" />
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Median Value", value: formatCurrency(result.percentiles.p50) },
                  { label: "5th Percentile", value: formatCurrency(result.percentiles.p5) },
                  { label: "95th Percentile", value: formatCurrency(result.percentiles.p95) },
                  { label: "P(Target)", value: `${result.probabilityOfTarget.toFixed(1)}%` },
                ].map((s) => (
                  <Card key={s.label}>
                    <div className="stat-label mb-1">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                  </Card>
                ))}
              </div>

              {result.var5 !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card title="Risk Metrics">
                    <div>
                      <div className="flex justify-between py-2 border-b border-white/[0.04]"><span className="text-xs text-slate-500">VaR (5%)</span><span className="text-sm font-mono text-danger">{formatCurrency(result.var5)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-xs text-slate-500">CVaR / Expected Shortfall</span><span className="text-sm font-mono text-danger">{formatCurrency(result.cvar5)}</span></div>
                    </div>
                  </Card>
                  <Card title="Return Statistics">
                    <div>
                      <div className="flex justify-between py-2 border-b border-white/[0.04]"><span className="text-xs text-slate-500">Mean Return</span><span className="text-sm font-mono text-accent">{formatSafe(result.meanReturn * 100, 2)}%</span></div>
                      <div className="flex justify-between py-2"><span className="text-xs text-slate-500">Std Deviation</span><span className="text-sm font-mono text-white">{formatSafe(result.stdDevReturn * 100, 2)}%</span></div>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
          {!result && <div className="card p-16 text-center text-sm text-slate-500">Configure parameters and run simulation to see results.</div>}
        </div>
      </div>
    </div>
  );
};

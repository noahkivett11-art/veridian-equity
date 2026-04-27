import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calculator, Search, Shield, Printer, Activity } from "lucide-react";
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, PageHeader } from "../shared";
import { CompanyDataService, CompanySearchResult } from "../../services/companyService";
import { DCFService, DCFAssumptions, WACCInputs, DCFResult, ValueSource, DCFValue } from "../../services/dcfService";
import { useDebounce, useClickOutside } from "../../hooks";
import { formatSafe } from "../../lib/utils";

// ─── Source-aware input ─────────────────────────────────────────────

const DCFInput = ({
  label, value, onChange, suffix = "", source = "assumption", sourceLabel,
}: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  suffix?: string; source?: ValueSource; sourceLabel?: string;
}) => {
  const colors = { loaded: "text-accent", assumption: "text-slate-500", override: "text-orange-400" };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</label>
        <span className={`text-[8px] uppercase font-semibold ${colors[source]}`}>
          {source === "loaded" ? "Loaded" : source === "override" ? "Override" : "Assumption"}
        </span>
      </div>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value) || null)}
          className={`w-full bg-surface-800/80 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors ${
            source === "override" ? "border-orange-400/30 focus:border-orange-400/50" : "border-white/[0.08] focus:border-accent/40"
          }`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
};

// ─── Main DCF Module ────────────────────────────────────────────────

interface DCFProps {
  initialSymbol?: string | null;
  onResultChange?: (symbol: string, result: DCFResult) => void;
  onSelectTicker?: (symbol: string) => void;
}

export const DCFValuationModule: React.FC<DCFProps> = ({ initialSymbol, onResultChange, onSelectTicker }) => {
  const [ticker, setTicker] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const clearSearch = () => setSearchResults([]);
  const searchRef = useClickOutside(clearSearch);
  const debouncedTicker = useDebounce(ticker, 300);

  const mkVal = <T,>(value: T, source: ValueSource = "assumption"): DCFValue<T> => ({ value, source });

  const [assumptions, setAssumptions] = useState<DCFAssumptions>({
    symbol: "", companyName: "",
    currentRevenue: mkVal(1000), growthRates: mkVal([0.15, 0.12, 0.10, 0.08, 0.06]),
    operatingMargin: mkVal(0.25), taxRate: mkVal(0.21),
    daPercentOfRev: mkVal(0.05), capexPercentOfRev: mkVal(0.06), wcPercentOfRev: mkVal(0.02),
    sharesOutstanding: mkVal(100), currentEPS: mkVal(5.0),
    baseRevenueGrowth: mkVal(0.15), baseEPSGrowth: mkVal(0.12),
    epsGrowthRates: mkVal([0.12, 0.10, 0.08, 0.07, 0.06]),
    modelDriver: mkVal("blended"), netDebt: mkVal(200),
    terminalGrowth: mkVal(0.02), wacc: mkVal(0.09),
  });

  const [waccInputs, setWaccInputs] = useState<WACCInputs>({
    riskFreeRate: mkVal(0.04), beta: mkVal(1.2), equityRiskPremium: mkVal(0.05),
    costOfDebt: mkVal(0.06), taxRate: mkVal(0.21), debtWeight: mkVal(0.2), equityWeight: mkVal(0.8),
  });

  const [result, setResult] = useState<DCFResult | null>(null);

  // Recalc WACC → assumptions
  useEffect(() => {
    const w = DCFService.getInstance().calculateWACC(waccInputs);
    setAssumptions((p) => ({ ...p, wacc: { ...p.wacc, value: w } }));
  }, [waccInputs]);

  // Recalc DCF
  useEffect(() => {
    const r = DCFService.getInstance().calculateDCF(assumptions);
    setResult(r);
    if (assumptions.symbol && r) onResultChange?.(assumptions.symbol, r);
  }, [assumptions]);

  // Load on initial symbol
  useEffect(() => {
    if (initialSymbol && ticker !== initialSymbol) loadCompany(initialSymbol);
  }, [initialSymbol]);

  // Search
  useEffect(() => {
    if (debouncedTicker.length > 0) {
      CompanyDataService.getInstance().searchCompanies(debouncedTicker).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [debouncedTicker]);

  const loadCompany = async (sym: string) => {
    setTicker(sym);
    setSearchResults([]);
    onSelectTicker?.(sym);
    const data = await DCFService.getInstance().loadCompanyData(sym);
    if (data) { setAssumptions(data.assumptions); setWaccInputs(data.waccInputs); }
  };

  const setA = (key: keyof DCFAssumptions, value: any) => {
    setAssumptions((p) => ({ ...p, [key]: { ...(p[key] as DCFValue<any>), value, source: "override" as ValueSource } }));
  };

  const setBaseGrowth = (v: number | null) => {
    const b = v ?? 0;
    const rates = [b, b * 0.9, b * 0.8, b * 0.7, b * 0.6];
    setAssumptions((p) => ({
      ...p,
      baseRevenueGrowth: { ...p.baseRevenueGrowth, value: v, source: "override" },
      growthRates: { ...p.growthRates, value: rates, source: "assumption" },
    }));
  };

  const setBaseEPSGrowth = (v: number | null) => {
    const b = v ?? 0;
    const rates = [b, b * 0.9, b * 0.8, b * 0.7, b * 0.6];
    setAssumptions((p) => ({
      ...p,
      baseEPSGrowth: { ...p.baseEPSGrowth, value: v, source: "override" },
      epsGrowthRates: { ...p.epsGrowthRates, value: rates, source: "assumption" },
    }));
  };

  const setGrowth = (i: number, v: number | null) => {
    const g = [...assumptions.growthRates.value];
    g[i] = v ?? 0;
    setAssumptions((p) => ({ ...p, growthRates: { ...p.growthRates, value: g, source: "override" } }));
  };

  const setEPSGrowth = (i: number, v: number | null) => {
    const g = [...assumptions.epsGrowthRates.value];
    g[i] = v ?? 0;
    setAssumptions((p) => ({ ...p, epsGrowthRates: { ...p.epsGrowthRates, value: g, source: "override" } }));
  };

  const setW = (key: keyof WACCInputs, value: number | null) => {
    setWaccInputs((p) => ({ ...p, [key]: { ...p[key], value, source: "override" } }));
  };

  // Sensitivity
  const wacc = assumptions.wacc.value ?? 0.09;
  const tg = assumptions.terminalGrowth.value ?? 0.02;
  const waccRange = [wacc - 0.01, wacc - 0.005, wacc, wacc + 0.005, wacc + 0.01];
  const growthRange = [tg - 0.005, tg - 0.0025, tg, tg + 0.0025, tg + 0.005];
  const sensitivity = DCFService.getInstance().generateSensitivity(assumptions, waccRange, growthRange);

  const pct = (v: DCFValue<number | null>) => (v.value !== null ? v.value * 100 : null);
  const fromPct = (v: number | null) => (v !== null ? v / 100 : null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="DCF Valuation"
        subtitle="Multi-stage intrinsic value model with sensitivity analysis"
        icon={<Calculator className="w-5 h-5" />}
        rightContent={<button onClick={() => window.print()} className="btn-secondary text-xs flex items-center gap-2"><Printer className="w-3.5 h-3.5" />Export</button>}
      />

      {/* Ticker Search */}
      <div className="card p-5 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 relative" ref={searchRef}>
          <div className="flex items-center gap-2 mb-1.5">
            <Search className="w-3.5 h-3.5 text-accent" />
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Load Company</label>
          </div>
          <input
            type="text" value={ticker} onChange={(e) => setTicker(e.target.value)}
            placeholder="Search ticker (e.g. AAPL, MSFT)..."
            className="input-field"
          />
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute top-full left-0 right-0 mt-1.5 bg-surface-900 border border-white/[0.08] rounded-lg shadow-2xl z-50 overflow-hidden">
                {searchResults.map((r) => (
                  <button key={r.symbol} onClick={() => loadCompany(r.symbol)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors group">
                    <div><span className="text-sm font-semibold text-white group-hover:text-accent">{r.symbol}</span>
                      <span className="text-xs text-slate-500 ml-2">{r.name}</span></div>
                    <span className="text-[10px] font-mono text-slate-600">{r.exchange}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {assumptions.symbol && (
          <div className="text-right">
            <div className="text-lg font-display font-bold text-white">{assumptions.companyName}</div>
            <div className="text-xs font-mono text-accent">{assumptions.symbol} · Data Loaded</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Assumptions + Forecast */}
        <div className="lg:col-span-2 space-y-6">
          {/* Model Assumptions */}
          <Card title="Model Assumptions">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-semibold text-slate-400 border-b border-white/[0.04] pb-1.5">Operating Metrics</h4>
                <DCFInput label="Revenue ($M)" value={assumptions.currentRevenue.value} source={assumptions.currentRevenue.source} onChange={(v) => setA("currentRevenue", v)} />
                <DCFInput label="Revenue Growth" value={pct(assumptions.baseRevenueGrowth)} source={assumptions.baseRevenueGrowth.source} onChange={(v) => setBaseGrowth(fromPct(v))} suffix="%" />
                <DCFInput label="Operating Margin" value={pct(assumptions.operatingMargin)} source={assumptions.operatingMargin.source} onChange={(v) => setA("operatingMargin", fromPct(v))} suffix="%" />
                <DCFInput label="Tax Rate" value={pct(assumptions.taxRate)} source={assumptions.taxRate.source} onChange={(v) => setA("taxRate", fromPct(v))} suffix="%" />
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-semibold text-slate-400 border-b border-white/[0.04] pb-1.5">Capital & Cash Flow</h4>
                <DCFInput label="D&A (% Rev)" value={pct(assumptions.daPercentOfRev)} source={assumptions.daPercentOfRev.source} onChange={(v) => setA("daPercentOfRev", fromPct(v))} suffix="%" />
                <DCFInput label="CapEx (% Rev)" value={pct(assumptions.capexPercentOfRev)} source={assumptions.capexPercentOfRev.source} onChange={(v) => setA("capexPercentOfRev", fromPct(v))} suffix="%" />
                <DCFInput label="WC (% Rev)" value={pct(assumptions.wcPercentOfRev)} source={assumptions.wcPercentOfRev.source} onChange={(v) => setA("wcPercentOfRev", fromPct(v))} suffix="%" />
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-semibold text-slate-400 border-b border-white/[0.04] pb-1.5">Valuation Inputs</h4>
                <DCFInput label="Shares Outstanding (M)" value={assumptions.sharesOutstanding.value} source={assumptions.sharesOutstanding.source} onChange={(v) => setA("sharesOutstanding", v)} />
                <DCFInput label="Current EPS" value={assumptions.currentEPS.value} source={assumptions.currentEPS.source} onChange={(v) => setA("currentEPS", v)} />
                <DCFInput label="EPS Growth" value={pct(assumptions.baseEPSGrowth)} source={assumptions.baseEPSGrowth.source} onChange={(v) => setBaseEPSGrowth(fromPct(v))} suffix="%" />
                <DCFInput label="Net Debt ($M)" value={assumptions.netDebt.value} source={assumptions.netDebt.source} onChange={(v) => setA("netDebt", v)} />
                <DCFInput label="Terminal Growth" value={pct(assumptions.terminalGrowth)} source={assumptions.terminalGrowth.source} onChange={(v) => setA("terminalGrowth", fromPct(v))} suffix="%" />
              </div>
            </div>

            {/* Model Driver Toggle */}
            <div className="mt-6 pt-5 border-t border-white/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Model Driver</span>
                <div className="flex bg-surface-800/50 p-0.5 rounded-lg border border-white/[0.04]">
                  {(["revenue", "earnings", "blended"] as const).map((m) => (
                    <button key={m} onClick={() => setA("modelDriver", m)}
                      className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-md transition-all ${
                        assumptions.modelDriver.value === m ? "bg-accent text-surface-950" : "text-slate-500 hover:text-white"
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                {assumptions.modelDriver.value === "revenue" && "FCF driven by top-line revenue growth and operating margins."}
                {assumptions.modelDriver.value === "earnings" && "FCF derived from forecasted EPS and shares outstanding."}
                {assumptions.modelDriver.value === "blended" && "50/50 weighted average of revenue and earnings drivers."}
              </p>
            </div>

            {/* Growth rate projections */}
            <div className="mt-6 space-y-3">
              <h4 className="text-[10px] font-semibold text-slate-400 border-b border-white/[0.04] pb-1.5">Revenue Growth Projections</h4>
              <div className="grid grid-cols-5 gap-3">
                {assumptions.growthRates.value.map((r, i) => (
                  <DCFInput key={i} label={`Y${i + 1}`} value={r !== null ? r * 100 : null} onChange={(v) => setGrowth(i, fromPct(v))} suffix="%" source={assumptions.growthRates.source} />
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <h4 className="text-[10px] font-semibold text-slate-400 border-b border-white/[0.04] pb-1.5">EPS Growth Projections</h4>
              <div className="grid grid-cols-5 gap-3">
                {assumptions.epsGrowthRates.value.map((r, i) => (
                  <DCFInput key={i} label={`Y${i + 1}`} value={r !== null ? r * 100 : null} onChange={(v) => setEPSGrowth(i, fromPct(v))} suffix="%" source={assumptions.epsGrowthRates.source} />
                ))}
              </div>
            </div>
          </Card>

          {/* FCF Forecast Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02] flex justify-between items-center">
              <h3 className="text-sm font-display font-semibold text-white">5-Year FCF Projection</h3>
              <span className="text-[10px] text-slate-500">All figures in $M</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Metric</th>
                    {[1, 2, 3, 4, 5].map((y) => <th key={y} className="px-4 py-3 text-[10px] font-semibold text-slate-500 text-right">Year {y}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Revenue", key: "revenue", fmt: 1, cls: "text-white" },
                    { label: "EPS", key: "eps", fmt: 2, cls: "text-accent" },
                    { label: "EBIT", key: "ebit", fmt: 1, cls: "text-white" },
                    { label: "Taxes", key: "taxes", fmt: 1, cls: "text-danger/70", neg: true },
                    { label: "NOPAT", key: "nopat", fmt: 1, cls: "text-white font-semibold", bg: "bg-white/[0.02]" },
                    { label: "D&A", key: "da", fmt: 1, cls: "text-accent/70" },
                    { label: "CapEx", key: "capex", fmt: 1, cls: "text-danger/70", neg: true },
                    { label: "Δ WC", key: "changeInWC", fmt: 1, cls: "text-danger/70", neg: true },
                    { label: "Free Cash Flow", key: "fcf", fmt: 1, cls: "text-accent font-semibold", bg: "bg-accent/[0.06]" },
                    { label: `PV of FCF @${formatSafe(wacc * 100, 1)}%`, key: "pvFcf", fmt: 1, cls: "text-slate-500 italic" },
                  ].map((row) => (
                    <tr key={row.key} className={`border-b border-white/[0.03] ${row.bg || ""}`}>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{row.label}</td>
                      {result?.forecast.map((f: any) => (
                        <td key={f.year} className={`px-4 py-2.5 text-right ${row.cls}`}>
                          {row.neg ? `(${formatSafe(f[row.key], row.fmt)})` : formatSafe(f[row.key], row.fmt)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: WACC + Summary */}
        <div className="space-y-6">
          <Card title="WACC Calculation">
            <div className="space-y-3">
              <DCFInput label="Risk-Free Rate" value={pct(waccInputs.riskFreeRate)} source={waccInputs.riskFreeRate.source} onChange={(v) => setW("riskFreeRate", fromPct(v))} suffix="%" />
              <DCFInput label="Beta" value={waccInputs.beta.value} source={waccInputs.beta.source} onChange={(v) => setW("beta", v)} />
              <DCFInput label="Equity Risk Premium" value={pct(waccInputs.equityRiskPremium)} source={waccInputs.equityRiskPremium.source} onChange={(v) => setW("equityRiskPremium", fromPct(v))} suffix="%" />
              <div className="grid grid-cols-2 gap-3">
                <DCFInput label="Debt Weight" value={pct(waccInputs.debtWeight)} source={waccInputs.debtWeight.source} onChange={(v) => setW("debtWeight", fromPct(v))} suffix="%" />
                <DCFInput label="Equity Weight" value={pct(waccInputs.equityWeight)} source={waccInputs.equityWeight.source} onChange={(v) => setW("equityWeight", fromPct(v))} suffix="%" />
              </div>
              <DCFInput label="Cost of Debt" value={pct(waccInputs.costOfDebt)} source={waccInputs.costOfDebt.source} onChange={(v) => setW("costOfDebt", fromPct(v))} suffix="%" />
              <DCFInput label="Tax Rate (WACC)" value={pct(waccInputs.taxRate)} source={waccInputs.taxRate.source} onChange={(v) => setW("taxRate", fromPct(v))} suffix="%" />
              <div className="pt-3 mt-3 border-t border-white/[0.06] flex justify-between items-center">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Calculated WACC</span>
                <span className="text-xl font-mono font-bold text-accent">{formatSafe(wacc * 100, 2)}%</span>
              </div>
            </div>
          </Card>

          {/* Valuation Summary */}
          <div className="card p-5 border border-accent/20 bg-accent/[0.03]">
            <h3 className="text-sm font-display font-semibold text-white mb-4">Valuation Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">PV of Forecast FCF</span><span className="text-white font-mono">${formatSafe(result?.pvForecastCashFlows, 1)}M</span></div>
              <div className="flex justify-between"><span className="text-slate-400">PV of Terminal Value</span><span className="text-white font-mono">${formatSafe(result?.pvTerminalValue, 1)}M</span></div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between font-semibold"><span className="text-white">Enterprise Value</span><span className="text-white font-mono">${formatSafe(result?.enterpriseValue, 1)}M</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Less: Net Debt</span><span className="text-danger font-mono">(${formatSafe(assumptions.netDebt.value, 1)}M)</span></div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between font-semibold"><span className="text-white">Equity Value</span><span className="text-white font-mono">${formatSafe(result?.equityValue, 1)}M</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Shares Outstanding</span><span className="text-white font-mono">{assumptions.sharesOutstanding.value ?? "—"}M</span></div>
            </div>
            <div className="mt-4 p-3 bg-accent rounded-lg text-surface-950 text-center">
              <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5">Intrinsic Value Per Share</div>
              <div className="text-2xl font-mono font-bold">${formatSafe(result?.intrinsicValue, 2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity Table */}
      <Card title="Sensitivity Analysis: WACC vs Terminal Growth">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-sm font-mono">
            <thead>
              <tr>
                <th className="p-3 border border-white/[0.04] bg-white/[0.02] text-[10px] font-semibold text-slate-500 uppercase">WACC \ Growth</th>
                {growthRange.map((g) => <th key={g} className="p-3 border border-white/[0.04] bg-white/[0.02] text-[10px] font-semibold text-slate-500">{formatSafe(g * 100, 2)}%</th>)}
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((row, i) => (
                <tr key={i}>
                  <td className="p-3 border border-white/[0.04] bg-white/[0.02] text-[10px] font-semibold text-slate-500">{formatSafe(waccRange[i] * 100, 2)}%</td>
                  {row.map((val, j) => (
                    <td key={j} className={`p-3 border border-white/[0.04] ${i === 2 && j === 2 ? "bg-accent/15 text-accent font-semibold" : "text-slate-300"}`}>
                      ${formatSafe(val, 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-slate-500 italic text-center">Highlighted cell = base case.</p>
      </Card>
    </div>
  );
};

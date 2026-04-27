import React, { useState, useEffect } from "react";
import { PieChart as PieChartIcon, Printer, Plus, Trash2, Play } from "lucide-react";
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, PageHeader, InputField, StatRow } from "../../shared";
import { FixedIncomeService, BondInputs, BondPricingResult, YieldCurvePoint, SpotBootstrapBond, SpotRateResult } from "../../../services/fixedIncomeService";

interface SensitivityRow {
  yieldChange: number;
  newYield: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
}

const DEFAULT_INPUTS: BondInputs = { faceValue: 1000, couponRate: 5.0, ytm: 4.5, yearsToMaturity: 10, frequency: 2 };

const DEFAULT_BOOTSTRAP_BONDS: SpotBootstrapBond[] = [
  { maturity: 0.5, couponRate: 0,   price: 973.24, faceValue: 1000, frequency: 2 },
  { maturity: 1.0, couponRate: 0,   price: 947.87, faceValue: 1000, frequency: 2 },
  { maturity: 1.5, couponRate: 2.5, price: 976.30, faceValue: 1000, frequency: 2 },
  { maturity: 2.0, couponRate: 3.0, price: 981.50, faceValue: 1000, frequency: 2 },
  { maturity: 3.0, couponRate: 4.0, price: 989.20, faceValue: 1000, frequency: 2 },
  { maturity: 5.0, couponRate: 4.5, price: 993.10, faceValue: 1000, frequency: 2 },
];

function buildSensitivityRows(inputs: BondInputs, r: BondPricingResult, svc: FixedIncomeService): SensitivityRow[] {
  const rawSens = svc.getPriceSensitivityAnalysis(inputs);
  const baseRow: SensitivityRow = { yieldChange: 0, newYield: inputs.ytm, newPrice: r.price, priceChange: 0, priceChangePercent: 0 };
  return [
    baseRow,
    ...rawSens.map((row) => ({
      yieldChange: row.shiftBps,
      newYield: inputs.ytm + row.shiftBps / 100,
      newPrice: row.exactPrice,
      priceChange: row.exactPrice - r.price,
      priceChangePercent: ((row.exactPrice - r.price) / r.price) * 100,
    })),
  ].sort((a, b) => a.yieldChange - b.yieldChange);
}

export const FixedIncomeModule: React.FC = () => {
  const svc = FixedIncomeService.getInstance();

  const [inputs, setInputs] = useState<BondInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<BondPricingResult>(() => svc.calculateBondPrice(DEFAULT_INPUTS));
  const [yieldCurve, setYieldCurve] = useState<YieldCurvePoint[]>(() => svc.getTreasuryYieldCurve());
  const [sensitivity, setSensitivity] = useState<SensitivityRow[]>(() => {
    const r = svc.calculateBondPrice(DEFAULT_INPUTS);
    return buildSensitivityRows(DEFAULT_INPUTS, r, svc);
  });
  const [priceYield, setPriceYield] = useState<{ ytm: number; price: number; tangent?: number }[]>(() => {
    const r = svc.calculateBondPrice(DEFAULT_INPUTS);
    return svc.generateSensitivity(DEFAULT_INPUTS).map((p) => ({
      ...p,
      tangent: r.price * (1 - r.modifiedDuration * (p.ytm - DEFAULT_INPUTS.ytm) / 100),
    }));
  });

  // YTM Solver
  const [ytmSolverInputs, setYtmSolverInputs] = useState({ marketPrice: '1050', faceValue: '1000', couponRate: '5.0', years: '10', frequency: '2' });
  const [ytmSolverResult, setYtmSolverResult] = useState<{ ytm: number; iterations: number; verificationPrice: number } | null>(null);

  // Spot Rate Bootstrapper
  const [bootstrapBonds, setBootstrapBonds] = useState<SpotBootstrapBond[]>(DEFAULT_BOOTSTRAP_BONDS);
  const [spotRates, setSpotRates] = useState<SpotRateResult[]>([]);

  useEffect(() => {
    const r = svc.calculateBondPrice(inputs);
    setResult(r);
    setYieldCurve(svc.getTreasuryYieldCurve());
    setSensitivity(buildSensitivityRows(inputs, r, svc));
    setPriceYield(
      svc.generateSensitivity(inputs).map((p) => ({
        ...p,
        tangent: r.price * (1 - r.modifiedDuration * (p.ytm - inputs.ytm) / 100),
      }))
    );
  }, [inputs]);

  const update = (key: keyof BondInputs, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setInputs((p) => ({ ...p, [key]: n }));
  };

  const solveYTM = () => {
    const mp = parseFloat(ytmSolverInputs.marketPrice);
    const fv = parseFloat(ytmSolverInputs.faceValue);
    const cr = parseFloat(ytmSolverInputs.couponRate);
    const yr = parseFloat(ytmSolverInputs.years);
    const fr = parseInt(ytmSolverInputs.frequency);
    if ([mp, fv, cr, yr, fr].some(isNaN)) return;
    const res = svc.solveYTM(mp, fv, cr, yr, fr);
    setYtmSolverResult(res);
  };

  const runBootstrap = () => {
    const results = svc.bootstrapSpotRates(bootstrapBonds);
    setSpotRates(results);
  };

  const updateBootstrapBond = (i: number, field: keyof SpotBootstrapBond, val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    setBootstrapBonds(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: n } : b));
  };

  const addBootstrapBond = () => {
    const last = bootstrapBonds[bootstrapBonds.length - 1];
    setBootstrapBonds(prev => [...prev, { maturity: (last?.maturity ?? 0) + 1, couponRate: 4.5, price: 990, faceValue: 1000, frequency: 2 }]);
  };

  const removeBootstrapBond = (i: number) => setBootstrapBonds(prev => prev.filter((_, idx) => idx !== i));

  const annualCoupon = inputs.faceValue * (inputs.couponRate / 100);
  const currentYield = (annualCoupon / result.price) * 100;
  const dv01 = result.dollarDuration / 10000;
  const totalCouponIncome = annualCoupon * inputs.yearsToMaturity;
  const totalReturn = totalCouponIncome + (inputs.faceValue - result.price);

  return (
    <div className="space-y-8">
      <PageHeader title="Fixed Income & Yield Curve" subtitle="Bond pricing, duration, and treasury curve analytics" icon={<PieChartIcon className="w-5 h-5" />}
        rightContent={<button onClick={() => window.print()} className="btn-secondary text-xs flex items-center gap-2"><Printer className="w-3.5 h-3.5" />Export</button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Yield Curve */}
        <div className="lg:col-span-2">
          <Card title="U.S. Treasury Yield Curve">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="ycGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="maturity" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} unit="%" domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }} />
                  <Area type="monotone" dataKey="yield" stroke="#22c55e" strokeWidth={2} fill="url(#ycGrad)" dot={{ fill: "#22c55e", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Yield curve data table */}
        <Card title="Curve Data">
          <div className="space-y-0 max-h-[300px] overflow-y-auto">
            {yieldCurve.map((p) => (
              <StatRow key={p.maturity} label={p.maturity} value={`${p.yield.toFixed(2)}%`} />
            ))}
          </div>
        </Card>
      </div>

      {/* Bond Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Bond Parameters">
          <div className="space-y-4">
            <InputField label="Face Value ($)" value={inputs.faceValue} onChange={(v) => update("faceValue", v)} type="number" />
            <InputField label="Coupon Rate (%)" value={inputs.couponRate} onChange={(v) => update("couponRate", v)} type="number" suffix="%" />
            <InputField label="Yield to Maturity (%)" value={inputs.ytm} onChange={(v) => update("ytm", v)} type="number" suffix="%" />
            <InputField label="Years to Maturity" value={inputs.yearsToMaturity} onChange={(v) => update("yearsToMaturity", v)} type="number" />
            <div className="space-y-1.5">
              <label className="stat-label">Payment Frequency</label>
              <select value={inputs.frequency} onChange={(e) => setInputs({ ...inputs, frequency: parseInt(e.target.value) })} className="input-field text-xs">
                <option value={1} className="bg-surface-900">Annual</option>
                <option value={2} className="bg-surface-900">Semi-Annual</option>
                <option value={4} className="bg-surface-900">Quarterly</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Pricing Result */}
        <Card title="Bond Pricing">
          <div>
            <div className="p-3 bg-accent/[0.06] rounded-lg text-center mb-4">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Clean Price</div>
              <div className="text-2xl font-mono font-bold text-accent">${result.price.toFixed(4)}</div>
            </div>
            <StatRow label="Current Yield"       value={`${currentYield.toFixed(4)}%`} />
            <StatRow label="Macaulay Duration"   value={`${result.macaulayDuration.toFixed(4)} yrs`} highlight />
            <StatRow label="Modified Duration"   value={result.modifiedDuration.toFixed(4)} highlight />
            <StatRow label="Convexity"           value={result.convexity.toFixed(4)} highlight />
            <StatRow label="DV01"                value={`$${dv01.toFixed(4)}`} />
            <StatRow label="Total Coupon Income" value={`$${totalCouponIncome.toFixed(2)}`} />
            <StatRow label="Total Return"        value={`$${totalReturn.toFixed(2)}`} />
          </div>
        </Card>

        {/* Price-Yield Curve */}
        <Card title="Price-Yield Relationship">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={priceYield} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="ytm" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }} />
                <Line type="monotone" dataKey="price" stroke="#22c55e" strokeWidth={2} dot={false} name="Actual Price" />
                <Line type="monotone" dataKey="tangent" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Duration Approx." />
              </ReLineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Sensitivity Table */}
      {sensitivity.length > 0 && (
        <Card title="Price Sensitivity Analysis">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-sm font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-500">YTM Change</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-500">New YTM</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-500">Price</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-500">Price Change</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-500">% Change</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.map((row, i) => (
                  <tr key={i} className={`border-b border-white/[0.03] ${row.yieldChange === 0 ? "bg-accent/[0.06]" : ""}`}>
                    <td className="px-4 py-2 text-slate-400">{row.yieldChange > 0 ? "+" : ""}{row.yieldChange} bps</td>
                    <td className="px-4 py-2">{row.newYield.toFixed(2)}%</td>
                    <td className="px-4 py-2">${row.newPrice.toFixed(2)}</td>
                    <td className={`px-4 py-2 ${row.priceChange >= 0 ? "positive" : "negative"}`}>
                      {row.priceChange >= 0 ? "+" : ""}{row.priceChange.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 ${row.priceChangePercent >= 0 ? "positive" : "negative"}`}>
                      {row.priceChangePercent >= 0 ? "+" : ""}{row.priceChangePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* YTM Solver */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="YTM Solver — Bisection Method">
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">Given a market price, solve for the yield to maturity using numerical bisection. Accurate to 0.001%.</p>
          <div className="space-y-3 mb-5">
            {[
              { label: 'Market Price ($)', key: 'marketPrice', suffix: '$' },
              { label: 'Face Value ($)', key: 'faceValue', suffix: '$' },
              { label: 'Coupon Rate (%)', key: 'couponRate', suffix: '%' },
              { label: 'Years to Maturity', key: 'years', suffix: 'yrs' },
            ].map(({ label, key, suffix }) => (
              <InputField key={key} label={label} value={(ytmSolverInputs as any)[key]}
                onChange={v => setYtmSolverInputs(p => ({ ...p, [key]: v }))} type="number" suffix={suffix} />
            ))}
            <div className="space-y-1.5">
              <label className="stat-label">Payment Frequency</label>
              <select value={ytmSolverInputs.frequency}
                onChange={e => setYtmSolverInputs(p => ({ ...p, frequency: e.target.value }))}
                className="input-field text-xs">
                <option value="1" className="bg-surface-900">Annual</option>
                <option value="2" className="bg-surface-900">Semi-Annual</option>
                <option value="4" className="bg-surface-900">Quarterly</option>
              </select>
            </div>
          </div>
          <button onClick={solveYTM} className="btn-primary w-full flex items-center justify-center gap-2 text-xs mb-4">
            <Play className="w-3.5 h-3.5" />Solve YTM
          </button>
          {ytmSolverResult && (
            <div className="p-4 rounded-xl bg-accent/[0.06] border border-accent/20">
              <div className="text-center mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Solved YTM</p>
                <p className="text-3xl font-mono font-bold text-accent">{ytmSolverResult.ytm.toFixed(4)}%</p>
              </div>
              <StatRow label="Iterations"          value={ytmSolverResult.iterations} />
              <StatRow label="Verification Price"  value={`$${ytmSolverResult.verificationPrice.toFixed(4)}`} />
              <StatRow label="Price Difference"    value={`$${Math.abs(parseFloat(ytmSolverInputs.marketPrice) - ytmSolverResult.verificationPrice).toFixed(6)}`} />
            </div>
          )}
        </Card>

        {/* Spot Rate Bootstrapper */}
        <Card title="Spot Rate Bootstrapper"
          rightContent={
            <button onClick={runBootstrap} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
              <Play className="w-3 h-3" />Bootstrap
            </button>
          }>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">Enter par bond data sorted by maturity. The bootstrapper derives the zero-coupon (spot) rate at each tenor.</p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Maturity (yr)', 'Coupon %', 'Price ($)', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[9px] text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bootstrapBonds.map((b, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="px-1 py-1">
                      <input type="number" value={b.maturity} onChange={e => updateBootstrapBond(i, 'maturity', e.target.value)}
                        className="input-field text-xs py-1 w-20" step="0.5" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={b.couponRate} onChange={e => updateBootstrapBond(i, 'couponRate', e.target.value)}
                        className="input-field text-xs py-1 w-20" step="0.25" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={b.price} onChange={e => updateBootstrapBond(i, 'price', e.target.value)}
                        className="input-field text-xs py-1 w-24" step="0.01" />
                    </td>
                    <td className="px-1 py-1">
                      <button onClick={() => removeBootstrapBond(i)} className="text-slate-600 hover:text-danger transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addBootstrapBond} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 mb-4 transition-colors">
            <Plus className="w-3 h-3" />Add Bond
          </button>
          {spotRates.length > 0 && (
            <>
              <div className="h-[180px] mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart data={spotRates} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="maturity" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `${v}Y`} />
                    <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} unit="%" domain={['auto','auto']} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "10px" }} formatter={(v: number) => [`${v.toFixed(3)}%`, 'Spot Rate']} />
                    <Line type="monotone" dataKey="spotRate" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="Spot Rate" />
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="py-1.5 text-left text-[9px] text-slate-500">Maturity</th>
                    <th className="py-1.5 text-right text-[9px] text-slate-500">Spot Rate</th>
                    <th className="py-1.5 text-right text-[9px] text-slate-500">Discount Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {spotRates.map((r, i) => (
                    <tr key={i} className="border-b border-white/[0.03]">
                      <td className="py-1.5 text-slate-300">{r.maturity}Y</td>
                      <td className="py-1.5 text-right text-accent font-semibold">{r.spotRate.toFixed(3)}%</td>
                      <td className="py-1.5 text-right text-slate-300">{r.discountFactor.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

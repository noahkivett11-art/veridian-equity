import React, { useState } from "react";
import { Target } from "lucide-react";
import { PageHeader, Card } from "../../shared";
import {
  PlannerService,
  InvestorProfileInputs,
  PortfolioRecommendation,
  RiskLevel,
  RiskTolerance,
  InvestmentPreference,
} from "../../../services/plannerService";

const DEFAULT_INPUTS: InvestorProfileInputs = {
  age: 35,
  investableAmount: 100000,
  annualContribution: 12000,
  yearsToRetirement: 25,
  riskLevel: "Medium",
  riskTolerance: "Moderate",
  desiredReturn: 7,
  incomeNeed: "None",
  preference: "Balanced",
};

export const PortfolioPlannerModule: React.FC = () => {
  const [inputs, setInputs] = useState<InvestorProfileInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<PortfolioRecommendation | null>(null);

  const set = <K extends keyof InvestorProfileInputs>(key: K, value: InvestorProfileInputs[K]) =>
    setInputs((p) => ({ ...p, [key]: value }));

  const generate = () => setResult(PlannerService.getInstance().generateRecommendation(inputs));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio Planner"
        subtitle="AI-powered asset allocation recommendations"
        icon={<Target className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Investor Profile">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="stat-label">Age</label>
                <input
                  type="number" value={inputs.age} min={18} max={80}
                  onChange={(e) => set("age", +e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="space-y-1.5">
                <label className="stat-label">Years to Retirement</label>
                <input
                  type="number" value={inputs.yearsToRetirement} min={1}
                  onChange={(e) => set("yearsToRetirement", +e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Investable Amount ($)</label>
              <input
                type="number" value={inputs.investableAmount}
                onChange={(e) => set("investableAmount", +e.target.value)}
                className="input-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Annual Contribution ($)</label>
              <input
                type="number" value={inputs.annualContribution}
                onChange={(e) => set("annualContribution", +e.target.value)}
                className="input-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Risk Level</label>
              <select
                value={inputs.riskLevel}
                onChange={(e) => set("riskLevel", e.target.value as RiskLevel)}
                className="input-field"
              >
                {(["Low", "Medium", "High", "Very High"] as RiskLevel[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Risk Tolerance</label>
              <select
                value={inputs.riskTolerance}
                onChange={(e) => set("riskTolerance", e.target.value as RiskTolerance)}
                className="input-field"
              >
                {(["Conservative", "Moderate", "Aggressive"] as RiskTolerance[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Investment Preference</label>
              <select
                value={inputs.preference}
                onChange={(e) => set("preference", e.target.value as InvestmentPreference)}
                className="input-field"
              >
                {(["Growth", "Income", "Balanced"] as InvestmentPreference[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="stat-label">Income Need</label>
              <select
                value={inputs.incomeNeed}
                onChange={(e) => set("incomeNeed", e.target.value as typeof inputs.incomeNeed)}
                className="input-field"
              >
                {(["None", "Low", "Medium", "High"] as const).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <button onClick={generate} className="btn-primary w-full mt-2">
              Generate Recommendation
            </button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <div className="card p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
              <Target className="w-10 h-10 text-slate-700 mb-4" />
              <p className="text-sm text-slate-500 max-w-xs">
                Configure your investor profile on the left and click Generate to see a personalized asset allocation.
              </p>
            </div>
          ) : (
            <>
              <Card title="Recommended Profile">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-display font-bold text-white">{result.profileName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {result.stockBondRatio} Stocks/Bonds · {result.growthTilt}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Est. Annual Return</div>
                    <div className="text-lg font-mono font-bold text-accent">
                      {result.estimatedReturnRange[0]}–{result.estimatedReturnRange[1]}%
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{result.explanation}</p>
              </Card>

              <Card title="Recommended Allocation">
                <div className="space-y-4">
                  {result.allocations.map((alloc) => (
                    <div key={alloc.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{alloc.category}</span>
                        <span className="text-sm font-mono font-bold text-accent">
                          {(alloc.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-500"
                          style={{ width: `${alloc.weight * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-500">{alloc.description}</p>
                        <p className="text-[10px] text-slate-600 font-mono">{alloc.exampleAssets.join(", ")}</p>
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

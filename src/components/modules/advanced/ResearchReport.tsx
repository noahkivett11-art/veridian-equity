import React, { useState, useEffect } from "react";
import { FileText, Search, TrendingUp, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PageHeader, EmptyState, LoadingState, Card, StatRow } from "../../shared";
import { ReportService, ResearchReport, EquityRating } from "../../../services/reportService";
import { CompanyDataService, CompanySearchResult } from "../../../services/companyService";
import { DCFResult } from "../../../services/dcfService";
import { CompsResult } from "../../../services/compsService";
import { useDebounce, useClickOutside } from "../../../hooks";
import { formatSafe } from "../../../lib/utils";

const RATING_STYLES: Record<EquityRating, { badge: string; text: string }> = {
  "Strong Buy":  { badge: "bg-accent/20 text-accent border border-accent/40",    text: "text-accent"  },
  "Buy":         { badge: "bg-accent/10 text-accent border border-accent/20",     text: "text-accent"  },
  "Hold":        { badge: "bg-warning/10 text-warning border border-warning/20",  text: "text-warning" },
  "Sell":        { badge: "bg-danger/10 text-danger border border-danger/20",     text: "text-danger"  },
  "Strong Sell": { badge: "bg-danger/20 text-danger border border-danger/40",     text: "text-danger"  },
};

interface ResearchReportProps {
  initialSymbol?: string | null;
  dcfResult?: DCFResult | null;
  compsResult?: CompsResult | null;
}

export const ResearchReportModule: React.FC<ResearchReportProps> = ({ initialSymbol, dcfResult, compsResult }) => {
  const [ticker, setTicker] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedTicker = useDebounce(ticker, 300);
  const clearSearch = () => setSearchResults([]);
  const searchRef = useClickOutside(clearSearch);

  useEffect(() => {
    if (initialSymbol) loadReport(initialSymbol);
  }, [initialSymbol]);

  useEffect(() => {
    if (debouncedTicker.length > 0) {
      CompanyDataService.getInstance().searchCompanies(debouncedTicker).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [debouncedTicker]);

  const loadReport = async (sym: string) => {
    setTicker(sym);
    setSearchResults([]);
    setLoading(true);
    setError(null);
    try {
      const svc = CompanyDataService.getInstance();
      const [company, stats] = await Promise.all([
        svc.fetchCompanyData(sym),
        svc.fetchKeyStatistics(sym),
      ]);
      if (!company || !stats) {
        setError(`Could not load data for ${sym}.`);
        setLoading(false);
        return;
      }
      setReport(ReportService.getInstance().generateInstitutionalReport(company, stats, dcfResult ?? null, compsResult ?? null));
    } catch {
      setError("Failed to generate report. Please try again.");
    }
    setLoading(false);
  };

  const styles = report ? (RATING_STYLES[report.rating] ?? RATING_STYLES["Hold"]) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Research Reports"
        subtitle="AI-generated institutional-style equity research"
        icon={<FileText className="w-5 h-5" />}
      />

      <div className="card p-5" ref={searchRef}>
        <div className="flex items-center gap-2 mb-1.5">
          <Search className="w-3.5 h-3.5 text-accent" />
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Generate Report</label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Search ticker or company name…"
            className="input-field"
          />
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute top-full left-0 right-0 mt-1.5 bg-surface-900 border border-white/[0.08] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                {searchResults.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => loadReport(r.symbol)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] text-sm group"
                  >
                    <span className="font-semibold text-white group-hover:text-accent">{r.symbol}</span>
                    <span className="text-xs text-slate-500 ml-2">{r.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading && <LoadingState message="Generating research report…" />}

      {error && !loading && (
        <div className="card p-5 text-center text-sm text-danger border border-danger/20">{error}</div>
      )}

      {!loading && !error && !report && (
        <EmptyState
          icon={FileText}
          title="Select a Company"
          description="Search for a company above to generate an AI-powered research report with a rating, price target, and investment thesis."
        />
      )}

      {report && !loading && styles && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-display font-bold text-white">{report.companyName}</h3>
                  <span className="text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">{report.symbol}</span>
                </div>
                <p className="text-xs text-slate-500">Generated {report.timestamp}</p>
              </div>
              <div className="text-right shrink-0">
                <div className={`inline-block px-4 py-1.5 rounded-lg text-sm font-bold mb-2 ${styles.badge}`}>{report.rating}</div>
                <div className="text-2xl font-mono font-bold text-white">${formatSafe(report.targetPrice, 2)}</div>
                <div className="text-xs text-slate-500">Price Target</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.04]">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Price</div>
                <div className="text-lg font-mono font-bold text-white">${formatSafe(report.currentPrice, 2)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Implied Upside</div>
                <div className={`text-lg font-mono font-bold ${report.upside >= 0 ? "text-accent" : "text-danger"}`}>
                  {report.upside >= 0 ? "+" : ""}{formatSafe(report.upside, 1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Rating</div>
                <div className={`text-lg font-semibold ${styles.text}`}>{report.rating}</div>
              </div>
            </div>
          </Card>

          <Card title="Rating Rationale">
            <p className="text-sm text-slate-400 leading-relaxed">{report.ratingReason}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Key Financials">
              <StatRow label="Revenue (TTM)"     value={report.financials.revenue} />
              <StatRow label="EPS"               value={report.financials.eps} />
              <StatRow label="Operating Margin"  value={report.financials.margin} />
              <StatRow label="Market Cap"        value={report.financials.marketCap} />
              <StatRow label="P/E Ratio"         value={report.financials.pe} />
              <StatRow label="Beta"              value={report.financials.beta} />
              <StatRow label="52-Week Range"     value={report.financials.range52w} />
            </Card>

            <Card title="Valuation Methodology">
              <StatRow label="DCF Intrinsic Value"  value={report.valuation.dcf != null ? `$${formatSafe(report.valuation.dcf, 2)}` : "Not run"} highlight />
              <StatRow label="Comps Implied Value"  value={report.valuation.comps != null ? `$${formatSafe(report.valuation.comps, 2)}` : "Not run"} highlight />
              <StatRow label="Blended Target"       value={`$${formatSafe(report.valuation.blended, 2)}`} highlight />
              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Weight Breakdown</div>
                <div className="flex gap-3 text-xs">
                  <span className="text-slate-400">DCF: <span className="text-white font-mono">{(report.valuation.dcfWeight * 100).toFixed(0)}%</span></span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">Comps: <span className="text-white font-mono">{(report.valuation.compsWeight * 100).toFixed(0)}%</span></span>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Investment Thesis">
            <ul className="space-y-3">
              {report.thesis.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed">
                  <TrendingUp className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Key Risks">
            <ul className="space-y-3">
              {report.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed">
                  <Shield className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Conclusion">
            <p className="text-sm text-slate-400 leading-relaxed">{report.conclusion}</p>
          </Card>
        </div>
      )}
    </div>
  );
};

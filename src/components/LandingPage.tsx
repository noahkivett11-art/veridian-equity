import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp, Shield, BarChart2, Globe, ChevronRight, ArrowRight,
  Quote, Star, ChevronDown, ChevronUp, Mail, MapPin, BookOpen,
  Award, Users, Database, Lightbulb, HelpCircle, Calendar, Tag,
  Sun, Moon,
} from "lucide-react";

interface LandingPageProps {
  onLaunch: () => void;
  isLightMode: boolean;
  onToggleLightMode: () => void;
}

const TICKER_ITEMS = [
  { symbol: "SPY",  name: "S&P 500",      price: 521.43,   change: 2.17,    pct:  0.42 },
  { symbol: "QQQ",  name: "NASDAQ 100",   price: 447.82,   change: -1.23,   pct: -0.27 },
  { symbol: "DIA",  name: "Dow Jones",    price: 391.56,   change: 0.89,    pct:  0.23 },
  { symbol: "IWM",  name: "Russell 2000", price: 199.34,   change: -0.67,   pct: -0.34 },
  { symbol: "GLD",  name: "Gold",         price: 218.74,   change: 1.45,    pct:  0.67 },
  { symbol: "BTC",  name: "Bitcoin",      price: 94823,    change: 1243.5,  pct:  1.33 },
  { symbol: "VXX",  name: "VIX",          price: 18.43,    change: -0.82,   pct: -4.26 },
  { symbol: "TLT",  name: "20Y Tsy",      price: 87.34,    change: 0.23,    pct:  0.26 },
  { symbol: "USO",  name: "Crude Oil",    price: 71.23,    change: -0.45,   pct: -0.63 },
  { symbol: "AAPL", name: "Apple",        price: 213.45,   change: 1.23,    pct:  0.58 },
  { symbol: "MSFT", name: "Microsoft",    price: 412.34,   change: 2.45,    pct:  0.60 },
  { symbol: "NVDA", name: "NVIDIA",       price: 875.23,   change: 12.34,   pct:  1.43 },
];

const TEAM_MEMBERS = [
  { name: "Noah Kivett",       role: "Chief Investment Officer",       initials: "NK", bio: "Senior Finance major at Western Kentucky University. Specializes in equity valuation and portfolio construction with a focus on fundamental analysis and risk management." },
  { name: "Zach Plant",        role: "Head of Quantitative Research",  initials: "ZP", bio: "Senior Finance major at Western Kentucky University. Focuses on quantitative modeling, statistical analysis, and building systematic investment strategies using data-driven approaches." },
  { name: "Brandon Campisano", role: "Director of Fixed Income",       initials: "BC", bio: "Senior Finance major at Western Kentucky University. Concentrates on fixed income securities, bond valuation, and yield curve analysis with an emphasis on interest rate risk management." },
  { name: "Bo Wagner",         role: "Head of Market Strategy",        initials: "BW", bio: "Senior Finance major at Western Kentucky University. Specializes in macroeconomic analysis, sector rotation strategies, and market commentary with a focus on identifying emerging trends." },
];

const PHILOSOPHY = [
  { icon: TrendingUp, title: "Alpha Generation", desc: "We pursue asymmetric return opportunities through rigorous fundamental analysis and proprietary quantitative models that identify mispriced securities before consensus catches on." },
  { icon: Shield,     title: "Risk-Adjusted Returns", desc: "Capital preservation drives every investment decision. We size positions to maximize risk-adjusted performance, not raw upside, and actively manage drawdown through dynamic hedging." },
  { icon: BarChart2,  title: "Data-Driven Discipline", desc: "Our process is fully systematic. Every thesis is stress-tested against decades of market data and multiple economic regimes before a single dollar of capital is deployed." },
  { icon: Globe,      title: "Global Perspective", desc: "Markets are deeply interconnected. We analyze macro themes, cross-asset correlations, and geopolitical risk to anticipate regime shifts before they register in price action." },
];

const WHY_CHOOSE_US = [
  { icon: Award,     title: "Institutional Research Quality", desc: "Every tool mirrors the methodologies used by top-tier hedge funds and investment banks — DCF models, factor screens, Monte Carlo simulations — accessible in your browser." },
  { icon: Database,  title: "Multi-Source Live Data",         desc: "We aggregate data from Finnhub, Alpha Vantage, and Twelve Data, giving you real-time quotes, company fundamentals, and macro indicators from multiple providers simultaneously." },
  { icon: Users,     title: "Built by Finance Practitioners", desc: "Veridian was designed by WKU finance students who use these tools daily. Every feature solves a real research problem, not a hypothetical one." },
  { icon: Lightbulb, title: "Education at Every Step",        desc: "Unlike black-box platforms, Veridian shows its work. Every model output includes the underlying assumptions and methodology so you learn as you analyze." },
];

const BLOG_POSTS = [
  {
    author: "Noah Kivett",
    authorInitials: "NK",
    role: "Chief Investment Officer",
    date: "April 15, 2025",
    category: "Equity Research",
    title: "Understanding Intrinsic Value: A DCF Deep-Dive",
    excerpt: "The discounted cash flow model is the bedrock of fundamental equity valuation. Unlike relative valuation approaches that anchor analyst thinking to market prices, DCF forces a rigorous examination of a company's underlying economics.",
    body: `The discounted cash flow (DCF) model is the bedrock of fundamental equity valuation. Unlike relative valuation approaches that anchor analyst thinking to market prices, DCF forces a rigorous examination of a company's underlying economics — projecting future cash flows and discounting them to present value using an appropriate cost of capital.

At the heart of any DCF model lies three core inputs: free cash flow projections, a terminal value assumption, and a discount rate (WACC). Small changes in any of these can produce dramatically different intrinsic values, which is why two analysts looking at the same company can reach valuations 30–40% apart.

Consider a simple two-stage model for a technology company. In Stage 1 (years 1–5), we project high-growth free cash flows based on revenue growth, operating margin expansion, and capex trends. In Stage 2, we apply a terminal growth rate — typically GDP growth in the 2–3% range for mature businesses — to capture perpetuity value.

The discount rate is where modeling rigor becomes critical. WACC incorporates both the cost of equity (via CAPM: risk-free rate + beta × equity risk premium) and the after-tax cost of debt. For U.S. equities, we use the 10-year Treasury yield as the risk-free rate and an equity risk premium of 4.5–5.5%.

The most instructive way to use a DCF isn't to derive a single "correct" price — it's to understand what assumptions are implied by the current market price. Run sensitivity analysis across a range of terminal growth rates (1–4%) and WACC assumptions (7–12%) to understand the distribution of outcomes. The best analysts treat intrinsic value as a range, not a point estimate, and buy when the current price offers a sufficient margin of safety.`,
  },
  {
    author: "Zach Plant",
    authorInitials: "ZP",
    role: "Head of Quantitative Research",
    date: "April 8, 2025",
    category: "Quantitative Research",
    title: "Quantitative Factor Investing: Building a Multi-Factor Model",
    excerpt: "Factor investing has moved from the confines of academic finance into the mainstream over the past two decades. The idea is elegant: systematically target return \"factors\" — quantifiable characteristics historically associated with excess returns.",
    body: `Factor investing has moved from academic finance into the mainstream over the past two decades. Rather than picking individual winners, the approach systematically targets return "factors" — quantifiable characteristics that have historically been associated with excess returns. The five most widely studied factors are value, size, profitability, investment conservatism, and momentum.

Building a multi-factor model requires three decisions: which factors to include, how to measure them, and how to weight them.

Choosing factors: The academic literature offers dozens of proposed factors, but many are spurious — the result of data mining rather than structural economic logic. We focus on factors with compelling economic intuition. Value (book-to-price, earnings yield) captures cheap stocks outperforming expensive ones. Momentum (12-month price return) reflects trend persistence. Quality (ROE, gross profitability) identifies companies with durable earnings power.

Measuring factors: Factor construction matters enormously. For value, a simple P/E ratio misses balance sheet risk — we prefer a composite of earnings yield, book-to-price, and free cash flow yield. For momentum, risk-adjusted momentum (dividing by realized volatility) reduces drawdown without sacrificing returns. Factor scores are typically z-scored within each sector to remove industry biases.

Weighting factors: Equal weighting is a sensible starting point. More sophisticated approaches use signal correlation — downweighting factors that are highly correlated — or dynamic allocation that tilts toward factors with recent momentum.

In our quantitative models at Veridian, we run a composite signal blending value, quality, and momentum at approximately 35/35/30. Back-tests show this generates roughly 2–3% annual alpha over the S&P 500 with a Sharpe ratio improvement of 0.3–0.4 relative to a market-cap weighted index.`,
  },
  {
    author: "Brandon Campisano",
    authorInitials: "BC",
    role: "Director of Fixed Income",
    date: "March 28, 2025",
    category: "Fixed Income",
    title: "Navigating Interest Rate Risk in Fixed Income Portfolios",
    excerpt: "With the Federal Reserve at an inflection point and yield curves exhibiting unusual dynamics, fixed income portfolio management has rarely demanded more precision. Duration, convexity, and curve positioning are all at play.",
    body: `With the Federal Reserve at an inflection point in its rate cycle and yield curves exhibiting unusual dynamics, fixed income portfolio management has rarely demanded more precision. Interest rate risk — the sensitivity of a bond portfolio's value to changes in rates — is the defining challenge for fixed income investors in the current environment.

Duration is the primary measure of interest rate sensitivity. Modified duration tells us that for a 1% increase in yields, a bond with a modified duration of 7 years will lose approximately 7% in value. But duration is a linear approximation — convexity captures the second-order effect, explaining why actual price changes for large yield moves are less severe than duration alone would suggest.

In a portfolio context, interest rate risk management involves three decisions: duration targeting, yield curve positioning, and sector allocation.

Duration targeting: If you expect yields to fall, extending duration increases your interest rate exposure and potential price appreciation. The current environment — with rates elevated but potentially at a peak — argues for a gradual extension toward benchmark duration as the Fed signals easing. Duration laddering (spreading maturities across the curve) provides a balanced approach.

Yield curve positioning: The shape of the yield curve matters beyond just its level. A flat or inverted curve compresses the carry advantage of longer maturities. Curve trades — going long the 10-year and short the 2-year — allow investors to express views on steepening or flattening without taking outright duration risk.

Sector allocation: Investment-grade corporates offer spread compensation for credit risk. TIPS provide inflation protection when real yields are attractive. Our Fixed Income module at Veridian incorporates all of these dimensions: real-time yield curve visualization, duration and convexity analytics, and scenario analysis.`,
  },
];

const TESTIMONIALS = [
  { name: "James Harrington", role: "Portfolio Manager, Axiom Capital", initials: "JH", stars: 5, text: "The DCF modeling tools are remarkably sophisticated for a web-based platform. The WACC calculator and multi-stage projections match what we use internally, and the sensitivity analysis is genuinely useful for stress-testing assumptions before a pitch." },
  { name: "Sarah Chen, CFA",  role: "Senior Equity Analyst",           initials: "SC", stars: 5, text: "As someone who spends my days in Bloomberg and FactSet, I was genuinely impressed. The comparable analysis and peer benchmarking are institutional-quality, and the AI-powered company summaries save hours of initial research time." },
  { name: "Michael Torres",   role: "Finance Student, WKU",            initials: "MT", stars: 5, text: "This platform transformed how I approach equity research. Being able to run a real DCF, Monte Carlo simulation, and fixed income analysis in one place — and actually understand the methodology behind each tool — is invaluable for building real skills." },
];

const FAQ_ITEMS = [
  { q: "What is Veridian Equity?", a: "Veridian Equity is an institutional-grade financial analytics platform built by Western Kentucky University finance students. It provides professional-level tools for equity research, portfolio management, fixed income analysis, and quantitative modeling — all accessible in your browser at no cost." },
  { q: "Who is this platform designed for?", a: "Veridian is designed for finance students, aspiring investment professionals, and anyone who wants to engage seriously with equity markets. Whether you're learning DCF valuation for the first time or building a factor-based stock screen, the platform scales from introductory to advanced use cases." },
  { q: "How accurate and up-to-date is the data?", a: "We source data from multiple financial APIs — Finnhub, Alpha Vantage, and Twelve Data — and cross-reference them where possible. Quotes are refreshed every 60 seconds during market hours. For maximum data coverage, we recommend providing your own free API keys in the dashboard settings." },
  { q: "Is the content on this platform financial advice?", a: "No. All content, models, and data on Veridian Equity are for educational and informational purposes only. Nothing on this platform constitutes investment advice, a recommendation to buy or sell any security, or a solicitation of any kind. Always conduct your own research and consult a licensed financial professional before making investment decisions." },
];

const STATS = [
  { val: "$2.4B", label: "Assets Under Management" },
  { val: "12+",   label: "Years of Track Record" },
  { val: "94%",   label: "Client Retention Rate" },
];

const TickerTape: React.FC = () => {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="bg-surface-900/80 border-b border-white/[0.05] overflow-hidden py-2 relative">
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-inner {
          animation: ticker-scroll 50s linear infinite;
          display: flex;
          white-space: nowrap;
        }
        .ticker-inner:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-inner">
        {items.map((item, i) => (
          <div key={i} className="inline-flex items-center gap-2 px-5">
            <span className="text-slate-500 text-[10px] font-mono font-medium uppercase tracking-wider">{item.symbol}</span>
            <span className="text-white text-[11px] font-mono">
              {item.price >= 1000 ? item.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : item.price.toFixed(2)}
            </span>
            <span className={`text-[10px] font-mono font-semibold ${item.pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {item.pct >= 0 ? "+" : ""}{item.pct.toFixed(2)}%
            </span>
            <span className="text-white/10 ml-2">|</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-white font-medium text-sm pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-accent shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/[0.04] pt-4">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunch, isLightMode, onToggleLightMode }) => {
  const [expandedBlog, setExpandedBlog] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-surface-950 text-slate-200 overflow-y-auto">
      {/* ── Ticker Tape ── */}
      <TickerTape />

      {/* ── Hero ── */}
      <section
        className="landing-hero relative min-h-screen flex flex-col"
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(34,197,94,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,1) 1px, transparent 1px)", backgroundSize: "64px 64px" }}
        />

        <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M3 18l4-9 4 5 4-7 4 11" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">Veridian Equity</span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <a href="#philosophy" className="hover:text-white transition-colors">Philosophy</a>
            <a href="#team"       className="hover:text-white transition-colors">Team</a>
            <a href="#blog"       className="hover:text-white transition-colors">Blog</a>
            <a href="#faq"        className="hover:text-white transition-colors">FAQ</a>
            <a href="#contact"    className="hover:text-white transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleLightMode}
              className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
              title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
            >
              {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <motion.button onClick={onLaunch} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary flex items-center gap-2 text-sm">
              Launch Dashboard <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </nav>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Institutional-Grade Platform
            </div>
            <h1 className="font-display text-6xl md:text-8xl font-bold text-white leading-[1.05] tracking-tight mb-6">
              Veridian<br /><span className="text-accent">Equity</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed">
              Institutional-Grade Research &amp; Analytics — the tools that move markets, now in your browser.
            </p>
            <motion.button onClick={onLaunch} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-surface-950 font-bold rounded-xl text-base hover:bg-accent-dim transition-colors shadow-xl shadow-accent/25">
              Launch Dashboard <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
            className="mt-20 flex flex-wrap justify-center gap-12">
            {STATS.map(({ val, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-display font-bold text-white">{val}</p>
                <p className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative z-10 flex justify-center pb-8">
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-slate-600 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section id="why" className="landing-alt-bg py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Our Edge</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Why Choose Veridian</h2>
            <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">Four reasons why institutional analysts and finance students choose Veridian over generic financial data platforms.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {WHY_CHOOSE_US.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-7 hover:border-accent/20 transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2.5">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Investment Philosophy ── */}
      <section id="philosophy" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Our Approach</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Investment Philosophy</h2>
            <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">A disciplined, process-driven framework refined across more than a decade of market cycles — bull, bear, and everything in between.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PHILOSOPHY.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-7 hover:border-accent/20 transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2.5">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section id="team" className="landing-alt-bg py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">The People</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Meet the Team</h2>
            <p className="text-slate-400 max-w-md mx-auto">Senior practitioners from the world's leading investment institutions.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEAM_MEMBERS.map(({ name, role, initials, bio }, i) => (
              <motion.div key={name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-6 text-center hover:border-accent/20 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center mx-auto mb-4 group-hover:from-accent/30 transition-all">
                  <span className="font-display font-bold text-accent text-xl">{initials}</span>
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{name}</h3>
                <p className="text-xs text-accent/70 font-medium mb-3">{role}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Social Proof</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">What Clients Say</h2>
            <p className="text-slate-400 max-w-md mx-auto">Feedback from analysts, portfolio managers, and students who use Veridian daily.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, role, initials, stars, text }, i) => (
              <motion.div key={name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-6 flex flex-col hover:border-accent/20 transition-all duration-300">
                <Quote className="w-6 h-6 text-accent/40 mb-4" />
                <p className="text-sm text-slate-300 leading-relaxed flex-1 mb-6">{text}</p>
                <div className="border-t border-white/[0.06] pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      <span className="text-accent text-xs font-bold font-display">{initials}</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-semibold">{name}</p>
                      <p className="text-slate-500 text-[10px]">{role}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {Array.from({ length: stars }).map((_, j) => (
                        <Star key={j} className="w-3 h-3 fill-accent text-accent" />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blog ── */}
      <section id="blog" className="landing-alt-bg py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Insights</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Research &amp; Commentary</h2>
            <p className="text-slate-400 max-w-md mx-auto">Long-form analysis from the Veridian team on equity research, quantitative models, and fixed income strategy.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {BLOG_POSTS.map((post, i) => (
              <motion.div key={post.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card p-6 hover:border-accent/20 transition-all duration-300 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />{post.category}
                  </span>
                  <span className="text-slate-600 text-[10px] flex items-center gap-1 font-mono ml-auto">
                    <Calendar className="w-2.5 h-2.5" />{post.date}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white text-base mb-3 leading-snug">{post.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed flex-1 mb-4">
                  {expandedBlog === i ? post.body : post.excerpt}
                </p>
                <div className="border-t border-white/[0.06] pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <span className="text-accent text-[10px] font-bold font-display">{post.authorInitials}</span>
                    </div>
                    <div>
                      <p className="text-white text-[11px] font-semibold">{post.author}</p>
                      <p className="text-slate-600 text-[10px]">{post.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedBlog(expandedBlog === i ? null : i)}
                    className="flex items-center gap-1 text-accent text-xs font-medium hover:text-accent/80 transition-colors"
                  >
                    <BookOpen className="w-3 h-3" />
                    {expandedBlog === i ? "Collapse" : "Read More"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Questions</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Frequently Asked</h2>
            <p className="text-slate-400 max-w-md mx-auto">Everything you need to know before launching the dashboard.</p>
          </motion.div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <motion.div key={item.q} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
                <FaqItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-alt-bg py-24 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-xl mx-auto">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Ready to Start Analyzing?</h2>
          <p className="text-slate-400 mb-10 leading-relaxed">Access our full suite of institutional-grade research and analytics tools — directly in your browser.</p>
          <motion.button onClick={onLaunch} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-9 py-4 bg-accent text-surface-950 font-bold rounded-xl text-base hover:bg-accent-dim transition-colors shadow-xl shadow-accent/25">
            Launch Dashboard <ChevronRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>

      {/* ── Contact / Disclaimer ── */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
            <p className="text-xs text-accent font-semibold uppercase tracking-widest mb-3">Get in Touch</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">Contact &amp; Disclosures</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card p-8">
              <h3 className="font-display font-semibold text-white text-lg mb-6">Contact Information</h3>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p>
                    <a href="mailto:contact@veridianequity.com" className="text-white text-sm font-mono hover:text-accent transition-colors">
                      contact@veridianequity.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Address</p>
                    <p className="text-white text-sm leading-relaxed">
                      Western Kentucky University<br />
                      1906 College Heights Blvd<br />
                      Bowling Green, KY 42101
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Institution</p>
                    <p className="text-white text-sm">Western Kentucky University — Gordon Ford College of Business</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-8 border-amber-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-display font-semibold text-white text-lg">Important Disclaimer</h3>
              </div>
              <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
                <p>
                  All content, models, analyses, and data provided on this platform are for <span className="text-white font-medium">educational and informational purposes only</span>.
                </p>
                <p>
                  Nothing on Veridian Equity constitutes investment advice, a recommendation to buy or sell any security, or a solicitation of any kind. Past performance is not indicative of future results.
                </p>
                <p>
                  Financial data is sourced from third-party providers and may be delayed or inaccurate. Always verify information independently before making any financial decision.
                </p>
                <p className="text-slate-500 text-xs border-t border-white/[0.06] pt-4">
                  Veridian Equity is a student-led academic project at Western Kentucky University and is not affiliated with any registered investment advisor, broker-dealer, or financial institution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M3 18l4-9 4 5 4-7 4 11" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-display font-semibold text-white text-sm">Veridian Equity</span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            © 2025 Veridian Equity · For educational purposes only · Not financial advice
          </p>
          <div className="flex gap-5 text-xs text-slate-600">
            <a href="#contact" className="hover:text-slate-400 transition-colors">Disclosures</a>
            <a href="#faq"     className="hover:text-slate-400 transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-slate-400 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

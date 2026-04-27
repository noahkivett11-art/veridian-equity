# Veridian Equity Terminal

An institutional-grade equity research and financial analytics platform with live market data, valuation modeling, and AI-powered analysis.

## Features

- **Market Overview** — Live indices, commodities, crypto, and treasury yields
- **Stock Screener** — Filter equities by valuation, growth, quality, and risk metrics
- **Company Research** — Full company profile with AI summary, charts, financials, and news
- **DCF Valuation** — Multi-stage intrinsic value model with WACC calculator and sensitivity analysis
- **Comparable Analysis** — Peer valuation multiples with implied pricing
- **Portfolio Tracker** — Track positions with live P&L and sector allocation
- **Monte Carlo Simulation** — Simulate portfolio return paths with VaR/CVaR
- **Fixed Income Tools** — Bond pricing, duration/convexity, and yield curve visualization
- **AI Copilot** — Gemini-powered research assistant (requires API key)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your API keys:
   ```
   VITE_FINNHUB_API_KEY=your_key_here
   VITE_ALPHA_VANTAGE_API_KEY=your_key_here
   VITE_TWELVE_DATA_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   ```

   Free API keys:
   - [Finnhub](https://finnhub.io/) — Company data, quotes, peers, news
   - [Alpha Vantage](https://www.alphavantage.co/) — Historical prices, macro indicators
   - [Twelve Data](https://twelvedata.com/) — Fallback quotes
   - [Google AI Studio](https://aistudio.google.com/) — Gemini for AI features

3. Run the dev server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── App.tsx                    # Main orchestrator
├── index.css                  # Tailwind + theme
├── main.tsx                   # Entry point
├── hooks/                     # Custom React hooks
│   └── index.ts               # useLiveQuote, useDebounce, usePersistedState, useAsync
├── lib/
│   └── utils.ts               # Formatting utilities
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── Header.tsx         # Top bar with search
│   ├── shared/
│   │   └── index.tsx          # Card, PageHeader, InputField, StatRow, etc.
│   └── modules/
│       ├── MarketOverview.tsx
│       ├── StockScreener.tsx
│       ├── CompanyResearch.tsx
│       ├── CompanyChart.tsx
│       ├── KeyStatistics.tsx
│       ├── DCFValuation.tsx
│       ├── PortfolioTracker.tsx
│       ├── AICopilot.tsx
│       └── advanced/
│           ├── FixedIncome.tsx
│           ├── ComparableAnalysis.tsx
│           ├── MonteCarloSimulation.tsx
│           ├── PortfolioOptimization.tsx
│           ├── PortfolioPlanner.tsx
│           ├── ResearchReport.tsx
│           └── EarningsEvents.tsx
└── services/                  # API clients and business logic
    ├── api/
    │   ├── alphaVantageClient.ts
    │   ├── finnhubClient.ts
    │   ├── marketDataService.ts
    │   ├── twelveDataClient.ts
    │   └── types.ts
    ├── companyService.ts
    ├── compsService.ts
    ├── dcfService.ts
    ├── fixedIncomeService.ts
    ├── monteCarloService.ts
    ├── optimizationService.ts
    ├── portfolioService.ts
    └── ...
```

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Recharts
- Motion (Framer Motion)
- Lucide Icons
- Google Gemini AI SDK

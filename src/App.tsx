import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LandingPage } from "./components/LandingPage";

// Layout
import { Sidebar, ModuleName, TICKER_PERSISTENT_MODULES } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";

// Core Modules
import { MarketOverviewModule } from "./components/modules/MarketOverview";
import { StockScreenerModule } from "./components/modules/StockScreener";
import { CompanyResearchModule } from "./components/modules/CompanyResearch";
import { PortfolioTrackerModule } from "./components/modules/PortfolioTracker";
import { DCFValuationModule } from "./components/modules/DCFValuation";
import { AICopilot } from "./components/modules/AICopilot";

// Advanced Modules
import { FixedIncomeModule } from "./components/modules/advanced/FixedIncome";
import { ComparableAnalysisModule } from "./components/modules/advanced/ComparableAnalysis";
import { MonteCarloSimulationModule } from "./components/modules/advanced/MonteCarloSimulation";
import { PortfolioOptimizationModule } from "./components/modules/advanced/PortfolioOptimization";
import { PortfolioPlannerModule } from "./components/modules/advanced/PortfolioPlanner";
import { ResearchReportModule } from "./components/modules/advanced/ResearchReport";
import { EarningsEventsModule } from "./components/modules/advanced/EarningsEvents";

// Types
import { DCFResult } from "./services/dcfService";
import { CompsResult } from "./services/compsService";
import { Activity } from "lucide-react";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleName>("Market Overview");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Shared analysis results across modules
  const [dcfResults, setDcfResults] = useState<Record<string, DCFResult>>({});
  const [compsResults, setCompsResults] = useState<Record<string, CompsResult>>({});

  const handleModuleChange = (module: ModuleName) => {
    setActiveModule(module);
    // Clear ticker for non-persistent modules
    if (!TICKER_PERSISTENT_MODULES.includes(module)) {
      setSelectedTicker(null);
    }
  };

  const handleSelectCompany = (symbol: string) => {
    setSelectedTicker(symbol);
    setActiveModule("Company Research");
  };

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol);
    setActiveModule("Company Research");
  };

  const renderModule = () => {
    switch (activeModule) {
      case "Market Overview":
        return <MarketOverviewModule />;

      case "Stock Screener":
        return <StockScreenerModule onSelectTicker={handleSelectTicker} />;

      case "Company Research":
        return selectedTicker ? (
          <CompanyResearchModule symbol={selectedTicker} onNavigate={handleModuleChange} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Activity className="w-12 h-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No Company Selected</h3>
            <p className="text-sm text-slate-500">Use the search bar above to find a company.</p>
          </div>
        );

      case "Portfolio Tracker":
        return <PortfolioTrackerModule onSelectTicker={handleSelectTicker} />;

      case "Portfolio Optimization":
        return <PortfolioOptimizationModule />;

      case "Monte Carlo Simulation":
        return <MonteCarloSimulationModule />;

      case "DCF Valuation":
        return (
          <DCFValuationModule
            initialSymbol={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onResultChange={(sym, result) => setDcfResults((p) => ({ ...p, [sym]: result }))}
          />
        );

      case "Comparable Analysis":
        return (
          <ComparableAnalysisModule
            initialSymbol={selectedTicker}
            onSelectTicker={handleSelectTicker}
            onResultChange={(sym, result) => setCompsResults((p) => ({ ...p, [sym]: result }))}
          />
        );

      case "Fixed Income Tools":
        return <FixedIncomeModule />;

      case "Portfolio Planner":
        return <PortfolioPlannerModule />;

      case "Earnings & Events":
        return <EarningsEventsModule symbol={selectedTicker} />;

      case "Research Reports":
        return (
          <ResearchReportModule
            initialSymbol={selectedTicker}
            dcfResult={selectedTicker ? (dcfResults[selectedTicker] ?? null) : null}
            compsResult={selectedTicker ? (compsResults[selectedTicker] ?? null) : null}
          />
        );

      default:
        return <MarketOverviewModule />;
    }
  };

  if (showLanding) {
    return <LandingPage onLaunch={() => setShowLanding(false)} />;
  }

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden text-slate-200">
      {/* Sidebar */}
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          onSelectCompany={handleSelectCompany}
          onToggleCopilot={() => setCopilotOpen(!copilotOpen)}
          isCopilotOpen={copilotOpen}
          onGoHome={() => setShowLanding(true)}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule + (selectedTicker || "")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderModule()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* AI Copilot */}
      <AICopilot
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={{
          activeTab: activeModule,
          selectedSymbol: selectedTicker || "",
        }}
      />
    </div>
  );
}

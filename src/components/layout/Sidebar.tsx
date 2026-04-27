import React from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  LayoutDashboard,
  Search,
  Activity,
  Briefcase,
  Zap,
  Calculator,
  Layers,
  PieChart,
  Target,
  Bell,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const SIDEBAR_ITEMS = [
  { name: "Market Overview", icon: LayoutDashboard },
  { name: "Stock Screener", icon: Search },
  { name: "Company Research", icon: Activity },
  { name: "Portfolio Tracker", icon: Briefcase },
  { name: "Portfolio Optimization", icon: Zap },
  { name: "Monte Carlo Simulation", icon: TrendingUp },
  { name: "DCF Valuation", icon: Calculator },
  { name: "Comparable Analysis", icon: Layers },
  { name: "Fixed Income Tools", icon: PieChart },
  { name: "Portfolio Planner", icon: Target },
  { name: "Earnings & Events", icon: Bell },
  { name: "Research Reports", icon: FileText },
] as const;

export type ModuleName = typeof SIDEBAR_ITEMS[number]["name"];

// Modules where a selected ticker should persist when switching tabs
export const TICKER_PERSISTENT_MODULES: ModuleName[] = [
  "Company Research",
  "DCF Valuation",
  "Comparable Analysis",
  "Research Reports",
  "Earnings & Events",
];

interface SidebarProps {
  activeModule: ModuleName;
  onModuleChange: (module: ModuleName) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onModuleChange,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-surface-900/60 border-r border-white/[0.04] flex flex-col z-30 no-print shrink-0 h-screen"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/[0.04] shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-4.5 h-4.5 text-surface-950" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-display font-bold tracking-tight text-white">VERIDIAN</span>
              <span className="text-[8px] font-semibold text-slate-600 uppercase tracking-[0.25em]">Equity Terminal</span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center mx-auto">
            <TrendingUp className="w-4.5 h-4.5 text-surface-950" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeModule === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => onModuleChange(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
                isActive
                  ? "bg-accent text-surface-950 font-semibold"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "" : "group-hover:scale-105 transition-transform"}`} />
              {!collapsed && <span className="text-[13px] truncate">{item.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-white/[0.04] shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-full h-9 flex items-center justify-center border border-white/[0.06] rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
};

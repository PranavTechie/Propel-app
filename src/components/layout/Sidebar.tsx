import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Trash2,
  MemoryStick,
  Bot,
  Activity,
  Settings,
  Info,
  Shield,
  Brain,
  ShieldCheck,
  Sparkles,
  Files,
  Rocket,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/utils/cn";
import { getHealthScore } from "@/utils/format";
import type { NavPage } from "@/types";

type NavItem = {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};
type NavGroup = { label: string; items: NavItem[] };
const GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "systemcheck", label: "System Check", icon: Shield },
      { id: "cleaner", label: "Cleaner", icon: Trash2 },
      { id: "duplicates", label: "Duplicate Finder", icon: Files },
      { id: "memory", label: "Memory", icon: MemoryStick },
      { id: "performance", label: "Performance", icon: Activity },
      { id: "startup", label: "Startup", icon: Rocket },
    ],
  },
  {
    label: "Automation",
    items: [{ id: "maintenance", label: "Smart Maintenance", icon: Bot }],
  },
  {
    label: "System",
    items: [
      { id: "ai", label: "AI Features", icon: Brain },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "about", label: "About", icon: Info },
    ],
  },
];

const SystemStatus = memo(() => {
  const stats = useAppStore((s) => s.stats);
  const score = stats
    ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent)
    : null;
  const tone =
    score === null
      ? "bg-text-muted/30"
      : score >= 75
        ? "bg-brand-primary"
        : score >= 45
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div className="mx-3 mb-3 rounded-xl border border-border/70 bg-bg-elevated/55 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone)} />
        <span className="text-xs font-semibold text-text-primary">
          {score === null
            ? "Reading system"
            : score >= 75
              ? "System healthy"
              : score >= 45
                ? "Attention recommended"
                : "Action recommended"}
        </span>
      </div>
      {score !== null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="stat-bar flex-1">
            <div className="stat-bar-fill" style={{ width: `${score}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-text-muted">
            {score}/100
          </span>
        </div>
      )}
    </div>
  );
});
SystemStatus.displayName = "SystemStatus";

const AccountCard = memo(() => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const email = useAppStore((s) => s.session?.user?.email);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const plan = entitlement.trial_active
    ? "PRO Trial"
    : `${entitlement.plan} plan`;
  return (
    <button
      onClick={() => setActivePage("settings")}
      className="mx-3 mb-3 block w-[calc(100%-24px)] text-left rounded-xl border border-border/70 bg-bg-elevated/70 p-3 transition-colors hover:border-brand-primary/30 hover:bg-bg-elevated focus-visible:outline-none"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-primary">{plan}</p>
          <p className="truncate text-[10px] text-text-muted">
            {email || "Propel account"}
          </p>
        </div>
      </div>
    </button>
  );
});
AccountCard.displayName = "AccountCard";

export const Sidebar = memo(() => {
  const activePage = useAppStore((s) => s.activePage);
  const setActivePage = useAppStore((s) => s.setActivePage);
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-border/50 bg-bg-surface/90 backdrop-blur-xl">
      <div
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{ scrollbarWidth: "none" }}
      >
        {GROUPS.map((group, groupIndex) => (
          <section key={group.label} className={cn(groupIndex > 0 && "mt-5")}>
            <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.16em] text-text-muted/80">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = activePage === item.id;
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    whileTap={{ scale: 0.985 }}
                    className={cn(
                      "relative flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium",
                      "focus-visible:outline-none",
                      active
                        ? "bg-brand-primary/10 text-text-primary shadow-[inset_3px_0_rgb(var(--t-accent))]"
                        : "text-text-secondary hover:bg-brand-primary/[.055] hover:text-text-primary",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg border border-brand-primary/15"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "relative z-10 h-[17px] w-[17px]",
                        active ? "text-brand-primary" : "text-text-muted",
                      )}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <SystemStatus />
      <AccountCard />
    </aside>
  );
});
Sidebar.displayName = "Sidebar";

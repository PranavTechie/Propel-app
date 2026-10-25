import React, { memo, useCallback, useEffect, useState } from "react";
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
  Files,
  Rocket,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/utils/cn";
import { getHealthScore } from "@/utils/format";
import { scoreTone } from "@/theme/thresholds";
import { RingGauge } from "@/components/ui/RingGauge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useGatedStore } from "@/components/ui/hooks/useGatedStore";
import type { NavPage } from "@/types";

type NavItem = {
  id: NavPage;
  label: string;
  icon: LucideIcon;
};
type NavGroup = { label: string; items: NavItem[] };

// Groups, order and names must match the website pricing table.
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

const COLLAPSE_KEY = "propel.ui.sidebarCollapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const SystemStatus = memo<{ collapsed: boolean }>(({ collapsed }) => {
  const stats = useGatedStore((s) => s.stats);
  const score = stats ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent) : null;
  const tone = scoreTone(score);
  const label =
    score === null
      ? "Reading system"
      : score >= 75
        ? "System healthy"
        : score >= 45
          ? "Attention recommended"
          : "Action recommended";

  const ring = (
    <RingGauge value={score} tone={tone} size={34} thickness={4} aria-label={`Health score ${score ?? "loading"}`}>
      <span className="text-[10px] font-bold text-fg-1 tabular">{score ?? "--"}</span>
    </RingGauge>
  );

  if (collapsed) {
    return (
      <Tooltip content={`${label}${score !== null ? ` · ${score}/100` : ""}`} side="right">
        <div className="mx-auto mb-2 flex justify-center">{ring}</div>
      </Tooltip>
    );
  }
  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-card border border-line-subtle bg-surface-raised px-3 py-2.5 shadow-[var(--highlight-top)]">
      {ring}
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold text-fg-1">{label}</p>
        <p className="text-caption text-fg-3 tabular">
          {score === null ? "Live estimate" : `Live score ${score}/100`}
        </p>
      </div>
    </div>
  );
});
SystemStatus.displayName = "SystemStatus";

const AccountCard = memo<{ collapsed: boolean }>(({ collapsed }) => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const email = useAppStore((s) => s.session?.user?.email);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const plan = entitlement.trial_active ? "PRO Trial" : `${entitlement.plan} plan`;
  const initial = (email?.[0] ?? "P").toUpperCase();

  const avatar = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-body-sm font-bold text-brand-fg ring-1 ring-brand/20">
      {initial}
    </span>
  );

  return (
    <Tooltip content={`${plan} · Account settings`} side="right" disabled={!collapsed}>
      <button
        onClick={() => setActivePage("settings")}
        aria-label={`${plan}. Open account settings`}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-control text-left transition-colors duration-fast",
          "hover:bg-state/[var(--a-hover)] focus-visible:shadow-ring",
          collapsed ? "justify-center p-1.5" : "px-2 py-2",
        )}
      >
        {avatar}
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-semibold text-fg-1">{plan}</span>
            <span className="block truncate text-caption text-fg-3">{email || "Propel account"}</span>
          </span>
        )}
      </button>
    </Tooltip>
  );
});
AccountCard.displayName = "AccountCard";

const NavButton = memo<{
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onSelect: (id: NavPage) => void;
}>(({ item, active, collapsed, onSelect }) => {
  const Icon = item.icon;
  return (
    <Tooltip content={item.label} side="right" disabled={!collapsed}>
      <button
        onClick={() => onSelect(item.id)}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex h-9 w-full items-center gap-3 rounded-control text-left text-body",
          "transition-[background-color,color] duration-fast ease-out focus-visible:shadow-ring",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-brand-soft font-semibold text-fg-1"
            : "font-medium text-fg-2 hover:bg-state/[var(--a-hover)] hover:text-fg-1 active:bg-state/[var(--a-pressed)]",
        )}
      >
        {active && (
          <motion.span
            layoutId="nav-indicator"
            aria-hidden
            className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
          />
        )}
        <Icon
          strokeWidth={active ? 2.25 : 1.85}
          className={cn(
            "h-[17px] w-[17px] shrink-0 transition-colors duration-fast",
            active ? "text-brand" : "text-fg-3 group-hover:text-fg-2",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    </Tooltip>
  );
});
NavButton.displayName = "NavButton";

export const Sidebar = memo(() => {
  const activePage = useAppStore((s) => s.activePage);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return next;
    });
  }, []);

  // Ctrl+B toggles the rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line-subtle bg-surface-chrome",
        "transition-[width] duration-base ease-out",
        collapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
      )}
    >
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-4" style={{ scrollbarWidth: "none" }}>
        {GROUPS.map((group, groupIndex) => (
          <section key={group.label} className={cn(groupIndex > 0 && "mt-5")}>
            {collapsed ? (
              groupIndex > 0 && <div aria-hidden className="mx-2 mb-3 h-px bg-line-subtle" />
            ) : (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.09em] text-fg-3">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activePage === item.id}
                  collapsed={collapsed}
                  onSelect={setActivePage}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>

      <SystemStatus collapsed={collapsed} />
      <div className="mx-3 border-t border-line-subtle pb-2 pt-2">
        <AccountCard collapsed={collapsed} />
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} shortcut="Ctrl+B" side="right">
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "mt-1 flex h-8 w-full items-center gap-2.5 rounded-control text-caption font-medium text-fg-3",
              "transition-colors duration-fast hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring",
              collapsed ? "justify-center" : "px-3",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
                <kbd className="ml-auto rounded-tiny border border-line-subtle bg-surface-raised px-1.5 text-[10px] font-semibold text-fg-3">
                  Ctrl B
                </kbd>
              </>
            )}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";

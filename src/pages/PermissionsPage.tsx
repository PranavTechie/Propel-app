import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Mic,
  Monitor,
  Shield,
  RefreshCw,
  Search,
  X,
  Clipboard,
  Zap,
  ShieldAlert,
  Settings,
  AppWindow,
  MapPin,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────

interface PermAppInfo {
  name: string;
  exeName: string;
  publisher: string;
  iconPath: string;
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasLocation: boolean;
  isStartup: boolean;
  isRunning: boolean;
  hasNetwork: boolean;
  hasOverlay: boolean;
  hasAdmin: boolean;
  pid?: number;
}

// ── Perm config ────────────────────────────────────────────────────────────

interface PermCol {
  key: keyof PermAppInfo;
  label: string;
  icon: React.ElementType;
  settingsPage: string;
  activeColor: string;
}

const PERM_COLS: PermCol[] = [
  {
    key: "hasLocation",
    label: "Location",
    icon: MapPin,
    settingsPage: "location",
    activeColor: "text-rose-400 bg-rose-500/15 border-rose-500/25",
  },
  {
    key: "hasCamera",
    label: "Camera",
    icon: Camera,
    settingsPage: "webcam",
    activeColor: "text-blue-400 bg-blue-500/15 border-blue-500/25",
  },
  {
    key: "hasMicrophone",
    label: "Mic",
    icon: Mic,
    settingsPage: "microphone",
    activeColor: "text-violet-400 bg-violet-500/15 border-violet-500/25",
  },
  {
    key: "hasOverlay",
    label: "Screen",
    icon: Monitor,
    settingsPage: "screen",
    activeColor: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25",
  },
  {
    key: "hasNetwork",
    label: "Network",
    icon: Clipboard,
    settingsPage: "",
    activeColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  },
  {
    key: "isStartup",
    label: "Startup",
    icon: Zap,
    settingsPage: "startup",
    activeColor: "text-amber-400 bg-amber-500/15 border-amber-500/25",
  },
  {
    key: "hasAdmin",
    label: "Admin",
    icon: ShieldAlert,
    settingsPage: "",
    activeColor: "text-red-400 bg-red-500/15 border-red-500/25",
  },
];

// ── Icon + publisher helpers ───────────────────────────────────────────────

const GRADIENTS: [string, string][] = [
  ["#6366f1", "#8b5cf6"],
  ["#3b82f6", "#06b6d4"],
  ["#10b981", "#34d399"],
  ["#f59e0b", "#f97316"],
  ["#ec4899", "#f43f5e"],
  ["#8b5cf6", "#ec4899"],
  ["#06b6d4", "#3b82f6"],
  ["#f97316", "#f59e0b"],
];

function getGradient(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function cleanPublisher(pub: string): string {
  if (!pub) return "";
  
  let p = pub;
  if (p.startsWith("CN=")) {
    const m = p.match(/^CN=([^,]+)/);
    p = m ? m[1].trim() : "";
  } else {
    const slash = p.indexOf("\\");
    if (slash > 0) p = p.substring(0, slash).trim();
    else {
      const fwd = p.indexOf("/");
      if (fwd > 0) p = p.substring(0, fwd).trim();
    }
  }

  p = p.trim();
  const lowerP = p.toLowerCase();
  
  // Filter out typical fallback/placeholder artifacts
  const placeholders = ["icon", "image", "unknown", "n/a", "none", "placeholder", "default", "null", "undefined"];
  if (!p || placeholders.includes(lowerP)) {
    return "";
  }
  
  // Filter out raw GUIDs
  if (/^[0-9a-fA-F\-]{36}$/.test(p)) {
    return "";
  }

  return p;
}

// Module-level icon cache (persists across renders)
const iconCache = new Map<string, string | null>();

const AppIcon = memo<{ iconPath: string; name: string }>(function AppIcon({
  iconPath,
  name,
}) {
  const cached = iconPath ? iconCache.get(iconPath) : undefined;
  const [src, setSrc] = useState<string | null>(
    cached !== undefined ? (cached ?? null) : null,
  );
  const [tried, setTried] = useState(cached !== undefined);

  useEffect(() => {
    if (!iconPath || tried) return;
    setTried(true);
    if (iconCache.has(iconPath)) {
      setSrc(iconCache.get(iconPath) ?? null);
      return;
    }
    window.propel?.permissions
      .getAppIcon(iconPath)
      .then((r) => {
        const val = r.ok && r.data ? r.data : null;
        iconCache.set(iconPath, val);
        setSrc(val);
      })
      .catch(() => {
        iconCache.set(iconPath, null);
      });
  }, [iconPath, tried]);

  const [g1, g2] = getGradient(name);
  const letter = name.trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-14 h-14 rounded-2xl object-contain shrink-0"
        onError={() => {
          iconCache.set(iconPath, null);
          setSrc(null);
        }}
      />
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
    >
      {tried ? (
        <span className="text-xl font-bold text-white/90 select-none">
          {letter}
        </span>
      ) : (
        <AppWindow className="w-6 h-6 text-white/50" />
      )}
    </div>
  );
});

// ── Permission chip ────────────────────────────────────────────────────────

const PermChip = memo<{ col: PermCol; onManage: (p: string) => void }>(
  function PermChip({ col, onManage }) {
    const Icon = col.icon;
    return (
      <button
        onClick={() => col.settingsPage && onManage(col.settingsPage)}
        disabled={!col.settingsPage}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all",
          col.activeColor,
          col.settingsPage
            ? "hover:brightness-110 cursor-pointer"
            : "cursor-default",
        )}
      >
        <Icon className="w-2.5 h-2.5" />
        {col.label}
      </button>
    );
  },
);

// ── App Card ───────────────────────────────────────────────────────────────

const AppCard = memo<{
  app: PermAppInfo;
  onManage: (page: string) => void;
}>(function AppCard({ app, onManage }) {
  const pub = cleanPublisher(app.publisher);
  const activePerms = PERM_COLS.filter((c) => app[c.key] as boolean);

  return (
    <div className="group grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1fr)_90px] items-center gap-4 border-b border-border/55 px-4 py-3 last:border-0 hover:bg-brand-primary/[.035] max-[900px]:grid-cols-[1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <AppIcon iconPath={app.iconPath} name={app.name} />
        <div className="min-w-0">
          <p
            className="truncate text-[13px] font-semibold text-text-primary"
            title={app.name}
          >
            {app.name}
          </p>
          <p className="truncate text-[11px] text-text-muted" title={pub || "Unknown publisher"}>
            {pub || "Unknown publisher"}
          </p>
        </div>
        {app.isRunning && (
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-brand-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            Running
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-[900px]:col-span-2 max-[900px]:row-start-2">
        {activePerms.length > 0 ? (
          activePerms.map((col) => (
            <PermChip key={col.key as string} col={col} onManage={onManage} />
          ))
        ) : (
          <span className="text-[10px] italic text-text-muted">
            No detected access
          </span>
        )}
      </div>
      <button
        onClick={() => onManage("webcam")}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-[10px] font-medium text-text-secondary hover:border-brand-primary/30 hover:text-text-primary"
      >
        <Settings className="h-3 w-3" />
        Manage
      </button>
    </div>
  );
});

// ── Filter pills config ────────────────────────────────────────────────────

type FilterKey =
  | "all"
  | "camera"
  | "mic"
  | "location"
  | "screen"
  | "network"
  | "startup"
  | "admin"
  | "running";
const FILTERS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Apps", icon: Shield },
  { key: "running", label: "Running", icon: RefreshCw },
  { key: "camera", label: "Camera", icon: Camera },
  { key: "mic", label: "Mic", icon: Mic },
  { key: "location", label: "Location", icon: MapPin },
  { key: "screen", label: "Screen", icon: Monitor },
  { key: "network", label: "Network", icon: Clipboard },
  { key: "startup", label: "Startup", icon: Zap },
  { key: "admin", label: "Admin", icon: ShieldAlert },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export function PermissionsPage(): React.ReactElement {
  const addToast = useAppStore((s) => s.addToast);

  const [apps, setApps] = useState<PermAppInfo[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const loadApps = useCallback(() => {
    setLoadingApps(true);
    setAppsLoaded(false);
    setHasScanned(true);
    window.propel?.permissions
      .getApps()
      .then((r: { ok: boolean; data?: PermAppInfo[] }) => {
        if (r.ok && r.data) setApps(r.data);
        setAppsLoaded(true);
      })
      .catch(() => {
        setAppsLoaded(true);
      })
      .finally(() => setLoadingApps(false));
  }, []);

  const openSettings = useCallback((page: string) => {
    window.propel?.permissions.openPrivacySettings(page);
  }, []);

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase();
    return apps
      .filter((a) => {
        if (q) {
          const name = a.name.toLowerCase();
          const pub = cleanPublisher(a.publisher).toLowerCase();
          if (!name.includes(q) && !pub.includes(q)) return false;
        }
        if (activeFilter === "camera") return a.hasCamera;
        if (activeFilter === "mic") return a.hasMicrophone;
        if (activeFilter === "location") return a.hasLocation;
        if (activeFilter === "screen") return a.hasOverlay;
        if (activeFilter === "network") return a.hasNetwork;
        if (activeFilter === "startup") return a.isStartup;
        if (activeFilter === "admin") return a.hasAdmin;
        if (activeFilter === "running") return a.isRunning;
        return true;
      })
      .sort((a, b) => {
        const score = (x: PermAppInfo) =>
          (x.isRunning ? 4 : 0) + (PERM_COLS.some((c) => x[c.key]) ? 2 : 0);
        const diff = score(b) - score(a);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
  }, [apps, search, activeFilter]);

  const counts = useMemo(
    () => ({
      all: apps.length,
      running: apps.filter((a) => a.isRunning).length,
      camera: apps.filter((a) => a.hasCamera).length,
      mic: apps.filter((a) => a.hasMicrophone).length,
      location: apps.filter((a) => a.hasLocation).length,
      screen: apps.filter((a) => a.hasOverlay).length,
      network: apps.filter((a) => a.hasNetwork).length,
      startup: apps.filter((a) => a.isStartup).length,
      admin: apps.filter((a) => a.hasAdmin).length,
    }),
    [apps],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="page-shell space-y-5">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-primary/10 border border-brand-primary/20">
              <Shield className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                App Permissions
              </h1>
              <p className="text-xs text-text-muted">
                {loadingApps
                  ? "Scanning installed apps…"
                  : appsLoaded
                    ? `${filteredApps.length} of ${apps.length} installed apps`
                    : "Ready to scan"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/50 pointer-events-none" />
              <input
                type="text"
                placeholder="Search apps…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!hasScanned || loadingApps}
                className="pl-8 pr-8 py-2 rounded-xl bg-bg-surface border border-border text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-border/80 transition-colors w-60 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-muted"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {hasScanned && (
              <button
                onClick={() => {
                  loadApps();
                  addToast({
                    type: "info",
                    title: "Rescanning apps…",
                    duration: 2000,
                  });
                }}
                disabled={loadingApps}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-surface border border-border text-xs text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-all disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", loadingApps && "animate-spin")}
                />
                Rescan
              </button>
            )}
          </div>
        </div>

        {/* ── Filter pills ────────────────────────────────────────── */}
        {hasScanned && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeFilter === f.key;
              const count = counts[f.key];
              if (f.key !== "all" && count === 0) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                    isActive
                      ? "bg-brand-primary/20 border-brand-primary/40 text-brand-primary"
                      : "bg-bg-surface border-border/60 text-text-muted hover:text-text-secondary hover:border-border",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {f.label}
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full leading-none",
                      isActive
                        ? "bg-brand-primary/30 text-brand-primary"
                        : "bg-bg-elevated text-text-muted/60",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Idle empty state ────────────────────────────────────── */}
        {!hasScanned && !loadingApps && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-border/70 bg-bg-elevated"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border mb-6"
              style={{
                background: "var(--t-card-elevated-bg)",
                border: "var(--t-card-elevated-border)",
                boxShadow: "var(--t-glow-primary)",
              }}
            >
              <Shield
                className="w-8 h-8"
                style={{ color: "rgb(var(--t-text-accent))" }}
              />
            </div>
            
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Ready to Scan Installed Apps
            </h2>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed mb-8">
              Scan your installed applications to detect permissions, privacy
              access and security information.
            </p>
            
            <button
              onClick={() => loadApps()}
              disabled={loadingApps}
              className="flex items-center justify-center gap-2 w-[200px] h-10 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed mb-4"
              style={{
                background: "var(--t-btn-bg)",
                boxShadow: "var(--t-btn-shadow)",
              }}
            >
              <Shield className="w-4 h-4" />
              Scan Apps
            </button>
            
            <p className="text-[11px] text-text-muted/50">
              Scanning may take a few seconds depending on installed applications.
            </p>
          </motion.div>
        )}

        {/* ── Skeleton ────────────────────────────────────────────── */}
        {loadingApps && (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-bg-elevated">
            <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1fr)_90px] gap-4 border-b border-border/60 bg-bg-surface/70 px-4 py-2 text-[9px] font-bold uppercase tracking-[.14em] text-text-muted max-[900px]:hidden">
              <span>Application</span>
              <span>Detected access</span>
              <span>Action</span>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1fr)_90px] items-center gap-4 border-b border-border/55 px-4 py-3 last:border-0 max-[900px]:grid-cols-[1fr_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-bg-surface/80 border border-border/30 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  <div className="min-w-0 space-y-2.5 w-full">
                    <div className="h-3.5 w-32 rounded-md bg-bg-surface/80 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                    <div className="h-2.5 w-24 rounded-md bg-bg-surface/60 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-[900px]:col-span-2 max-[900px]:row-start-2">
                  <div className="h-[22px] w-20 rounded-full bg-bg-surface/80 border border-border/30 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  <div className="h-[22px] w-24 rounded-full bg-bg-surface/80 border border-border/30 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                </div>
                <div className="flex justify-end max-[900px]:col-start-2 max-[900px]:row-start-1">
                  <div className="h-7 w-[72px] rounded-lg bg-bg-surface/80 border border-border/30 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state (post-scan, no results) ──────────────── */}
        {hasScanned &&
          !loadingApps &&
          appsLoaded &&
          filteredApps.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-20"
            >
              <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                <Shield className="w-7 h-7 text-text-muted/30" />
              </div>
              <p className="text-sm font-medium text-text-secondary">
                {search
                  ? `No apps match "${search}"`
                  : activeFilter !== "all"
                    ? `No apps with ${activeFilter} access`
                    : "No apps found"}
              </p>
              <p className="text-xs text-text-muted/50">
                {search || activeFilter !== "all"
                  ? "Try clearing your filter"
                  : "Try a rescan"}
              </p>
            </motion.div>
          )}

        {/* ── App grid ────────────────────────────────────────────── */}
        {!loadingApps && filteredApps.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-bg-elevated">
            <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1fr)_90px] gap-4 border-b border-border/60 bg-bg-surface/70 px-4 py-2 text-[9px] font-bold uppercase tracking-[.14em] text-text-muted max-[900px]:hidden">
              <span>Application</span>
              <span>Detected access</span>
              <span>Action</span>
            </div>
            {filteredApps.slice(0, 240).map((app) => (
              <AppCard key={app.name} app={app} onManage={openSettings} />
            ))}
          </div>
        )}

        {!loadingApps && filteredApps.length > 240 && (
          <p className="text-center text-xs text-text-muted/40 py-2">
            Showing 240 of {filteredApps.length} — use search to narrow down
          </p>
        )}
      </div>
    </div>
  );
}

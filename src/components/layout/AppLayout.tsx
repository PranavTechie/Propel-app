import React, { lazy, Suspense } from "react";
import { MotionConfig, motion } from "framer-motion";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { ToastProvider } from "@/components/common/ToastProvider";
import { UpdateModal } from "@/components/ui/UpdateModal";
import { UpdateBanner } from "@/components/ui/UpdateBanner";
import { useAppStore, selectActivePage } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSystemStats } from "@/hooks/useSystemStats";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { usePerformanceProfile } from "@/hooks/usePerformanceProfile";
import { useDevicePing } from "@/hooks/useDevicePing";
import { useEntitlementRefresh } from "@/hooks/useEntitlementRefresh";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  PageActiveContext,
  useWindowVisible,
} from "@/components/ui/hooks/useLiveGate";
import { pageVariants } from "@/animations/variants";
import { Dashboard } from "@/pages/Dashboard";
import { NavPage } from "@/types";
const CleanerPage = lazy(() =>
  import("@/pages/CleanerPage").then((m) => ({ default: m.CleanerPage })),
);
const MemoryPage = lazy(() =>
  import("@/pages/MemoryPage").then((m) => ({ default: m.MemoryPage })),
);
const PerformancePage = lazy(() =>
  import("@/pages/PerformancePage").then((m) => ({
    default: m.PerformancePage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AboutPage = lazy(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);
const SmartMaintenancePage = lazy(() =>
  import("@/pages/SmartMaintenancePage").then((m) => ({
    default: m.SmartMaintenancePage,
  })),
);
const AIFeaturesPage = lazy(() =>
  import("@/pages/AIFeaturesPage").then((m) => ({ default: m.AIFeaturesPage })),
);
const SystemCheckPage = lazy(() =>
  import("@/pages/SystemCheckPage").then((m) => ({
    default: m.SystemCheckPage,
  })),
);
const StartupPage = lazy(() =>
  import("@/pages/StartupPage").then((m) => ({ default: m.StartupPage })),
);
const DuplicateFinderPage = lazy(() =>
  import("@/pages/DuplicateFinderPage").then((m) => ({
    default: m.DuplicateFinderPage,
  })),
);

const PAGE_MAP: Record<NavPage, React.ComponentType> = {
  dashboard: Dashboard,
  cleaner: CleanerPage,
  memory: MemoryPage,
  maintenance: SmartMaintenancePage,
  performance: PerformancePage,
  ai: AIFeaturesPage,
  systemcheck: SystemCheckPage,
  settings: SettingsPage,
  about: AboutPage,
  startup: StartupPage,
  duplicates: DuplicateFinderPage,
};
const PageFallback = () => (
  <div className="page-shell" role="status" aria-label="Loading page">
    <div className="mb-6 space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3.5 w-72" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-28 rounded-card" />
    </div>
    <Skeleton className="mt-4 h-64 w-full rounded-card" />
  </div>
);
export const AppLayout: React.FC = () => {
  const activePage = useAppStore(selectActivePage);
  useSystemStats(true);
  const {
    updateState,
    showModal,
    bannerVisible,
    handleDismissBanner,
    handleOpenModal,
    handleCloseModal,
    handleRestartAndInstall,
    handleRetry,
  } = useUpdateCheck();
  const perfProfile = usePerformanceProfile();
  const windowVisible = useWindowVisible();

  useDevicePing();
  useEntitlementRefresh();

  const ActivePage = PAGE_MAP[activePage];
  return (
    <MotionConfig reducedMotion="user">
    <TooltipProvider delayDuration={350} skipDelayDuration={200}>
      <div
        className="relative flex h-screen w-screen flex-col overflow-hidden bg-surface-base text-fg-1"
        data-perf={perfProfile}
        data-window-hidden={windowVisible ? undefined : "true"}
      >
        <TitleBar />
        <OfflineBanner />
        <div className="relative z-10 flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="relative flex-1 overflow-hidden">
            {Object.entries(PAGE_MAP).map(([key, Component]) => {
              const isActive = key === activePage;
              return (
                <div
                  key={key}
                  style={{
                    display: isActive ? "block" : "none",
                  }}
                  className="absolute inset-0 overflow-hidden"
                >
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate={isActive ? "animate" : "initial"}
                    data-page-container
                    className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                    style={{ scrollbarGutter: "stable" }}
                  >
                    <PageActiveContext.Provider value={isActive}>
                      <Suspense fallback={<PageFallback />}>
                        <Component />
                      </Suspense>
                    </PageActiveContext.Provider>
                  </motion.div>
                </div>
              );
            })}
          </main>
        </div>
        <ToastProvider />
      </div>
      {updateState && (
        <UpdateBanner
          state={updateState}
          visible={bannerVisible}
          onDismiss={handleDismissBanner}
          onOpenModal={handleOpenModal}
        />
      )}
      {showModal && updateState && (
        <UpdateModal
          state={updateState}
          onClose={handleCloseModal}
          onRestartAndInstall={handleRestartAndInstall}
          onRetry={handleRetry}
        />
      )}
    </TooltipProvider>
    </MotionConfig>
  );
};

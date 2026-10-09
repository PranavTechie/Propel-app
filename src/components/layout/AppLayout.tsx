import React, { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { pageVariants } from "@/animations/variants";
import { Dashboard } from "@/pages/Dashboard";
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

const PAGE_MAP = {
  dashboard: Dashboard,
  cleaner: CleanerPage,
  memory: MemoryPage,
  maintenance: SmartMaintenancePage,
  performance: PerformancePage,
  ai: AIFeaturesPage,
  systemcheck: SystemCheckPage,
  settings: SettingsPage,
  about: AboutPage,
};
const PageFallback = () => (
  <div className="page-shell space-y-4" role="status" aria-label="Loading page">
    <div className="skeleton h-7 w-52" />
    <div className="grid grid-cols-3 gap-4">
      <div className="skeleton h-28" />
      <div className="skeleton h-28" />
      <div className="skeleton h-28" />
    </div>
    <div className="skeleton h-64 w-full" />
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
  
  useDevicePing();

  const ActivePage = PAGE_MAP[activePage];
  return (
    <>
      <div
        className="relative flex h-screen w-screen flex-col overflow-hidden"
        data-perf={perfProfile}
        style={{ background: "var(--t-app-bg)" }}
      >
        <TitleBar />
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
                    <Suspense fallback={<PageFallback />}>
                      <Component />
                    </Suspense>
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
    </>
  );
};

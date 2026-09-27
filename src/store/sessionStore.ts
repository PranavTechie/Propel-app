import { create } from 'zustand'

export interface SessionStore {
  cleaner: {
    phase: "idle" | "scanning" | "results" | "cleaning";
    categories: any[];
    selected: Set<string>;
    scanLive: any;
    scanPct: number;
    elapsedSec: number;
    report: any | null;
  };
  setCleaner: (patch: Partial<SessionStore['cleaner']> | ((state: SessionStore['cleaner']) => Partial<SessionStore['cleaner']>)) => void;

  memory: {
    memStats: any | null;
    processes: any[];
    lastOptimization: any | null;
    perfMode: boolean;
    isOptimizing: boolean;
    perfModeLoading: boolean;
  };
  setMemory: (patch: Partial<SessionStore['memory']> | ((state: SessionStore['memory']) => Partial<SessionStore['memory']>)) => void;

  systemCheck: {
    data: any | null;
    lastScanTime: Date | null;
    error: string | null;
    scanning: boolean;
  };
  setSystemCheck: (patch: Partial<SessionStore['systemCheck']> | ((state: SessionStore['systemCheck']) => Partial<SessionStore['systemCheck']>)) => void;

  ai: {
    activeTab: any;
    sbAnalysis: any | null;
    sbResult: any | null;
    sbProgress: any | null;
    suAnalysis: any | null;
    suEntries: any[];
    dupScanResult: any | null;
    dupProgress: any | null;
    dupSelected: Set<string>;
    dupExpandedGroups: Set<string>;
    dupDeleteResult: any | null;
    dupFilterCategory: string;
    sbScanning: boolean;
    suScanning: boolean;
    dupScanning: boolean;
    dupDeleting: boolean;
  };
  setAi: (patch: Partial<SessionStore['ai']> | ((state: SessionStore['ai']) => Partial<SessionStore['ai']>)) => void;

  performance: {
    isOptimizingDrive: boolean;
  };
  setPerformance: (patch: Partial<SessionStore['performance']> | ((state: SessionStore['performance']) => Partial<SessionStore['performance']>)) => void;

  smartMaintenance: {
    settings: any;
    status: any | null;
    loading: boolean;
    running: boolean;
    runResult: any | null;
    isTechnicalDetailsOpen: boolean;
  };
  setSmartMaintenance: (patch: Partial<SessionStore['smartMaintenance']> | ((state: SessionStore['smartMaintenance']) => Partial<SessionStore['smartMaintenance']>)) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  cleaner: {
    phase: "idle",
    categories: [],
    selected: new Set(),
    scanLive: { currentPath: "", totalSize: 0, totalFiles: 0, activeCategory: "" },
    scanPct: 0,
    elapsedSec: 0,
    report: null,
  },
  setCleaner: (patch) => set((s) => ({
    cleaner: {
      ...s.cleaner,
      ...(typeof patch === 'function' ? patch(s.cleaner) : patch)
    }
  })),

  memory: {
    memStats: null,
    processes: [],
    lastOptimization: null,
    perfMode: false,
    isOptimizing: false,
    perfModeLoading: false,
  },
  setMemory: (patch) => set((s) => ({ memory: { ...s.memory, ...(typeof patch === 'function' ? patch(s.memory) : patch) } })),

  systemCheck: {
    data: null,
    lastScanTime: null,
    error: null,
    scanning: false,
  },
  setSystemCheck: (patch) => set((s) => ({ systemCheck: { ...s.systemCheck, ...(typeof patch === 'function' ? patch(s.systemCheck) : patch) } })),

  ai: {
    activeTab: "advisor",
    sbAnalysis: null,
    sbResult: null,
    sbProgress: null,
    suAnalysis: null,
    suEntries: [],
    dupScanResult: null,
    dupProgress: null,
    dupSelected: new Set(),
    dupExpandedGroups: new Set(),
    dupDeleteResult: null,
    dupFilterCategory: "all",
    sbScanning: false,
    suScanning: false,
    dupScanning: false,
    dupDeleting: false,
  },
  setAi: (patch) => set((s) => ({
    ai: {
      ...s.ai,
      ...(typeof patch === 'function' ? patch(s.ai) : patch)
    }
  })),

  performance: {
    isOptimizingDrive: false,
  },
  setPerformance: (patch) => set((s) => ({ performance: { ...s.performance, ...(typeof patch === 'function' ? patch(s.performance) : patch) } })),

  smartMaintenance: {
    settings: null,
    status: null,
    loading: true,
    running: false,
    runResult: null,
    isTechnicalDetailsOpen: false,
  },
  setSmartMaintenance: (patch) => set((s) => ({ smartMaintenance: { ...s.smartMaintenance, ...(typeof patch === 'function' ? patch(s.smartMaintenance) : patch) } })),
}))

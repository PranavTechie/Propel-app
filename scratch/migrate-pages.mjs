import fs from 'fs';

// --- CleanerPage.tsx ---
let cleaner = fs.readFileSync('src/pages/CleanerPage.tsx', 'utf8');

if (!cleaner.includes('useSessionStore')) {
  cleaner = cleaner.replace(
    'import { useSettingsStore } from "@/store/settingsStore";',
    'import { useSettingsStore } from "@/store/settingsStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// Remove state declarations that are in store
cleaner = cleaner.replace(/  const \[phase, setPhase\] = useState<Phase>\("idle"\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[categories, setCategories\] = useState<ScanCategory\[\]>\(\[\]\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[selected, setSelected\] = useState<Set<string>>\(new Set\(\)\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[scanLive, setScanLive\] = useState<ScanLiveState>\(\{\r?\n\s*currentPath: "",\r?\n\s*totalSize: 0,\r?\n\s*totalFiles: 0,\r?\n\s*activeCategory: "",\r?\n\s*\}\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[scanPct, setScanPct\] = useState\(0\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[elapsedSec, setElapsedSec\] = useState\(0\);\r?\n/, '');
cleaner = cleaner.replace(/  const \[report, setReport\] = useState<CleanupReport \| null>\(null\);\r?\n/, '');

// Add useSessionStore hooks
const cleanerHooks = `  const { phase, categories, selected, scanLive, scanPct, elapsedSec, report } = useSessionStore(s => s.cleaner);
  const setCleaner = useSessionStore(s => s.setCleaner);
  const setPhase = (p: Phase) => setCleaner({ phase: p });
  const setCategories = (c: ScanCategory[] | ((prev: ScanCategory[]) => ScanCategory[])) => setCleaner(s => ({ categories: typeof c === 'function' ? c(s.categories) : c }));
  const setSelected = (s: Set<string> | ((prev: Set<string>) => Set<string>)) => setCleaner(st => ({ selected: typeof s === 'function' ? s(st.selected) : s }));
  const setScanLive = (s: any) => setCleaner({ scanLive: s });
  const setScanPct = (p: number) => setCleaner({ scanPct: p });
  const setElapsedSec = (e: any) => setCleaner(s => ({ elapsedSec: typeof e === 'function' ? e(s.elapsedSec) : e }));
  const setReport = (r: any) => setCleaner({ report: r });
`;
cleaner = cleaner.replace('  const { addToast } = useAppStore();\n', `  const { addToast } = useAppStore();\n${cleanerHooks}`);

fs.writeFileSync('src/pages/CleanerPage.tsx', cleaner);
console.log('Fixed CleanerPage');

// --- MemoryPage.tsx ---
let memory = fs.readFileSync('src/pages/MemoryPage.tsx', 'utf8');

if (!memory.includes('useSessionStore')) {
  memory = memory.replace(
    'import { useSettingsStore } from "@/store/settingsStore";',
    'import { useSettingsStore } from "@/store/settingsStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

memory = memory.replace(/  const \[memStats, setMemStats\] = useState<MemoryStats \| null>\(null\);\r?\n/, '');
memory = memory.replace(/  const \[processes, setProcesses\] = useState<ProcessInfo\[\]>\(\[\]\);\r?\n/, '');
memory = memory.replace(/  const \[lastOptimization, setLastOptimization\] = useState<\{ freed: number; time: Date \} \| null>\(null\);\r?\n/, '');
memory = memory.replace(/  const \[perfMode, setPerfMode\] = useState\(false\);\r?\n/, '');

const memoryHooks = `  const { memStats, processes, lastOptimization, perfMode } = useSessionStore(s => s.memory);
  const setMemory = useSessionStore(s => s.setMemory);
  const setMemStats = (s: any) => setMemory({ memStats: s });
  const setProcesses = (p: any) => setMemory({ processes: p });
  const setLastOptimization = (o: any) => setMemory({ lastOptimization: o });
  const setPerfMode = (p: any) => setMemory({ perfMode: p });
`;
memory = memory.replace('  const { addToast } = useAppStore();\n', `  const { addToast } = useAppStore();\n${memoryHooks}`);

fs.writeFileSync('src/pages/MemoryPage.tsx', memory);
console.log('Fixed MemoryPage');

// --- SystemCheckPage.tsx ---
let syscheck = fs.readFileSync('src/pages/SystemCheckPage.tsx', 'utf8');

if (!syscheck.includes('useSessionStore')) {
  syscheck = syscheck.replace(
    'import { useAppStore } from "@/store/appStore";',
    'import { useAppStore } from "@/store/appStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

syscheck = syscheck.replace(/  const \[data, setData\] = useState<SystemInfo \| null>\(null\);\r?\n/, '');
syscheck = syscheck.replace(/  const \[lastScanTime, setLastScanTime\] = useState<Date \| null>\(null\);\r?\n/, '');
syscheck = syscheck.replace(/  const \[error, setError\] = useState<string \| null>\(null\);\r?\n/, '');

const sysHooks = `  const { data, lastScanTime, error } = useSessionStore(s => s.systemCheck);
  const setSystemCheck = useSessionStore(s => s.setSystemCheck);
  const setData = (d: any) => setSystemCheck({ data: d });
  const setLastScanTime = (t: any) => setSystemCheck({ lastScanTime: t });
  const setError = (e: any) => setSystemCheck({ error: e });
`;
syscheck = syscheck.replace('  const { addToast } = useAppStore();\n', `  const { addToast } = useAppStore();\n${sysHooks}`);

fs.writeFileSync('src/pages/SystemCheckPage.tsx', syscheck);
console.log('Fixed SystemCheckPage');


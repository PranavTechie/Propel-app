import fs from 'fs';

let content = fs.readFileSync('src/pages/SmartMaintenancePage.tsx', 'utf8');

// 1. Add useSessionStore import
if (!content.includes('useSessionStore')) {
  content = content.replace(
    'import { cn } from "@/utils/cn";',
    'import { cn } from "@/utils/cn";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// 2. Add destructured session store in SmartMaintenancePage
const hooks = `
  const { settings, status, loading, running, runResult, isTechnicalDetailsOpen } = useSessionStore(s => s.smartMaintenance);
  const setSmartMaintenance = useSessionStore(s => s.setSmartMaintenance);
  const setSettings = (s: any) => setSmartMaintenance(st => ({ settings: typeof s === 'function' ? s(st.settings || DEFAULT_SETTINGS) : s }));
  const setStatus = (st: any) => setSmartMaintenance({ status: st });
  const setLoading = (l: boolean) => setSmartMaintenance({ loading: l });
  const setRunning = (r: boolean) => setSmartMaintenance({ running: r });
  const setRunResult = (rr: any) => setSmartMaintenance({ runResult: rr });
  const setIsTechnicalDetailsOpen = (o: boolean) => setSmartMaintenance({ isTechnicalDetailsOpen: o });
`;

// Find the block of useState declarations and replace them.
const targetRegex = /  const \[settings, setSettings\] =\r?\n\s*useState<MaintenanceSettings>\(DEFAULT_SETTINGS\);\r?\n  const \[status, setStatus\] = useState<MaintenanceStatus \| null>\(null\);\r?\n  const \[loading, setLoading\] = useState\(true\);\r?\n  const \[running, setRunning\] = useState\(false\);\r?\n  const \[runResult, setRunResult\] = useState<\{\r?\n\s*ok: boolean;\r?\n\s*msg: string;\r?\n\s*\} \| null>\(null\);\r?\n.*\r?\n\s*const \[isTechnicalDetailsOpen, setIsTechnicalDetailsOpen\] = useState\(false\);\r?\n/;

content = content.replace(targetRegex, hooks);

fs.writeFileSync('src/pages/SmartMaintenancePage.tsx', content);
console.log('Fixed SmartMaintenancePage');

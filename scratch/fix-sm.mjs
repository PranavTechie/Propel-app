import fs from 'fs';

let c = fs.readFileSync('src/pages/SmartMaintenancePage.tsx', 'utf8');

if (!c.includes('useSessionStore')) {
  c = c.replace(
    'import { useSettingsStore } from "@/store/settingsStore";',
    'import { useSettingsStore } from "@/store/settingsStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// Remove state declarations
c = c.replace(/  const \[settings, setSettings\] =\r?\n\s*useState<MaintenanceSettings>\(DEFAULT_SETTINGS\);\r?\n/, '');
c = c.replace(/  const \[status, setStatus\] = useState<MaintenanceStatus \| null>\(null\);\r?\n/, '');
c = c.replace(/  const \[loading, setLoading\] = useState\(true\);\r?\n/, '');
c = c.replace(/  const \[running, setRunning\] = useState\(false\);\r?\n/, '');
c = c.replace(/  const \[runResult, setRunResult\] = useState<\{\r?\n\s*success: boolean;\r?\n\s*message: string;\r?\n\s*metrics\?: MaintenanceMetrics;\r?\n\s*\} \| null>\(null\);\r?\n/, '');
c = c.replace(/  const \[isTechnicalDetailsOpen, setIsTechnicalDetailsOpen\] = useState\(false\);\r?\n/, '');

// Add useSessionStore hooks
const hooksStr = `  const { settings: rawSettings, status, loading, running, runResult, isTechnicalDetailsOpen } = useSessionStore(s => s.smartMaintenance);
  const setSM = useSessionStore(s => s.setSmartMaintenance);
  const settings = rawSettings || DEFAULT_SETTINGS;
`;
c = c.replace('  const { addToast } = useAppStore();\n', `  const { addToast } = useAppStore();\n${hooksStr}`);

// Replace setters
c = c.replace(/setSettings\((.*?)\)/g, 'setSM({ settings: $1 })');
c = c.replace(/setStatus\((.*?)\)/g, 'setSM({ status: $1 })');
c = c.replace(/setLoading\((.*?)\)/g, 'setSM({ loading: $1 })');
c = c.replace(/setRunning\((.*?)\)/g, 'setSM({ running: $1 })');
c = c.replace(/setRunResult\((.*?)\)/g, 'setSM({ runResult: $1 })');
c = c.replace(/setIsTechnicalDetailsOpen\((.*?)\)/g, 'setSM({ isTechnicalDetailsOpen: $1 })');

// There is also an updater pattern setSettings((s) => ({ ...s, schedule: { ...s.schedule, enabled } }))
c = c.replace(/setSettings\(\(s\) => \(\{ \.\.\.s, schedule: \{ \.\.\.s\.schedule, enabled \} \}\)\)/g, 
  'setSM({ settings: { ...settings, schedule: { ...settings.schedule, enabled } } })');
  
// Another updater: setSettings((s) => ({ ...s, [key]: !s[key as keyof typeof s] }))
c = c.replace(/setSettings\(\(s\) => \(\{ \.\.\.s, \[key\]: !s\[key as keyof typeof s\] \}\)\)/g, 
  'setSM({ settings: { ...settings, [key]: !settings[key as keyof typeof settings] } })');

fs.writeFileSync('src/pages/SmartMaintenancePage.tsx', c);
console.log('Fixed SmartMaintenancePage');

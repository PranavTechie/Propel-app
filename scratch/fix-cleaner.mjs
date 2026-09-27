import fs from 'fs';

let content = fs.readFileSync('src/pages/CleanerPage.tsx', 'utf8');

if (!content.includes('useSessionStore')) {
  content = content.replace(
    'import { useAppStore } from "@/store/appStore";',
    'import { useAppStore } from "@/store/appStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// Replace the block of useState declarations
const stateBlock = `  const [phase, setPhase] = useState<Phase>("idle");
  const [categories, setCategories] = useState<ScanCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanLive, setScanLive] = useState<ScanLiveState>({
    currentPath: "",
    totalSize: 0,
    totalFiles: 0,
    activeCategory: "",
  });
  const [cleanLive, setCleanLive] = useState<CleanLiveState>({
    current: 0,
    total: 0,
    currentFile: "",
    freed: 0,
  });
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);
  const [restoreWarning, setRestoreWarning] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [safeCleaningMode, setSafeCleaningMode] = useState(true);
  // ── Scan progress percentage (0-100) derived from category completion ──
  const [scanPct, setScanPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);`;

const replacement = `  const { phase, categories, selected, scanLive, scanPct, elapsedSec, report } = useSessionStore(s => s.cleaner);
  const setCleaner = useSessionStore(s => s.setCleaner);

  const [cleanLive, setCleanLive] = useState<CleanLiveState>({
    current: 0,
    total: 0,
    currentFile: "",
    freed: 0,
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);
  const [restoreWarning, setRestoreWarning] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [safeCleaningMode, setSafeCleaningMode] = useState(true);`;

// Regex replacement for the state block to bypass CRLF issues
content = content.replace(/  const \[phase, setPhase\] = useState<Phase>\("idle"\);[\s\S]*?const \[elapsedSec, setElapsedSec\] = useState\(0\);/, replacement);

// Replace setters
content = content.replace(/setPhase\((.*?)\)/g, 'setCleaner({ phase: $1 })');
content = content.replace(/setCategories\(/g, 'setCleaner({ categories: ');
content = content.replace(/setSelected\((.*?)\)/g, 'setCleaner({ selected: $1 })');
content = content.replace(/setScanLive\((.*?)\)/g, 'setCleaner({ scanLive: $1 })');
content = content.replace(/setScanPct\((.*?)\)/g, 'setCleaner({ scanPct: $1 })');
content = content.replace(/setElapsedSec\((.*?)\)/g, 'setCleaner({ elapsedSec: $1 })');
content = content.replace(/setReport\((.*?)\)/g, 'setCleaner({ report: $1 })');

// We need to fix the setCategories updates where it takes a callback, e.g. setCategories(prev => ...).
// useSessionStore's setCleaner doesn't automatically support callbacks out of the box unless we pass the state.
// Wait, Zustand setter `set(s => ({ ... }))` supports it!
// Let's manually fix the setCategories with callbacks if any exist, or just use `useSessionStore.getState().cleaner.categories`.

content = content.replace(/setCleaner\(\{ categories: \(prev\) => \{/g, 'setCleaner({ categories: (function(prev) {');

// A safer way is to use useSessionStore.getState() for callbacks.
// Let's do it right. We'll run this first and then check if there are manual fixes needed.

fs.writeFileSync('src/pages/CleanerPage.tsx', content);
console.log('CleanerPage.tsx updated successfully');

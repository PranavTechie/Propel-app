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

// Replace functional setters to use setCleaner(prev => ({ prop: functionCall(prev.prop) }))
content = content.replace(/setCategories\(\(prev\) => \{([\s\S]*?)\}\);/g, 'setCleaner((prev) => { const prevCats = prev.categories; $1 return { categories: prevCats }; });');

content = content.replace(/setScanLive\(\(prev\) => \(\{ \.\.\.prev, \.\.\.p \}\)\);/g, 'setCleaner(prev => ({ scanLive: { ...prev.scanLive, ...p } }));');

content = content.replace(/setElapsedSec\(\(s\) => s \+ 1\)/g, 'setCleaner(prev => ({ elapsedSec: prev.elapsedSec + 1 }))');

content = content.replace(/setSelected\(\(prev\) => \{([\s\S]*?)\}\);/g, 'setCleaner((prev) => { const prevSel = prev.selected; $1 return { selected: prevSel }; });');

// Normal setters
content = content.replace(/setPhase\((.*?)\)/g, 'setCleaner({ phase: $1 })');
content = content.replace(/setCategories\((.*?)\)/g, 'setCleaner({ categories: $1 })');
content = content.replace(/setSelected\((.*?)\)/g, 'setCleaner({ selected: $1 })');
content = content.replace(/setScanLive\((.*?)\)/g, 'setCleaner({ scanLive: $1 })');
content = content.replace(/setScanPct\((.*?)\)/g, 'setCleaner({ scanPct: $1 })');
content = content.replace(/setElapsedSec\((.*?)\)/g, 'setCleaner({ elapsedSec: $1 })');
content = content.replace(/setReport\((.*?)\)/g, 'setCleaner({ report: $1 })');

// Wait, the setCategories replacement above for functions will result in `prevCats.find` etc. We need to make sure we return `categories: prevCats` correctly, but the inner code modifies `prevCats`? No, the original code returns a new array.
// Let's check the original code:
// setCategories((prev) => {
//   const existing = prev.find(c => c.id === evt.id);
//   if (existing) return prev;
//   return [...prev, ...];
// });
// If I transform it to `setCleaner((prev) => { const prevCats = prev.categories; ... return { categories: prevCats }; })` - NO, the original code had `return [...]`. 
// So `$1` contains `return ...`. My replacement `return { categories: prevCats };` will be unreachable.

// Let's just do a specific manual replace for setCategories in CleanerPage:
content = content.replace(
  /setCleaner\(\(prev\) => \{ const prevCats = prev\.categories;([\s\S]*?) return \{ categories: prevCats \}; \}\);/g, 
  function(match, inner) {
    // We need to change the inner `return x` to `return { categories: x }`
    return 'setCleaner((prev) => {' + inner.replace(/return (.*?);/g, 'return { categories: $1 };') + '});';
  }
);
// And the same for setSelected
content = content.replace(
  /setCleaner\(\(prev\) => \{ const prevSel = prev\.selected;([\s\S]*?) return \{ selected: prevSel \}; \}\);/g, 
  function(match, inner) {
    return 'setCleaner((prev) => {' + inner.replace(/return (.*?);/g, 'return { selected: $1 };') + '});';
  }
);

// We should also replace `prev` with `prevCats` inside the block for categories.
// Or we could just use `useSessionStore.getState().cleaner` to avoid the mess.

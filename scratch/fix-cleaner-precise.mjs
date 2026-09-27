import fs from 'fs';

let content = fs.readFileSync('src/pages/CleanerPage.tsx', 'utf8');

// 1. Add useSessionStore import
if (!content.includes('useSessionStore')) {
  content = content.replace(
    'import { useCleanerHistoryStore } from "@/store/cleanerHistoryStore";',
    'import { useCleanerHistoryStore } from "@/store/cleanerHistoryStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// 2. Add destructured session store in CleanerPage
const hooks = `
  const { phase, categories, selected, report, scanLive, scanPct, elapsedSec } = useSessionStore(s => s.cleaner);
  const setCleaner = useSessionStore(s => s.setCleaner);
  const setPhase = (p: any) => setCleaner({ phase: p });
  const setCategories = (c: any) => setCleaner(s => ({ categories: typeof c === 'function' ? c(s.categories) : c }));
  const setSelected = (sel: any) => setCleaner(s => ({ selected: typeof sel === 'function' ? sel(s.selected) : sel }));
  const setReport = (r: any) => setCleaner({ report: r });
  const setScanLive = (sl: any) => setCleaner(s => ({ scanLive: typeof sl === 'function' ? sl(s.scanLive) : sl }));
  const setScanPct = (p: any) => setCleaner(s => ({ scanPct: typeof p === 'function' ? p(s.scanPct) : p }));
  const setElapsedSec = (e: any) => setCleaner(s => ({ elapsedSec: typeof e === 'function' ? e(s.elapsedSec) : e }));

`;

// Find the block of useState declarations and replace them.
// They look like:
/*
  const [phase, setPhase] = useState<Phase>("idle");
  const [categories, setCategories] = useState<ScanCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [scanLive, setScanLive] = useState<ScanLiveState>({
    currentPath: "",
    totalSize: 0,
    totalFiles: 0,
    activeCategory: "",
  });
  const [scanPct, setScanPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
*/

const targetRegex = /  const \[phase, setPhase\] = useState<Phase>\("idle"\);\r?\n  const \[categories, setCategories\] = useState<ScanCategory\[\]>\(\[\]\);\r?\n  const \[selected, setSelected\] = useState<Set<string>>\(new Set\(\)\);\r?\n  const \[report, setReport\] = useState<CleanupReport \| null>\(null\);\r?\n  const \[scanLive, setScanLive\] = useState<ScanLiveState>\(\{\r?\n    currentPath: "",\r?\n    totalSize: 0,\r?\n    totalFiles: 0,\r?\n    activeCategory: "",\r?\n  \}\);\r?\n  const \[scanPct, setScanPct\] = useState\(0\);\r?\n  const \[elapsedSec, setElapsedSec\] = useState\(0\);\r?\n/;

content = content.replace(targetRegex, hooks);

fs.writeFileSync('src/pages/CleanerPage.tsx', content);
console.log('Fixed CleanerPage');

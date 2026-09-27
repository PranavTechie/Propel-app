import fs from 'fs';

// --- AIFeaturesPage.tsx ---
let ai = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

if (!ai.includes('useSessionStore')) {
  ai = ai.replace(
    'import { useSettingsStore } from "@/store/settingsStore";',
    'import { useSettingsStore } from "@/store/settingsStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// Remove state declarations
ai = ai.replace(/  const \[activeTab, setActiveTab\] = useState<"advisor" \| "startup" \| "duplicates">(\("advisor"\));\r?\n/, '');

// Smart Boost (PC Advisor)
ai = ai.replace(/  const \[sbAnalysis, setSbAnalysis\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[sbResult, setSbResult\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[sbProgress, setSbProgress\] = useState<any \| null>\(null\);\r?\n/, '');

// Startup Manager
ai = ai.replace(/  const \[suAnalysis, setSuAnalysis\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[suEntries, setSuEntries\] = useState<any\[\]>\(\[\]\);\r?\n/, '');

// Duplicate Finder
ai = ai.replace(/  const \[dupScanResult, setDupScanResult\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[dupProgress, setDupProgress\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[dupSelected, setDupSelected\] = useState<Set<string>>\(new Set\(\)\);\r?\n/, '');
ai = ai.replace(/  const \[dupExpandedGroups, setDupExpandedGroups\] = useState<Set<string>>\(new Set\(\)\);\r?\n/, '');
ai = ai.replace(/  const \[dupDeleteResult, setDupDeleteResult\] = useState<any \| null>\(null\);\r?\n/, '');
ai = ai.replace(/  const \[dupFilterCategory, setDupFilterCategory\] = useState<string>\("all"\);\r?\n/, '');

const aiHooks = `  const {
    activeTab, sbAnalysis, sbResult, sbProgress,
    suAnalysis, suEntries,
    dupScanResult, dupProgress, dupSelected, dupExpandedGroups, dupDeleteResult, dupFilterCategory
  } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setActiveTab = (t: any) => setAi({ activeTab: t });
  const setSbAnalysis = (a: any) => setAi({ sbAnalysis: a });
  const setSbResult = (r: any) => setAi({ sbResult: r });
  const setSbProgress = (p: any) => setAi({ sbProgress: p });
  const setSuAnalysis = (a: any) => setAi({ suAnalysis: a });
  const setSuEntries = (e: any) => setAi(s => ({ suEntries: typeof e === 'function' ? e(s.suEntries) : e }));
  const setDupScanResult = (r: any) => setAi({ dupScanResult: r });
  const setDupProgress = (p: any) => setAi({ dupProgress: p });
  const setDupSelected = (s: any) => setAi(st => ({ dupSelected: typeof s === 'function' ? s(st.dupSelected) : s }));
  const setDupExpandedGroups = (s: any) => setAi(st => ({ dupExpandedGroups: typeof s === 'function' ? s(st.dupExpandedGroups) : s }));
  const setDupDeleteResult = (r: any) => setAi({ dupDeleteResult: r });
  const setDupFilterCategory = (c: any) => setAi({ dupFilterCategory: c });
`;
ai = ai.replace('  const { addToast } = useAppStore();\n', `  const { addToast } = useAppStore();\n${aiHooks}`);

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', ai);
console.log('Fixed AIFeaturesPage');

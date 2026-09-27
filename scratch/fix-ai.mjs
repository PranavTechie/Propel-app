import fs from 'fs';

let content = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

if (!content.includes('useSessionStore')) {
  content = content.replace(
    'import { useSettingsStore } from "@/store/settingsStore";',
    'import { useSettingsStore } from "@/store/settingsStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// SmartBoost
content = content.replace(
  '  const [analysis, setAnalysis] = useState<SmartBoostAnalysis | null>(null);',
  `  const { sbAnalysis: analysis, sbResult: result, sbProgress: progress } = useSessionStore(s => s.ai);\n  const setAi = useSessionStore(s => s.setAi);`
);
content = content.replace(/  const \[result, setResult\] = useState<SmartBoostResult \| null>\(null\);\r?\n/, '');
content = content.replace(/  const \[progress, setProgress\] = useState<\{[\s\S]*?\}>\(null\);\r?\n/, '');

// StartupManager
content = content.replace(
  '  const [analysis, setAnalysis] = useState<StartupAnalysis | null>(null);',
  `  const { suAnalysis: analysis, suEntries: entries } = useSessionStore(s => s.ai);\n  const setAi = useSessionStore(s => s.setAi);`
);
content = content.replace(/  const \[entries, setEntries\] = useState<StartupEntry\[\]>\(\[\]\);\r?\n/, '');

// DuplicateFinder
content = content.replace(
  /  const \[scanResult, setScanResult\] = useState<DuplicateScanResult \| null>\([\s\S]*?\);/,
  `  const { dupScanResult: scanResult, dupProgress: progress, dupSelected: selected, dupExpandedGroups: expandedGroups, dupDeleteResult: deleteResult, dupFilterCategory: filterCategory } = useSessionStore(s => s.ai);\n  const setAi = useSessionStore(s => s.setAi);`
);
content = content.replace(/  const \[progress, setProgress\] = useState<DuplicateScanProgress \| null>\(null\);\r?\n/, '');
content = content.replace(/  const \[selected, setSelected\] = useState<Set<string>>\(new Set\(\)\);\r?\n/, '');
content = content.replace(/  const \[expandedGroups, setExpandedGroups\] = useState<Set<string>>\(new Set\(\)\);\r?\n/, '');
content = content.replace(/  const \[deleteResult, setDeleteResult\] = useState<\{[\s\S]*?\}>\(null\);\r?\n/, '');
content = content.replace(/  const \[filterCategory, setFilterCategory\] = useState<string>\("all"\);\r?\n/, '');

// AIFeaturesPage
content = content.replace(
  '  const [activeTab, setActiveTab] = useState<Tab>("advisor");',
  `  const { activeTab } = useSessionStore(s => s.ai);\n  const setAi = useSessionStore(s => s.setAi);\n  const setActiveTab = (tab: Tab) => setAi({ activeTab: tab });`
);

// Split into component blocks
let sbStart = content.indexOf('export const SmartBoost: React.FC = () => {');
let smStart = content.indexOf('export const StartupManager: React.FC = () => {');
let dfStart = content.indexOf('export const DuplicateFinder: React.FC = () => {');
let aiStart = content.indexOf('export const AIFeaturesPage: React.FC = () => {');

let smartBoostStr = content.substring(sbStart, smStart);
let startupManagerStr = content.substring(smStart, dfStart);
let duplicateFinderStr = content.substring(dfStart, aiStart);
let aiFeaturesStr = content.substring(aiStart);

smartBoostStr = smartBoostStr.replace(/setAnalysis\((.*?)\)/g, 'setAi({ sbAnalysis: $1 })');
smartBoostStr = smartBoostStr.replace(/setResult\((.*?)\)/g, 'setAi({ sbResult: $1 })');
smartBoostStr = smartBoostStr.replace(/setProgress\((.*?)\)/g, 'setAi({ sbProgress: $1 })');

startupManagerStr = startupManagerStr.replace(/setAnalysis\((.*?)\)/g, 'setAi({ suAnalysis: $1 })');
startupManagerStr = startupManagerStr.replace(/setEntries\(\(prev\) =>\r?\n([\s\S]*?)prev\.map\((.*?)\)\r?\n([\s\S]*?)\);/g,
  'setAi({ suEntries: useSessionStore.getState().ai.suEntries.map($2) });'
);
startupManagerStr = startupManagerStr.replace(/setEntries\(\(prev\) => prev\.map\((.*?)\)\);/g,
  'setAi({ suEntries: useSessionStore.getState().ai.suEntries.map($1) });'
);
startupManagerStr = startupManagerStr.replace(/setEntries\((.*?)\)/g, 'setAi({ suEntries: $1 })');

duplicateFinderStr = duplicateFinderStr.replace(/setScanResult\((.*?)\)/g, 'setAi({ dupScanResult: $1 })');
duplicateFinderStr = duplicateFinderStr.replace(/setProgress\((.*?)\)/g, 'setAi({ dupProgress: $1 })');
duplicateFinderStr = duplicateFinderStr.replace(/setDeleteResult\((.*?)\)/g, 'setAi({ dupDeleteResult: $1 })');
duplicateFinderStr = duplicateFinderStr.replace(/setFilterCategory\((.*?)\)/g, 'setAi({ dupFilterCategory: $1 })');

// setSelected
duplicateFinderStr = duplicateFinderStr.replace(/setSelected\(\(prev\) => \{\r?\n\s*const next = new Set\(prev\);\r?\n\s*if \(next\.has\(file\.path\)\)\r?\n\s*next\.delete\(file\.path\);\r?\n\s*else next\.add\(file\.path\);\r?\n\s*return next;\r?\n\s*\}\)/g, 
  'setAi((prev) => { const next = new Set(prev.dupSelected); if (next.has(file.path)) next.delete(file.path); else next.add(file.path); return { dupSelected: next }; })'
);
duplicateFinderStr = duplicateFinderStr.replace(/setSelected\(new Set\(\)\)/g, 'setAi({ dupSelected: new Set() })');
duplicateFinderStr = duplicateFinderStr.replace(/setSelected\((.*?)\)/g, 'setAi({ dupSelected: $1 })');

// setExpandedGroups
duplicateFinderStr = duplicateFinderStr.replace(/setExpandedGroups\(\(prev\) => \{\r?\n\s*const next = new Set\(prev\);\r?\n\s*if \(next\.has\(group\.hash\)\)\r?\n\s*next\.delete\(group\.hash\);\r?\n\s*else next\.add\(group\.hash\);\r?\n\s*return next;\r?\n\s*\}\)/g, 
  'setAi((prev) => { const next = new Set(prev.dupExpandedGroups); if (next.has(group.hash)) next.delete(group.hash); else next.add(group.hash); return { dupExpandedGroups: next }; })'
);
duplicateFinderStr = duplicateFinderStr.replace(/setExpandedGroups\((.*?)\)/g, 'setAi({ dupExpandedGroups: $1 })');


const finalContent = content.substring(0, sbStart) + smartBoostStr + startupManagerStr + duplicateFinderStr + aiFeaturesStr;

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', finalContent);
console.log('AIFeaturesPage.tsx updated successfully');

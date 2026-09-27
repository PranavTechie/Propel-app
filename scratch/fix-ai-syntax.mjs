import fs from 'fs';

let ai = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

// Add import
if (!ai.includes('useSessionStore')) {
  ai = ai.replace(
    'import React, { useState, useEffect, useCallback, useRef } from "react";',
    'import React, { useState, useEffect, useCallback, useRef } from "react";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// 1. SmartBoostSection
ai = ai.replace(
`  const [analysis, setAnalysis] = useState<SmartBoostAnalysis | null>(null);
  const [result, setResult] = useState<SmartBoostResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<{
    step: string;
    pct: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);`,
`  const { sbAnalysis: analysis, sbResult: result, sbProgress: progress } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setAnalysis = (a: any) => setAi({ sbAnalysis: a });
  const setResult = (r: any) => setAi({ sbResult: r });
  const setProgress = (p: any) => setAi({ sbProgress: p });
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);`
);

// 2. StartupAnalyzerSection
ai = ai.replace(
`  const [analysis, setAnalysis] = useState<StartupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StartupEntry[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);`,
`  const { suAnalysis: analysis, suEntries: entries } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setAnalysis = (a: any) => setAi({ suAnalysis: a });
  const setEntries = (e: any) => setAi(s => ({ suEntries: typeof e === 'function' ? e(s.suEntries) : e }));
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);`
);

// 3. DuplicateFinderSection
ai = ai.replace(
`  const [scanResult, setScanResult] = useState<DuplicateScanResult | null>(
    null,
  );
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteResult, setDeleteResult] = useState<{
    freedBytes: number;
    deletedCount: number;
  } | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");`,
`  const { dupScanResult: scanResult, dupProgress: progress, dupSelected: selected, dupExpandedGroups: expandedGroups, dupDeleteResult: deleteResult, dupFilterCategory: filterCategory } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setScanResult = (r: any) => setAi({ dupScanResult: r });
  const setProgress = (p: any) => setAi({ dupProgress: p });
  const setSelected = (s: any) => setAi(st => ({ dupSelected: typeof s === 'function' ? s(st.dupSelected) : s }));
  const setExpandedGroups = (s: any) => setAi(st => ({ dupExpandedGroups: typeof s === 'function' ? s(st.dupExpandedGroups) : s }));
  const setDeleteResult = (r: any) => setAi({ dupDeleteResult: r });
  const setFilterCategory = (c: any) => setAi({ dupFilterCategory: c });
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);`
);

// 4. AIFeaturesPage
ai = ai.replace(
`  const [activeTab, setActiveTab] = useState<Tab>("advisor");`,
`  const { activeTab } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setActiveTab = (t: any) => setAi({ activeTab: t });`
);

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', ai);
console.log('Fixed AIFeaturesPage syntax');

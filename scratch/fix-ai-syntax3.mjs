import fs from 'fs';

let content = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

// 1. Remove progress in SmartBoost
content = content.replace(/  const \[progress, setProgress\] = useState<\{\r?\n\s*step: string;\r?\n\s*pct: number;\r?\n\s*\} \| null>\(null\);\r?\n/, '');

// 2. Remove deleteResult in DuplicateFinder
content = content.replace(/  const \[deleteResult, setDeleteResult\] = useState<\{\r?\n\s*freedBytes: number;\r?\n\s*deletedCount: number;\r?\n\s*\} \| null>\(null\);\r?\n/, '');

// 3. Fix setExpandedGroups
content = content.replace(
  /setAi\(\{ dupExpandedGroups: \(prev \}\) => \{\r?\n\s*const next = new Set\(prev\);\r?\n\s*if \(next\.has\(group\.hash\)\) next\.delete\(group\.hash\);\r?\n\s*else next\.add\(group\.hash\);\r?\n\s*return next;\r?\n\s*\}\)/g,
  'setAi((prev) => { const next = new Set(prev.dupExpandedGroups); if (next.has(group.hash)) next.delete(group.hash); else next.add(group.hash); return { dupExpandedGroups: next }; })'
);

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', content);
console.log('Fixed syntax errors 3');

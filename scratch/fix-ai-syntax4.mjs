import fs from 'fs';

let content = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

// Fix group select all checkbox
content = content.replace(
  /setAi\(\{ dupSelected: \(prev \}\) => \{\r?\n\s*const next = new Set\(prev\);\r?\n\s*for \(const f of duplicates\) \{/g,
  'setAi((prev) => { const next = new Set(prev.dupSelected); for (const f of duplicates) {'
);

// We should also replace the closing brace of the group select all
content = content.replace(
  /        next\.add\(f\.path\);\r?\n\s*\}\r?\n\s*return next;\r?\n\s*\}\)/g,
  '        next.add(f.path);\n                              }\n                              return { dupSelected: next };\n                            })'
);

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', content);
console.log('Fixed syntax errors 4');

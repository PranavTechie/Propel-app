import fs from 'fs';

let c = fs.readFileSync('src/pages/AIFeaturesPage.tsx', 'utf8');

c = c.replace(/const next = new Set\(prev\.dupExpandedGroups\);\s*const next = new Set\(prev\);/g, 'const next = new Set(prev.dupExpandedGroups);');
c = c.replace(/return \{ dupExpandedGroups: next \}; \}\);\s*\}\}/g, 'return { dupExpandedGroups: next }; })\n                        } ');
// It says Expected "}" but found ";" at line 1020.
// 1019|                          else next.add(group.hash);
// 1020|                           return { dupExpandedGroups: next }; });
// 1021|                        }}

c = c.replace(/return \{ dupExpandedGroups: next \}; \}\);\n\s*\}\}/g, 'return { dupExpandedGroups: next }; })\n                        }');
c = c.replace(/return \{ dupExpandedGroups: next \}; \}\);/g, 'return { dupExpandedGroups: next }; });');

// Wait, the error is `Expected "}" but found ";"` because it's inside `onClick={() => setAi(...) }`
// The original was: `onClick={() => setExpandedGroups(...) }`
// So it became `onClick={() => setAi(...) });` - Notice the `);` inside the jsx attribute!
c = c.replace(/onClick=\{\(\) =>\s*setAi\(\(prev\) => \{\s*const next = new Set\(prev\.dupExpandedGroups\);\s*if \(next\.has\(group\.hash\)\) next\.delete\(group\.hash\);\s*else next\.add\(group\.hash\);\s*return \{ dupExpandedGroups: next \}; \}\);\n\s*\}\}/g, 
  'onClick={() =>\n                        setAi((prev) => { const next = new Set(prev.dupExpandedGroups);\n                          if (next.has(group.hash)) next.delete(group.hash);\n                          else next.add(group.hash);\n                          return { dupExpandedGroups: next }; })\n                        }'
);

c = c.replace(/onClick=\{\(\) =>\s*setAi\(\(prev\) => \{\s*const next = new Set\(prev\.dupExpandedGroups\);\s*const next = new Set\(prev\);\s*if \(next\.has\(group\.hash\)\) next\.delete\(group\.hash\);\s*else next\.add\(group\.hash\);\s*return \{ dupExpandedGroups: next \}; \}\);\n\s*\}\}/g, 
  'onClick={() =>\n                        setAi((prev) => { const next = new Set(prev.dupExpandedGroups);\n                          if (next.has(group.hash)) next.delete(group.hash);\n                          else next.add(group.hash);\n                          return { dupExpandedGroups: next }; })\n                        }'
);

fs.writeFileSync('src/pages/AIFeaturesPage.tsx', c);
console.log('Fixed syntax errors 2');

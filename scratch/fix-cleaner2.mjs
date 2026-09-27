import fs from 'fs';
let c = fs.readFileSync('src/pages/CleanerPage.tsx', 'utf8');

c = c.replace(/setCleaner\(\{ categories: \[\]\);/g, 'setCleaner({ categories: [] });');
c = c.replace(/setCleaner\(\{ selected: new Set\( \}\)\);/g, 'setCleaner({ selected: new Set() });');
c = c.replace(/setCleaner\(\{ elapsedSec: \(s \}\) => s \+ 1\), 1000\);/g, 'setCleaner({ elapsedSec: useSessionStore.getState().cleaner.elapsedSec + 1 }); }, 1000);');
c = c.replace(/setCleaner\(\{ scanLive: \(prev \}\) => \(\{ \.\.\.prev, \.\.\.p \}\)\);/g, 'setCleaner({ scanLive: { ...useSessionStore.getState().cleaner.scanLive, ...p } });');
c = c.replace(/setCleaner\(\{ categories: results\);/g, 'setCleaner({ categories: results });');
c = c.replace(/setCleaner\(\{ selected: allIds \}\);/g, 'setCleaner({ selected: new Set(allIds) });');
c = c.replace(/setCleaner\(\{ scanPct: Math\.min\(95, Math\.round\(\(doneCount \/ total \}\) \* 95\)\)\);/g, 'setCleaner({ scanPct: Math.min(95, Math.round((doneCount / total) * 95)) });');
c = c.replace(/setCleaner\(\{ selected: new Set\(categories\.map\(\(c \}\) => c\.id\)\)\);/g, 'setCleaner({ selected: new Set(categories.map((c) => c.id)) });');

// setCategories(prev => ...) was replaced with setCleaner({ categories: (function(prev) { ...
// Let's find this and fix it.
c = c.replace(/setCleaner\(\{ categories: \(function\(prev\) \{([\s\S]*?)const existing = prev\.find\(\(c\) => c\.id === evt\.id\);([\s\S]*?)\}\)\);/g, 
  `const prev = useSessionStore.getState().cleaner.categories;
          const existing = prev.find((c) => c.id === evt.id);
          $2
          setCleaner({ categories: prev }); // Wait this is wrong.
`);

// To fix it perfectly, I'll restore the file to before my messy regex and do it right.

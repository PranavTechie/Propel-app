import fs from 'fs';

let content = fs.readFileSync('src/pages/MemoryPage.tsx', 'utf8');

// Add import
if (!content.includes('useSessionStore')) {
  content = content.replace(
    'import { useAppStore } from "@/store/appStore";',
    'import { useAppStore } from "@/store/appStore";\nimport { useSessionStore } from "@/store/sessionStore";'
  );
}

// Replace useState declarations
content = content.replace(
  '  const [memStats, setMemStats] = useState<MemoryDetails | null>(null);',
  `  const { memStats, processes, lastOptimization, perfMode } = useSessionStore(s => s.memory);
  const setMemory = useSessionStore(s => s.setMemory);`
);
content = content.replace(
  '  const [processes, setProcesses] = useState<ProcessMemInfo[]>([]);',
  ''
);
content = content.replace(
  /  const \[optimizeResult, setOptimizeResult\] =\s*useState<OptimizationResult \| null>\(null\);/g,
  ''
);
content = content.replace(
  '  const [perfMode, setPerfMode] = useState(false);',
  ''
);

// Replace setters
content = content.replace(/setMemStats\((.*?)\)/g, 'setMemory({ memStats: $1 })');
content = content.replace(/setProcesses\((.*?)\)/g, 'setMemory({ processes: $1 })');
content = content.replace(/setOptimizeResult\((.*?)\)/g, 'setMemory({ lastOptimization: $1 })');
content = content.replace(/setPerfMode\((.*?)\)/g, 'setMemory({ perfMode: $1 })');

// Change references to optimizeResult to lastOptimization
content = content.replace(/optimizeResult/g, 'lastOptimization');

fs.writeFileSync('src/pages/MemoryPage.tsx', content);
console.log('MemoryPage.tsx updated successfully');

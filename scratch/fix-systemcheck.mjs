import fs from 'fs';

let content = fs.readFileSync('src/pages/SystemCheckPage.tsx', 'utf8');

content = content.replace(
  'const [data, setData] = useState<FullScanData | null>(null);',
  ''
);
content = content.replace(
  'const [error, setError] = useState<string | null>(null);',
  ''
);
content = content.replace(
  'const [lastScanTime, setLastScanTime] = useState<Date | null>(null);',
  ''
);

content = content.replace(/setData\(/g, 'setSystemCheck({ data: ');
content = content.replace(/setLastScanTime\((.*?)\)/g, 'setSystemCheck({ lastScanTime: $1 })');
content = content.replace(/setError\((.*?)\)/g, 'setSystemCheck({ error: $1 })');

// Fix the setter object syntax (since we replaced setData(result.data) -> setSystemCheck({ data: result.data) - missing closing brace)
content = content.replace(/setSystemCheck\({ data: result.data\);/g, 'setSystemCheck({ data: result.data });');

// Actually, let's just do a clean regex replacement for the runScan block
const runScanTarget = `  const runScan = useCallback(async () => {
    setScanning(true);
    setSystemCheck({ error: null });
    try {
      const result = await window.propel.systemCheck.runFull();
      if (result.ok) {
        setSystemCheck({ data: result.data, lastScanTime: new Date() });
      } else {
        setSystemCheck({ error: result.error ?? "Scan failed" });
      }
    } catch (e: any) {
      setSystemCheck({ error: e?.message ?? "Unexpected error" });
    } finally {
      setScanning(false);
    }
  }, [setSystemCheck]);`;

// Since there's CRLF vs LF, we just replace everything from `const runScan = ` to `  }, []);`
content = content.replace(
  /const runScan = useCallback[\s\S]*?\}, \[\]\);/,
  runScanTarget
);

fs.writeFileSync('src/pages/SystemCheckPage.tsx', content);
console.log('SystemCheckPage.tsx updated successfully');

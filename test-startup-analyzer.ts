import { analyzeStartup } from './electron/services/ai/startupAnalyzerService';

async function run() {
  console.log("Analyzing startup...");
  const start = Date.now();
  const analysis = await analyzeStartup();
  const end = Date.now();
  console.log(`Scan duration: ${end - start}ms`);
  console.log(JSON.stringify(analysis, null, 2));
}

run();

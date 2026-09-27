import { setStartupEntryEnabled } from '../electron/services/ai/startupAnalyzerService';

async function test() {
  console.log('Testing injection fix...');
  const maliciousEntry = {
    id: 'HKCU_Run_Malicious',
    name: "My App'; Write-Host 'PWNED'",
    displayName: "My App'; Write-Host 'PWNED'",
    command: "C:\\path\\to\\app.exe",
    location: 'HKCU_Run',
    enabled: true,
    impact: 'low',
    impactLabel: 'Low Impact',
    estimatedDelaySec: 0.5,
    recommendation: '',
    publisher: ''
  };

  try {
    // This should NOT execute Write-Host 'PWNED' or crash due to syntax errors
    const success = await setStartupEntryEnabled(maliciousEntry as any, false);
    console.log('Toggle success:', success);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

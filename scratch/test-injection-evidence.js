const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function testInjection() {
  const maliciousName = "My App'; Write-Host 'PWNED'";
  const maliciousCmd = "C:\\path\\to\\app.exe -silent";

  const b64Name = Buffer.from(maliciousName).toString('base64');
  const b64Command = Buffer.from(maliciousCmd).toString('base64');

  console.log('==========================================');
  console.log('--- TEST 1: SETTING MALICIOUS ENTRY ---');
  const setScript = `
$name = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Name}'))
$cmd = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Command}'))
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name $name -Value $cmd -ErrorAction Stop
Write-Host "Set operation successful, PWNED was not executed."
  `.trim();

  const setEncoded = Buffer.from(setScript, 'utf16le').toString('base64');

  try {
    const { stdout, stderr } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', setEncoded
    ]);
    console.log(stdout.trim());
  } catch (err) {
    console.error('Error during set:', err.message);
  }

  console.log('\n--- TEST 2: READING BACK ENTRY ---');
  // Safe read back
  const readScript = `
$targetName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Name}'))
$runKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$props = Get-ItemProperty -Path $runKey -ErrorAction Stop
$props.PSObject.Properties | Where-Object { $_.Name -eq $targetName } | ForEach-Object {
  "$($_.Name)|||$($_.Value)"
}
  `.trim();

  const readEncoded = Buffer.from(readScript, 'utf16le').toString('base64');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', readEncoded
    ]);
    console.log('Read back output from Windows Registry:');
    console.log(stdout.trim());
  } catch (err) {
    console.error('Error during read:', err.message);
  }

  console.log('\n--- TEST 3: CLEANUP ---');
  const cleanScript = `
$targetName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Name}'))
Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name $targetName -ErrorAction SilentlyContinue
  `.trim();
  const cleanEncoded = Buffer.from(cleanScript, 'utf16le').toString('base64');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', cleanEncoded]);
  console.log('Cleanup complete.');
  console.log('==========================================');
}

testInjection();

const { execFile } = require('child_process');

execFile('powershell.exe', [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  '& { param($name, $cmd) Write-Output "Name: $name, Cmd: $cmd" }',
  '-args', "my'name", 'my cmd'
], (err, stdout, stderr) => {
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
});

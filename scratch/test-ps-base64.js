const { execFile } = require("child_process");

const script = `
param($name, $cmd)
Write-Output "Name: $name, Cmd: $cmd"
`;

// we can't easily pass args to EncodedCommand.
// But we can just embed the base64 encoded strings IN the powershell script!
// Like:
// $name = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("base64"))
const b64Name = Buffer.from("my'name").toString("base64");
const b64Cmd = Buffer.from("my cmd").toString("base64");

const safeScript = `
$name = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Name}'))
$cmd = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Cmd}'))
Write-Output "Name: $name, Cmd: $cmd"
`;

const encodedCommand = Buffer.from(safeScript, "utf16le").toString("base64");

execFile(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
  (err, stdout, stderr) => {
    console.log("stdout:", stdout);
    console.log("stderr:", stderr);
  },
);

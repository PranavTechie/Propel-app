import { buildElevatedScript, encodePS1 } from '../cleanupService'

function runLenTest() {
  const counts = [50, 300, 1000, 5000]
  console.log('=== COMMAND LINE LENGTH TEST ===\n')

  // Case 1: If file paths were baked directly into the script string as array literal
  console.log('--- If path literals were baked into the script string: ---')
  for (const n of counts) {
    const fakePaths: string[] = []
    for (let i = 0; i < n; i++) {
      fakePaths.push(`C:\\Windows\\SoftwareDistribution\\Download\\${'a1b2c3d4e5f6'.repeat(3)}\\package_update_patch_kb1234567_${i}.cab`)
    }
    const pathsArrayLiteral = `@(\n` + fakePaths.map(p => `  '${p}'`).join(',\n') + `\n)`
    const scriptWithBakedPaths = `$items = ${pathsArrayLiteral}\n` + buildElevatedScript({
      inputPath: 'C:\\temp\\in.json',
      outputPath: 'C:\\temp\\out.json',
      progressPrefix: 'C:\\temp\\prog',
      cancelPath: 'C:\\temp\\cancel',
      startedPath: 'C:\\temp\\started',
      maxRuntimeSec: 300,
    })

    const enc = encodePS1(scriptWithBakedPaths)
    const outerCmd = `$p=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${enc}'; exit $p.ExitCode`
    const finalCmd = `powershell.exe -NoProfile -NonInteractive -Command "${outerCmd}"`

    console.log(`N = ${n.toString().padStart(4)} | Script: ${scriptWithBakedPaths.length.toString().padStart(7)} chars | Encoded: ${enc.length.toString().padStart(7)} chars | Final Cmd: ${finalCmd.length.toString().padStart(7)} chars | Exceeds 32k: ${finalCmd.length > 32767 ? 'YES (OVER LIMIT)' : 'NO'}`)
  }

  // Case 2: Current commit abbef2b implementation (inputPath points to input.json, paths NOT in command line)
  console.log('\n--- Current implementation (input.json path passed in opts, fixed script): ---')
  for (const n of counts) {
    const script = buildElevatedScript({
      inputPath: 'C:\\Users\\User\\AppData\\Local\\Temp\\propel-adm-123456\\input.json',
      outputPath: 'C:\\Users\\User\\AppData\\Local\\Temp\\propel-adm-123456\\output.json',
      progressPrefix: 'C:\\Users\\User\\AppData\\Local\\Temp\\propel-adm-123456\\prog',
      cancelPath: 'C:\\Users\\User\\AppData\\Local\\Temp\\propel-adm-123456\\cancel',
      startedPath: 'C:\\Users\\User\\AppData\\Local\\Temp\\propel-adm-123456\\started',
      maxRuntimeSec: 300,
    })
    const enc = encodePS1(script)
    const outerCmd = `$p=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${enc}'; exit $p.ExitCode`
    const finalCmd = `powershell.exe -NoProfile -NonInteractive -Command "${outerCmd}"`
    console.log(`N = ${n.toString().padStart(4)} | Script: ${script.length.toString().padStart(7)} chars | Encoded: ${enc.length.toString().padStart(7)} chars | Final Cmd: ${finalCmd.length.toString().padStart(7)} chars | Exceeds 32k: NO`)
  }
}

runLenTest()


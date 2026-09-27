const si = require('systeminformation');

// ── Known game process patterns ──────────────────────────────────────────
const GAME_PATTERNS = [
  // Game launchers / games
  'steam', 'epicgameslauncher', 'gog', 'battlenet', 'battle.net', 'origin', 'ea_desktop',
  // Common game engine executables & generic game markers
  'ue4', 'ue5', 'unity', 'unreal',
  // High-resource processes (CPU or GPU-heavy) that are likely games
  // These are detected dynamically by cpu usage threshold
]

// Process names that are definitely NOT games
const EXCLUDE_PATTERNS = [
  'system', 'idle', 'smss', 'csrss', 'wininit', 'winlogon', 'lsass', 'services',
  'svchost', 'dwm', 'audiodg', 'registry', 'msmpsvc', 'msmpeng', 'antimalware',
  'explorer', 'taskmgr', 'cmd', 'powershell', 'pwsh', 'node', 'python',
  'code', 'devenv', 'chrome', 'firefox', 'msedge', 'opera', 'brave', 'vivaldi',
  'slack', 'discord', 'teams', 'zoom', 'spotify', 'vlc', 'obs',
]

async function detectGames() {
  const [processData, memData] = await Promise.all([si.processes(), si.mem()])
  const totalRam = memData.total || 1

  const games = []

  for (const p of processData.list) {
    const nameLower = p.name.toLowerCase().replace('.exe', '')

    // Skip known non-game processes
    if (EXCLUDE_PATTERNS.some(ex => nameLower.includes(ex))) continue

    // Check if it's a known game launcher/pattern
    const isKnownGame = GAME_PATTERNS.some(gp => nameLower.includes(gp))

    // Also detect by high CPU usage (>10% sustained) from non-system processes
    // and significant memory footprint (>200MB)
    const isHighResourceApp =
      p.cpu > 10 &&
      p.mem > 1 && // mem is a percentage
      !EXCLUDE_PATTERNS.some(ex => nameLower.includes(ex))

    if (isKnownGame || isHighResourceApp) {
      const memBytes = Math.round((p.mem / 100) * totalRam)
      games.push({
        pid: p.pid,
        name: p.name,
        displayName: p.name.replace(/\.exe$/i, ''),
        cpuPercent: Math.round(p.cpu * 10) / 10,
        memPercent: Math.round(p.mem * 10) / 10,
        memBytes,
        reason: isKnownGame ? 'Known Pattern' : 'High Resource'
      })
    }
  }

  // Sort by CPU usage desc, take top 3
  games.sort((a, b) => b.cpuPercent - a.cpuPercent)
  const topGames = games.slice(0, 3)

  console.log(JSON.stringify({ detected: topGames.length > 0, games: topGames }, null, 2))
}

detectGames().catch(console.error);

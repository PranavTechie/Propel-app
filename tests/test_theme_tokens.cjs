/**
 * test_theme_tokens.cjs
 *
 * Guards the light/dark token sets in src/styles/tokens.css:
 *  (a) every CSS variable defined in the LIGHT block also exists in the DARK
 *      block, and vice versa;
 *  (b) key text/background pairs meet WCAG contrast in BOTH themes
 *      (body text 4.5:1, UI parts 3:1).
 *
 * Run: node tests/test_theme_tokens.cjs   (exit 1 on any failure)
 */
const fs = require('fs')
const path = require('path')

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '') // strip comments

let failures = 0
const pass = (msg) => console.log(`[PASS] ${msg}`)
const fail = (msg) => { failures++; console.log(`[FAIL] ${msg}`) }

// ── Parse blocks ───────────────────────────────────────────────────────────
function blockBody(selectorRegex) {
  const m = css.match(selectorRegex)
  if (!m) throw new Error(`Block not found: ${selectorRegex}`)
  return m[1]
}
function parseVars(body) {
  const vars = {}
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m
  while ((m = re.exec(body))) vars[m[1]] = m[2].trim().replace(/\s+/g, ' ')
  return vars
}

const primitives = parseVars(blockBody(/:root\s*\{([\s\S]*?)\n\}/))
const light = parseVars(blockBody(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/))
const dark = parseVars(blockBody(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/))

// ── (a) Variable parity ────────────────────────────────────────────────────
const missingInDark = Object.keys(light).filter((k) => !(k in dark))
const missingInLight = Object.keys(dark).filter((k) => !(k in light))
if (missingInDark.length) fail(`Defined in light but missing in dark: ${missingInDark.join(', ')}`)
else pass(`All ${Object.keys(light).length} light variables exist in dark`)
if (missingInLight.length) fail(`Defined in dark but missing in light: ${missingInLight.join(', ')}`)
else pass(`All ${Object.keys(dark).length} dark variables exist in light`)

// ── Color resolution ───────────────────────────────────────────────────────
function resolve(theme, name, depth = 0) {
  if (depth > 10) throw new Error(`Circular reference at ${name}`)
  const raw = theme[name] ?? primitives[name]
  if (raw == null) throw new Error(`Undefined variable ${name}`)
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/i)
  if (ref) return resolve(theme, ref[1], depth + 1)
  const ch = raw.match(/^(\d+)\s+(\d+)\s+(\d+)$/)
  if (!ch) throw new Error(`${name} is not an RGB channel triplet: "${raw}"`)
  return ch.slice(1, 4).map(Number)
}
function luminance([r, g, b]) {
  const lin = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// ── (b) Contrast pairs ─────────────────────────────────────────────────────
const TEXT = 4.5
const UI = 3
const surfaces = ['--c-surface-base', '--c-surface-raised', '--c-surface-overlay']
const pairs = []
for (const fg of ['--c-fg-1', '--c-fg-2', '--c-fg-3']) {
  for (const bg of surfaces) pairs.push([fg, bg, TEXT, 'text'])
}
pairs.push(
  ['--c-fg-on-brand', '--c-brand-solid', TEXT, 'text'],
  ['--c-fg-on-brand', '--c-brand-solid-top', TEXT, 'text'],
  ['--c-fg-on-danger', '--c-danger', TEXT, 'text'],
  ['--c-brand-fg', '--c-brand-soft', TEXT, 'text'],
  ['--c-success-fg', '--c-success-soft', TEXT, 'text'],
  ['--c-warning-fg', '--c-warning-soft', TEXT, 'text'],
  ['--c-danger-fg', '--c-danger-soft', TEXT, 'text'],
  ['--c-brand', '--c-surface-raised', UI, 'UI'],
  ['--c-brand', '--c-surface-base', UI, 'UI'],
  ['--c-success', '--c-surface-raised', UI, 'UI'],
  ['--c-warning', '--c-surface-raised', UI, 'UI'],
  ['--c-danger', '--c-surface-raised', UI, 'UI'],
  ['--c-chart-1', '--c-surface-raised', UI, 'UI'],
  ['--c-chart-2', '--c-surface-raised', UI, 'UI'],
)

for (const [themeName, theme] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min, kind] of pairs) {
    try {
      const ratio = contrast(resolve(theme, fg), resolve(theme, bg))
      const label = `${themeName}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (${kind} >= ${min})`
      ratio >= min ? pass(label) : fail(label)
    } catch (e) {
      fail(`${themeName}: ${fg} on ${bg} could not be resolved (${e.message})`)
    }
  }
}

console.log('')
if (failures) {
  console.log(`--- THEME TOKEN TEST FAILED: ${failures} problem(s) ---`)
  process.exit(1)
}
console.log('--- ALL THEME TOKEN TESTS PASSED ---')

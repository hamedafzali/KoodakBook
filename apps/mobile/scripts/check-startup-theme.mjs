// Static regression check for the startup theme flash (2026-09-25).
// Run: npm run check:theme   (from apps/mobile). No dependencies.
//
// Guards the invariants that keep the first visible frame on the app's real
// background: one page colour from the native splash to Home, and no timer or
// intermediate scene in between. See the comment above RootLayout in
// app/_layout.tsx for the flash this prevents.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
// Code only: comments may legitimately name the old values they replaced.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg) }

const theme = read('lib/theme.ts')
const pageBlock = theme.match(/export const page = \{([\s\S]*?)\n\}/)?.[1] ?? ''
const base = pageBlock.match(/base:\s*'(#[0-9A-Fa-f]{6})'/)?.[1]
const gradient = [...(pageBlock.match(/gradient:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1])
check(base, 'lib/theme.ts: `page.base` not found')
check(gradient.length === 3, 'lib/theme.ts: `page.gradient` must have three stops')
check(base && gradient[1]?.toLowerCase() === base.toLowerCase(), 'lib/theme.ts: page.base must equal the gradient\'s middle stop')

const app = JSON.parse(read('app.json')).expo
const splash = (app.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1]
check(app.backgroundColor?.toLowerCase() === base?.toLowerCase(), `app.json: expo.backgroundColor (${app.backgroundColor}) must equal page.base (${base})`)
check(splash?.backgroundColor?.toLowerCase() === base?.toLowerCase(), `app.json: expo-splash-screen backgroundColor (${splash?.backgroundColor}) must equal page.base (${base})`)

const layout = read('app/_layout.tsx')
const code = stripComments(layout)
check(!/setTimeout\s*\(/.test(code), 'app/_layout.tsx: no setTimeout in the root layout (no timed hold of any startup screen)')
check(!/LaunchScreen/.test(code), 'app/_layout.tsx: LaunchScreen must not be rendered on the startup path')
check(/contentStyle:\s*\{\s*backgroundColor:\s*page\.base\s*\}/.test(code), 'app/_layout.tsx: root Stack needs contentStyle backgroundColor page.base (else React Navigation paints its default grey)')
// RootLayout itself (the ErrorBoundary below it has its own, crash-only hide).
const rootCode = code.split('export function ErrorBoundary')[0]
const hides = rootCode.match(/SplashScreen\.hideAsync\(/g) ?? []
check(hides.length === 1 && /onLayoutRoot[\s\S]*?SplashScreen\.hideAsync\(/.test(rootCode), 'app/_layout.tsx: RootLayout hides the splash exactly once, from the root onLayout')

// 2026-09-27: the navigation theme. The root Stack's contentStyle reaches
// neither nested Stacks nor each native ScreenStack's own container (shown
// during transitions); only the theme's `background` does.
check(/<ThemeProvider value=\{NAV_THEME\}>/.test(code) && /background:\s*page\.base/.test(code), 'app/_layout.tsx: wrap the Stack in ThemeProvider with NAV_THEME (colors.background page.base), else React Navigation\'s grey shows in nested stacks and transitions')
check(/export function ErrorBoundary/.test(code) && /ErrorBoundary[\s\S]*SplashScreen\.hideAsync\(/.test(code), 'app/_layout.tsx: export the root ErrorBoundary, and let it hide the splash (a crash before the first layout must not leave the splash up)')
// Every nested Stack sets its own page colour explicitly.
const layouts = []
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel)
    else if (e.name === '_layout.tsx' && rel !== path.join('app', '_layout.tsx')) layouts.push(rel)
  }
}
walk('app')
for (const f of layouts) {
  const src = stripComments(read(f))
  check(!/<Stack\b/.test(src) || /contentStyle:\s*\{\s*backgroundColor:/.test(src), `${f}: a nested Stack needs screenOptions contentStyle backgroundColor`)
}
check(fs.existsSync(path.join(root, 'app/+not-found.tsx')), 'app/+not-found.tsx: keep the themed not-found route (expo-router\'s default is a white English page)')

const index = stripComments(read('app/index.tsx'))
check(/<ScreenBackground variant="warm">/.test(index) && !/colors\.bg/.test(index), 'app/index.tsx: the auth gate must render on ScreenBackground warm, not colors.bg')
check(/\.catch\(/.test(index), 'app/index.tsx: the auth gate must handle a failed token read (else the startup spinner never ends)')

const home = read('app/home.tsx')
const loading = home.slice(home.indexOf('if (!child) {'), home.indexOf('if (!child) {') + 1200)
check(/<ScreenBackground variant="warm">/.test(loading), 'app/home.tsx: the loading/error state must render on ScreenBackground warm')

// 2026-09-28: the parent area never paints a frame it shouldn't. Every parent
// sub-screen decides "locked?" during render (a focus effect runs after the
// first paint, so a locked deep link used to show the page for a frame before
// the PIN), and the hub's pre-PIN loading frame is the gate's own backdrop.
for (const e of fs.readdirSync(path.join(root, 'app/parent'))) {
  if (!e.endsWith('.tsx') || e === '_layout.tsx' || e === 'index.tsx') continue
  const src = stripComments(read(path.join('app/parent', e)))
  check(/const allowed = isParentUnlocked\(\)/.test(src) && /if \(!allowed\) return/.test(src), `app/parent/${e}: gate on isParentUnlocked() during render (const allowed = ...; if (!allowed) return ...)`)
}
const hub = stripComments(read('app/parent/index.tsx'))
check(/unlocked \? parentUI\.page : PIN_BACKDROP/.test(hub), 'app/parent/index.tsx: the hub\'s loading frame before the PIN must use the gate\'s PIN_BACKDROP (no cream flash before the dark gate)')
const settings = stripComments(read('app/parent/settings.tsx'))
check(/prefsReady\(\)/.test(settings), 'app/parent/settings.tsx: wait for prefsReady() before showing the goal/language (no default-then-stored swap)')

const bg = stripComments(read('components/ScreenBackground.tsx'))
check(/warm:\s*page\.gradient/.test(bg), 'components/ScreenBackground.tsx: warm must read page.gradient (no literal stops)')

if (failures.length) {
  console.error('check-startup-theme: FAIL\n' + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log(`check-startup-theme: OK (page.base ${base}; splash, root view, navigation theme, nested stacks, auth gate, not-found and Home loading all on the page background; no timed startup hold; parent screens gate the PIN at render)`)

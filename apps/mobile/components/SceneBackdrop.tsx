import { StyleSheet, View } from 'react-native'
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText,
} from 'react-native-svg'
import type { SceneSlug, SceneTime } from '@koodakbook/shared'

/**
 * The 12-scene story backdrop library (web: components/child/SceneBackdrop),
 * drawn programmatically so pages without a real image still get an
 * illustration — zero image downloads. Ported to react-native-svg; the slow
 * Ken Burns / parallax motion is dropped for a clean static scene.
 */
interface Palette { sky: [string, string]; ground: string; accent: string; dark: boolean }

const DAY: Record<SceneSlug, Palette> = {
  forest: { sky: ['#bae6fd', '#dcfce7'], ground: '#4ade80', accent: '#166534', dark: false },
  home: { sky: ['#bae6fd', '#fef9c3'], ground: '#86efac', accent: '#f97316', dark: false },
  room: { sky: ['#fef3c7', '#fde68a'], ground: '#fbbf24', accent: '#8b5cf6', dark: false },
  school: { sky: ['#bae6fd', '#e0f2fe'], ground: '#a3e635', accent: '#ef4444', dark: false },
  park: { sky: ['#93c5fd', '#dbeafe'], ground: '#4ade80', accent: '#f472b6', dark: false },
  sea: { sky: ['#7dd3fc', '#e0f2fe'], ground: '#38bdf8', accent: '#fbbf24', dark: false },
  mountain: { sky: ['#93c5fd', '#e9d5ff'], ground: '#a78bfa', accent: '#f8fafc', dark: false },
  bazaar: { sky: ['#fed7aa', '#fef3c7'], ground: '#fdba74', accent: '#dc2626', dark: false },
  kitchen: { sky: ['#fef3c7', '#ffedd5'], ground: '#fdba74', accent: '#16a34a', dark: false },
  garden: { sky: ['#bbf7d0', '#dcfce7'], ground: '#86efac', accent: '#ec4899', dark: false },
  city: { sky: ['#bae6fd', '#f1f5f9'], ground: '#94a3b8', accent: '#f59e0b', dark: false },
  sky: { sky: ['#7dd3fc', '#dbeafe'], ground: '#e0f2fe', accent: '#fbbf24', dark: false },
}

const NIGHT = Object.fromEntries(
  (Object.keys(DAY) as SceneSlug[]).map((k) => [
    k, { sky: ['#1e293b', '#475569'] as [string, string], ground: '#334155', accent: DAY[k].accent, dark: true },
  ])
) as Record<SceneSlug, Palette>

function SceneShapes({ scene, p }: { scene: SceneSlug; p: Palette }) {
  const g = p.ground
  const a = p.accent
  switch (scene) {
    case 'forest':
      return (
        <>
          <Ellipse cx="80" cy="200" rx="130" ry="60" fill={g} />
          <Ellipse cx="320" cy="210" rx="160" ry="70" fill={g} opacity="0.85" />
          {[60, 150, 250, 330].map((x, i) => (
            <G key={x}>
              <Rect x={x - 5} y={120 + (i % 2) * 14} width="10" height="46" rx="4" fill="#92400e" />
              <Circle cx={x} cy={104 + (i % 2) * 14} r={30 - (i % 2) * 6} fill={a} opacity={p.dark ? 0.7 : 1} />
            </G>
          ))}
        </>
      )
    case 'home':
      return (
        <>
          <Ellipse cx="200" cy="215" rx="230" ry="55" fill={g} />
          <Rect x="140" y="110" width="120" height="80" rx="8" fill="#fef3c7" stroke={a} strokeWidth="4" />
          <Path d="M128 116 L200 62 L272 116 Z" fill={a} />
          <Rect x="186" y="150" width="28" height="40" rx="4" fill={a} />
          <Rect x="152" y="126" width="22" height="20" rx="3" fill={p.dark ? '#fde68a' : '#bae6fd'} />
          <Rect x="226" y="126" width="22" height="20" rx="3" fill={p.dark ? '#fde68a' : '#bae6fd'} />
        </>
      )
    case 'room':
      return (
        <>
          <Rect x="0" y="170" width="400" height="70" fill={g} />
          <Rect x="50" y="120" width="90" height="60" rx="8" fill="#fff" opacity="0.9" />
          <Rect x="58" y="150" width="74" height="30" rx="6" fill={a} opacity="0.8" />
          <Rect x="250" y="96" width="70" height="84" rx="6" fill="#a16207" />
          <Rect x="258" y="104" width="54" height="14" rx="3" fill="#f472b6" />
          <Rect x="258" y="122" width="54" height="14" rx="3" fill="#60a5fa" />
          <Rect x="258" y="140" width="54" height="14" rx="3" fill="#4ade80" />
          <Circle cx="196" cy="86" r="16" fill={p.dark ? '#fde68a' : '#fbbf24'} />
        </>
      )
    case 'school':
      return (
        <>
          <Ellipse cx="200" cy="215" rx="230" ry="55" fill={g} />
          <Rect x="120" y="100" width="160" height="90" rx="8" fill="#fecaca" stroke={a} strokeWidth="3" />
          <Rect x="184" y="150" width="32" height="40" rx="4" fill={a} />
          <Path d="M192 76 L200 60 L208 76 Z M200 60 L200 100" stroke={a} strokeWidth="4" fill={a} />
          <Rect x="136" y="118" width="26" height="22" rx="3" fill="#bae6fd" />
          <Rect x="238" y="118" width="26" height="22" rx="3" fill="#bae6fd" />
        </>
      )
    case 'park':
      return (
        <>
          <Ellipse cx="200" cy="212" rx="240" ry="58" fill={g} />
          <Circle cx="90" cy="110" r="30" fill="#4ade80" opacity={p.dark ? 0.6 : 1} />
          <Rect x="85" y="130" width="10" height="40" rx="4" fill="#92400e" />
          <Path d="M240 160 L300 160 M250 160 L250 130 L296 148" stroke={a} strokeWidth="6" strokeLinecap="round" fill="none" />
          <Circle cx="316" cy="166" r="12" fill={a} />
        </>
      )
    case 'sea':
      return (
        <>
          <Rect x="0" y="150" width="400" height="90" fill={g} opacity="0.9" />
          <Path d="M0 156 Q40 146 80 156 T160 156 T240 156 T320 156 T400 156" stroke="#fff" strokeWidth="4" fill="none" opacity="0.6" />
          <Path d="M150 120 L150 70 L196 108 Z" fill={a} />
          <Path d="M120 124 L200 124 L184 148 L136 148 Z" fill={p.dark ? '#94a3b8' : '#f8fafc'} />
          <Circle cx="60" cy="60" r="20" fill={p.dark ? '#e2e8f0' : '#fde047'} opacity="0.9" />
        </>
      )
    case 'mountain':
      return (
        <>
          <Path d="M0 210 L110 80 L220 210 Z" fill={g} />
          <Path d="M110 80 L140 116 L124 116 Z" fill={a} />
          <Path d="M150 210 L280 60 L400 210 Z" fill={g} opacity="0.8" />
          <Path d="M280 60 L312 100 L294 100 Z" fill={a} />
          <Ellipse cx="200" cy="222" rx="240" ry="34" fill={p.dark ? '#1e293b' : '#dcfce7'} />
        </>
      )
    case 'bazaar':
      return (
        <>
          <Ellipse cx="200" cy="218" rx="240" ry="48" fill={g} />
          {[70, 200, 330].map((x, i) => (
            <G key={x}>
              <Rect x={x - 48} y="128" width="96" height="60" rx="6" fill="#fff7ed" stroke="#d6d3d1" />
              <Path d={`M${x - 56} 128 h112 l-10 -24 h-92 Z`} fill={i % 2 ? a : '#16a34a'} />
              <Circle cx={x - 20} cy="150" r="9" fill="#f87171" />
              <Circle cx={x} cy="150" r="9" fill="#fbbf24" />
              <Circle cx={x + 20} cy="150" r="9" fill="#4ade80" />
            </G>
          ))}
        </>
      )
    case 'kitchen':
      return (
        <>
          <Rect x="0" y="168" width="400" height="72" fill={g} />
          <Rect x="60" y="120" width="120" height="48" rx="6" fill="#e7e5e4" />
          <Circle cx="90" cy="132" r="8" fill="#334155" />
          <Circle cx="120" cy="132" r="8" fill="#334155" />
          <Rect x="240" y="90" width="80" height="78" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
          <Path d="M120 96 q10 -18 0 -34" stroke="#94a3b8" strokeWidth="4" fill="none" strokeLinecap="round" />
          <Circle cx="290" cy="60" r="14" fill={a} />
        </>
      )
    case 'garden':
      return (
        <>
          <Ellipse cx="200" cy="212" rx="240" ry="58" fill={g} />
          {[70, 130, 270, 330].map((x, i) => (
            <G key={x}>
              <Rect x={x - 2} y="160" width="5" height="26" fill="#16a34a" />
              <Circle cx={x} cy="152" r="10" fill={i % 2 ? a : '#f472b6'} />
              <Circle cx={x} cy="152" r="4" fill="#fde047" />
            </G>
          ))}
          <Rect x="180" y="120" width="44" height="60" rx="6" fill="#a16207" opacity="0.85" />
          <Path d="M168 122 L202 96 L236 122 Z" fill="#dc2626" />
        </>
      )
    case 'city':
      return (
        <>
          <Rect x="0" y="200" width="400" height="40" fill={g} />
          {[[30, 110, 60], [110, 80, 70], [200, 130, 56], [270, 70, 80], [350, 120, 50]].map(([x, y, w]) => (
            <G key={x}>
              <Rect x={x - w / 2} y={y} width={w} height={200 - y} rx="4" fill={p.dark ? '#475569' : '#cbd5e1'} />
              {[0, 1, 2].map((r) =>
                [0, 1].map((c) => (
                  <Rect key={`${r}${c}`} x={x - w / 2 + 8 + c * (w / 2 - 6)} y={y + 10 + r * 24} width="12" height="14" rx="2" fill={p.dark ? '#fde68a' : '#e0f2fe'} />
                ))
              )}
            </G>
          ))}
          <Circle cx="330" cy="52" r="16" fill={a} />
        </>
      )
    case 'sky':
      return (
        <>
          <Circle cx="70" cy="70" r="24" fill={p.dark ? '#e2e8f0' : '#fde047'} />
          <Path d="M180 150 c0 -30 50 -30 50 0 l-8 34 h-34 Z" fill={a} />
          <Rect x="192" y="184" width="26" height="18" rx="5" fill="#a16207" />
          <Ellipse cx="120" cy="190" rx="70" ry="16" fill="#fff" opacity="0.7" />
          <Ellipse cx="300" cy="120" rx="60" ry="14" fill="#fff" opacity="0.8" />
        </>
      )
    default:
      return null
  }
}

function Floats({ scene, night }: { scene: SceneSlug; night: boolean }) {
  const items = night
    ? [{ x: 40, y: 30, e: '✦' }, { x: 340, y: 24, e: '✦' }, { x: 250, y: 56, e: '✧' }, { x: 120, y: 44, e: '✦' }]
    : scene === 'sea'
      ? [{ x: 60, y: 120, e: '☁️' }, { x: 300, y: 90, e: '☁️' }]
      : [{ x: 70, y: 40, e: '☁️' }, { x: 290, y: 60, e: '☁️' }]
  return (
    <G>
      {items.map((it, i) => (
        <SvgText key={i} x={it.x} y={it.y} fontSize={night ? 16 : 26} opacity={night ? 0.9 : 0.8}>{it.e}</SvgText>
      ))}
      {night && <Circle cx="330" cy="46" r="18" fill="#fef3c7" opacity="0.95" />}
    </G>
  )
}

export default function SceneBackdrop({ scene, time = 'day', style }: {
  scene: SceneSlug
  time?: SceneTime
  style?: object
}) {
  const p = (time === 'night' ? NIGHT : DAY)[scene]
  const gid = `sky-${scene}-${time}`
  return (
    <View style={[styles.wrap, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.sky[0]} />
            <Stop offset="1" stopColor={p.sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="400" height="240" fill={`url(#${gid})`} />
        <Floats scene={scene} night={p.dark} />
        <SceneShapes scene={scene} p={p} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 16 },
})

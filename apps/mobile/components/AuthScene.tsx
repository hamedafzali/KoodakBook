import Svg, { Circle, Ellipse, Path, Rect, G, Text as SvgText } from 'react-native-svg'

/**
 * Auth illustrations ported from web's AuthShell. Login = an open book under a
 * moon and stars (bedtime story); signup = a hot-air balloon of books (a new
 * adventure). Same motifs and colours as web so the two platforms match.
 */
const W = 300
const H = 190

export function StoryScene() {
  return (
    <Svg width={W} height={H} viewBox="0 0 360 240">
      <Circle cx="308" cy="44" r="22" fill="#fef3c7" />
      <Circle cx="298" cy="38" r="20" fill="#f59e0b" opacity="0.15" />
      <SvgText x="40" y="46" fontSize="18">⭐</SvgText>
      <SvgText x="96" y="26" fontSize="12">✨</SvgText>
      <SvgText x="250" y="90" fontSize="14">✨</SvgText>
      <SvgText x="120" y="70" fontSize="30" fontWeight="bold" fill="#fbbf24" opacity="0.9">ب</SvgText>
      <SvgText x="170" y="48" fontSize="24" fontWeight="bold" fill="#fda4af" opacity="0.9">آ</SvgText>
      <SvgText x="212" y="76" fontSize="27" fontWeight="bold" fill="#93c5fd" opacity="0.9">م</SvgText>
      <SvgText x="158" y="100" fontSize="21" fontWeight="bold" fill="#86efac" opacity="0.9">د</SvgText>
      <Path d="M60 150 Q120 122 180 145 Q240 122 300 150 L300 200 Q240 176 180 196 Q120 176 60 200 Z" fill="#fff" />
      <Path d="M60 150 Q120 122 180 145 L180 196 Q120 176 60 200 Z" fill="#fffbeb" />
      <Path d="M180 145 L180 196" stroke="#fde68a" strokeWidth="3" />
      <Path d="M60 150 Q120 122 180 145 Q240 122 300 150" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <Path d="M84 162 q44 -14 82 -4 M84 176 q44 -14 82 -4" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M194 158 q44 -10 82 0 M194 172 q44 -10 82 0" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Ellipse cx="180" cy="216" rx="120" ry="10" fill="#f59e0b" opacity="0.12" />
    </Svg>
  )
}

export function BalloonScene() {
  return (
    <Svg width={W} height={H} viewBox="0 0 360 240">
      <Circle cx="52" cy="42" r="18" fill="#fef9c3" />
      <Ellipse cx="290" cy="50" rx="34" ry="12" fill="#ffffff" opacity="0.85" />
      <Ellipse cx="268" cy="58" rx="24" ry="10" fill="#ffffff" opacity="0.7" />
      <Ellipse cx="86" cy="110" rx="28" ry="10" fill="#ffffff" opacity="0.6" />
      <SvgText x="300" y="120" fontSize="14">✨</SvgText>
      <SvgText x="48" y="160" fontSize="16">⭐</SvgText>
      <Path d="M180 24c-42 0-64 30-64 58 0 34 34 52 48 72h32c14-20 48-38 48-72 0-28-22-58-64-58z" fill="#fff" />
      <Path d="M180 24c-16 0-26 34-26 58 0 32 12 54 18 72h16c6-18 18-40 18-72 0-24-10-58-26-58z" fill="#fbbf24" />
      <Path d="M180 24c-42 0-64 30-64 58 0 34 34 52 48 72" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
      <Path d="M180 24c42 0 64 30 64 58 0 34-34 52-48 72" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
      <Path d="M164 154l-6 26M196 154l6 26" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <Rect x="150" y="178" width="60" height="34" rx="8" fill="#d97706" />
      <Rect x="150" y="178" width="60" height="10" rx="5" fill="#b45309" />
      <G rotation="-8" origin="165, 173">
        <Rect x="158" y="164" width="14" height="18" rx="3" fill="#34d399" />
      </G>
      <Rect x="174" y="162" width="14" height="20" rx="3" fill="#f472b6" />
      <G rotation="8" origin="197, 173">
        <Rect x="190" y="164" width="14" height="18" rx="3" fill="#93c5fd" />
      </G>
      <Path d="M180 8v18" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" />
      <Path d="M180 9l20 5-20 6z" fill="#f43f5e" />
      <Ellipse cx="180" cy="224" rx="90" ry="8" fill="#0d9488" opacity="0.12" />
    </Svg>
  )
}

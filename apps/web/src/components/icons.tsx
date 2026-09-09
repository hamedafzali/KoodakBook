import {
  BookOpen, BookMarked, Library, Pencil, PenLine, Music, Mic, Volume2, Headphones,
  RefreshCw, RotateCcw, Repeat, Hash, Trophy, Star, Flame, GraduationCap, Lock,
  Check, CheckCircle2, X, Dices, DoorOpen, Home, Users, MessageCircle, Share2,
  Sparkles, PartyPopper, Play, Pause, ChevronLeft, ChevronRight, Plus, Minus,
  Languages, ShoppingCart, Gamepad2, Calculator, Cloud, Hand, Send, AlertTriangle,
  Settings, LogOut, User, Baby, Heart, Eye, Trash2, ArrowRight, ArrowLeft,
  Compass, Brain, Globe, Ban, BarChart3, UsersRound, Package, ShieldCheck,
  Gift, Smartphone, Rocket, CalendarDays, Clock, Sun, Moon, Sprout,
  TrendingUp, Handshake, Download, Timer, FileText, Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react'

/* ── KoodakBook icon system ──────────────────────────────────
 *
 * Why this file exists: before it, the apps drew UI affordances with emoji —
 * 781 of them across 125 files. Emoji are a *font*, not a design token. They
 * render differently on every OS (a 🎲 is a white cube on Windows and a red
 * one on iOS), they can't take a color or a stroke weight, they ignore the
 * type scale, and inside an RTL Persian run they force a bidi context switch
 * that can nudge neighbouring glyphs. That is the single biggest reason the
 * UI reads "homemade" — see docs/design-system.md §1.
 *
 * The rule this file enforces: **an emoji may never be a structural icon.**
 * One family (Lucide), one grid (24px), one stroke (2px), colored by
 * `currentColor` so it inherits the module tint like any other token.
 *
 * What is NOT in scope: emoji used as *content* rather than chrome — the
 * apples a child counts in /child/math/counting, the animal characters in
 * the friends row. Those are subject matter, and they belong to real
 * illustration (pixel-wizards-charachters), not to an icon set. Swapping
 * them for outline glyphs would make the learning content worse, not better.
 * Grep for EMOJI-CONTENT to find the ones deliberately left alone. */

/** Every icon the product is allowed to use, under a KoodakBook name.
 *  Adding a glyph here is a deliberate act — it keeps the set small enough
 *  that a child learns the vocabulary instead of re-reading it each time. */
export const ICON = {
  // learning modules (must stay in sync with MODULE in components/child/kit.tsx)
  lessons: Library,
  letters: Pencil,
  phonics: Music,
  stories: BookOpen,
  review: RefreshCw,
  speak: Mic,
  write: PenLine,
  math: Hash,
  games: Gamepad2,
  rewards: Trophy,

  // navigation & chrome
  home: Home,
  friends: Users,
  back: ChevronRight,      // RTL default: "back" points right in Persian
  forward: ChevronLeft,
  next: ChevronLeft,
  prev: ChevronRight,
  ltrBack: ChevronLeft,    // for the LTR admin app
  ltrForward: ChevronRight,
  arrowNext: ArrowLeft,
  arrowPrev: ArrowRight,
  close: X,
  settings: Settings,
  logout: LogOut,
  parent: User,
  child: Baby,

  // state & feedback
  done: Check,
  doneCircle: CheckCircle2,
  locked: Lock,
  streak: Flame,
  star: Star,
  level: GraduationCap,
  sparkle: Sparkles,
  celebrate: PartyPopper,
  warning: AlertTriangle,
  love: Heart,

  // actions
  play: Play,
  pause: Pause,
  listen: Volume2,
  headphones: Headphones,
  record: Mic,
  random: Dices,
  seeAll: DoorOpen,
  share: Share2,
  send: Send,
  message: MessageCircle,
  retry: RotateCcw,
  loop: Repeat,
  add: Plus,
  remove: Minus,
  view: Eye,
  delete: Trash2,

  // content areas
  alphabet: Languages,
  book: BookMarked,
  shop: ShoppingCart,
  counting: Calculator,
  sky: Cloud,
  wave: Hand,

  // marketing & parent-facing
  placement: Compass,
  method: Brain,
  language: Globe,
  noAds: Ban,
  progress: BarChart3,
  family: UsersRound,
  bundle: Package,
  protect: ShieldCheck,
  gift: Gift,
  mobile: Smartphone,
  launch: Rocket,
  calendar: CalendarDays,
  time: Clock,
  day: Sun,
  night: Moon,
  grow: Sprout,
  trend: TrendingUp,
  partner: Handshake,
  save: Download,
  timer: Timer,
  report: FileText,
  image: ImageIcon,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICON

/** Icon sizes, tied to the type scale rather than invented per call site. */
const SIZE = { xs: 14, sm: 18, md: 22, lg: 28, xl: 36, hero: 48 } as const
export type IconSize = keyof typeof SIZE

/**
 * The only way to draw an icon in this app.
 *
 * Decorative by default (`aria-hidden`), because an icon beside a visible
 * label is noise to a screen reader. Pass `label` when the icon is the only
 * thing identifying a control — then it becomes an `img` with a name.
 */
export function Icon({
  name, size = 'md', label, className = '', strokeWidth = 2,
}: {
  name: IconName
  size?: IconSize | number
  /** Accessible name. Omit for icons that sit next to visible text. */
  label?: string
  className?: string
  strokeWidth?: number
}) {
  const Glyph = ICON[name]
  const px = typeof size === 'number' ? size : SIZE[size]
  return (
    <Glyph
      width={px}
      height={px}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}

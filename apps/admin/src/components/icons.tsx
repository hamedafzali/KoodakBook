import {
  BookOpen, Library, PenLine, Volume2, Image as ImageIcon, Search, Mic,
  Users, UsersRound, Baby, Trophy, Check, CheckCircle2, X, AlertTriangle,
  Bot, Send, Mail, Phone, Globe, Hash, EyeOff, Tag, Monitor, Smartphone,
  RefreshCw, Headphones, Paperclip, Save, MessageSquare, Trash2,
  Home, ShieldCheck, CreditCard, Folder, ScrollText, Pencil, Type, FlaskConical,
  Smile, Inbox, LogOut, Plus, ChevronLeft, BarChart3,
  type LucideIcon,
} from 'lucide-react'

/* Admin-side counterpart to apps/web/src/components/icons.tsx.
 *
 * Same rule, same reason: an emoji is a font, not a design token — it can't
 * take a color, a stroke, or a size from the type scale, and inside the RTL
 * Persian copy that fills this dashboard it forces a bidi context switch on
 * every line. The admin set is deliberately *smaller* than the web one; this
 * is an internal tool, and a status column only needs to say one thing.
 *
 * The two files are separate on purpose: admin and web share no component
 * layer, and admin should not inherit the child-facing vocabulary (streaks,
 * mascots, celebration) that means nothing on a data table.
 *
 * This replaces the hand-rolled inline-path set that lived here before. Same
 * intent, three gains: the names are now a *type* (a typo is a build error
 * instead of a silent fall-through to the home icon), the glyphs come from the
 * same Lucide family the web app draws from, and adding one is an import
 * rather than hand-authored path data. Every name the old set exposed is kept
 * below so existing call sites keep working. */
export const ICON = {
  // records
  words: PenLine,
  stories: BookOpen,
  lessons: Library,
  letters: Hash,
  users: Users,
  families: UsersRound,
  children: Baby,
  badges: Trophy,
  characters: MessageSquare,

  // media
  audio: Volume2,
  image: ImageIcon,
  record: Mic,
  headphones: Headphones,
  attach: Paperclip,
  search: Search,

  // status
  ok: Check,
  okCircle: CheckCircle2,
  warning: AlertTriangle,
  error: X,
  hidden: EyeOff,
  tag: Tag,

  // actions
  save: Save,
  remove: Trash2,
  close: X,
  regenerate: RefreshCw,
  send: Send,

  // leads / channels
  ai: Bot,
  email: Mail,
  phone: Phone,
  country: Globe,
  tablet: Monitor,
  mobile: Smartphone,
  count: Hash,

  // names carried over from the previous inline set (nav + misc call sites)
  home: Home,
  shield: ShieldCheck,
  chart: BarChart3,
  scroll: ScrollText,
  card: CreditCard,
  folder: Folder,
  book: BookOpen,
  pencil: Pencil,
  type: Type,
  flask: FlaskConical,
  smile: Smile,
  inbox: Inbox,
  volume: Volume2,
  logout: LogOut,
  add: Plus,
  chevron: ChevronLeft,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICON

const SIZE = { xs: 13, sm: 15, md: 18, lg: 22, xl: 28 } as const
export type IconSize = keyof typeof SIZE

/** The only way to draw an icon in the admin app. Decorative by default —
 *  pass `label` when the icon is the only thing naming a control. */
export function Icon({
  name, size = 'sm', label, className = '', strokeWidth = 2,
}: {
  name: IconName
  size?: IconSize | number
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
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}

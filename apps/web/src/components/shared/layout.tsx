import type { ReactNode } from 'react'

/**
 * Shared layout layer — the single source of truth for content *measure*
 * (max readable/working width per surface). Width ownership lives here, not
 * hard-coded per page or in a route layout, so a page declares intent
 * ("wide dashboard" vs "reading column") and the desktop composition follows.
 *
 * All sizes are no-ops below `lg` (w-full) → mobile composition is unchanged;
 * the constraint + centring only engage on laptop/desktop/ultrawide. Ultrawide
 * is capped so content never sprawls.
 */
export const containerWidths = {
  prose: 'w-full lg:max-w-2xl  lg:mx-auto',   // forms, dense reading (~672)
  app:   'w-full lg:max-w-[880px] lg:mx-auto', // standard reading column
  wide:  'w-full lg:max-w-[1400px] lg:mx-auto', // multi-column dashboards
  full:  'w-full',
} as const

export type ContainerSize = keyof typeof containerWidths

/** Wrapper variant for pages that compose content inside a bg/scroll root. */
export function Container({ size = 'app', className = '', children }:
  { size?: ContainerSize; className?: string; children: ReactNode }) {
  return <div className={`${containerWidths[size]} ${className}`}>{children}</div>
}

import { query } from './db'

/**
 * Record an admin action against a user/child record (mig-022). Fail-safe: an
 * audit write must never break the action it describes.
 */
export async function logAudit(
  adminEmail: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `insert into audit_log (admin_email, action, target_type, target_id, detail)
       values ($1, $2, $3, $4, $5)`,
      [adminEmail || 'unknown', action, targetType, targetId, JSON.stringify(detail)],
    )
  } catch (err) {
    console.error('audit log write failed:', action, err)
  }
}

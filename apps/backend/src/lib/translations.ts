import { query } from './db'

/**
 * Read access to the language-agnostic content model (migration 009).
 *
 * NOT yet wired into the curriculum routes — those still read the legacy
 * persian/english columns. This is the read path the cutover will switch to
 * (see docs/i18n-plan.md). Kept here so the cutover is a localized change.
 */
export type EntityType = 'word' | 'letter' | 'story' | 'story_page'

export type FieldMap = Record<string, string>            // field -> value
export type TranslationMap = Record<string, FieldMap>     // entity_id -> fields

/** Fetch all fields for the given entities in one locale, keyed by entity_id. */
export async function getTranslations(
  entityType: EntityType,
  entityIds: string[],
  locale: string,
): Promise<TranslationMap> {
  if (entityIds.length === 0) return {}
  const rows = await query<{ entity_id: string; field: string; value: string }>(
    `select entity_id, field, value
       from content_translations
      where entity_type = $1 and locale = $2 and entity_id = any($3)`,
    [entityType, locale, entityIds]
  )
  const out: TranslationMap = {}
  for (const r of rows) {
    ;(out[r.entity_id] ??= {})[r.field] = r.value
  }
  return out
}

/** Locales known to the system, with text direction. */
export async function listLocales() {
  return query<{ code: string; name: string; direction: 'ltr' | 'rtl' }>(
    'select code, name, direction from locales order by code'
  )
}

type TxEntry = { locale: string; field: string; value: string | null | undefined }

/**
 * Dual-write: keep content_translations in sync with the legacy columns on
 * every admin create/update. Empty/null clears that translation. Idempotent.
 */
export async function upsertTranslations(
  entityType: EntityType,
  entityId: string,
  entries: TxEntry[],
): Promise<void> {
  for (const e of entries) {
    if (e.value == null || e.value === '') {
      await query(
        'delete from content_translations where entity_type=$1 and entity_id=$2 and locale=$3 and field=$4',
        [entityType, entityId, e.locale, e.field]
      )
      continue
    }
    await query(
      `insert into content_translations (entity_type, entity_id, locale, field, value)
       values ($1,$2,$3,$4,$5)
       on conflict (entity_type, entity_id, locale, field) do update set value = excluded.value`,
      [entityType, entityId, e.locale, e.field, e.value]
    )
  }
}

/** Remove all translations for an entity (call on delete; loose FK = no cascade). */
export async function deleteEntityTranslations(
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  await query('delete from content_translations where entity_type=$1 and entity_id=$2', [entityType, entityId])
}

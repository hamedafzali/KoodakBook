'use client'
import { useMemo, useState, type ReactNode } from 'react'
import { Card, EmptyState } from '@/components/ui'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  align?: 'start' | 'center' | 'end'
  width?: string
}

/** Reusable table: client-side sort + pagination + optional row click. */
export function DataTable<T extends { id?: string }>({
  rows, columns, onRowClick, pageSize = 25, empty = 'موردی یافت نشد',
}: {
  rows: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  pageSize?: number
  empty?: string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col?.sortValue) return rows
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a), vb = col.sortValue!(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = sorted.slice(cur * pageSize, cur * pageSize + pageSize)
  const toggle = (key: string) => setSort(s => s?.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 })
  const alignCls = (a?: string) => a === 'center' ? 'text-center' : a === 'end' ? 'text-left' : 'text-right'

  if (rows.length === 0) return <Card className="p-0"><EmptyState>{empty}</EmptyState></Card>

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ width: c.width }}
                className={`${alignCls(c.align)} px-4 py-3 font-medium ${c.sortValue ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                onClick={() => c.sortValue && toggle(c.key)}>
                {c.header}{sort?.key === c.key && (sort.dir === 1 ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => (
            <tr key={row.id ?? i}
              className={`border-t border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-amber-50/40' : ''}`}
              onClick={() => onRowClick?.(row)}>
              {columns.map(c => (
                <td key={c.key} className={`${alignCls(c.align)} px-4 py-3`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          <span>{sorted.length} مورد · صفحه {cur + 1} از {pages}</span>
          <div className="flex gap-1">
            <button disabled={cur === 0} onClick={() => setPage(cur - 1)}
              className="px-3 py-1 rounded-lg bg-slate-100 disabled:opacity-40 hover:bg-slate-200">قبلی</button>
            <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}
              className="px-3 py-1 rounded-lg bg-slate-100 disabled:opacity-40 hover:bg-slate-200">بعدی</button>
          </div>
        </div>
      )}
    </Card>
  )
}

import type { ReactNode } from 'react'
import { TableSkeleton } from './Skeleton'
import EmptyState from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  sortable?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  actions?: (row: T) => ReactNode
  emptyMessage?: string
  loading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  actions,
  emptyMessage = 'Nada encontrado.',
  loading = false,
  sortKey,
  sortDir,
  onSort,
}: Props<T>) {
  if (loading) {
    return <TableSkeleton rows={5} cols={columns.length || 4} />
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className="rounded-lg border border-slate-800 overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-slate-900/60 border-b border-slate-800">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={[
                  'text-left px-4 py-3 font-medium text-slate-300 text-xs uppercase tracking-wide select-none',
                  c.sortable && onSort ? 'cursor-pointer hover:text-slate-100 group' : '',
                  c.className ?? '',
                ].join(' ')}
                onClick={() => c.sortable && onSort && onSort(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortable && onSort && (
                    <SortIcon active={sortKey === c.key} dir={sortKey === c.key ? (sortDir ?? 'asc') : 'asc'} />
                  )}
                </span>
              </th>
            ))}
            {actions && <th className="w-1 px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={`border-t border-slate-800/60 ${onRowClick ? 'cursor-pointer hover:bg-slate-800/40' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-3 text-slate-200 ${c.className ?? ''}`}
                >
                  {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
              {actions && (
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`transition-opacity ${active ? 'opacity-100 text-brand-400' : 'opacity-0 group-hover:opacity-40'}`}>
      {active && dir === 'desc' ? '↓' : '↑'}
    </span>
  )
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const BOM = '﻿'
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const content = BOM + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

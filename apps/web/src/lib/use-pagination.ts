import { useState } from 'react'

// Splits a (filtered) list into pages.
// When resetKey changes (e.g. a filter changed), it goes back to page 1.
// All data is already loaded, so paging happens in the browser.
export function usePagination<T>(items: T[], resetKey: string, pageSize: number) {
  const [current, setCurrent] = useState({ key: resetKey, page: 1 })

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = current.key === resetKey ? Math.min(current.page, pageCount) : 1
  const start = (page - 1) * pageSize

  return {
    page,
    pageCount,
    pageItems: items.slice(start, start + pageSize),
    // Row numbers shown in "Showing 21–40 of 68"
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    setPage: (next: number) => setCurrent({ key: resetKey, page: next })
  }
}

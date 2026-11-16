import { ChevronLeft, ChevronRight } from 'lucide-react'

// Page numbers to show: always first and last, plus the pages around the current one
function getPageNumbers(page: number, pageCount: number): (number | '...')[] {
  const pages: (number | '...')[] = []

  for (let number = 1; number <= pageCount; number++) {
    if (number === 1 || number === pageCount || Math.abs(number - page) <= 1) {
      pages.push(number)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return pages
}

interface Props {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  // e.g. "records" or "employees"
  label: string
  // Shown when filters hide some rows, e.g. "(68 in total)"
  allCount?: number
  onChange: (page: number) => void
}

export default function Pagination({ page, pageCount, from, to, total, label, allCount, onChange }: Props) {
  return (
    <div className="table-footer pagination">
      <span>
        Showing {from}–{to} of {total} {label}
        {allCount !== undefined && allCount !== total && ` (${allCount} in total)`}
      </span>

      {pageCount > 1 && (
        <nav className="pagination-pages" aria-label="Pages">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {getPageNumbers(page, pageCount).map((number, index) =>
            number === '...' ? (
              <span key={`gap-${index}`} className="pagination-gap">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                className={`btn btn-sm ${number === page ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onChange(number)}
                aria-current={number === page ? 'page' : undefined}
              >
                {number}
              </button>
            )
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}

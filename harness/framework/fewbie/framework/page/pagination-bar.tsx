export interface PaginationBarLabels {
  previous: string;
  next: string;
  pageOf: (page: number, totalPages: number) => string;
  recordCount?: (total: number) => string;
}

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  labels: PaginationBarLabels;
  className?: string;
}

/** Behavioral double of the framework pager used by module conformance tests. */
export function PaginationBar({ page, pageSize, total, onPageChange, labels }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 0), totalPages - 1);
  return (
    <div>
      <span>{labels.recordCount?.(total) ?? null}</span>
      <button type="button" disabled={current <= 0} onClick={() => onPageChange(current - 1)}>
        {labels.previous}
      </button>
      <span>{labels.pageOf(current + 1, totalPages)}</span>
      <button type="button" disabled={current >= totalPages - 1} onClick={() => onPageChange(current + 1)}>
        {labels.next}
      </button>
    </div>
  );
}

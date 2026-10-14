export type PageResult<T> = { sessions: T[]; total: number }

/** Reads every server-side page in a bounded range. */
export async function collectPagedSessions<T>(
  readPage: (page: number, pageSize: number) => Promise<PageResult<T>>,
  pageSize = 100,
) {
  const first = await readPage(1, pageSize)
  const pages = Math.ceil(first.total / pageSize)
  if (pages <= 1) return first.sessions
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => readPage(index + 2, pageSize)),
  )
  return [...first.sessions, ...rest.flatMap(page => page.sessions)]
}

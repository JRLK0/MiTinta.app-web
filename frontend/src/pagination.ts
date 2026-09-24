export type PageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

export async function loadAllPages<T>(
  loadPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = 500,
): Promise<PageResult<T>> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1)
    if (page.error) return { data: null, error: page.error }
    const rows = page.data ?? []
    all.push(...rows)
    if (rows.length < pageSize) return { data: all, error: null }
  }
}

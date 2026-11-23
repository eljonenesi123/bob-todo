const PAGE = 1000 // Supabase returns at most this many rows per request

// Fetch every row of a query, page by page. `makeQuery` must build a fresh, sorted query each time.
export async function allRows(makeQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < PAGE) return { data: rows, error: null }
  }
}

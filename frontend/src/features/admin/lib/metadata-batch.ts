export interface RecordResult<T> {
  item: T
  error?: string
}

/** Independent metadata writes keep partial successes and retry only failed records. */
export async function runMetadataBatch<T>(
  items: readonly T[],
  write: (item: T) => Promise<unknown>,
  signal: AbortSignal
): Promise<RecordResult<T>[]> {
  const results: RecordResult<T>[] = []
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (index < items.length && !signal.aborted) {
        const item = items[index++]
        try {
          await write(item)
          results.push({ item })
        } catch (error) {
          results.push({ item, error: (error as Error).message })
        }
      }
    })
  )
  return results
}

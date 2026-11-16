export function playgroundSelection(options: string[], selected: string, explicit: boolean): string {
  if (options.includes(selected)) return selected
  return explicit ? '' : options[0] || ''
}

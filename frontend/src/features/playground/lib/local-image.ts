const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function readLocalImage(file: File, maxBytes = 10 * 1024 * 1024): Promise<string> {
  if (!allowedTypes.has(file.type) || file.size === 0 || file.size > maxBytes) return Promise.reject(new Error('invalid image'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('image read failed')))
    reader.onerror = () => reject(new Error('image read failed'))
    reader.readAsDataURL(file)
  })
}

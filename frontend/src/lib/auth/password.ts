// New API RSA-OAEP SHA-256 and hybrid password-v2 wire protocol.
export async function passwordPayload(password: string) {
  const response = await fetch('/api/user/login/encryption-key', { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error('Password encryption key unavailable')
  if (!result.data.enabled) return { password }
  const { public_key: pem, kid } = result.data
  const raw = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c: string) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('spki', raw, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const bytes = new TextEncoder().encode(password)
  const base64 = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)))
  let encrypted: string
  if (bytes.length <= (key.algorithm as RsaKeyAlgorithm).modulusLength / 8 - 66) {
    encrypted = base64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, bytes))
  } else {
    const secret = crypto.getRandomValues(new Uint8Array(32)),
      nonce = crypto.getRandomValues(new Uint8Array(12))
    const aes = await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt'])
    const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP', label: new TextEncoder().encode('password-v2') }, key, secret)
    const payload = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(`password-v2:${kid}`) },
      aes,
      bytes
    )
    encrypted = ['v2', base64(wrapped), base64(nonce.buffer), base64(payload)].join('.')
  }
  return { password_encrypted: encrypted, encryption_key_id: kid }
}

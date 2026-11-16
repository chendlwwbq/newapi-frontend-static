'use client'

import { useTranslation } from 'react-i18next'

export function ImageAttachment({ source, index }: { source: string; index: number }) {
  const { t } = useTranslation()
  if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(source))
    return <img className="chat-image-thumbnail" src={source} alt={`${t('Local image')} ${index + 1}`} />
  if (source.startsWith('data:')) return <span>{t('Image')}</span>
  return <code>{source}</code>
}

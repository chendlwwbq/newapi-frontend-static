'use client'

import { useTranslation } from 'react-i18next'
import type { PdfAttachment as PdfFile } from './lib/backup'

export function PdfAttachment({ file }: { file: PdfFile }) {
  const { t } = useTranslation()
  const valid = /^data:application\/pdf;base64,[a-z0-9+/]+={0,2}$/i.test(file.data)
  return (
    <p>
      {file.name} · PDF{' '}
      {valid && (
        <a className="text-link" href={file.data} download={file.name}>
          {t('Download')}
        </a>
      )}
    </p>
  )
}

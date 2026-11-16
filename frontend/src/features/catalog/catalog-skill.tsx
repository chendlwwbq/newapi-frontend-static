'use client'

import { BookOpen } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/shared/copy-button'
import { Button } from '@/components/ui/button'
import { useGatewayAddress } from '@/features/docs/use-gateway-address'

export function CatalogSkill() {
  const { t } = useTranslation()
  const gateway = useGatewayAddress()
  const skill = useQuery({
    queryKey: ['public-skill', 'eva-models'],
    queryFn: async ({ signal }) => {
      // This public endpoint returns Markdown, not the JSON envelope used by api().
      const response = await fetch('/api/skills/eva-models/SKILL.md', { signal, credentials: 'omit' })
      if (!response.ok) throw new Error('Skill unavailable')
      const content = await response.text()
      if (!content.startsWith('---\nname: eva-models\n') && !content.startsWith('---\r\nname: eva-models\r\n')) {
        throw new Error('Skill unavailable')
      }
      return content
    },
    staleTime: 300_000,
    retry: false,
  })
  const failed = skill.isError || !!gateway.error
  const ready = !!skill.data && !!gateway.address && !failed
  const content = ready
    ? `${skill.data}\n\n## 本次接入地址\n\n网关根地址：${gateway.address}\nSkill 地址：${gateway.address}/api/skills/eva-models/SKILL.md\n\n请按上述 Skill 查询我的 Key 可用模型，并将支持的模型和调用接口添加到我指定的客户端或项目配置中。保留现有配置，密钥使用本地环境变量 EVA_API_KEY，不要发起付费生成。\n`
    : ''

  return (
    <section
      aria-labelledby="catalog-skill-title"
      className="mb-6 flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <BookOpen size={20} className="mt-1 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="catalog-skill-title" className="text-base font-semibold">
            {t('Connect with AI Skill')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Copy the full Skill to your AI client to discover models, query points and configure API calls.')}
          </p>
          {failed && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {t('Unable to load the Skill. Please retry.')}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {failed && (
          <Button
            variant="ghost"
            onClick={() => {
              void skill.refetch()
              void gateway.retry()
            }}
          >
            {t('Retry')}
          </Button>
        )}
        <CopyButton value={content} label={t('Copy full Skill')} showLabel disabled={!ready} />
      </div>
    </section>
  )
}

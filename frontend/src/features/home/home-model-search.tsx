'use client'

import { useMemo, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Combobox } from '@base-ui/react/combobox'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useModelTyping } from '@/components/motion/model-typing'
import { catalogQuote, filterCatalog, readCatalogFilters } from '@/features/catalog/catalog-state'
import { modelHref, PriceDisplay, ProviderIcon } from '@/features/catalog/model-card'
import { quoteUnitLabel } from '@/features/catalog/price-format'
import { formatNumber } from '@/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import type { CatalogModel } from '@/lib/api/types'

/** Inline hero search uses Base UI's keyboard, focus and combobox semantics. */
export function HomeModelSearch(props: {
  models: CatalogModel[]
  modality: string
  inputRef: RefObject<HTMLInputElement | null>
  onPreviewChange: (model: string) => void
}) {
  const { t, i18n } = useTranslation(),
    router = useRouter(),
    anchor = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState(''),
    [open, setOpen] = useState(false)
  const matches = useMemo(
    () => filterCatalog(props.models, readCatalogFilters(new URLSearchParams({ q: query, modality: props.modality }).toString())),
    [props.models, props.modality, query]
  )
  const filtered = useMemo(() => matches.slice(0, 8), [matches])
  const catalogQuery = new URLSearchParams({ q: query, modality: props.modality })
  const typing = useModelTyping(
    props.models.filter((model) => props.modality === 'all' || model.modality === props.modality),
    anchor,
    open || !!query
  )
  return (
    <Combobox.Root<CatalogModel>
      items={filtered}
      filter={null}
      autoHighlight
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) props.onPreviewChange('')
      }}
      inputValue={query}
      onInputValueChange={(value) => {
        setQuery(value)
        const rows = filterCatalog(props.models, readCatalogFilters(new URLSearchParams({ q: value, modality: props.modality }).toString()))
        props.onPreviewChange(rows[0]?.configured_model_id || '')
      }}
      onItemHighlighted={(model) => {
        if (model) props.onPreviewChange(model.configured_model_id)
      }}
      itemToStringLabel={(model) => model.configured_model_id}
      onValueChange={(model) => {
        if (model) router.push(modelHref(model))
      }}
    >
      <div className="model-typing home-model-search" ref={anchor}>
        <span aria-hidden="true">model=</span>
        <Combobox.Input
          ref={props.inputRef}
          render={<Input />}
          aria-label={t('Search models by name or capability')}
          placeholder={typing.text || t('Search models')}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => {
            setOpen(true)
            props.onPreviewChange(filtered[0]?.configured_model_id || '')
          }}
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('Clear')}
            onClick={() => {
              setQuery('')
              props.onPreviewChange(
                filterCatalog(props.models, readCatalogFilters(new URLSearchParams({ modality: props.modality }).toString()))[0]
                  ?.configured_model_id || ''
              )
              props.inputRef.current?.focus()
            }}
          >
            <X size={16} />
          </Button>
        ) : (
          <Search size={17} aria-hidden="true" />
        )}
      </div>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchor} sideOffset={8} className="home-model-search-positioner">
          <Combobox.Popup className="home-model-search-popup">
            <Combobox.List>
              {(model: CatalogModel) => (
                <Combobox.Item key={model.model_key} value={model} className="home-model-search-result">
                  <ProviderIcon provider={model.provider} modelName={model.configured_model_id} icon={model.icon} size={25} />
                  <div>
                    <strong>{model.name}</strong>
                    <small>{model.configured_model_id}</small>
                  </div>
                  <div className="home-model-search-price">
                    <PriceDisplay quote={catalogQuote(model, [])} />
                    <small>{t(quoteUnitLabel(catalogQuote(model, [])))}</small>
                  </div>
                  <ArrowUpRight size={15} />
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="home-model-search-empty">{t('No results')}</Combobox.Empty>
            {matches.length > 0 && (
              <div className="home-model-search-footer">
                <span>
                  {formatNumber(matches.length, toIntlLocale(i18n.resolvedLanguage || i18n.language))} {t('Models available')}
                </span>
                <Link href={`/pricing?${catalogQuery}`}>
                  {t('Model catalog')} <ArrowUpRight size={13} />
                </Link>
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

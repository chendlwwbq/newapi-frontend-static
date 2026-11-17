/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import { toc } from '@lobehub/icons/es/toc'
import AnthropicMono from '@lobehub/icons/es/Anthropic/components/Mono.js'
import ByteDanceColor from '@lobehub/icons/es/ByteDance/components/Color.js'
import ByteDanceMono from '@lobehub/icons/es/ByteDance/components/Mono.js'
import ClaudeColor from '@lobehub/icons/es/Claude/components/Color.js'
import ClaudeMono from '@lobehub/icons/es/Claude/components/Mono.js'
import DeepSeekColor from '@lobehub/icons/es/DeepSeek/components/Color.js'
import DeepSeekMono from '@lobehub/icons/es/DeepSeek/components/Mono.js'
import DoubaoColor from '@lobehub/icons/es/Doubao/components/Color.js'
import DoubaoMono from '@lobehub/icons/es/Doubao/components/Mono.js'
import GeminiColor from '@lobehub/icons/es/Gemini/components/Color.js'
import GeminiMono from '@lobehub/icons/es/Gemini/components/Mono.js'
import GoogleColor from '@lobehub/icons/es/Google/components/Color.js'
import GoogleMono from '@lobehub/icons/es/Google/components/Mono.js'
import GrokMono from '@lobehub/icons/es/Grok/components/Mono.js'
import KimiColor from '@lobehub/icons/es/Kimi/components/Color.js'
import KimiMono from '@lobehub/icons/es/Kimi/components/Mono.js'
import MetaColor from '@lobehub/icons/es/Meta/components/Color.js'
import MetaMono from '@lobehub/icons/es/Meta/components/Mono.js'
import MistralColor from '@lobehub/icons/es/Mistral/components/Color.js'
import MistralMono from '@lobehub/icons/es/Mistral/components/Mono.js'
import MoonshotMono from '@lobehub/icons/es/Moonshot/components/Mono.js'
import OpenAIMono from '@lobehub/icons/es/OpenAI/components/Mono.js'
import QwenColor from '@lobehub/icons/es/Qwen/components/Color.js'
import QwenMono from '@lobehub/icons/es/Qwen/components/Mono.js'
import XAIMono from '@lobehub/icons/es/XAI/components/Mono.js'
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'

import { lobeIconLoaders } from './lobe-icon-loaders'
const sglangLogo = '/orbis/brand-icons/sglang.svg'
import { IconSub2api } from './icon-sub2api'
import { IconWan } from './icon-wan'

type IconProps = Record<string, string | number | boolean> & { size?: number | string }

const CUSTOM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  SGLang: (props) => <img src={sglangLogo} alt="" aria-hidden="true" width={props.size ?? 20} height={props.size ?? 20} className="object-contain" />,
  Sub2API: IconSub2api,
  Wan: IconWan,
}

// Top-10 high-frequency providers render synchronously with zero async chunk delay.
const SYNC_ICONS: Record<string, ComponentType<IconProps>> = {
  'Anthropic.Mono': AnthropicMono as ComponentType<IconProps>,
  'ByteDance.Color': ByteDanceColor as ComponentType<IconProps>,
  'ByteDance.Mono': ByteDanceMono as ComponentType<IconProps>,
  'Claude.Color': ClaudeColor as ComponentType<IconProps>,
  'Claude.Mono': ClaudeMono as ComponentType<IconProps>,
  'DeepSeek.Color': DeepSeekColor as ComponentType<IconProps>,
  'DeepSeek.Mono': DeepSeekMono as ComponentType<IconProps>,
  'Doubao.Color': DoubaoColor as ComponentType<IconProps>,
  'Doubao.Mono': DoubaoMono as ComponentType<IconProps>,
  'Gemini.Color': GeminiColor as ComponentType<IconProps>,
  'Gemini.Mono': GeminiMono as ComponentType<IconProps>,
  'Google.Color': GoogleColor as ComponentType<IconProps>,
  'Google.Mono': GoogleMono as ComponentType<IconProps>,
  'Grok.Mono': GrokMono as ComponentType<IconProps>,
  'Kimi.Color': KimiColor as ComponentType<IconProps>,
  'Kimi.Mono': KimiMono as ComponentType<IconProps>,
  'Meta.Color': MetaColor as ComponentType<IconProps>,
  'Meta.Mono': MetaMono as ComponentType<IconProps>,
  'Mistral.Color': MistralColor as ComponentType<IconProps>,
  'Mistral.Mono': MistralMono as ComponentType<IconProps>,
  'Moonshot.Mono': MoonshotMono as ComponentType<IconProps>,
  'OpenAI.Mono': OpenAIMono as ComponentType<IconProps>,
  'Qwen.Color': QwenColor as ComponentType<IconProps>,
  'Qwen.Mono': QwenMono as ComponentType<IconProps>,
  'XAI.Mono': XAIMono as ComponentType<IconProps>,
}

const ICON_METADATA = new Map(toc.map((icon) => [icon.id, icon]))
const ICON_VARIANTS = {
  Avatar: 'hasAvatar',
  Brand: 'hasBrand',
  BrandColor: 'hasBrandColor',
  Color: 'hasColor',
  Combine: 'hasCombine',
  Text: 'hasText',
  TextCn: 'hasTextCn',
  TextColor: 'hasTextColor',
} as const
const LAZY_ICONS = new Map<string, LazyExoticComponent<ComponentType<Record<string, unknown>>>>()

function renderLobeIconFallback(name: string, size: number | string): ReactNode {
  return (
    <div
      className="w-5 h-5 rounded-md bg-muted/40 shrink-0 text-muted-foreground flex items-center justify-center text-xs font-medium"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase() || '?'}
    </div>
  )
}

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

/**
 * Get LobeHub icon component by name
 * @param iconName - Icon name/description (e.g., "OpenAI", "OpenAI.Color", "Claude.Avatar")
 * @param size - Icon size (default: 20)
 * @returns Icon component or fallback
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(iconName: string | undefined | null, size: number = 20): ReactNode {
  const trimmedName = typeof iconName === 'string' ? iconName.trim() : ''
  const fallback = renderLobeIconFallback(trimmedName, size)
  if (!trimmedName) return fallback

  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const CustomIcon = CUSTOM_ICONS[baseKey]
  if (CustomIcon) return <CustomIcon size={size} />

  const metadata = ICON_METADATA.get(baseKey)
  if (!metadata) return fallback

  const variantKey = segments[1] as keyof typeof ICON_VARIANTS
  const variantFlag = ICON_VARIANTS[variantKey]
  let variant: string = variantFlag && metadata.param[variantFlag] ? variantKey : 'Mono'
  // These published variants are not represented by the package's toc flags.
  if ((baseKey === 'Gemma' && segments[1] === 'Simple') || (baseKey === 'LobeHub' && segments[1] === 'Morden')) {
    variant = segments[1]
  }
  const propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  const cacheKey = `${baseKey}.${variant}`
  const SyncIcon = SYNC_ICONS[cacheKey]
  if (!SyncIcon && !lobeIconLoaders[cacheKey]) return fallback

  // Parse chained properties (e.g., "type={'platform'}", "shape='square'")
  const props: IconProps = {}

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  // Set size if not explicitly specified in the string
  if (props.size == null && size != null) {
    props.size = size
  }

  const resolvedSize = typeof props.size === 'number' || typeof props.size === 'string' ? props.size : size
  if (SyncIcon) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center" style={{ width: resolvedSize, height: resolvedSize }}>
        <SyncIcon {...props} />
      </span>
    )
  }

  let IconComponent = LAZY_ICONS.get(cacheKey)
  if (!IconComponent) {
    // Explicit import paths allow Next.js to split each installed icon variant.
    IconComponent = lazy(() =>
      lobeIconLoaders[cacheKey]()
        .then((module) => ({ default: module.default as ComponentType<Record<string, unknown>> }))
        .catch(() => ({
          default: (p: Record<string, unknown>) =>
            renderLobeIconFallback(baseKey, typeof p.size === 'number' || typeof p.size === 'string' ? p.size : 20),
        }))
    )
    LAZY_ICONS.set(cacheKey, IconComponent)
  }

  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: resolvedSize, height: resolvedSize }}>
      <Suspense fallback={renderLobeIconFallback(baseKey, resolvedSize)}>
        <IconComponent {...props} />
      </Suspense>
    </span>
  )
}

// The selector uses the same installed icon registry as the renderer.
export function getLobeIconNames(): string[] {
  const names = toc.flatMap((icon) => (icon.param.hasColor ? [icon.id, `${icon.id}.Color`] : [icon.id]))
  return [...new Set([...names, ...Object.keys(CUSTOM_ICONS)])].sort()
}

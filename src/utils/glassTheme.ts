import type { GlassCustomColors } from '@/stores/app'

export type GlassColorPreset = 'emerald' | 'soft' | 'contrast' | 'midnight' | 'custom'

interface GlassThemeTokens {
  lightCard: string
  lightCardHover: string
  lightControl: string
  lightHeader: string
  lightText: string
  lightMutedText: string
  lightBorder: string
  lightShadow: string
  darkCard: string
  darkCardHover: string
  darkControl: string
  darkHeader: string
  darkText: string
  darkMutedText: string
  darkBorder: string
  darkShadow: string
}

const PRESET_TOKENS: Record<Exclude<GlassColorPreset, 'custom'>, GlassThemeTokens> = {
  emerald: {
    lightCard: '#dce8f1e6',
    lightCardHover: '#e7f0f7ef',
    lightControl: '#d4e2edf0',
    lightHeader: '#dce8f1ed',
    lightText: '#10151c',
    lightMutedText: '#304459',
    lightBorder: '#9eb7c9b8',
    lightShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.68), 0 10px 30px rgb(30 64 88 / 0.14)',
    darkCard: '#0d111ad9',
    darkCardHover: '#111827e8',
    darkControl: '#101624d9',
    darkHeader: '#0b1020d9',
    darkText: '#f8fafc',
    darkMutedText: '#d6dae4',
    darkBorder: '#ffffff2e',
    darkShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.09), 0 12px 34px rgb(0 0 0 / 0.5)',
  },
  soft: {
    lightCard: '#e7e2e8e8',
    lightCardHover: '#eeeaf0f2',
    lightControl: '#ddd6e0ec',
    lightHeader: '#e3dde7ee',
    lightText: '#201a24',
    lightMutedText: '#514659',
    lightBorder: '#aa9eafad',
    lightShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.58), 0 10px 30px rgb(76 58 82 / 0.16)',
    darkCard: '#1b1720e8',
    darkCardHover: '#251e2bf2',
    darkControl: '#201925eb',
    darkHeader: '#17131ceb',
    darkText: '#f5eff8',
    darkMutedText: '#d4c7da',
    darkBorder: '#c4a7cf3d',
    darkShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.09), 0 12px 34px rgb(8 5 10 / 0.54)',
  },
  contrast: {
    lightCard: '#f4f6f8f5',
    lightCardHover: '#fffffff9',
    lightControl: '#e1e7edf7',
    lightHeader: '#edf1f5f8',
    lightText: '#070a0d',
    lightMutedText: '#25303b',
    lightBorder: '#657383bf',
    lightShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.7), 0 12px 34px rgb(2 6 12 / 0.24)',
    darkCard: '#0b0e12f5',
    darkCardHover: '#12171dfc',
    darkControl: '#111820f5',
    darkHeader: '#070a0df7',
    darkText: '#ffffff',
    darkMutedText: '#dce4ec',
    darkBorder: '#cbd5e166',
    darkShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.14), 0 14px 38px rgb(0 0 0 / 0.68)',
  },
  midnight: {
    lightCard: '#d7e5f2e8',
    lightCardHover: '#e2edf7f2',
    lightControl: '#c7d9eaed',
    lightHeader: '#d3e2f0ee',
    lightText: '#101b2d',
    lightMutedText: '#324c6a',
    lightBorder: '#6f93b8b3',
    lightShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.62), 0 12px 34px rgb(24 72 120 / 0.22)',
    darkCard: '#071426e8',
    darkCardHover: '#0b1d34f2',
    darkControl: '#0a1a30ed',
    darkHeader: '#06101fee',
    darkText: '#edf6ff',
    darkMutedText: '#b9d3ee',
    darkBorder: '#5aa9ff52',
    darkShadow: 'inset 0 1px 0 rgb(147 197 253 / 0.12), 0 14px 38px rgb(0 5 16 / 0.64)',
  },
}

function withHoverAlpha(color: string): string {
  return color.length === 9 ? `${color.slice(0, 7)}e6` : color
}

export function buildGlassThemeTokens(preset: GlassColorPreset, customColors: GlassCustomColors): GlassThemeTokens {
  if (preset !== 'custom')
    return PRESET_TOKENS[preset]

  return {
    lightCard: customColors.lightCard,
    lightCardHover: withHoverAlpha(customColors.lightCard),
    lightControl: customColors.lightControl,
    lightHeader: customColors.lightControl,
    lightText: customColors.lightText,
    lightMutedText: customColors.lightMutedText,
    lightBorder: customColors.lightBorder,
    lightShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.58), 0 10px 30px rgb(15 23 42 / 0.18)',
    darkCard: customColors.darkCard,
    darkCardHover: withHoverAlpha(customColors.darkCard),
    darkControl: customColors.darkControl,
    darkHeader: customColors.darkControl,
    darkText: customColors.darkText,
    darkMutedText: customColors.darkMutedText,
    darkBorder: customColors.darkBorder,
    darkShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.09), 0 12px 34px rgb(0 0 0 / 0.5)',
  }
}

'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import React from 'react'

import type { ThemePreference } from '../types'

import { useTheme } from '..'

export const ThemeSelector: React.FC = () => {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme: ThemePreference = theme ?? 'system'
  const nextTheme: Record<ThemePreference, ThemePreference> = {
    dark: 'system',
    light: 'dark',
    system: 'light',
  }

  const Icon = mounted
    ? activeTheme === 'light'
      ? Sun
      : activeTheme === 'dark'
        ? Moon
        : Monitor
    : Monitor

  const label = `Tema: ${mounted ? activeTheme : 'system'}`

  return (
    <button
      aria-label={label}
      className="theme-toggle"
      onClick={() => setTheme(nextTheme[activeTheme])}
      title={label}
      type="button"
    >
      <Icon aria-hidden className="w-5" />
    </button>
  )
}

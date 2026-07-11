'use client'

import React from 'react'
import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from 'next-themes'

import type { ThemeContextType } from './types'

import { defaultTheme, themeLocalStorageKey } from './shared'

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      storageKey={themeLocalStorageKey}
    >
      {children}
    </NextThemeProvider>
  )
}

export const useTheme = (): ThemeContextType => {
  const { resolvedTheme, setTheme, theme } = useNextTheme()

  return {
    resolvedTheme: resolvedTheme === 'dark' ? 'dark' : 'light',
    setTheme,
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : undefined,
  }
}

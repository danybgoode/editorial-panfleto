export type Theme = 'dark' | 'light'
export type ThemePreference = Theme | 'system'

export interface ThemeContextType {
  setTheme: (theme: ThemePreference) => void
  theme?: ThemePreference
  resolvedTheme?: Theme
}

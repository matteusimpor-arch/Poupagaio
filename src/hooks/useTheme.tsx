import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'poupagaio' | 'ocean' | 'nature';
export type ActiveTheme = 'poupagaio' | 'ocean' | 'nature';

interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  // Backward compatibility
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SESSION_KEY = 'poupagaio_theme_session';
const VALID_THEMES: ThemeMode[] = ['poupagaio', 'ocean', 'nature'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Force cleanup of legacy localStorage theme values to prevent persistence across sessions
        localStorage.removeItem('poupagaio_theme');
        localStorage.removeItem('poupagaio_theme_mode');
        
        // Choice is stored only in sessionStorage (lasts during session/tab, resets on close)
        const savedMode = sessionStorage.getItem(SESSION_KEY) as ThemeMode | null;
        if (savedMode && VALID_THEMES.includes(savedMode)) {
          return savedMode;
        }
      } catch (e) {
        console.warn('sessionStorage is not accessible:', e);
      }
    }
    return 'poupagaio';
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(themeMode);

  useEffect(() => {
    setActiveTheme(themeMode);
  }, [themeMode]);

  // Sync document attribute and sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    
    // Set theme parameters on html element
    root.setAttribute('data-theme', activeTheme);
    root.dataset.theme = activeTheme;
    root.classList.remove('dark');

    try {
      sessionStorage.setItem(SESSION_KEY, themeMode);
    } catch (e) {
      console.warn('Failed to set sessionStorage theme:', e);
    }
  }, [themeMode, activeTheme]);

  const setThemeMode = (newMode: ThemeMode) => {
    if (VALID_THEMES.includes(newMode)) {
      setThemeModeState(newMode);
    } else {
      setThemeModeState('poupagaio');
    }
  };

  // Toggle theme switches between poupagaio and ocean
  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === 'poupagaio' ? 'ocean' : 'poupagaio'));
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        activeTheme,
        isDark: false,
        setThemeMode,
        theme: 'light',
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

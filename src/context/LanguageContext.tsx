/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Global Language Context & i18n Hook for Eya3D Studio
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { SupportedLanguages, TranslationType, translations } from '../i18n/locales';

interface LanguageContextValue {
  language: SupportedLanguages;
  setLanguage: (lang: SupportedLanguages) => void;
  t: TranslationType;
}

const STORAGE_KEY = 'eya3d_language';

const VALID_LANGUAGES: SupportedLanguages[] = ['fr', 'en', 'es', 'de', 'ja', 'zh'];

/**
 * Détecte la langue initiale intelligente (localStorage > navigator.language > 'fr')
 */
function getInitialLanguage(): SupportedLanguages {
  if (typeof window !== 'undefined') {
    // 1. Vérifier la sauvegarde utilisateur dans le localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguages | null;
      if (stored && VALID_LANGUAGES.includes(stored)) {
        return stored;
      }
    } catch {
      // Ignore les erreurs d'accès au localStorage (ex: mode privé strict)
    }

    // 2. Détecter la langue système du navigateur
    try {
      const navLang = navigator.language?.toLowerCase() || '';
      if (navLang.startsWith('fr')) return 'fr';
      if (navLang.startsWith('en')) return 'en';
      if (navLang.startsWith('es')) return 'es';
      if (navLang.startsWith('de')) return 'de';
      if (navLang.startsWith('ja')) return 'ja';
      if (navLang.startsWith('zh')) return 'zh';
    } catch {
      // Ignore
    }
  }

  // 3. Repli par défaut
  return 'fr';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguages>(getInitialLanguage);

  const setLanguage = (newLang: SupportedLanguages) => {
    if (!VALID_LANGUAGES.includes(newLang)) return;
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // Ignore
    }
  };

  // Synchronisation si le localStorage change (ex: multi-onglets)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && VALID_LANGUAGES.includes(e.newValue as SupportedLanguages)) {
        setLanguageState(e.newValue as SupportedLanguages);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t: TranslationType = useMemo(() => {
    return translations[language] || translations.fr;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/**
 * Hook personnalisé pour accéder à la langue active et aux traductions fortement typées
 */
export const useTranslation = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Si appelé hors du Provider, renvoie un fallback sécurisé
    return {
      language: 'fr',
      setLanguage: () => {},
      t: translations.fr,
    };
  }
  return context;
};

export const useLanguage = useTranslation;

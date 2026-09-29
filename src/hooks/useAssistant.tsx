import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'showPoupagaioAssistant';

interface AssistantContextType {
  showAssistant: boolean;
  setShowAssistant: (show: boolean) => void;
  toggleAssistant: () => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [showAssistant, setShowAssistantState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return true; // Default is true
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(showAssistant));
    } catch (e) {
      console.warn('Unable to persist showPoupagaioAssistant preference:', e);
    }
  }, [showAssistant]);

  const setShowAssistant = (show: boolean) => {
    setShowAssistantState(show);
  };

  const toggleAssistant = () => {
    setShowAssistantState((prev) => !prev);
  };

  return (
    <AssistantContext.Provider
      value={{
        showAssistant,
        setShowAssistant,
        toggleAssistant,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

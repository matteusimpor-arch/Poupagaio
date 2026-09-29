import { useState, useEffect } from 'react';

export interface AssistantConfig {
  showAssistant: boolean;
  positionMode: 'auto' | 'left' | 'right';
}

const STORAGE_KEY = 'poupagaio_assistant_config_v1';

export function getStoredAssistantConfig(): AssistantConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showAssistant: typeof parsed.showAssistant === 'boolean' ? parsed.showAssistant : true,
        positionMode: ['auto', 'left', 'right'].includes(parsed.positionMode) ? parsed.positionMode : 'auto',
      };
    }
  } catch (e) {
    // Ignore storage parse error
  }
  return {
    showAssistant: true,
    positionMode: 'auto',
  };
}

export function saveAssistantConfig(config: AssistantConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('poupagaio_assistant_config_changed', { detail: config }));
  } catch (e) {
    console.warn('Erro ao salvar preferências do assistente:', e);
  }
}

export function useAssistantPreferences() {
  const [config, setConfig] = useState<AssistantConfig>(() => getStoredAssistantConfig());

  useEffect(() => {
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<AssistantConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        setConfig(getStoredAssistantConfig());
      }
    };

    window.addEventListener('poupagaio_assistant_config_changed', handleConfigChange);
    window.addEventListener('storage', handleConfigChange);
    return () => {
      window.removeEventListener('poupagaio_assistant_config_changed', handleConfigChange);
      window.removeEventListener('storage', handleConfigChange);
    };
  }, []);

  const updateShowAssistant = (show: boolean) => {
    const updated: AssistantConfig = { ...config, showAssistant: show };
    setConfig(updated);
    saveAssistantConfig(updated);
  };

  const updatePositionMode = (mode: 'auto' | 'left' | 'right') => {
    const updated: AssistantConfig = { ...config, positionMode: mode };
    setConfig(updated);
    saveAssistantConfig(updated);
  };

  return {
    config,
    showAssistant: config.showAssistant,
    positionMode: config.positionMode,
    updateShowAssistant,
    updatePositionMode,
  };
}

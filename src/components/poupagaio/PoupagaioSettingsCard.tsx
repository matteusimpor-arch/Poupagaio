import React, { useState, useEffect } from 'react';
import { POUPAGAIO_ASSISTANTE_URL } from '../../assets/mascot';
import { Eye, EyeOff, Layout, Check, Sparkles } from 'lucide-react';

export interface PoupagaioPreferences {
  isVisible: boolean;
  positionMode: 'auto' | 'left' | 'right';
}

export function getStoredPoupagaioPreferences(): PoupagaioPreferences {
  const visible = localStorage.getItem('poupagaio-assistant-visible');
  const isVisible = visible !== 'false'; // Default true

  const posMode = localStorage.getItem('poupagaio-assistant-position-type');
  const positionMode: 'auto' | 'left' | 'right' =
    posMode === 'left' || posMode === 'right' ? posMode : 'auto';

  return { isVisible, positionMode };
}

export function setStoredPoupagaioPreferences(prefs: Partial<PoupagaioPreferences>) {
  if (prefs.isVisible !== undefined) {
    localStorage.setItem('poupagaio-assistant-visible', prefs.isVisible ? 'true' : 'false');
  }
  if (prefs.positionMode !== undefined) {
    localStorage.setItem('poupagaio-assistant-position-type', prefs.positionMode);
    
    // Also update coordinate position in poupagaio-assistant-position if set to left or right
    if (prefs.positionMode === 'left' || prefs.positionMode === 'right') {
      const savedPos = localStorage.getItem('poupagaio-assistant-position');
      let currentY = window.innerHeight - 150;
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          if (parsed && typeof parsed.y === 'number') currentY = parsed.y;
        } catch (e) {
          // Ignore
        }
      }
      localStorage.setItem(
        'poupagaio-assistant-position',
        JSON.stringify({ side: prefs.positionMode, y: currentY })
      );
    }
  }

  // Dispatch custom window event for real-time reactivity
  window.dispatchEvent(new Event('poupagaio-settings-changed'));
}

export function PoupagaioSettingsCard() {
  const [prefs, setPrefs] = useState<PoupagaioPreferences>(getStoredPoupagaioPreferences());

  useEffect(() => {
    const handleSettingsChanged = () => {
      setPrefs(getStoredPoupagaioPreferences());
    };
    window.addEventListener('poupagaio-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('poupagaio-settings-changed', handleSettingsChanged);
  }, []);

  const handleToggleVisible = () => {
    const next = !prefs.isVisible;
    setStoredPoupagaioPreferences({ isVisible: next });
    setPrefs((prev) => ({ ...prev, isVisible: next }));
  };

  const handleSelectPosition = (mode: 'auto' | 'left' | 'right') => {
    setStoredPoupagaioPreferences({ positionMode: mode });
    setPrefs((prev) => ({ ...prev, positionMode: mode }));
  };

  return (
    <div className="bg-white/90 dark:bg-[#1C211E]/90 border border-[#D2DDD6] dark:border-[#28322C] rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE6] dark:border-[#28322C]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#02402E]/10 dark:bg-[#78D9A6]/15 p-1 shrink-0 flex items-center justify-center">
            <img
              src={POUPAGAIO_ASSISTANTE_URL}
              alt="Poupagaio"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] font-display flex items-center gap-1.5">
              <span>Assistente Poupagaio</span>
              <Sparkles className="w-3.5 h-3.5 text-[#F2B807]" />
            </h3>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
              Configure a exibição e posição do mascote flutuante.
            </p>
          </div>
        </div>
      </div>

      {/* TOGGLE VISIBILITY */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F4F8F5] dark:bg-[#181C1A] border border-[#E2ECE6] dark:border-[#28322C]">
        <div className="flex items-center gap-2.5">
          {prefs.isVisible ? (
            <Eye className="w-4 h-4 text-[#16A66A]" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-400" />
          )}
          <div>
            <p className="text-xs font-bold text-[#202724] dark:text-[#F4F4F5]">
              Mostrar assistente flutuante
            </p>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              {prefs.isVisible ? 'O Poupagaio está visível nas telas.' : 'O Poupagaio está oculto. (Opções financeiras continuam ativas)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleVisible}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            prefs.isVisible ? 'bg-[#16A66A]' : 'bg-gray-300 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={prefs.isVisible}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              prefs.isVisible ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* POSITION SELECTION */}
      <div className="space-y-2 pt-1">
        <label className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] flex items-center gap-1.5">
          <Layout className="w-3.5 h-3.5 text-[#16A66A]" />
          <span>Posição do assistente:</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'auto', label: 'Automática' },
            { id: 'left', label: 'Esquerda' },
            { id: 'right', label: 'Direita' },
          ].map((pos) => {
            const selected = prefs.positionMode === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => handleSelectPosition(pos.id as any)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  selected
                    ? 'bg-[#02402E] text-white dark:bg-[#78D9A6] dark:text-[#101614] border-[#02402E] shadow-2xs'
                    : 'bg-white dark:bg-[#141816] border-[#D2DDD6] dark:border-[#28322C] text-[#5E6963] dark:text-[#95A39B] hover:border-[#16A66A]'
                }`}
              >
                {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>{pos.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

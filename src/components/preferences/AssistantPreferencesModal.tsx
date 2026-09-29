import React from 'react';
import { useAssistantPreferences } from '../../hooks/useAssistantPreferences';
import { POUPAGAIO_ASSISTANTE_URL } from '../../assets/mascot';
import { X, Sparkles, Sliders, Check } from 'lucide-react';

interface AssistantPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantPreferencesModal({ isOpen, onClose }: AssistantPreferencesModalProps) {
  const { showAssistant, positionMode, updateShowAssistant, updatePositionMode } = useAssistantPreferences();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#181C1A] border border-[#D2DDD6] dark:border-[#28322C] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE6] dark:border-[#28322C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#02402E]/10 dark:bg-[#78D9A6]/15 flex items-center justify-center p-1.5">
              <img
                src={POUPAGAIO_ASSISTANTE_URL}
                alt="Poupagaio"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-[#02402E] dark:text-[#78D9A6]">
                Preferências do Assistente
              </h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Configure a exibição do Poupagaio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#5E6963] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Toggle Exibição */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F4F8F5] dark:bg-[#202622] border border-[#E2ECE6] dark:border-[#2C3630]">
            <div className="space-y-0.5 pr-3">
              <span className="text-sm font-bold text-[#02402E] dark:text-[#78D9A6] block">
                Mostrar assistente flutuante
              </span>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Mantenha o Poupagaio acessível em todas as telas com atalhos e lançamento rápido.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showAssistant}
              onClick={() => updateShowAssistant(!showAssistant)}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showAssistant ? 'bg-[#16A66A]' : 'bg-[#D2DDD6] dark:bg-[#34423A]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  showAssistant ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          {!showAssistant && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
              💡 O mascote visual está oculto. Todas as funcionalidades financeiras continuam disponíveis pelos menus superiores e de navegação.
            </div>
          )}
        </div>

        {/* Section 2: Posição do Assistente */}
        <div className={`space-y-3 transition-opacity duration-200 ${!showAssistant ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] font-display">
              Posição do Assistente
            </label>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B] mt-0.5">
              Escolha onde o Poupagaio deve se posicionar por padrão. Você também pode arrastá-lo livremente na tela.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'auto', label: 'Automática', desc: 'Lado mais próximo' },
              { id: 'left', label: 'Esquerda', desc: 'Canto esquerdo' },
              { id: 'right', label: 'Direita', desc: 'Canto direito' },
            ].map((opt) => {
              const isSelected = positionMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePositionMode(opt.id as any)}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'border-[#16A66A] bg-[#E6F6EF] dark:bg-[#16A66A]/15 shadow-2xs'
                      : 'border-[#D2DDD6] dark:border-[#28322C] bg-[#F4F8F5] dark:bg-[#202622] hover:bg-white dark:hover:bg-[#252C28]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-[#02402E] dark:text-[#78D9A6]' : 'text-[#202724] dark:text-[#F4F4F5]'}`}>
                      {opt.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#16A66A]" />}
                  </div>
                  <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E2ECE6] dark:border-[#28322C] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#02402E] text-white hover:bg-[#16A66A] dark:bg-[#78D9A6] dark:text-[#101614] text-xs font-bold transition-all cursor-pointer shadow-2xs text-center"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

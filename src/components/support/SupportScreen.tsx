import React from 'react';
import { Mail, HelpCircle, MessageSquare, AlertCircle, Sparkles, Send, ArrowRight } from 'lucide-react';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';

export function SupportScreen() {
  const supportEmail = 'poupagaiofinance@gmail.com';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-4 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#1E2220] border border-[#DCE2DE] dark:border-[#2B322F] rounded-2xl p-6 shadow-3xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#02402E]/10 dark:bg-[#78D9A6]/15 text-[#02402E] dark:text-[#78D9A6] text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Central de Atendimento</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#02402E] dark:text-[#78D9A6]">
              Como podemos ajudar?
            </h1>
            <p className="text-sm text-[#5E6963] dark:text-[#95A39B] max-w-lg">
              Estamos aqui para garantir que sua experiência financeira com o Poupagaio seja simples, segura e eficiente.
            </p>
          </div>

          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-[#16A66A]/30 bg-[#F2F4F3] dark:bg-[#232725] p-1 shrink-0 shadow-xs">
            <img
              src={POUPAGAIO_MASCOT_URL}
              alt="Poupagaio Mascot"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Topics */}
        <div className="md:col-span-2 bg-white dark:bg-[#1E2220] border border-[#DCE2DE] dark:border-[#2B322F] rounded-2xl p-6 shadow-3xs space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#02402E] dark:text-[#78D9A6] font-display flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#16A66A]" />
              Canais de Contato e Orientações
            </h2>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B] mt-1">
              Utilize este canal oficial para nos enviar:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-[#DCE2DE] dark:border-[#2B322F] bg-[#F7F9F8] dark:bg-[#181B1A]/60 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#202724] dark:text-[#F4F4F5]">Sugestões</h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Ideias de novos recursos, relatórios ou melhorias de uso.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#DCE2DE] dark:border-[#2B322F] bg-[#F7F9F8] dark:bg-[#181B1A]/60 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#202724] dark:text-[#F4F4F5]">Dúvidas</h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Ajuda para entender recursos, lançamentos ou fechamento de mês.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#DCE2DE] dark:border-[#2B322F] bg-[#F7F9F8] dark:bg-[#181B1A]/60 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#202724] dark:text-[#F4F4F5]">Problemas e Erros</h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Relato de falhas ou bugs encontrados durante a navegação.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#DCE2DE] dark:border-[#2B322F] bg-[#F7F9F8] dark:bg-[#181B1A]/60 space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#202724] dark:text-[#F4F4F5]">Reclamações</h3>
              <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                Feedback sobre qualquer aspecto da plataforma ou serviço.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Email Contact */}
        <div className="bg-gradient-to-br from-[#02402E] to-[#055a42] text-white rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#F2B807]" />
            </div>
            <h3 className="text-lg font-bold font-display">
              Enviar Mensagem
            </h3>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              Entre em contato diretamente com a equipe do Poupagaio Finance pelo nosso e-mail oficial:
            </p>
            
            <div className="bg-black/20 backdrop-blur-xs border border-white/15 rounded-xl p-3 text-center">
              <span className="text-xs font-mono font-bold text-[#F2C438] select-all break-all">
                {supportEmail}
              </span>
            </div>
          </div>

          <a
            href={`mailto:${supportEmail}?subject=Suporte%20Poupagaio%20Finance`}
            className="w-full py-3 px-4 rounded-xl bg-[#F2B807] hover:bg-[#F2C438] text-[#02402E] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Enviar E-mail Agora</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </a>
        </div>
      </div>
    </div>
  );
}

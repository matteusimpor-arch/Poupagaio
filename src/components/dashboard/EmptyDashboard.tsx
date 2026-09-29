import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShieldCheck, Layers, Sparkles, ArrowRight, CheckCircle2, Info, Database } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

export function EmptyDashboard() {
  const { profile, user, currentSpace, isSchemaPending } = useAuth();
  const [showNextStepModal, setShowNextStepModal] = useState(false);
  const isConnected = isSupabaseConfigured();

  const userName = profile?.full_name || user?.full_name || 'Amigo(a)';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-4 animate-in fade-in duration-300">
      {/* Top Banner / System Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#075C45]/5 border border-[#16A66A]/20 dark:bg-[#16A66A]/10 dark:border-[#16A66A]/30">
        <div className="flex items-center gap-2 text-xs font-medium text-[#075C45] dark:text-[#78D9A6]">
          <Database className="w-3.5 h-3.5" />
          <span>
            {isSchemaPending
              ? 'Conectado ao Supabase (Aguardando criação das tabelas no SQL Editor)'
              : 'Conectado ao Supabase • Sessão Autenticada'}
          </span>
        </div>
        <Badge variant={isSchemaPending ? 'gold' : 'success'} className="text-[11px] gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {isSchemaPending ? 'Configuração Pendente' : 'Sessão Ativa'}
        </Badge>
      </div>

      {/* Main Empty State Hero Card */}
      <Card className="overflow-hidden border-[#E8E4D5] dark:border-[#24312B] bg-gradient-to-b from-white to-[#F7F4EA]/40 dark:from-[#18211D] dark:to-[#111614]">
        <CardContent className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          {/* 3D Mascot Showcase */}
          <div className="relative shrink-0">
            <div className="w-40 h-40 md:w-52 md:h-52 rounded-3xl overflow-hidden shadow-lg border-2 border-[#16A66A]/30 bg-[#F7F4EA] dark:bg-[#101614] flex items-center justify-center p-2">
              <img
                src={POUPAGAIO_MASCOT_URL}
                alt="Mascote Poupagaio Finance"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#D6A84B] text-[#202724] px-2.5 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1 border border-white/40">
              <Sparkles className="w-3 h-3 text-[#075C45]" />
              <span>Poupagaio 3D</span>
            </div>
          </div>

          {/* Hero Messaging */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#16A66A]/15 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] text-xs font-semibold">
              <span>Espaço Atual:</span>
              <span className="font-bold">{currentSpace?.name || 'Pessoal'}</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl md:text-3xl font-bold font-display text-[#075C45] dark:text-[#78D9A6] tracking-tight">
                Bem-vindo(a), {userName}!
              </h1>
              <p className="text-base text-[#5E6963] dark:text-[#95A39B] max-w-xl">
                “Organize hoje. Voe mais longe.”
              </p>
              <p className="text-sm text-[#202724] dark:text-[#F7F4EA] pt-1">
                Vamos começar organizando sua vida financeira com tranquilidade, segurança e planejamento.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <Button
                id="btn-comecar"
                size="lg"
                variant="primary"
                onClick={() => setShowNextStepModal(true)}
                className="gap-2 text-base px-6 h-12 shadow-md cursor-pointer"
              >
                <span>Começar</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architectural Pillars / Foundation Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#075C45]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-[#202724] dark:text-[#F7F4EA]">
            Autenticação & Sessão
          </h3>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
            Sua conta está conectada de forma persistente e segura via Supabase Auth com senha protegida.
          </p>
        </Card>

        <Card className="p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#16A66A]/10 text-[#16A66A] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-[#202724] dark:text-[#F7F4EA]">
            Espaço Desacoplado
          </h3>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
            Seu espaço Pessoal foi criado automaticamente. A arquitetura já suporta Casal, Família e Empresa.
          </p>
        </Card>

        <Card className="p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#D6A84B]/15 text-[#D6A84B] dark:bg-[#D6A84B]/25 dark:text-[#F2D58A] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-[#202724] dark:text-[#F7F4EA]">
            Isolamento por RLS
          </h3>
          <p className="text-xs text-[#5E6963] dark:text-[#95A39B] leading-relaxed">
            Políticas de Row Level Security no PostgreSQL garantem que nenhum outro usuário veja seus registros.
          </p>
        </Card>
      </div>

      {/* Modal / Dialog triggered by "Começar" button */}
      {showNextStepModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#075C45] text-white flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display text-[#075C45] dark:text-[#78D9A6]">
                  Fundação Técnica Pronta!
                </h2>
                <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                  Poupagaio Finance — Etapa 1
                </p>
              </div>
            </div>

            <p className="text-sm text-[#202724] dark:text-[#F7F4EA] leading-relaxed">
              A fundação da sua aplicação está 100% construída com autenticação, perfis e a arquitetura de espaços desacoplada.
            </p>

            <div className="p-3.5 rounded-xl bg-[#F7F4EA] dark:bg-[#111614] border border-[#E8E4D5] dark:border-[#24312B] text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium text-[#075C45] dark:text-[#78D9A6]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Espaço Pessoal: Criado e ativo</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-[#075C45] dark:text-[#78D9A6]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Perfil: Sincronizado</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-[#075C45] dark:text-[#78D9A6]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Segurança: RLS e isolamento</span>
              </div>
            </div>

            <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
              Conforme as diretrizes da Etapa 1, os módulos financeiros (receitas, despesas, faturas, contas) serão integrados na próxima etapa sobre esta estrutura robusta.
            </p>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowNextStepModal(false)}
                className="w-full"
              >
                Entendido
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

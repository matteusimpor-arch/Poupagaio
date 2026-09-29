import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SUPABASE_SCHEMA_SQL } from '../../lib/schema-sql';
import { Database, Copy, Check, RefreshCw, ChevronDown, ChevronUp, AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/button';

export function SupabaseSchemaNotice() {
  const { isSchemaPending, recheckSchema, isLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  if (!isSchemaPending || isDismissed) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = SUPABASE_SCHEMA_SQL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCheck = async () => {
    setCheckMessage(null);
    const success = await recheckSchema();
    if (success) {
      setCheckMessage('Tabelas detectadas com sucesso no Supabase!');
    } else {
      setCheckMessage('As tabelas ainda não foram encontradas. Verifique se clicou em "Run" no SQL Editor do Supabase.');
    }
  };

  return (
    <div
      id="supabase-schema-notice"
      className="w-full bg-[#D6A84B]/10 dark:bg-[#D6A84B]/15 border-b border-[#D6A84B]/30 px-4 py-3 text-[#202724] dark:text-[#F7F4EA] transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D6A84B]/20 dark:bg-[#D6A84B]/30 flex items-center justify-center shrink-0 text-[#8A6318] dark:text-[#F2D58A] mt-0.5">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs font-display tracking-tight text-[#8A6318] dark:text-[#F2D58A]">
                Configuração do Supabase Pendente
              </span>
              <span className="text-[10px] bg-[#D6A84B]/20 text-[#8A6318] dark:text-[#F2D58A] px-1.5 py-0.2 rounded font-mono font-medium">
                PGRST205
              </span>
            </div>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B] mt-0.5">
              As tabelas (<code className="text-[#075C45] dark:text-[#78D9A6] font-mono">profiles</code>,{' '}
              <code className="text-[#075C45] dark:text-[#78D9A6] font-mono">spaces</code>,{' '}
              <code className="text-[#075C45] dark:text-[#78D9A6] font-mono">space_members</code>) precisam ser criadas no SQL Editor do Supabase para habilitar a persistência real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="text-xs h-8 gap-1.5 border-[#D6A84B]/40 hover:bg-[#D6A84B]/15 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8A6318] dark:text-[#F2D58A]" />
                <span>Copiar SQL</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs h-8 gap-1 cursor-pointer text-[#5E6963] dark:text-[#95A39B]"
          >
            <span>Instruções</span>
            {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          <Button
            size="sm"
            onClick={handleCheck}
            disabled={isLoading}
            className="text-xs h-8 gap-1.5 bg-[#075C45] hover:bg-[#075C45]/90 text-white dark:bg-[#16A66A] dark:text-[#101614] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Verificar</span>
          </Button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dispensar aviso"
            className="p-1 rounded text-[#5E6963] hover:text-[#202724] dark:text-[#95A39B] dark:hover:text-white cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Verification Feedback Message */}
      {checkMessage && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-[#D6A84B]/20 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#8A6318] dark:text-[#F2D58A] shrink-0" />
          <span>{checkMessage}</span>
        </div>
      )}

      {/* Collapsible Step-by-Step Instructions */}
      {showInstructions && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-[#D6A84B]/30 space-y-3 animate-in fade-in duration-200">
          <div className="grid md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/80 dark:bg-[#141C18]/80 p-3 rounded-xl border border-[#E8E4D5] dark:border-[#24312B]">
              <span className="font-bold text-[#075C45] dark:text-[#78D9A6] block mb-1">Passo 1</span>
              Acesse o seu painel do Supabase (<a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-medium text-[#16A66A]">supabase.com/dashboard</a>) e entre no seu projeto.
            </div>
            <div className="bg-white/80 dark:bg-[#141C18]/80 p-3 rounded-xl border border-[#E8E4D5] dark:border-[#24312B]">
              <span className="font-bold text-[#075C45] dark:text-[#78D9A6] block mb-1">Passo 2</span>
              No menu lateral esquerdo, clique no ícone do <strong>SQL Editor</strong> e crie uma nova query (+ New query).
            </div>
            <div className="bg-white/80 dark:bg-[#141C18]/80 p-3 rounded-xl border border-[#E8E4D5] dark:border-[#24312B]">
              <span className="font-bold text-[#075C45] dark:text-[#78D9A6] block mb-1">Passo 3</span>
              Cole o script copiado (botão acima "Copiar SQL"), clique em <strong>Run</strong> e depois volte aqui e clique em <strong>Verificar</strong>.
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#5E6963] dark:text-[#95A39B] pb-1 px-1">
              <span>Arquivo: supabase/schema.sql (198 linhas)</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[#075C45] dark:text-[#78D9A6] font-semibold hover:underline cursor-pointer"
              >
                {copied ? 'Copiado!' : 'Copiar todo o SQL'}
              </button>
            </div>
            <pre className="text-[11px] font-mono bg-black/5 dark:bg-black/40 p-3 rounded-xl max-h-48 overflow-y-auto border border-[#E8E4D5] dark:border-[#24312B] text-[#202724] dark:text-[#F7F4EA]">
              {SUPABASE_SCHEMA_SQL}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

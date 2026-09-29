import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sun, Moon, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { PoupagaioLogo } from '../branding/PoupagaioLogo';

export function ResetPasswordScreen() {
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    async function verifyRecoverySession() {
      if (!isSupabaseConfigured() || !supabase) {
        setIsValidSession(false);
        setErrorMessage('Supabase não configurado.');
        return;
      }

      const hash = window.location.hash;
      const isRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token');
      
      const { data, error } = await supabase.auth.getSession();
      if (error || (!data.session && !isRecoveryHash)) {
        setIsValidSession(false);
        setErrorMessage('Link de recuperação inválido ou expirado. Por favor, solicite um novo e-mail de redefinição.');
      } else {
        setIsValidSession(true);
      }
    }

    verifyRecoverySession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password || !confirmPassword) {
      setErrorMessage('Preencha todos os campos de senha.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase não inicializado.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message || 'Erro ao atualizar a senha.');
      } else {
        setSuccessMessage('Senha alterada com sucesso! Você já pode acessar sua conta com a nova senha.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao atualizar senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    window.location.hash = '';
    window.location.pathname = '/';
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F7F4EA] dark:bg-[#121212] text-[#202724] dark:text-[#F4F4F5] p-4 md:p-6 transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <PoupagaioLogo showText className="h-10 sm:h-11" />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="p-2.5 rounded-xl border border-[#E8E4D5] hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5 transition-colors cursor-pointer text-[#5E6963] dark:text-zinc-300"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <Card className="border-[#E8E4D5] dark:border-white/12 bg-white dark:bg-[#1A1A1A] shadow-xl overflow-hidden">
          <div className="p-6 pb-2 text-center flex flex-col items-center space-y-3">
            <PoupagaioLogo variant="hero" className="h-20 sm:h-24 md:h-28" />
            <div>
              <h1 className="text-xl font-bold font-display text-[#075C45] dark:text-[#34D399]">
                Redefinir Senha
              </h1>
              <p className="text-xs text-[#5E6963] dark:text-zinc-400 italic mt-0.5">
                “Organize hoje. Voe mais longe.”
              </p>
            </div>
          </div>

          <CardContent className="p-6 pt-4">
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs font-medium border border-red-200 dark:border-red-900/50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {isValidSession === false ? (
              <div className="space-y-4 text-center py-4">
                <p className="text-xs text-[#5E6963] dark:text-zinc-300">
                  O link de recuperação expirou ou é inválido. Por favor, retorne à tela de login e solicite um novo link de redefinição de senha.
                </p>
                <Button
                  type="button"
                  onClick={goToLogin}
                  variant="primary"
                  size="lg"
                  className="w-full gap-2 text-sm font-semibold"
                >
                  Voltar para o Login
                </Button>
              </div>
            ) : successMessage ? (
              <div className="space-y-4 text-center py-2">
                <Button
                  type="button"
                  onClick={goToLogin}
                  variant="primary"
                  size="lg"
                  className="w-full gap-2 text-sm font-semibold"
                >
                  Acessar com nova senha
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1">
                  <Input
                    id="new-password"
                    type="password"
                    label="Nova Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Input
                    id="confirm-password"
                    type="password"
                    label="Confirmar Nova Senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button
                  id="btn-update-password"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full gap-2 text-sm font-semibold"
                >
                  <Lock className="w-4 h-4" />
                  <span>Salvar Nova Senha</span>
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={goToLogin}
                    className="text-xs text-[#075C45] hover:underline dark:text-[#34D399] font-medium cursor-pointer"
                  >
                    Cancelar e voltar para o login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto py-2 text-center text-xs text-[#5E6963] dark:text-[#95A39B]">
        <span>Poupagaio Finance © {new Date().getFullYear()} — Todos os direitos reservados.</span>
      </div>
    </div>
  );
}

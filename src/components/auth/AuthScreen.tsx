import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { PoupagaioLogo } from '../branding/PoupagaioLogo';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sun, Moon, ArrowRight, CheckCircle2, Lock, Mail, User, ShieldCheck, AlertTriangle, Palette } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AppearanceModal } from '../preferences/AppearanceModal';

export function AuthScreen() {
  const { signIn, signUp, resetPassword, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearForm = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearForm();

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    const { error } = await signIn({ email: email.trim(), password });
    if (error) {
      setErrorMessage(error.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearForm();

    if (!fullName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    const { error, needsEmailConfirmation } = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else if (needsEmailConfirmation) {
      setSuccessMessage(
        'Conta criada! Enviamos um link de confirmação para seu e-mail. Confirme seu endereço para acessar o Poupagaio.'
      );
    } else {
      setSuccessMessage('Conta criada com sucesso!');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearForm();

    if (!email.trim()) {
      setErrorMessage('Digite seu e-mail para receber as instruções de recuperação.');
      return;
    }

    const { error } = await resetPassword(email.trim());
    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[var(--bg-page)] text-[var(--text-main)] p-4 md:p-6 transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <PoupagaioLogo showText className="h-10 sm:h-11" />

        <button
          type="button"
          onClick={() => setIsAppearanceModalOpen(true)}
          aria-label="Aparência e Temas"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D2DDD6] dark:border-[#28322C] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-bold text-[#075C45] dark:text-[#78D9A6]"
        >
          <Palette className="w-4 h-4 text-[#16A66A]" />
          <span>Aparência</span>
        </button>
      </div>

      {/* Main Center Auth Container */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <Card className="border-[#E8E4D5] dark:border-white/12 bg-white dark:bg-[#1A1A1A] shadow-xl overflow-hidden">
          {/* Header Brand */}
          <div className="p-6 pb-2 text-center flex flex-col items-center space-y-3">
            <PoupagaioLogo variant="hero" className="h-20 sm:h-24 md:h-28" />
            <div>
              <h1 className="text-xl font-bold font-display text-[#075C45] dark:text-[#34D399]">
                Poupagaio Finance
              </h1>
              <p className="text-xs text-[#5E6963] dark:text-zinc-400 italic mt-0.5">
                “Organize hoje. Voe mais longe.”
              </p>
            </div>
          </div>

          {!isSupabaseConfigured() && (
            <div className="mx-6 mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Configuração do Supabase não encontrada.</span>
            </div>
          )}

           {/* Tab Switcher (Login / Register) */}
          {mode !== 'forgot' && (
            <div className="px-6 pt-2 pb-0">
              <div className="grid grid-cols-2 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-[#E8E4D5]/60 dark:border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  id="tab-login"
                  onClick={() => {
                    setMode('login');
                    clearForm();
                  }}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-[#2A2A2E] text-[#075C45] dark:text-[#34D399] shadow-sm font-bold'
                      : 'text-[#5E6963] dark:text-zinc-400 hover:text-[#202724] dark:hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  id="tab-register"
                  onClick={() => {
                    setMode('register');
                    clearForm();
                  }}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-[#2A2A2E] text-[#075C45] dark:text-[#34D399] shadow-sm font-bold'
                      : 'text-[#5E6963] dark:text-zinc-400 hover:text-[#202724] dark:hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
              </div>
            </div>
          )}

          <CardContent className="p-6 pt-4">
            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs font-medium border border-red-200 dark:border-red-900/50">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                {successMessage}
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Input
                    id="login-email"
                    type="email"
                    label="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Input
                    id="login-password"
                    type="password"
                    label="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        clearForm();
                      }}
                      className="text-xs text-[#075C45] hover:underline dark:text-[#78D9A6] font-medium cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </div>

                <Button
                  id="btn-submit-login"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full gap-2 text-sm font-semibold"
                >
                  <Lock className="w-4 h-4" />
                  <span>Acessar Conta</span>
                </Button>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  id="register-fullname"
                  type="text"
                  label="Nome Completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  required
                />

                <Input
                  id="register-email"
                  type="email"
                  label="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  autoComplete="email"
                  required
                />

                <Input
                  id="register-password"
                  type="password"
                  label="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  helperText="A senha é protegida diretamente pelo Supabase Auth"
                  required
                />

                <Button
                  id="btn-submit-register"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full gap-2 text-sm font-semibold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cadastrar e Criar Espaço</span>
                </Button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#075C45] dark:text-[#78D9A6]">
                    Recuperação de Senha
                  </h3>
                  <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
                    Informe seu e-mail cadastrado. Enviaremos as orientações de redefinição.
                  </p>
                </div>

                <Input
                  id="forgot-email"
                  type="email"
                  label="E-mail Cadastrado"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  autoComplete="email"
                  required
                />

                <Button
                  id="btn-submit-forgot"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full gap-2 text-sm font-semibold"
                >
                  <Mail className="w-4 h-4" />
                  <span>Enviar Instruções</span>
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      clearForm();
                    }}
                    className="text-xs text-[#075C45] hover:underline dark:text-[#78D9A6] font-medium cursor-pointer"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Quick Credentials Info / Architecture reassurance */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            Autenticação segura via Supabase Auth • Criptografia e Row Level Security
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto py-2 text-center text-xs text-[#5E6963] dark:text-[#95A39B]">
        <span>Poupagaio Finance © {new Date().getFullYear()} — Todos os direitos reservados.</span>
      </div>

      <AppearanceModal
        isOpen={isAppearanceModalOpen}
        onClose={() => setIsAppearanceModalOpen(false)}
      />
    </div>
  );
}

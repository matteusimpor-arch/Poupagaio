import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar } from '../ui/avatar';
import { Shield, Eye, EyeOff } from 'lucide-react';

interface ProfileCardProps {
  fullName: string;
  setFullName: (name: string) => void;
  handleSaveName: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export function ProfileCard({ fullName, setFullName, handleSaveName, isSaving, saveSuccess }: ProfileCardProps) {
  const { user, profile } = useAuth();
  const storageKey = user ? `poupagaio_user_phrase_${user.id}` : 'poupagaio_user_phrase';
  const [phrase, setPhrase] = React.useState(() => localStorage.getItem(storageKey) || '');

  React.useEffect(() => {
    if (user?.id) {
      setPhrase(localStorage.getItem(`poupagaio_user_phrase_${user.id}`) || '');
    }
  }, [user?.id]);

  const onSave = (e: React.FormEvent) => {
    localStorage.setItem(storageKey, phrase.trim());
    handleSaveName(e);
  };

  return (
    <Card className="bg-white dark:bg-[#18211D]">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar src={profile?.avatar_url} name={fullName} size="lg" />
          <div className="space-y-1 min-w-0">
            <CardTitle>Informações do Perfil</CardTitle>
            {phrase ? (
              <p className="text-xs text-[#075C45] dark:text-[#78D9A6] italic truncate">
                “{phrase}”
              </p>
            ) : (
              <p className="text-sm text-gray-500">Seus dados básicos na aplicação.</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
              Nome Completo
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
              Frase ou Lema Pessoal <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Ex: Organize hoje. Voe mais longe."
              maxLength={120}
            />
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              Sua frase motivacional de finanças ou lembrete pessoal.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>Salvar alterações</Button>
          </div>
          {saveSuccess && <p className="text-xs text-emerald-500">Salvo com sucesso!</p>}
        </form>
      </CardContent>
    </Card>
  );
}

interface SecurityCardProps {
  newPassword: string;
  setNewPassword: (p: string) => void;
  confirmPassword: string;
  setConfirmPassword: (p: string) => void;
  showPassword: boolean;
  setShowPassword: (s: boolean) => void;
  handleUpdatePassword: (e: React.FormEvent) => void;
  isUpdatingPassword: boolean;
  passwordSuccess: boolean;
  passwordError: string;
}

export function SecurityCard({
  newPassword, setNewPassword, confirmPassword, setConfirmPassword,
  showPassword, setShowPassword, handleUpdatePassword, isUpdatingPassword,
  passwordSuccess, passwordError
}: SecurityCardProps) {
  return (
    <Card className="bg-white dark:bg-[#18211D]">
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Segurança da Conta</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="relative">
            <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha" />
            <button type="button" className="absolute right-3 top-2.5 text-gray-500" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar nova senha" />
          <p className="text-xs text-gray-500">A nova senha deve ter pelo menos 6 caracteres.</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={isUpdatingPassword}>Alterar senha</Button>
          </div>
          {passwordSuccess && <p className="text-xs text-emerald-500">Senha atualizada!</p>}
          {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

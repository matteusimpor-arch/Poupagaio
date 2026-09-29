import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAssistant } from '../../hooks/useAssistant';
import { spaceService } from '../../lib/services/space';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { LogOut, Users, ChevronRight } from 'lucide-react';
import { Space, SpaceType, SpaceRole, SpaceMember } from '../../types';
import { ProfileCard, SecurityCard } from './ProfileTab';
import { SpacesTab } from './SpacesTab';
import { ThemeSelector } from '../preferences/ThemeSelector';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function ProfileScreen() {
  const { user, profile, spaces, memberships, currentSpace, updateProfileName, updatePassword, createSpace, updateSpaceName, deleteSpace, setCurrentSpace, signOut } = useAuth();
  const { showAssistant, toggleAssistant } = useAssistant();
  
  const [isManageSpacesOpen, setIsManageSpacesOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || user?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const [activeSpaceMembers, setActiveSpaceMembers] = useState<SpaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<SpaceType>('couple');
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [editSpaceName, setEditSpaceName] = useState(currentSpace?.name || '');
  const [isUpdatingSpaceName, setIsUpdatingSpaceName] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null);
  const [isDeletingSpace, setIsDeletingSpace] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  useEffect(() => {
    if (profile?.full_name || user?.full_name) {
      setFullName(profile?.full_name || user?.full_name || '');
    }
  }, [profile?.full_name, user?.full_name]);

  useEffect(() => {
    if (currentSpace) {
      setEditSpaceName(currentSpace.name);
    }
  }, [currentSpace]);

  useEffect(() => {
    const loadActiveSpaceMembers = async (spaceId: string) => {
      setIsLoadingMembers(true);
      try {
        const members = await spaceService.getSpaceMembers(spaceId);
        setActiveSpaceMembers(members);
      } catch (err) {
        console.warn('Erro ao carregar membros:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    if (currentSpace?.id) {
      loadActiveSpaceMembers(currentSpace.id);
    }
  }, [currentSpace?.id]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setErrorMsg('O nome não pode ficar vazio.'); return; }
    setIsSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);
    const { error } = await updateProfileName(fullName.trim());
    setIsSaving(false);
    if (error) { setErrorMsg(error.message); } else { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPasswordError('As senhas não coincidem.'); return; }
    if (newPassword.length < 6) { setPasswordError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);
    const { error } = await updatePassword(newPassword);
    setIsUpdatingPassword(false);
    if (error) { setPasswordError(error.message); } else { setPasswordSuccess(true); setNewPassword(''); setConfirmPassword(''); setTimeout(() => setPasswordSuccess(false), 3000); }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    setIsCreatingSpace(true);
    await createSpace(newSpaceName.trim(), newSpaceType);
    setIsCreatingSpace(false);
    setNewSpaceName('');
  };

  const handleUpdateSpaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSpace) return;
    setIsUpdatingSpaceName(true);
    await updateSpaceName(currentSpace.id, editSpaceName.trim());
    setIsUpdatingSpaceName(false);
  };

  const handleDeleteSpace = async () => {
    if (!spaceToDelete) return;
    setIsDeletingSpace(true);
    const { error } = await spaceService.deleteSpace(spaceToDelete.id);
    setIsDeletingSpace(false);
    if (!error) {
      setSpaceToDelete(null);
      setDeleteConfirmationName('');
    }
  };

  const getRoleLabel = (role?: SpaceRole) => role === 'owner' ? 'Proprietário' : role === 'admin' ? 'Administrador' : 'Membro';
  const getRoleBadgeColor = (role?: SpaceRole) => role === 'owner' ? 'bg-amber-100 text-amber-800' : role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';
  const currentSpaceRole = memberships.find((m) => m.space_id === currentSpace?.id)?.role || (currentSpace?.owner_id === user?.id ? 'owner' : 'member');
  
  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'personal': return 'Pessoal';
      case 'couple': return 'Casal';
      case 'family': return 'Família';
      case 'business': return 'Empresa';
      default: return type;
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'personal': return '🏠';
      case 'couple': return '♥';
      case 'family': return '👥';
      case 'business': return '💼';
      default: return '📁';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-4 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#075C45] dark:text-[#78D9A6]">Meu Perfil & Configurações</h1>
        <p className="text-gray-500">Gerencie suas informações, espaços e a segurança da sua conta.</p>
      </div>
      
      {/* LINHA 1: Perfil + Segurança */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProfileCard 
          fullName={fullName} setFullName={setFullName} handleSaveName={handleSaveName} isSaving={isSaving} saveSuccess={saveSuccess}
        />
        <SecurityCard
          newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          showPassword={showPassword} setShowPassword={setShowPassword} handleUpdatePassword={handleUpdatePassword} isUpdatingPassword={isUpdatingPassword}
          passwordSuccess={passwordSuccess} passwordError={passwordError}
        />
      </div>

      {/* LINHA 2: Espaços */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-green-700" />
                <div>
                    <h2 className="text-lg font-bold">Espaços</h2>
                    <p className="text-sm text-gray-500">Organize suas finanças pessoais, do casal, da família ou da empresa.</p>
                </div>
            </div>
            <Button variant="ghost" className="text-green-700" onClick={() => setIsManageSpacesOpen(true)}>Gerenciar espaços <ChevronRight className="w-4 h-4 ml-1"/></Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map(s => (
                <Card key={s.id} className={currentSpace?.id === s.id ? 'border-2 border-green-500' : 'border'}>
                    <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{getCategoryIcon(s.type)}</span>
                            {currentSpace?.id === s.id && <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Ativo</span>}
                        </div>
                        <div>
                            <p className="font-bold">{s.name}</p>
                            <p className="text-sm text-gray-500">{getCategoryLabel(s.type)}</p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>

        <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-sm text-green-800">
            <strong>💡 Dica:</strong> Você pode ter múltiplos espaços para separar suas finanças por objetivo. O espaço Pessoal não pode ser excluído.
        </div>
      </div>

      {/* LINHA DE APARÊNCIA & TEMAS */}
      <div className="bg-white dark:bg-[#18211D] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
        <ThemeSelector />
      </div>

      {/* LINHA 3: Preferências de Exibição */}
      <div className="flex items-center justify-between p-6 bg-white dark:bg-[#18211D] rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <img src={POUPAGAIO_MASCOT_URL} alt="Poupagaio" className="w-8 h-8 object-contain shrink-0" />
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100">Assistente Poupagaio</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Exibe o Poupagaio e seus atalhos rápidos nas telas.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
            showAssistant ? 'bg-[#16A66A]/15 text-[#16A66A]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
          }`}>
            {showAssistant ? 'ON' : 'OFF'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showAssistant}
            onClick={toggleAssistant}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              showAssistant ? 'bg-[#16A66A]' : 'bg-[#D2DDD6] dark:bg-[#28322C]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                showAssistant ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* LINHA 4: Sair */}
      <div className="flex items-center justify-between p-6 bg-white dark:bg-[#18211D] rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <LogOut className="w-5 h-5 text-red-500" />
          <div>
            <p className="font-bold">Sair da Conta</p>
            <p className="text-sm text-gray-500">Encerre sua sessão atual com segurança.</p>
          </div>
        </div>
        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" size="sm" onClick={() => signOut()}>Sair da Conta</Button>
      </div>

      {/* Panel/Modal for Spaces Management */}
      {isManageSpacesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Gerenciar Espaços</h2>
                <p className="text-sm text-gray-500">Crie e organize ambientes separados para suas finanças.</p>
              </div>
              <Button variant="ghost" onClick={() => setIsManageSpacesOpen(false)}>Fechar</Button>
            </div>

            <SpacesTab 
              spaces={spaces} currentSpace={currentSpace} setCurrentSpace={setCurrentSpace} currentSpaceRole={currentSpaceRole}
              activeSpaceMembers={activeSpaceMembers} getRoleLabel={getRoleLabel} getRoleBadgeColor={getRoleBadgeColor}
              handleCreateSpace={handleCreateSpace} newSpaceName={newSpaceName} setNewSpaceName={setNewSpaceName}
              newSpaceType={newSpaceType} setNewSpaceType={setNewSpaceType} isCreatingSpace={isCreatingSpace}
              handleUpdateSpaceName={handleUpdateSpaceName} editSpaceName={editSpaceName} setEditSpaceName={setEditSpaceName}
              isUpdatingSpaceName={isUpdatingSpaceName} setSpaceToDelete={setSpaceToDelete}
              spaceToDelete={spaceToDelete} handleDeleteSpace={handleDeleteSpace}
              deleteConfirmationName={deleteConfirmationName} setDeleteConfirmationName={setDeleteConfirmationName}
              isDeletingSpace={isDeletingSpace}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Space, SpaceMember, SpaceRole, SpaceType } from '../../types';

interface SpacesTabProps {
  spaces: Space[];
  currentSpace: Space | null;
  setCurrentSpace: (s: Space) => void;
  currentSpaceRole: SpaceRole;
  activeSpaceMembers: SpaceMember[];
  getRoleLabel: (role?: SpaceRole) => string;
  getRoleBadgeColor: (role?: SpaceRole) => string;
  handleCreateSpace: (e: React.FormEvent) => void;
  newSpaceName: string;
  setNewSpaceName: (name: string) => void;
  newSpaceType: SpaceType;
  setNewSpaceType: (type: SpaceType) => void;
  isCreatingSpace: boolean;
  handleUpdateSpaceName: (e: React.FormEvent) => void;
  editSpaceName: string;
  setEditSpaceName: (name: string) => void;
  isUpdatingSpaceName: boolean;
  setSpaceToDelete: (s: Space | null) => void;
  spaceToDelete: Space | null;
  handleDeleteSpace: () => void;
  deleteConfirmationName: string;
  setDeleteConfirmationName: (name: string) => void;
  isDeletingSpace: boolean;
}

export function SpacesTab({
  spaces, currentSpace, setCurrentSpace, currentSpaceRole, activeSpaceMembers,
  getRoleLabel, getRoleBadgeColor, handleCreateSpace, newSpaceName, setNewSpaceName,
  newSpaceType, setNewSpaceType, isCreatingSpace, handleUpdateSpaceName,
  editSpaceName, setEditSpaceName, isUpdatingSpaceName, setSpaceToDelete,
  spaceToDelete, handleDeleteSpace, deleteConfirmationName, setDeleteConfirmationName, isDeletingSpace
}: SpacesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Seus Espaços ({spaces.length})</h3>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ Novo Espaço</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map(s => (
          <Card key={s.id} className={currentSpace?.id === s.id ? 'border-2 border-green-500' : 'border'}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-2xl">{getCategoryIcon(s.type)}</span>
                {currentSpace?.id === s.id && <Badge className="bg-green-100 text-green-700">Ativo</Badge>}
              </div>
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-gray-500">{getCategoryLabel(s.type)}</p>
                <p className="text-sm text-gray-500">👥 {activeSpaceMembers.length} membros</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setCurrentSpace(s); setIsManageModalOpen(true); }}>Gerenciar</Button>
                {s.type !== 'personal' && currentSpaceRole === 'owner' && (
                  <Button variant="outline" size="sm" className="text-red-500 border-red-200" onClick={() => setSpaceToDelete(s)}>Excluir</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dica */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-sm text-green-800">
        <strong>💡 Dica:</strong> Você pode ter múltiplos espaços para separar suas finanças por objetivo. O espaço Pessoal não pode ser excluído.
      </div>
...

      {/* Modal Criar */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Criar Novo Espaço</h2>
            <form onSubmit={(e) => { handleCreateSpace(e); setIsCreateModalOpen(false); }} className="space-y-4">
              <Input value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Nome do novo espaço" required />
              <select value={newSpaceType} onChange={(e) => setNewSpaceType(e.target.value as SpaceType)} className="w-full p-2 border rounded">
                <option value="couple">Casal</option>
                <option value="family">Família</option>
                <option value="business">Empresa</option>
              </select>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isCreatingSpace}>Criar espaço</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Gerenciar */}
      {isManageModalOpen && currentSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Gerenciar Espaço: {currentSpace.name}</h2>
            <form onSubmit={(e) => { handleUpdateSpaceName(e); setIsManageModalOpen(false); }} className="space-y-4">
              <Input value={editSpaceName} onChange={(e) => setEditSpaceName(e.target.value)} placeholder="Nome do espaço" />
              <Button type="submit" disabled={isUpdatingSpaceName}>Renomear</Button>
            </form>
            <div className="mt-6">
              <p className="font-bold">Membros ({activeSpaceMembers.length})</p>
              {activeSpaceMembers.map(m => (
                <div key={m.id} className="flex justify-between items-center py-2">
                  <span>{m.profile?.full_name || 'Usuário'}</span>
                  <Badge className={getRoleBadgeColor(m.role)}>{getRoleLabel(m.role)}</Badge>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" variant="ghost" onClick={() => setIsManageModalOpen(false)}>Fechar</Button>
          </Card>
        </div>
      )}

      {/* Modal Exclusão */}
      {spaceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Excluir {spaceToDelete.name}?</h2>
            <p className="mb-4 text-sm">Digite o nome do espaço para confirmar:</p>
            <Input value={deleteConfirmationName} onChange={(e) => setDeleteConfirmationName(e.target.value)} />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" onClick={() => setSpaceToDelete(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDeleteSpace} disabled={deleteConfirmationName !== spaceToDelete.name || isDeletingSpace}>Excluir</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ChevronDown, Check, User, Users, Home, Building2 } from 'lucide-react';

export interface SpaceSelectorProps {
  hideIcon?: boolean;
}

export function SpaceSelector({ hideIcon = false }: SpaceSelectorProps) {
  const { currentSpace, spaces, setCurrentSpace, memberships, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSpaceTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return User;
      case 'couple':
        return Home;
      case 'family':
        return Users;
      case 'business':
        return Building2;
      default:
        return User;
    }
  };

  const getSpaceTypeLabel = (type: string) => {
    switch (type) {
      case 'personal':
        return 'Pessoal';
      case 'couple':
        return 'Casal';
      case 'family':
        return 'Família';
      case 'business':
        return 'Empresa';
      default:
        return 'Outro';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietário';
      case 'admin':
        return 'Administrador';
      case 'member':
        return 'Membro';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  const ActiveIcon = currentSpace ? getSpaceTypeIcon(currentSpace.type) : User;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        id="space-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#E8E4D5] bg-white hover:bg-black/5 dark:border-[#24312B] dark:bg-[#18211D] dark:hover:bg-white/5 transition-all duration-150 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {!hideIcon && (
            <div className="w-8 h-8 rounded-lg bg-[#16A66A]/15 text-[#075C45] dark:bg-[#16A66A]/25 dark:text-[#78D9A6] flex items-center justify-center shrink-0">
              <ActiveIcon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#5E6963] dark:text-[#95A39B] uppercase font-semibold tracking-wider">
                Espaço Ativo
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16A66A]"></span>
            </div>
            <p className="text-sm font-semibold truncate text-[#202724] dark:text-[#F7F4EA]">
              {currentSpace ? currentSpace.name : 'Pessoal'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#5E6963] dark:text-[#95A39B] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[260px] max-w-sm rounded-2xl border border-[#E8E4D5] bg-white p-2 shadow-xl dark:border-[#24312B] dark:bg-[#18211D] z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-[#E8E4D5]/60 dark:border-[#24312B]/60 mb-1">
            <p className="text-xs font-semibold text-[#5E6963] dark:text-[#95A39B] uppercase tracking-wider">
              Seus Espaços Financeiros
            </p>
          </div>

          <div className="space-y-1">
            {spaces.map((space) => {
              const isSelected = currentSpace?.id === space.id;
              const spaceRole = memberships?.find((m) => m.space_id === space.id)?.role ||
                (space.owner_id === user?.id ? 'owner' : 'member');
              const SpaceIcon = getSpaceTypeIcon(space.type);

              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => {
                    setCurrentSpace(space);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#16A66A]/10 text-[#075C45] dark:bg-[#16A66A]/20 dark:text-[#78D9A6] font-semibold'
                      : 'hover:bg-black/5 text-[#202724] dark:hover:bg-white/5 dark:text-[#F7F4EA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#16A66A]/15 text-[#075C45] dark:text-[#78D9A6]'
                        : 'bg-black/5 text-[#5E6963] dark:bg-white/5 dark:text-[#95A39B]'
                    }`}>
                      <SpaceIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-[#202724] dark:text-[#F7F4EA]">{space.name}</p>
                      <span className="text-[10px] text-[#5E6963] dark:text-[#95A39B] block truncate capitalize">
                        {getSpaceTypeLabel(space.type)} • {getRoleLabel(spaceRole)}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#16A66A] shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

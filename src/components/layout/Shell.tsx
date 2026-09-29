import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useAssistant } from '../../hooks/useAssistant';
import { POUPAGAIO_MASCOT_URL } from '../../assets/mascot';
import { PoupagaioLogo } from '../branding/PoupagaioLogo';
import { SpaceSelector } from './SpaceSelector';
import { SupabaseSchemaNotice } from './SupabaseSchemaNotice';
import { FloatingPoupagaio } from './FloatingPoupagaio';
import { BotanicalLeaves } from './BotanicalLeaves';
import { Avatar } from '../ui/avatar';
import { checklistService, FinancialAlert } from '../../lib/services/checklist';
import { formatCurrency } from '../../lib/formatters';
import {
  Home,
  ArrowUpRight,
  ArrowLeftRight,
  CreditCard,
  FileText,
  Calendar,
  ShoppingBag,
  Target,
  Gift,
  CalendarCheck,
  BarChart3,
  Sun,
  Moon,
  LogOut,
  X,
  Bell,
  AlertCircle,
  Clock,
  HelpCircle,
  Menu,
  Youtube,
  Instagram,
  Linkedin,
  MoreHorizontal,
  ChevronDown,
  PiggyBank,
  Palette,
} from 'lucide-react';
import { ActiveTab } from '../../types';
import { AppearanceModal } from '../preferences/AppearanceModal';
import { EntryModal } from '../entries/EntryModal';
import { VariableExpenseModal } from '../variable-expenses/VariableExpenseModal';
import { FixedExpenseModal } from '../fixed-expenses/FixedExpenseModal';
import { InstallmentPurchaseModal } from '../installments/InstallmentPurchaseModal';
import { entriesService } from '../../lib/services/entries';
import { variableExpensesService } from '../../lib/services/variableExpenses';
import { fixedExpensesService } from '../../lib/services/fixedExpenses';
import { installmentsService } from '../../lib/services/installments';
import {
  CreateEntryInput,
  UpdateEntryInput,
  CreateVariableExpenseInput,
  UpdateVariableExpenseInput,
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  CreateInstallmentPurchaseInput,
  UpdateInstallmentPurchaseInput,
} from '../../types';

interface ShellProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  children: React.ReactNode;
  selectedYear?: number;
  selectedMonth?: number;
  onRefreshData?: () => void;
}

export function Shell({
  currentTab,
  onSelectTab,
  children,
  selectedYear,
  selectedMonth,
  onRefreshData,
}: ShellProps) {
  const { user, profile, currentSpace, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showAssistant, toggleAssistant } = useAssistant();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // State for direct creation modals opened via Poupagaio
  const [poupagaioModal, setPoupagaioModal] = useState<
    'entries' | 'variable_expenses' | 'fixed_expenses' | 'installments' | null
  >(null);

  // Save handlers for Poupagaio direct modals
  const handleSaveEntryPoupagaio = async (data: CreateEntryInput | UpdateEntryInput): Promise<boolean> => {
    if (!user || !currentSpace?.id) return false;
    const res = await entriesService.createEntry(user.id, data as CreateEntryInput);
    if (res.error) {
      throw new Error(res.error);
    }
    setPoupagaioModal(null);
    if (onRefreshData) onRefreshData();
    return true;
  };

  const handleSaveVariableExpensePoupagaio = async (data: CreateVariableExpenseInput | UpdateVariableExpenseInput): Promise<boolean> => {
    if (!user || !currentSpace?.id) return false;
    const res = await variableExpensesService.createVariableExpense(user.id, data as CreateVariableExpenseInput);
    if (res.error) {
      throw new Error(res.error);
    }
    setPoupagaioModal(null);
    if (onRefreshData) onRefreshData();
    return true;
  };

  const handleSaveFixedExpensePoupagaio = async (data: CreateFixedExpenseInput | UpdateFixedExpenseInput): Promise<boolean> => {
    if (!user || !currentSpace?.id) return false;
    const res = await fixedExpensesService.createFixedExpense(user.id, data as CreateFixedExpenseInput);
    if (res.error) {
      throw new Error(res.error);
    }
    setPoupagaioModal(null);
    if (onRefreshData) onRefreshData();
    return true;
  };

  const handleSaveInstallmentPoupagaio = async (input: CreateInstallmentPurchaseInput | UpdateInstallmentPurchaseInput): Promise<{ success: boolean; error?: string }> => {
    if (!user || !currentSpace?.id) return { success: false, error: 'Espaço indisponível' };
    const res = await installmentsService.createPurchase({
      ...input,
      space_id: currentSpace.id,
    } as CreateInstallmentPurchaseInput);
    if (!res.error) {
      setPoupagaioModal(null);
      if (onRefreshData) onRefreshData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function loadAlerts() {
      if (!currentSpace?.id) return;
      const now = new Date();
      try {
        const res = await checklistService.getMonthlyChecklist(currentSpace.id, now.getFullYear(), now.getMonth() + 1);
        setAlerts(res.alerts);
      } catch (e) {
        console.warn('Erro ao carregar alertas na barra de navegação:', e);
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [currentSpace?.id]);

  const navItems: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'movements', label: 'Movimentações', icon: ArrowLeftRight },
    { id: 'planning', label: 'Planejamento', icon: Target },
    { id: 'reserves', label: 'Reservas', icon: PiggyBank },
    { id: 'entries', label: 'Entradas', icon: ArrowUpRight },
    { id: 'fixed_expenses', label: 'Gastos Fixos', icon: FileText },
    { id: 'variable_expenses', label: 'Gastos Variáveis', icon: CreditCard },
    { id: 'installments', label: 'Parcelados', icon: Calendar },
    { id: 'market', label: 'Mercado', icon: ShoppingBag },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'wishlist', label: 'Lista de Desejos', icon: Gift },
    { id: 'reports', label: 'Visão Financeira', icon: BarChart3 },
    { id: 'closing', label: 'Fechamento', icon: CalendarCheck },
    { id: 'support', label: 'Suporte', icon: HelpCircle },
  ];

  const mainNavItems = navItems.filter((item) =>
    ['home', 'movements', 'planning', 'reports', 'closing'].includes(item.id)
  );

  const secondaryNavItems = navItems.filter(
    (item) => !['home', 'movements', 'planning', 'reports', 'closing'].includes(item.id)
  );

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === currentTab);
  const activeSecondaryItem = secondaryNavItems.find((item) => item.id === currentTab);

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsMoreMenuOpen(false);
  };

  const handleHomeClick = () => {
    if (currentTab !== 'home') {
      handleNavClick('home');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#EAEDEB] dark:bg-[#121614] text-[#202724] dark:text-[#F4F4F5] transition-colors duration-200 relative overflow-x-hidden">
      {/* Botanical Background Leaf Elements */}
      <BotanicalLeaves />

      {/* DESKTOP + MOBILE STICKY TRANSLUCENT NAVIGATION HEADER */}
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-all duration-300 select-none ${
          isScrolled
            ? 'bg-[#EBF0EC]/95 dark:bg-[#161B18]/95 border-[#D2DDD6] dark:border-[#28322C] shadow-2xs opacity-100'
            : 'bg-[#EBF0EC]/80 dark:bg-[#161B18]/80 border-[#D2DDD6]/50 dark:border-[#28322C]/50 opacity-95 hover:opacity-100'
        }`}
      >
        {/* Top line: Brand, Space Selector & User Controls */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 gap-2 sm:gap-4 max-w-[1480px] mx-auto">
          {/* Left: Brand & Space */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div
              className="cursor-pointer shrink-0"
              onClick={() => handleNavClick('home')}
              title="Poupagaio Finance - Início"
            >
              <PoupagaioLogo
                showText
                subtitle="Organize hoje, conquiste amanhã."
                className="h-10 sm:h-12 md:h-14"
              />
            </div>

            <div className="h-5 w-px bg-[#DCE2DE] dark:bg-[#2B322F] hidden sm:block shrink-0" />

            <div className="hidden sm:block min-w-[150px] md:min-w-[180px]">
              <SpaceSelector />
            </div>
          </div>

          {/* Right: Notifications, Theme & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sino de Notificações */}
            <div className="relative">
              <button
                type="button"
                id="header-notifications-btn"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                aria-label="Notificações"
                className="p-2 rounded-xl border border-[#DCE2DE] hover:bg-black/5 dark:border-[#2B322F] dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer relative transition-colors"
              >
                <Bell className="w-4 h-4" />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white dark:ring-[#1C211E]" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#DCE2DE] dark:border-[#2B322F] bg-white dark:bg-[#1C211E] p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DCE2DE] dark:border-[#2B322F]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#02402E] dark:text-[#78D9A6] flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-[#16A66A]" />
                      Alertas Ativos ({alerts.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="p-1 text-[#5E6963] dark:text-[#95A39B] hover:text-[#202724] dark:hover:text-[#F4F4F5] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {alerts.length === 0 ? (
                    <div className="py-5 text-center space-y-1">
                      <p className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
                        Tudo em dia!
                      </p>
                      <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                        Você não tem lembretes ou avisos pendentes.
                      </p>
                    </div>
                  ) : (
                    <div className="py-2 divide-y divide-[#DCE2DE]/50 dark:divide-[#2B322F]/50 max-h-[280px] overflow-y-auto">
                      {alerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            onSelectTab('calendar');
                          }}
                          className="py-2.5 text-left cursor-pointer hover:bg-black/2 dark:hover:bg-white/2 transition-colors flex items-start gap-2.5"
                        >
                          {alert.severity === 'critical' ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#202724] dark:text-[#F4F4F5] truncate">
                              {alert.title}
                            </p>
                            <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B]">
                              Vence em: {alert.dueDate.split('-').reverse().join('/')} • {formatCurrency(alert.amount)}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            alert.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}>
                            {alert.badgeText}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Alternar Tema / Aparência */}
            <button
              type="button"
              id="topbar-toggle-theme"
              onClick={() => setIsAppearanceModalOpen(true)}
              aria-label="Aparência e Temas"
              className="flex items-center justify-center p-2 rounded-xl border border-[#D2DDD6] bg-white/70 dark:bg-[#1C211E]/70 dark:border-[#2B322F] hover:bg-[#16A66A]/10 text-xs font-bold text-[#02402E] dark:text-[#78D9A6] cursor-pointer transition-colors shadow-2xs shrink-0"
              title="Personalizar Tema & Aparência"
            >
              <Palette className="w-4 h-4 text-[#16A66A] shrink-0" />
              <span className="sr-only">Aparência</span>
            </button>

            {/* Perfil & Menu do Usuário */}
            <div className="relative">
              <button
                type="button"
                id="topbar-profile-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl border transition-colors cursor-pointer text-left ${
                  currentTab === 'profile' || isUserMenuOpen
                    ? 'bg-[#16A66A]/15 border-[#16A66A]/40 text-[#02402E] dark:bg-[#16A66A]/25 dark:text-[#78D9A6]'
                    : 'border-[#DCE2DE] dark:border-[#2B322F] hover:bg-black/5 text-[#202724] dark:hover:bg-white/5 dark:text-[#F4F4F5]'
                }`}
              >
                <Avatar
                  name={profile?.full_name || user?.full_name || user?.email || 'U'}
                  size="sm"
                />
                <span className="text-xs font-bold max-w-[90px] truncate hidden md:inline">
                  {profile?.full_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#5E6963] transition-transform duration-200 hidden md:inline ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu do Usuário */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1C211E] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="px-3 py-2 border-b border-[#E2ECE6] dark:border-[#28322C]">
                      <p className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6] truncate">
                        {profile?.full_name || user?.full_name || 'Usuário'}
                      </p>
                      <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] truncate">
                        {user?.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      id="dropdown-appearance-btn"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsAppearanceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-left text-[#02402E] dark:text-[#78D9A6] bg-[#16A66A]/10 hover:bg-[#16A66A]/20 transition-colors cursor-pointer"
                    >
                      <Palette className="w-4 h-4 text-[#16A66A] shrink-0" />
                      <span>🎨 Aparência (Temas)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleNavClick('profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left text-[#202724] dark:text-[#F4F4F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Home className="w-4 h-4 text-[#16A66A] shrink-0" />
                      <span>Meu Perfil & Configurações</span>
                    </button>

                    <div className="pt-1 border-t border-[#E2ECE6] dark:border-[#28322C]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-[#DCE2DE] dark:border-[#2B322F] hover:bg-black/5 dark:hover:bg-white/5 text-[#5E6963] dark:text-[#95A39B] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Sair */}
            <button
              type="button"
              id="topbar-logout-btn"
              onClick={() => signOut()}
              aria-label="Sair da conta"
              title="Sair"
              className="hidden sm:flex p-2 rounded-xl hover:bg-red-50 text-red-600 dark:hover:bg-red-950/40 dark:text-red-400 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Space Selector Bar (Prevents congestion on mobile header) */}
        <div className="sm:hidden px-3 py-1.5 border-t border-[#D2DDD6]/60 dark:border-[#28322C]/60 bg-[#EBF0EC]/90 dark:bg-[#161B18]/90 flex items-center gap-2">
          <button
            type="button"
            onClick={handleHomeClick}
            aria-label="Ir para o início"
            title="Início"
            className="flex items-center justify-center w-12 self-stretch rounded-xl border border-[#E8E4D5] bg-white text-[#16A66A] hover:bg-black/5 dark:border-[#24312B] dark:bg-[#18211D] dark:hover:bg-white/5 dark:text-[#78D9A6] transition-all duration-150 shrink-0 cursor-pointer shadow-2xs"
          >
            <Home className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <SpaceSelector hideIcon />
          </div>
        </div>

        {/* Desktop Horizontal Navigation Bar */}
        <nav className="hidden md:flex items-center justify-between px-6 py-1.5 gap-1.5 border-t border-[#D2DDD6]/60 dark:border-[#28322C]/60 max-w-[1480px] mx-auto relative select-none">
          {/* Main Navigation Items */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] shadow-2xs font-bold'
                      : 'text-[#5E6963] dark:text-[#95A39B] hover:text-[#02402E] dark:hover:text-[#F4F4F5] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white dark:text-[#101614]' : 'text-[#16A66A]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3 Pontinhos no canto para selecionar mais opções */}
          <div className="relative shrink-0 ml-auto">
            <button
              type="button"
              id="nav-more-options-btn"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSecondaryActive
                  ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] shadow-2xs'
                  : 'bg-black/5 dark:bg-white/5 text-[#5E6963] dark:text-[#95A39B] hover:text-[#02402E] dark:hover:text-[#F4F4F5]'
              }`}
              title="Mais opções de navegação"
              aria-label="Mais opções"
            >
              {isSecondaryActive && activeSecondaryItem ? (
                <>
                  {React.createElement(activeSecondaryItem.icon, {
                    className: 'w-3.5 h-3.5 text-white dark:text-[#101614]',
                  })}
                  <span>{activeSecondaryItem.label}</span>
                </>
              ) : (
                <span>Mais</span>
              )}
              <MoreHorizontal className="w-4 h-4 ml-0.5" />
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isMoreMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu dos 3 pontinhos */}
            {isMoreMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMoreMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#D2DDD6] dark:border-[#28322C] bg-white dark:bg-[#1C211E] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 grid grid-cols-1 gap-1">
                  <div className="px-2.5 py-1.5 border-b border-[#E2ECE6] dark:border-[#28322C] mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B]">
                      Outros Módulos
                    </span>
                  </div>
                  {secondaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614] font-bold'
                            : 'text-[#202724] dark:text-[#F4F4F5] hover:bg-[#F4F7F5] dark:hover:bg-white/5'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-white dark:text-[#101614]' : 'text-[#16A66A]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}

                  {/* Assistente Poupagaio Toggle */}
                  <div className="pt-2 mt-1 border-t border-[#E2ECE6] dark:border-[#28322C] px-2.5 pb-1 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6963] dark:text-[#95A39B] block">
                      Assistente Poupagaio
                    </span>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-xs font-semibold text-[#202724] dark:text-[#F4F4F5]">
                        Mostrar assistente
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showAssistant}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssistant();
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          showAssistant ? 'bg-[#16A66A]' : 'bg-[#D2DDD6] dark:bg-[#28322C]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            showAssistant ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-[#5E6963] dark:text-[#95A39B] leading-tight">
                      Exibe o Poupagaio e seus atalhos rápidos nas telas.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* MOBILE FULL DRAWER MENU */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex flex-col justify-end animate-in fade-in duration-200 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#1C211E] border-t border-[#DCE2DE] dark:border-[#2B322F] rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE2DE] dark:border-[#2B322F]">
              <div className="flex items-center gap-2">
                <PoupagaioLogo className="h-9 sm:h-10" />
                <h3 className="font-bold text-sm font-display text-[#02402E] dark:text-[#78D9A6]">
                  Navegação Poupagaio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-full text-[#5E6963] dark:text-[#95A39B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                      isActive
                        ? 'bg-[#02402E] text-white dark:bg-[#16A66A] dark:text-[#101614]'
                        : 'bg-[#F2F4F3] dark:bg-[#181B1A] text-[#202724] dark:text-[#F4F4F5]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Aparência & Temas */}
            <div className="pt-3 border-t border-[#DCE2DE] dark:border-[#2B322F]">
              <button
                type="button"
                id="mobile-drawer-appearance-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAppearanceModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#075C45]/10 dark:bg-[#16A66A]/15 border-2 border-[#16A66A]/40 text-xs font-bold text-[#02402E] dark:text-[#78D9A6] cursor-pointer hover:bg-[#16A66A]/20 transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Palette className="w-5 h-5 text-[#16A66A]" />
                  <span className="text-sm font-bold">🎨 Aparência (Temas)</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#16A66A] text-white shadow-2xs">
                  Escolher Tema
                </span>
              </button>
            </div>

            {/* Assistente Poupagaio Config Toggle */}
            <div className="pt-3 border-t border-[#DCE2DE] dark:border-[#2B322F]">
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#F4F7F5] dark:bg-[#181B1A] border border-[#E2ECE6] dark:border-[#2B322F]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={POUPAGAIO_MASCOT_URL} alt="Poupagaio" className="w-5 h-5 object-contain" />
                    <span className="text-xs font-bold text-[#02402E] dark:text-[#78D9A6]">
                      Assistente Poupagaio
                    </span>
                  </div>
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
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold text-[#202724] dark:text-[#F4F4F5]">Mostrar assistente</span>
                  <span className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
                    showAssistant ? 'bg-[#16A66A]/15 text-[#16A66A]' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {showAssistant ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
                  Exibe o Poupagaio e seus atalhos rápidos nas telas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPEARANCE & THEME CUSTOMIZATION MODAL */}
      <AppearanceModal
        isOpen={isAppearanceModalOpen}
        onClose={() => setIsAppearanceModalOpen(false)}
      />

      {/* SUPABASE SCHEMA NOTICE */}
      <SupabaseSchemaNotice />

      {/* NATURAL VERTICAL SCROLL MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-[1480px] mx-auto px-2 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-8 relative z-10">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-[#D2DDD6] dark:border-[#28322C] bg-white/80 dark:bg-[#161B18]/80 backdrop-blur-md py-2.5 sm:py-3 px-4 sm:px-6 mt-3 transition-colors relative z-10">
        <div className="max-w-[1480px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center md:text-left">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center justify-center md:justify-start">
              <PoupagaioLogo showText className="h-6 sm:h-7" />
            </div>
            <span className="hidden sm:inline text-xs text-[#5E6963] dark:text-[#95A39B] opacity-60">•</span>
            <p className="text-[11px] text-[#5E6963] dark:text-[#95A39B]">
              Organize hoje. Você mais longe.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs font-medium text-[#5E6963] dark:text-[#95A39B]">
            <button onClick={() => onSelectTab('home')} className="hover:text-[#02402E] dark:hover:text-[#78D9A6] transition-colors cursor-pointer">Início</button>
            <button onClick={() => onSelectTab('reports')} className="hover:text-[#02402E] dark:hover:text-[#78D9A6] transition-colors cursor-pointer">Visão Financeira</button>
            <button onClick={() => onSelectTab('support')} className="hover:text-[#02402E] dark:hover:text-[#78D9A6] transition-colors cursor-pointer">Suporte</button>
            <button onClick={() => onSelectTab('profile')} className="hover:text-[#02402E] dark:hover:text-[#78D9A6] transition-colors cursor-pointer">Meu Perfil</button>
          </div>

          {/* Credits & Social */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 text-[11px] text-[#5E6963] dark:text-[#95A39B]">
            <span className="font-semibold text-[#02402E] dark:text-[#78D9A6]">
              Mateus Araujo
            </span>
            <div className="flex items-center gap-2 text-[#02402E] dark:text-[#78D9A6]">
              <Youtube className="w-3.5 h-3.5 cursor-pointer hover:opacity-80 transition-opacity" />
              <Instagram className="w-3.5 h-3.5 cursor-pointer hover:opacity-80 transition-opacity" />
              <Linkedin className="w-3.5 h-3.5 cursor-pointer hover:opacity-80 transition-opacity" />
            </div>
            <span className="opacity-75">
              © 2026 Poupagaio Finance
            </span>
          </div>
        </div>
      </footer>

      {/* FLOATING POUPAGAIO QUICK ACCESS ASSISTANT */}
      <FloatingPoupagaio
        onSelectTab={handleNavClick}
        currentTab={currentTab}
        onOpenCreateModal={(modalType) => setPoupagaioModal(modalType)}
      />

      {/* POUPAGAIO DIRECT CREATION MODALS */}
      {currentSpace?.id && (
        <>
          <EntryModal
            isOpen={poupagaioModal === 'entries'}
            onClose={() => setPoupagaioModal(null)}
            onSave={handleSaveEntryPoupagaio}
            spaceId={currentSpace.id}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />

          <VariableExpenseModal
            isOpen={poupagaioModal === 'variable_expenses'}
            onClose={() => setPoupagaioModal(null)}
            onSave={handleSaveVariableExpensePoupagaio}
            spaceId={currentSpace.id}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />

          <FixedExpenseModal
            isOpen={poupagaioModal === 'fixed_expenses'}
            onClose={() => setPoupagaioModal(null)}
            onSave={handleSaveFixedExpensePoupagaio}
            spaceId={currentSpace.id}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />

          <InstallmentPurchaseModal
            isOpen={poupagaioModal === 'installments'}
            onClose={() => setPoupagaioModal(null)}
            onSave={handleSaveInstallmentPoupagaio}
            spaceId={currentSpace.id}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        </>
      )}
    </div>
  );
}

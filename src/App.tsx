import React, { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AssistantProvider } from './hooks/useAssistant';
import { AuthScreen } from './components/auth/AuthScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { Shell } from './components/layout/Shell';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { MovementsScreen } from './components/movements/MovementsScreen';
import { PlanningScreen } from './components/planning/PlanningScreen';
import { ReservesScreen } from './components/reserves/ReservesScreen';
import { EntriesScreen } from './components/entries/EntriesScreen';
import { FixedExpensesScreen } from './components/fixed-expenses/FixedExpensesScreen';
import { VariableExpensesScreen } from './components/variable-expenses/VariableExpensesScreen';
import { InstallmentsScreen } from './components/installments/InstallmentsScreen';
import { GoalsScreen } from './components/goals/GoalsScreen';
import { WishlistScreen } from './components/wishlist/WishlistScreen';
import { MarketScreen } from './components/market/MarketScreen';
import { ClosingScreen } from './components/closing/ClosingScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { CalendarScreen } from './components/calendar/CalendarScreen';
import { ModulePlaceholder } from './components/dashboard/ModulePlaceholder';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { SupportScreen } from './components/support/SupportScreen';
import { Skeleton } from './components/ui/skeleton';
import { ActiveTab } from './types';
import { POUPAGAIO_MASCOT_URL } from './assets/mascot';
import { PoupagaioLogo } from './components/branding/PoupagaioLogo';

function AppContent() {
  const { user, isInitializing } = useAuth();
  const [currentTab, setCurrentTab] = useState<ActiveTab>('home');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const handleRefreshData = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const isResetPasswordPath = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery');

  if (isResetPasswordPath) {
    return <ResetPasswordScreen />;
  }

  // Loading state with smooth skeletons to avoid blank white screens
  if (isInitializing) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#F7F9F7] dark:bg-[#101614] text-[#202724] dark:text-[#F7F4EA]">
        <div className="w-full max-w-md space-y-6 text-center flex flex-col items-center">
          <div className="animate-pulse flex items-center justify-center">
            <PoupagaioLogo className="h-16 sm:h-20" />
          </div>
          <div className="space-y-2 w-full">
            <h2 className="text-xl font-bold font-display text-[#075C45] dark:text-[#78D9A6]">
              Poupagaio Finance
            </h2>
            <p className="text-xs text-[#5E6963] dark:text-[#95A39B]">
              Iniciando ambiente seguro...
            </p>
          </div>
          <div className="w-full space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Authentication (Login / Register / Forgot Password)
  if (!user) {
    return <AuthScreen />;
  }

  // Render view based on currentTab
  const renderContent = () => {
    if (currentTab === 'home') {
      return (
        <React.Fragment key={refreshKey}>
          <DashboardHome
            onSelectTab={setCurrentTab}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'movements') {
      return (
        <React.Fragment key={refreshKey}>
          <MovementsScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'planning') {
      return (
        <React.Fragment key={refreshKey}>
          <PlanningScreen onSelectTab={setCurrentTab} />
        </React.Fragment>
      );
    }
    if (currentTab === 'reserves') {
      return (
        <React.Fragment key={refreshKey}>
          <ReservesScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'entries') {
      return (
        <React.Fragment key={refreshKey}>
          <EntriesScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'fixed_expenses') {
      return (
        <React.Fragment key={refreshKey}>
          <FixedExpensesScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'variable_expenses') {
      return (
        <React.Fragment key={refreshKey}>
          <VariableExpensesScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'installments') {
      return (
        <React.Fragment key={refreshKey}>
          <InstallmentsScreen
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        </React.Fragment>
      );
    }
    if (currentTab === 'goals') {
      return (
        <React.Fragment key={refreshKey}>
          <GoalsScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'wishlist') {
      return (
        <React.Fragment key={refreshKey}>
          <WishlistScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'market') {
      return (
        <React.Fragment key={refreshKey}>
          <MarketScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'closing') {
      return (
        <React.Fragment key={refreshKey}>
          <ClosingScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'reports') {
      return (
        <React.Fragment key={refreshKey}>
          <ReportsScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'calendar') {
      return (
        <React.Fragment key={refreshKey}>
          <CalendarScreen onSelectTab={setCurrentTab} />
        </React.Fragment>
      );
    }
    if (currentTab === 'profile') {
      return (
        <React.Fragment key={refreshKey}>
          <ProfileScreen />
        </React.Fragment>
      );
    }
    if (currentTab === 'support') {
      return (
        <React.Fragment key={refreshKey}>
          <SupportScreen />
        </React.Fragment>
      );
    }
    return <ModulePlaceholder tab={currentTab} onSelectTab={setCurrentTab} />;
  };

  // Authenticated -> Show Authenticated Layout Shell
  return (
    <Shell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      onRefreshData={handleRefreshData}
    >
      {renderContent()}
    </Shell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AssistantProvider>
          <AppContent />
        </AssistantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { DataProvider } from './context/DataContext.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { ExecutiveOverview } from './components/ExecutiveOverview.tsx';
import { MarketManagement } from './components/MarketManagement.tsx';
import { OfficialMemorandum } from './components/OfficialMemorandum.tsx';
import { ExcelManager } from './components/ExcelManager.tsx';

function MainApp() {
  const { currentUser } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');

  // Set initial sensible default tab based on logged in role
  useEffect(() => {
    if (currentUser?.role === 'User') {
      setCurrentTab('night_market');
    } else {
      setCurrentTab('overview');
    }
  }, [currentUser?.role]);

  // If not logged in, always render the Login Screen first
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Bar with RBAC status and Logout */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'overview' && (
          <ExecutiveOverview onNavigateTab={setCurrentTab} />
        )}
        {currentTab === 'night_market' && (
          <MarketManagement marketType="night" />
        )}
        {currentTab === 'fresh_market' && (
          <MarketManagement marketType="fresh" />
        )}
        {currentTab === 'official_memo' && (
          <OfficialMemorandum />
        )}
        {currentTab === 'excel_tools' && (
          <ExcelManager />
        )}
      </main>

      {/* Official Municipal Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม
          </div>
          <div className="font-mono-num text-[11px]">
            ประจำปีงบประมาณ พ.ศ. 2570 · ระบบฐานข้อมูลการจัดหาประโยชน์จากทรัพย์สิน
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainApp />
      </DataProvider>
    </AuthProvider>
  );
}

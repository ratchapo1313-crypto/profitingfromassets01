import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { getContractExpiryInfo } from '../utils/thaiFormat.ts';

export type NavTab = 'overview' | 'night_market' | 'fresh_market' | 'official_memo' | 'excel_tools';

interface NavbarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, logout } = useAuth();
  const { lastSyncedAt, refreshData, isLoading, db } = useData();

  const nightExpiringCount = useMemo(() => {
    return (db.contracts || [])
      .filter((c) => c.marketType === 'night')
      .filter((c) => {
        const info = getContractExpiryInfo(c.endDate);
        return info.status === 'critical' || info.status === 'warning' || info.status === 'expired';
      }).length;
  }, [db.contracts]);

  const freshExpiringCount = useMemo(() => {
    return (db.contracts || [])
      .filter((c) => c.marketType === 'fresh')
      .filter((c) => {
        const info = getContractExpiryInfo(c.endDate);
        return info.status === 'critical' || info.status === 'warning' || info.status === 'expired';
      }).length;
  }, [db.contracts]);

  if (!currentUser) return null;

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              เทศบาลเมืองมหาสารคาม
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
              ฝ่ายพัฒนารายได้ กองคลัง (พ.ศ. 2570)
            </span>
          </div>

          {/* Zone 2: Navigation Links (single line, clean text) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <button
              onClick={() => setCurrentTab('overview')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer pb-1 ${
                currentTab === 'overview'
                  ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              ภาพรวมสรุปผล
            </button>
            <button
              onClick={() => setCurrentTab('night_market')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer pb-1 ${
                currentTab === 'night_market'
                  ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>ตลาดโต้รุ่ง</span>
                {nightExpiringCount > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full font-bold font-mono-num">
                    {nightExpiringCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setCurrentTab('fresh_market')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer pb-1 ${
                currentTab === 'fresh_market'
                  ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>ตลาดสด</span>
                {freshExpiringCount > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full font-bold font-mono-num">
                    {freshExpiringCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setCurrentTab('official_memo')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer pb-1 ${
                currentTab === 'official_memo'
                  ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              บันทึกข้อความราชการ
            </button>
            <button
              onClick={() => setCurrentTab('excel_tools')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer pb-1 ${
                currentTab === 'excel_tools'
                  ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              นำเข้า/ส่งออก Excel
            </button>
          </nav>

          {/* Zone 3: 1 primary action & role status lockup */}
          <div className="flex items-center gap-3 shrink-0">
            {/* สถานะสิทธิ์ปัจจุบัน (Current Role Status without personal name) */}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-800">
                สถานะสิทธิ์: {currentUser.roleTitle}
              </div>
              <div className="text-[11px] font-mono-num flex items-center justify-end gap-1 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                <span>Firebase · {lastSyncedAt}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshData}
              title="ซิงค์ข้อมูลกับฐานข้อมูลกลาง"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto py-2 border-t border-slate-100 text-xs font-medium">
          <button
            onClick={() => setCurrentTab('overview')}
            className={`px-2.5 py-1 rounded whitespace-nowrap ${
              currentTab === 'overview' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            ภาพรวมสรุปผล
          </button>
          <button
            onClick={() => setCurrentTab('night_market')}
            className={`px-2.5 py-1 rounded whitespace-nowrap flex items-center gap-1 ${
              currentTab === 'night_market' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            <span>ตลาดโต้รุ่ง</span>
            {nightExpiringCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-num ${currentTab === 'night_market' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900'}`}>
                {nightExpiringCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentTab('fresh_market')}
            className={`px-2.5 py-1 rounded whitespace-nowrap flex items-center gap-1 ${
              currentTab === 'fresh_market' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            <span>ตลาดสด</span>
            {freshExpiringCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-num ${currentTab === 'fresh_market' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900'}`}>
                {freshExpiringCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentTab('official_memo')}
            className={`px-2.5 py-1 rounded whitespace-nowrap ${
              currentTab === 'official_memo' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            บันทึกข้อความ
          </button>
          <button
            onClick={() => setCurrentTab('excel_tools')}
            className={`px-2.5 py-1 rounded whitespace-nowrap ${
              currentTab === 'excel_tools' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Excel
          </button>
        </div>
      </div>
    </header>
  );
};

import React, { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { formatCurrency, formatInteger } from '../utils/thaiFormat.ts';
import { getSystemMetrics } from '../utils/marketMetrics.ts';
import {
  Building2,
  Store,
  DollarSign,
  FileCheck2,
  ArrowRight,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { NavTab } from './Navbar.tsx';

interface ExecutiveOverviewProps {
  onNavigateTab: (tab: NavTab) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ onNavigateTab }) => {
  const { db } = useData();

  // Unified metrics for night, fresh, and combined
  const metrics = useMemo(() => getSystemMetrics(db), [db]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                แดชบอร์ดสรุปผลการดำเนินงาน
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-mono-num text-slate-600">
                ปีงบประมาณ พ.ศ. 2570
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <RefreshCw className="w-3 h-3 text-emerald-600" />
                <span>ข้อมูลเชื่อมโยงตรงกัน 5 เมนู</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              ภาพรวมการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และ ตลาดสด) ข้อมูลอัปเดตตรงกันแบบเรียลไทม์
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('official_memo')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-slate-700" />
              <span>ดูบันทึกข้อความเสนอรายงาน</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('excel_tools')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Key Metric Cards - Combined from Single Source of Truth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: จำนวนล็อคทั้งหมด */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>จำนวนล็อคทั้งหมด (2 ตลาด)</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
            {formatInteger(metrics.combined.totalStalls)}{' '}
            <span className="text-sm font-normal text-slate-500">ล็อค</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ตลาดโต้รุ่ง {formatInteger(metrics.night.totalStalls)} ล็อค · ตลาดสด {formatInteger(metrics.fresh.totalStalls)} ล็อค
          </div>
        </div>

        {/* Metric 2: สัญญาเช่าที่จัดทำแล้ว */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span>สัญญาเช่าที่จัดทำแล้ว</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-800 font-mono-num">
            {formatInteger(metrics.combined.leasedCount)}{' '}
            <span className="text-sm font-normal text-emerald-700">สัญญา</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-mono-num font-medium">
            คงเหลือล็อคว่าง {formatInteger(metrics.combined.vacantCount)} ล็อค
          </div>
        </div>

        {/* Metric 3: อัตราการเช่าเฉลี่ย */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>อัตราการเช่าเฉลี่ย</span>
            <Store className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
            {metrics.combined.occupancyRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            โต้รุ่ง {metrics.night.occupancyRate}% · ตลาดสด {metrics.fresh.occupancyRate}%
          </div>
        </div>

        {/* Metric 4: ค่าเช่าทรัพย์สินรวม/เดือน */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>ค่าเช่าทรัพย์สินรวม/เดือน</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
            {formatCurrency(metrics.combined.monthlyRent)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            เงินประกันรวม {formatCurrency(metrics.combined.securityDeposit)} บาท
          </div>
        </div>
      </div>

      {/* Two Markets Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Night Market Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('night_market')}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
            >
              <span>จัดการสัญญา</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500">ล็อคทั้งหมด</div>
              <div className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                {formatInteger(metrics.night.totalStalls)}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="text-[11px] text-emerald-800">มีสัญญาแล้ว</div>
              <div className="text-lg font-bold font-mono-num text-emerald-900 mt-0.5">
                {formatInteger(metrics.night.leasedCount)}
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="text-[11px] text-amber-800">ล็อคว่าง</div>
              <div className="text-lg font-bold font-mono-num text-amber-900 mt-0.5">
                {formatInteger(metrics.night.vacantCount)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
              <span>อัตราการเช่าพื้นที่</span>
              <span className="font-mono-num font-bold text-slate-900">{metrics.night.occupancyRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, parseFloat(metrics.night.occupancyRate))}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>ค่าเช่ารวม/เดือน:</span>
              <span className="font-mono-num font-bold text-slate-900">
                {formatCurrency(metrics.night.monthlyRent)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>เงินประกันสัญญาเช่า:</span>
              <span className="font-mono-num text-slate-800 font-medium">
                {formatCurrency(metrics.night.securityDeposit)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>ค่าธรรมเนียมธุรกรรมรวม:</span>
              <span className="font-mono-num text-slate-800 font-medium">
                {formatCurrency(metrics.night.transactionFee)} บาท
              </span>
            </div>
          </div>
        </div>

        {/* Fresh Market Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                ตลาดสด เทศบาลเมืองมหาสารคาม
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('fresh_market')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <span>จัดการสัญญา</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500">ล็อคทั้งหมด</div>
              <div className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                {formatInteger(metrics.fresh.totalStalls)}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="text-[11px] text-emerald-800">มีสัญญาแล้ว</div>
              <div className="text-lg font-bold font-mono-num text-emerald-900 mt-0.5">
                {formatInteger(metrics.fresh.leasedCount)}
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="text-[11px] text-amber-800">ล็อคว่าง</div>
              <div className="text-lg font-bold font-mono-num text-amber-900 mt-0.5">
                {formatInteger(metrics.fresh.vacantCount)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
              <span>อัตราการเช่าพื้นที่</span>
              <span className="font-mono-num font-bold text-slate-900">{metrics.fresh.occupancyRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, parseFloat(metrics.fresh.occupancyRate))}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>ค่าเช่ารวม/เดือน:</span>
              <span className="font-mono-num font-bold text-slate-900">
                {formatCurrency(metrics.fresh.monthlyRent)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>เงินประกันสัญญาเช่า:</span>
              <span className="font-mono-num text-slate-800 font-medium">
                {formatCurrency(metrics.fresh.securityDeposit)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>ค่าธรรมเนียมธุรกรรมรวม:</span>
              <span className="font-mono-num text-slate-800 font-medium">
                {formatCurrency(metrics.fresh.transactionFee)} บาท
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

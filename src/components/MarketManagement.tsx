import React, { useState, useMemo } from 'react';
import { MarketType, MarketLeaseContract } from '../types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  formatCurrency,
  formatInteger,
  formatThaiDate,
  calculateEndDate,
  buildDurationLabel
} from '../utils/thaiFormat.ts';
import {
  Plus,
  Minus,
  Edit2,
  Trash2,
  Search,
  PlusCircle,
  Building2,
  Store,
  Calendar,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  FileDown
} from 'lucide-react';
import { downloadCategoryExcel, downloadTemplateExcel } from '../utils/excelHelper.ts';
import { getSystemMetrics } from '../utils/marketMetrics.ts';

interface MarketManagementProps {
  marketType: MarketType;
}

export const MarketManagement: React.FC<MarketManagementProps> = ({ marketType }) => {
  const { db, updateMarketStalls, addContract, updateContract, deleteContract } = useData();
  const { currentUser } = useAuth();
  const canEdit = currentUser?.role === 'User';

  const config = marketType === 'night' ? db.nightMarketConfig : db.freshMarketConfig;
  const isNight = marketType === 'night';
  const marketTitle = isNight ? 'ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม' : 'ตลาดสด เทศบาลเมืองมหาสารคาม';

  // Unified metrics from single source of truth
  const systemMetrics = useMemo(() => getSystemMetrics(db), [db]);
  const metrics = marketType === 'night' ? systemMetrics.night : systemMetrics.fresh;

  // Derived metrics guaranteed to be identical across Overview, Night, Fresh, Memo, and Excel
  const contracts = metrics.contracts;
  const totalStalls = metrics.totalStalls;
  const leasedCount = metrics.leasedCount;
  const vacantCount = metrics.vacantCount;
  const occupancyRate = metrics.occupancyRate;
  const totalMonthlyRent = metrics.monthlyRent;
  const totalSecurityDeposit = metrics.securityDeposit;
  const totalTransactionFees = metrics.transactionFee;

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  const filteredContracts = useMemo(() => {
    if (!searchTerm.trim()) return contracts;
    const term = searchTerm.toLowerCase();
    return contracts.filter(
      (c) =>
        c.assetName.toLowerCase().includes(term) ||
        c.contractNo.toLowerCase().includes(term) ||
        c.tenantName.toLowerCase().includes(term) ||
        (c.notes && c.notes.toLowerCase().includes(term))
    );
  }, [contracts, searchTerm]);

  // Total stalls +/- handlers
  const handleStallChange = (delta: number) => {
    if (!canEdit) return;
    const newTotal = Math.max(0, totalStalls + delta);
    updateMarketStalls(marketType, newTotal);
  };

  const handleStallInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      updateMarketStalls(marketType, val);
    }
  };

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<MarketLeaseContract | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    assetName: '',
    contractNo: '',
    tenantName: '',
    startDate: '2026-10-01',
    durationYears: 1,
    durationMonths: 0,
    durationDays: 0,
    endDate: calculateEndDate('2026-10-01', 1, 0, 0),
    transactionFee: 500,
    monthlyRent: 2500,
    securityDeposit: 5000,
    notes: ''
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const showSyncNotice = (msg: string) => {
    setSyncNotice(msg);
    setTimeout(() => {
      setSyncNotice(null);
    }, 3500);
  };

  const openAddModal = () => {
    const nextOrder = contracts.length + 1;
    const prefix = isNight ? 'A' : 'สด';
    const contractPrefix = isNight ? 'สช. ' : 'สช. ';
    const numPad = String(nextOrder).padStart(3, '0');

    setEditingContract(null);
    setFormData({
      assetName: isNight ? `แผงค้า ${prefix}-${String(nextOrder).padStart(2, '0')}` : `แผงค้า สด-${String(nextOrder).padStart(2, '0')}`,
      contractNo: `${contractPrefix}${numPad}/2570`,
      tenantName: '',
      startDate: '2026-10-01',
      durationYears: 1,
      durationMonths: 0,
      durationDays: 0,
      endDate: calculateEndDate('2026-10-01', 1, 0, 0),
      transactionFee: isNight ? 500 : 400,
      monthlyRent: isNight ? 2500 : 1800,
      securityDeposit: isNight ? 5000 : 3600,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: MarketLeaseContract) => {
    setEditingContract(c);
    setFormData({
      assetName: c.assetName,
      contractNo: c.contractNo,
      tenantName: c.tenantName,
      startDate: c.startDate,
      durationYears: c.durationYears ?? 1,
      durationMonths: c.durationMonths ?? 0,
      durationDays: c.durationDays ?? 0,
      endDate: c.endDate || calculateEndDate(c.startDate, c.durationYears ?? 1, c.durationMonths ?? 0, c.durationDays ?? 0),
      transactionFee: c.transactionFee,
      monthlyRent: c.monthlyRent,
      securityDeposit: c.securityDeposit,
      notes: c.notes || ''
    });
    setIsModalOpen(true);
  };

  // Recalculate end date whenever start date or duration changes
  const updateDates = (startDate: string, y: number, m: number, d: number) => {
    const calculated = calculateEndDate(startDate, y, m, d);
    setFormData((prev) => ({
      ...prev,
      startDate,
      durationYears: y,
      durationMonths: m,
      durationDays: d,
      endDate: calculated
    }));
  };

  const handleShortcutDuration = (years: number, months: number) => {
    updateDates(formData.startDate, years, months, 0);
  };

  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetName || !formData.contractNo) return;

    const durationLabel = buildDurationLabel(
      formData.durationYears,
      formData.durationMonths,
      formData.durationDays
    );

    if (editingContract) {
      updateContract(editingContract.id, {
        assetName: formData.assetName,
        contractNo: formData.contractNo,
        tenantName: formData.tenantName,
        startDate: formData.startDate,
        duration: durationLabel,
        durationYears: formData.durationYears,
        durationMonths: formData.durationMonths,
        durationDays: formData.durationDays,
        endDate: formData.endDate,
        transactionFee: Number(formData.transactionFee) || 0,
        monthlyRent: Number(formData.monthlyRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
        notes: formData.notes
      });
      showSyncNotice('แก้ไขสัญญาและบันทึกลงฐานข้อมูลกลางสำเร็จ · อัปเดตไปยังทุกเครื่องอัตโนมัติ');
    } else {
      const newContract: MarketLeaseContract = {
        id: `ct-${marketType}-${Date.now()}`,
        marketType,
        order: contracts.length + 1,
        assetName: formData.assetName,
        contractNo: formData.contractNo,
        tenantName: formData.tenantName,
        startDate: formData.startDate,
        duration: durationLabel,
        durationYears: formData.durationYears,
        durationMonths: formData.durationMonths,
        durationDays: formData.durationDays,
        endDate: formData.endDate,
        transactionFee: Number(formData.transactionFee) || 0,
        monthlyRent: Number(formData.monthlyRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
        status: 'active',
        notes: formData.notes,
        updatedAt: new Date().toISOString()
      };
      addContract(newContract);
      showSyncNotice('เพิ่มสัญญาใหม่และบันทึกลงฐานข้อมูลกลางสำเร็จ · อัปเดตไปยังทุกเครื่องอัตโนมัติ');
    }
    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteContract(deleteId);
      setDeleteId(null);
      showSyncNotice('ลบสัญญาและอัปเดตฐานข้อมูลกลางสำเร็จ · อัปเดตไปยังทุกเครื่องอัตโนมัติ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Sync Toast Notification */}
      {syncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-xs transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncNotice}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono-num">
            {new Date().toLocaleTimeString('th-TH')}
          </span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            {isNight ? (
              <Building2 className="w-5 h-5 text-indigo-600" />
            ) : (
              <Store className="w-5 h-5 text-emerald-600" />
            )}
            <h1 className="text-lg font-bold text-slate-900">{marketTitle}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              เชื่อมต่อ Firebase Firestore (เรียลไทม์)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadTemplateExcel(isNight ? 'night_contract' : 'fresh_contract')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="ดาวน์โหลดแบบฟอร์ม Template สำหรับกรอกข้อมูล"
          >
            <FileDown className="w-4 h-4 text-slate-600" />
            <span>แบบฟอร์ม Template</span>
          </button>

          <button
            type="button"
            onClick={() => downloadCategoryExcel(marketType, db)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>ส่งออก Excel</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ เพิ่มสัญญาใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. กล่องควบคุมจำนวนกี่ล็อคทั้งหมด (มีเพิ่ม/ลด ได้) และสรุปอัตโนมัติ */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              ควบคุมจำนวนล็อค / แผงค้าทั้งหมด
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              สามารถกรอกตัวเลขโดยตรง หรือใช้ปุ่มเพิ่ม/ลด (+ / -) เพื่อปรับจำนวนล็อครองรับ
            </div>
          </div>

          {/* กล่องควบคุม เพิ่ม/ลด */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
              จำนวนกี่ล็อคทั้งหมด:
            </span>
            <button
              type="button"
              disabled={!canEdit || totalStalls <= 0}
              onClick={() => handleStallChange(-1)}
              className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-200 disabled:opacity-40 border border-slate-300 rounded text-slate-700 font-bold transition-colors cursor-pointer"
              title="ลด 1 ล็อค"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="0"
              disabled={!canEdit}
              value={totalStalls}
              onChange={handleStallInput}
              className="w-16 py-1 text-center font-mono-num font-bold text-sm bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => handleStallChange(1)}
              className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-200 disabled:opacity-40 border border-slate-300 rounded text-slate-700 font-bold transition-colors cursor-pointer"
              title="เพิ่ม 1 ล็อค"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Quick +/- 5 buttons */}
            {canEdit && (
              <div className="hidden sm:flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => handleStallChange(-5)}
                  disabled={totalStalls < 5}
                  className="px-2 py-1 text-[11px] font-mono-num bg-white hover:bg-slate-200 disabled:opacity-40 border border-slate-300 rounded text-slate-600"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleStallChange(5)}
                  className="px-2 py-1 text-[11px] font-mono-num bg-white hover:bg-slate-200 border border-slate-300 rounded text-slate-600"
                >
                  +5
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ข้อมูลสรุปอัตโนมัติ: มีสัญญาเช่าแล้ว, ล็อคคงเหลือว่าง และอัตราการเช่า (%) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] font-medium text-slate-500">จำนวนล็อคทั้งหมด</div>
            <div className="mt-1 text-xl font-bold text-slate-900 font-mono-num">
              {formatInteger(totalStalls)} <span className="text-xs font-normal text-slate-500">ล็อค</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="text-[11px] font-medium text-emerald-800">มีสัญญาเช่าแล้ว</div>
            <div className="mt-1 text-xl font-bold text-emerald-900 font-mono-num">
              {formatInteger(leasedCount)} <span className="text-xs font-normal text-emerald-700">สัญญา</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-[11px] font-medium text-amber-800">ล็อคคงเหลือว่าง</div>
            <div className="mt-1 text-xl font-bold text-amber-900 font-mono-num">
              {formatInteger(vacantCount)} <span className="text-xs font-normal text-amber-700">ล็อค</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="text-[11px] font-medium text-indigo-800">อัตราการเช่า (%)</div>
            <div className="mt-1 text-xl font-bold text-indigo-900 font-mono-num">
              {occupancyRate}%
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] font-medium text-slate-500">ค่าเช่ารวม/เดือน</div>
            <div className="mt-1 text-sm font-bold text-slate-900 font-mono-num truncate">
              {formatCurrency(totalMonthlyRent)} <span className="text-xs font-normal text-slate-500">บาท</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] font-medium text-slate-500">เงินประกันรวม</div>
            <div className="mt-1 text-sm font-bold text-slate-900 font-mono-num truncate">
              {formatCurrency(totalSecurityDeposit)} <span className="text-xs font-normal text-slate-500">บาท</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. แสดงตารางสัญญาเช่า (มีสัญญาเช่าแล้ว) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              ตารางสัญญาเช่า ({contracts.length} สัญญา)
            </span>
            <span className="text-xs text-slate-500">· ปีงบประมาณ พ.ศ. 2570</span>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อล็อค, เลขที่สัญญา, ผู้เช่า..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* The Exact 11-Column Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">1. ลำดับ</th>
                <th className="py-3 px-3 min-w-[140px]">2. รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)</th>
                <th className="py-3 px-3 min-w-[140px]">3. ชื่อผู้เช่า / ผู้ประกอบการ</th>
                <th className="py-3 px-3 min-w-[110px]">4. เลขที่สัญญา</th>
                <th className="py-3 px-3 min-w-[95px]">5. วันที่เริ่มสัญญา</th>
                <th className="py-3 px-3 min-w-[100px]">6. กำหนดระยะเวลาการเช่า</th>
                <th className="py-3 px-3 min-w-[95px]">7. วันที่สิ้นสุดสัญญา</th>
                <th className="py-3 px-3 text-right min-w-[100px]">8. ค่าธรรมเนียม</th>
                <th className="py-3 px-3 text-right min-w-[110px]">9. ค่าเช่า/เดือน</th>
                <th className="py-3 px-3 text-right min-w-[110px]">10. เงินประกันสัญญา</th>
                <th className="py-3 px-3 text-center min-w-[85px]">11. จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    {searchTerm ? 'ไม่พบข้อมูลสัญญาที่ตรงกับคำค้นหา' : 'ยังไม่มีสัญญาเช่าในระบบ'}
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c, index) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. ลำดับ */}
                    <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                      {c.order || index + 1}
                    </td>

                    {/* 2. รายการทรัพย์สิน (ชื่อล็อค/แผงค้า) */}
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div>{c.assetName}</div>
                      {c.notes && <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{c.notes}</div>}
                    </td>

                    {/* 3. ชื่อผู้เช่า / ผู้ประกอบการ */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{c.tenantName || '-'}</div>
                      <span className="inline-block text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                        ผู้ประกอบการ
                      </span>
                    </td>

                    {/* 4. เลขที่สัญญา */}
                    <td className="py-2.5 px-3 font-mono-num font-medium text-slate-800">
                      {c.contractNo}
                    </td>

                    {/* 5. วันที่เริ่มสัญญา */}
                    <td className="py-2.5 px-3 font-mono-num text-slate-700 whitespace-nowrap">
                      {formatThaiDate(c.startDate, { short: true })}
                    </td>

                    {/* 6. กำหนดระยะเวลาการเช่า */}
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {c.duration || buildDurationLabel(c.durationYears, c.durationMonths, c.durationDays)}
                    </td>

                    {/* 7. วันที่สิ้นสุดสัญญา (ระบบคำนวณอัตโนมัติ) */}
                    <td className="py-2.5 px-3 font-mono-num text-slate-900 font-medium whitespace-nowrap">
                      {formatThaiDate(c.endDate, { short: true })}
                    </td>

                    {/* 8. ค่าธรรมเนียมการทำธุรกรรม */}
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(c.transactionFee)}
                    </td>

                    {/* 9. จำนวนค่าเช่า/เดือน */}
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                      {formatCurrency(c.monthlyRent)}
                    </td>

                    {/* 10. เงินประกันสัญญาเช่า */}
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(c.securityDeposit)}
                    </td>

                    {/* 11. จัดการ: ปุ่มแก้ไข และปุ่มลบสัญญา */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {canEdit ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            title="แก้ไขสัญญา"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(c.id)}
                            title="ลบสัญญา"
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">ดูข้อมูล</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Sums */}
            {filteredContracts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-semibold text-slate-900 border-t border-slate-300">
                  <td colSpan={6} className="py-2.5 px-3 text-right">
                    รวมทั้งสิ้น ({filteredContracts.length} สัญญา):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num">
                    {formatCurrency(
                      filteredContracts.reduce((sum, c) => sum + (c.transactionFee || 0), 0)
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num">
                    {formatCurrency(
                      filteredContracts.reduce((sum, c) => sum + (c.monthlyRent || 0), 0)
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num">
                    {formatCurrency(
                      filteredContracts.reduce((sum, c) => sum + (c.securityDeposit || 0), 0)
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 3. Modal เพิ่ม / แก้ไข สัญญาเช่า */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                {editingContract ? 'แก้ไขสัญญาเช่า' : 'เพิ่มสัญญาเช่าใหม่'} - {isNight ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. รายการทรัพย์สิน (ชื่อล็อค/แผงค้า) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    รายการทรัพย์สิน (ชื่อล็อค/แผงค้า) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                    placeholder={isNight ? 'เช่น แผงค้า A-01 (โซนอาหาร)' : 'เช่น แผงค้า สด-01 (โซนผัก)'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* 3. เลขที่สัญญา */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    เลขที่สัญญา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contractNo}
                    onChange={(e) => setFormData({ ...formData, contractNo: e.target.value })}
                    placeholder="เช่น สช. 001/2570"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* ชื่อผู้เช่า */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อผู้เช่า / ผู้ประกอบการ
                </label>
                <input
                  type="text"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* วันที่เริ่มสัญญา & กำหนดระยะเวลาการเช่า */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span>ระยะเวลาและวันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      4. วันที่เริ่มสัญญา (วว/ดด/ปปปป) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) =>
                        updateDates(
                          e.target.value,
                          formData.durationYears,
                          formData.durationMonths,
                          formData.durationDays
                        )
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md font-mono-num"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      6. วันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ)
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={formData.endDate}
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-md font-mono-num font-semibold text-slate-900 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      = {formatThaiDate(formData.endDate)}
                    </span>
                  </div>
                </div>

                {/* 5. กำหนดระยะเวลาการเช่า: ปุ่มลัด & inputs */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-slate-600">
                      5. กำหนดระยะเวลาการเช่า (ปุ่มลัดเลือกด่วน):
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => handleShortcutDuration(0, 3)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                        formData.durationYears === 0 && formData.durationMonths === 3
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      3 เดือน
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortcutDuration(0, 6)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                        formData.durationYears === 0 && formData.durationMonths === 6
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      6 เดือน
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortcutDuration(1, 0)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                        formData.durationYears === 1 && formData.durationMonths === 0
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      1 ปี
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortcutDuration(2, 0)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                        formData.durationYears === 2 && formData.durationMonths === 0
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      2 ปี
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortcutDuration(3, 0)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border ${
                        formData.durationYears === 3 && formData.durationMonths === 0
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      3 ปี
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500">จำนวนปี:</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.durationYears}
                        onChange={(e) =>
                          updateDates(
                            formData.startDate,
                            parseInt(e.target.value, 10) || 0,
                            formData.durationMonths,
                            formData.durationDays
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono-num text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">จำนวนเดือน:</span>
                      <input
                        type="number"
                        min="0"
                        max="11"
                        value={formData.durationMonths}
                        onChange={(e) =>
                          updateDates(
                            formData.startDate,
                            formData.durationYears,
                            parseInt(e.target.value, 10) || 0,
                            formData.durationDays
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono-num text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">จำนวนวัน:</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={formData.durationDays}
                        onChange={(e) =>
                          updateDates(
                            formData.startDate,
                            formData.durationYears,
                            formData.durationMonths,
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono-num text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* อัตราค่าเช่า ค่าธรรมเนียม เงินประกัน */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 7. ค่าธรรมเนียมการทำธุรกรรม */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    7. ค่าธรรมเนียมธุรกรรม (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.transactionFee}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionFee: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                {/* 8. จำนวนค่าเช่า/เดือน */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    8. ค่าเช่า/เดือน (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={formData.monthlyRent}
                    onChange={(e) => {
                      const rent = parseFloat(e.target.value) || 0;
                      // Auto suggest deposit as 2x monthly rent if not changed
                      setFormData({
                        ...formData,
                        monthlyRent: rent,
                        securityDeposit: rent * 2
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-semibold"
                  />
                </div>

                {/* 9. เงินประกันสัญญาเช่า */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    9. เงินประกันสัญญา (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.securityDeposit}
                    onChange={(e) =>
                      setFormData({ ...formData, securityDeposit: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  หมายเหตุ / ประเภทสินค้าที่จำหน่าย
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="เช่น จำหน่ายอาหารตามสั่ง, ขนมของหวาน, ผลไม้สด"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                >
                  {editingContract ? 'บันทึกการแก้ไข' : 'เพิ่มสัญญา'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>ยืนยันการลบสัญญาเช่า</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบสัญญาเช่านี้ออกจากระบบ? เมื่อลบแล้ว
              ระบบจะคำนวณจำนวนล็อคคงเหลือว่างและอัตราการเช่าใหม่ให้อัตโนมัติทันที
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

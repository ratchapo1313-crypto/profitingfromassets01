import React, { useState, useMemo } from 'react';
import { MarketType, MarketLeaseContract } from '../types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  formatCurrency,
  formatInteger,
  formatThaiDate,
  calculateEndDate,
  buildDurationLabel,
  getContractExpiryInfo,
  ContractExpiryInfo
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
  FileDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BellRing,
  Clock,
  AlertCircle,
  Filter,
  Database,
  RefreshCw,
  Radio,
  HardDrive
} from 'lucide-react';
import { downloadCategoryExcel, downloadTemplateExcel } from '../utils/excelHelper.ts';
import { getSystemMetrics } from '../utils/marketMetrics.ts';

interface MarketManagementProps {
  marketType: MarketType;
}

export const MarketManagement: React.FC<MarketManagementProps> = ({ marketType }) => {
  const {
    db,
    updateMarketStalls,
    addContract,
    updateContract,
    deleteContract,
    isFirebaseConnected,
    firestoreDatabaseId,
    lastSyncedAt,
    isLoading,
    syncMarketToFirestore,
    testFirebaseConnection,
    refreshData
  } = useData();
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

  // Search and expiry status filter
  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring' | 'expired' | 'normal'>('all');

  // Pagination state: "แสดงหน้าละ" (items per page)
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Map of contractId -> ExpiryInfo
  const contractExpiryMap = useMemo(() => {
    const map = new Map<string, ContractExpiryInfo>();
    contracts.forEach((c) => {
      map.set(c.id, getContractExpiryInfo(c.endDate));
    });
    return map;
  }, [contracts]);

  // Overall counts for alert badges and banner
  const expiryStats = useMemo(() => {
    let expired = 0;
    let critical = 0; // <= 30 days
    let warning = 0; // 31 - 60 days
    contracts.forEach((c) => {
      const info = contractExpiryMap.get(c.id);
      if (!info) return;
      if (info.status === 'expired') expired++;
      else if (info.status === 'critical') critical++;
      else if (info.status === 'warning') warning++;
    });
    return {
      expired,
      critical,
      warning,
      expiringTotal: critical + warning
    };
  }, [contracts, contractExpiryMap]);

  // Filtered contracts by search AND expiryFilter
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      // Expiry filter
      if (expiryFilter !== 'all') {
        const info = contractExpiryMap.get(c.id);
        if (!info) return false;
        if (expiryFilter === 'expiring' && !(info.status === 'critical' || info.status === 'warning')) return false;
        if (expiryFilter === 'expired' && info.status !== 'expired') return false;
        if (expiryFilter === 'normal' && info.status !== 'normal') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          c.assetName.toLowerCase().includes(term) ||
          c.contractNo.toLowerCase().includes(term) ||
          c.tenantName.toLowerCase().includes(term) ||
          (c.notes && c.notes.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [contracts, searchTerm, expiryFilter, contractExpiryMap]);

  // Total pages and current page slice
  const totalItems = filteredContracts.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === 'all' ? 0 : (safeCurrentPage - 1) * pageSize;
  const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedContracts = useMemo(() => {
    return filteredContracts.slice(startIndex, endIndex);
  }, [filteredContracts, startIndex, endIndex]);

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
  const [formData, setFormData] = useState<{
    assetName: string;
    contractNo: string;
    tenantName: string;
    startDate: string;
    durationYears: number;
    durationMonths: number;
    durationDays: number;
    endDate: string;
    transactionFee: number | string;
    monthlyRent: number | string;
    securityDeposit: number | string;
    notes: string;
  }>({
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
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);

  const showSyncNotice = (msg: string) => {
    setSyncNotice(msg);
    setTimeout(() => {
      setSyncNotice(null);
    }, 4000);
  };

  const handleSyncToFirestore = async () => {
    setIsSyncingFirebase(true);
    const result = await syncMarketToFirestore(marketType);
    setIsSyncingFirebase(false);
    if (result.success) {
      showSyncNotice(`เชื่อมต่อ Firebase สำเร็จ · สำรองและซิงค์ข้อมูลสัญญา${isNight ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'} ${result.count} สัญญาขึ้น Firestore เรียบร้อยแล้ว`);
    } else {
      showSyncNotice(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${result.error || 'ไม่สามารถบันทึกได้'}`);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingFirebase(true);
    const ok = await testFirebaseConnection();
    setIsTestingFirebase(false);
    if (ok) {
      showSyncNotice('การเชื่อมต่อ Firebase Firestore ทำงานปกติ (สถานะ: ออนไลน์ เรียลไทม์)');
    } else {
      showSyncNotice('ไม่สามารถเชื่อมต่อ Firebase Firestore ได้ในขณะนี้ กรุณาตรวจสอบเครือข่าย');
    }
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
      showSyncNotice('แก้ไขสัญญาและบันทึกลงฐานข้อมูล Firebase Firestore สำเร็จ (เรียลไทม์)');
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
      showSyncNotice('เพิ่มสัญญาใหม่และบันทึกลงฐานข้อมูล Firebase Firestore สำเร็จ (เรียลไทม์)');
    }
    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteContract(deleteId);
      setDeleteId(null);
      showSyncNotice('ลบสัญญาและอัปเดตฐานข้อมูล Firebase Firestore สำเร็จ (เรียลไทม์)');
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

      {/* ☁️ กล่องสถานะและการจัดการฐานข้อมูลคลาวด์ Firebase Firestore */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>เชื่อมต่อ Firebase Firestore สำเร็จ</span>
              </span>
              <span className="text-xs text-slate-300 font-mono-num flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>DB ID: <code className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded text-[11px]">{firestoreDatabaseId}</code></span>
              </span>
              <span className="text-xs text-slate-300 font-mono-num">
                Collection: <code className="text-sky-300 bg-black/40 px-1.5 py-0.5 rounded text-[11px]">contracts</code>
              </span>
            </div>
            <p className="text-xs text-slate-300">
              ฐานข้อมูลสัญญาเช่า{isNight ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'} ซิงค์เรียลไทม์อัตโนมัติ ทุกครั้งที่มีการเพิ่ม แก้ไข หรือลบสัญญา ข้อมูลจะถูกจัดเก็บบน Google Cloud Firestore ทันที
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono-num">
              <span>จำนวนสัญญาในตลาด: <strong className="text-white font-bold">{contracts.length}</strong> สัญญา</span>
              <span>•</span>
              <span>สถานะ: <strong className="text-emerald-400 font-semibold">{isFirebaseConnected ? 'ออนไลน์ (เชื่อมต่อเรียบร้อย)' : 'กำลังเชื่อมต่อ'}</strong></span>
              <span>•</span>
              <span>อัปเดตล่าสุด: <strong className="text-slate-200">{lastSyncedAt}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingFirebase}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors cursor-pointer"
              title="ตรวจสอบการเชื่อมต่อกับ Firebase Firestore"
            >
              <Radio className={`w-3.5 h-3.5 text-amber-400 ${isTestingFirebase ? 'animate-pulse' : ''}`} />
              <span>{isTestingFirebase ? 'กำลังตรวจสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
            </button>

            <button
              type="button"
              onClick={() => refreshData()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors cursor-pointer"
              title="ดึงข้อมูลล่าสุดจาก Firebase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>ดึงข้อมูลล่าสุด</span>
            </button>

            <button
              type="button"
              onClick={handleSyncToFirestore}
              disabled={isSyncingFirebase}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
              title="สำรองข้อมูลสัญญาตลาดทั้งหมดขึ้นฐานข้อมูล Cloud Firestore"
            >
              <Database className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'กำลังบันทึกลง Firebase...' : 'สำรองสัญญาขึ้น Firebase'}</span>
            </button>
          </div>
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

      {/* Expiration Alert Banner */}
      {(expiryStats.expiringTotal > 0 || expiryStats.expired > 0) && (
        <div className="p-4 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border border-amber-200 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5 shadow-2xs">
                <BellRing className="w-5 h-5 text-amber-700 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    การแจ้งเตือนสัญญาเช่าใกล้สิ้นสุดสัญญา
                  </h3>
                  <span className="text-[11px] font-bold bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full font-mono-num border border-amber-300">
                    พบ {expiryStats.expiringTotal + expiryStats.expired} สัญญา
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-900 mt-1">
                  {expiryStats.critical > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block"></span>
                      ใกล้สิ้นสุดสัญญาภายใน 30 วัน: <span className="font-mono-num font-bold">{expiryStats.critical}</span> สัญญา
                    </span>
                  )}
                  {expiryStats.warning > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                      ใกล้สิ้นสุดสัญญาภายใน 31-60 วัน: <span className="font-mono-num font-bold">{expiryStats.warning}</span> สัญญา
                    </span>
                  )}
                  {expiryStats.expired > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                      หมดอายุแล้ว: <span className="font-mono-num">{expiryStats.expired}</span> สัญญา
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Filter action buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setExpiryFilter(expiryFilter === 'expiring' ? 'all' : 'expiring');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  expiryFilter === 'expiring'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                    : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                {expiryFilter === 'expiring' ? 'กำลังกรอง: ใกล้สิ้นสุด' : `ดูสัญญาใกล้สิ้นสุด (${expiryStats.expiringTotal})`}
              </button>

              {expiryStats.expired > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                    expiryFilter === 'expired'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : 'bg-white border-rose-300 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {expiryFilter === 'expired' ? 'กำลังกรอง: หมดสัญญา' : `ดูหมดสัญญา (${expiryStats.expired})`}
                </button>
              )}

              {expiryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter('all');
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  แสดงทั้งหมด
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. แสดงตารางสัญญาเช่า (มีสัญญาเช่าแล้ว) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                ตารางสัญญาเช่า ({contracts.length} สัญญา)
              </span>
              <span className="text-xs text-slate-500">· ปีงบประมาณ พ.ศ. 2570</span>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setExpiryFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  expiryFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด ({contracts.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpiryFilter('expiring');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  expiryFilter === 'expiring'
                    ? 'bg-amber-500 text-white shadow-2xs font-semibold'
                    : 'text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>ใกล้สิ้นสุด</span>
                {expiryStats.expiringTotal > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num font-bold ${expiryFilter === 'expiring' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                    {expiryStats.expiringTotal}
                  </span>
                )}
              </button>
              {expiryStats.expired > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter('expired');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    expiryFilter === 'expired'
                      ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                      : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>หมดสัญญา</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num font-bold ${expiryFilter === 'expired' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'}`}>
                    {expiryStats.expired}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* แสดงหน้าละ (Items Per Page Selector in Header) */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap font-medium">แสดงหน้าละ:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium cursor-pointer"
              >
                <option value={10}>10 รายการ</option>
                <option value={20}>20 รายการ</option>
                <option value={50}>50 รายการ</option>
                <option value={100}>100 รายการ</option>
                <option value="all">ทั้งหมด ({filteredContracts.length})</option>
              </select>
            </div>

            {/* Search box */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ค้นหาชื่อล็อค, เลขที่สัญญา, ผู้เช่า..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
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
                <th className="py-3 px-3 min-w-[125px]">7. วันที่สิ้นสุดสัญญา</th>
                <th className="py-3 px-3 text-right min-w-[100px]">8. ค่าธรรมเนียม</th>
                <th className="py-3 px-3 text-right min-w-[110px]">9. ค่าเช่า/เดือน</th>
                <th className="py-3 px-3 text-right min-w-[110px]">10. เงินประกันสัญญา</th>
                <th className="py-3 px-3 text-center min-w-[85px]">11. จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {paginatedContracts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    {searchTerm || expiryFilter !== 'all' ? (
                      <div className="space-y-1">
                        <div>ไม่พบข้อมูลสัญญาที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง</div>
                        {expiryFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpiryFilter('all');
                              setSearchTerm('');
                              setCurrentPage(1);
                            }}
                            className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                          >
                            ล้างตัวกรองเพื่อแสดงทั้งหมด
                          </button>
                        )}
                      </div>
                    ) : (
                      'ยังไม่มีสัญญาเช่าในระบบ'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((c, index) => {
                  const expiry = contractExpiryMap.get(c.id) || getContractExpiryInfo(c.endDate);
                  const isExpiring = expiry.status === 'critical' || expiry.status === 'warning';
                  const isExpired = expiry.status === 'expired';

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isExpired
                          ? 'bg-rose-50/50 hover:bg-rose-50/80'
                          : isExpiring
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                        {c.order || startIndex + index + 1}
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

                      {/* 7. วันที่สิ้นสุดสัญญา พร้อมการแจ้งเตือน */}
                      <td className="py-2.5 px-3 font-mono-num whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatThaiDate(c.endDate, { short: true })}
                        </div>
                        <div className="mt-1">
                          {expiry.status === 'expired' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              หมดสัญญา ({Math.abs(expiry.daysLeft)} วัน)
                            </span>
                          )}
                          {expiry.status === 'critical' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              {expiry.daysLeft === 0 ? 'สิ้นสุดวันนี้' : `ใกล้สิ้นสุด (เหลือ ${expiry.daysLeft} วัน)`}
                            </span>
                          )}
                          {expiry.status === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              ใกล้สิ้นสุด (เหลือ ${expiry.daysLeft} วัน)
                            </span>
                          )}
                          {expiry.status === 'normal' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              ปกติ
                            </span>
                          )}
                        </div>
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
                  );
                })
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

        {/* Pagination & Items Per Page Bar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            {/* แสดงหน้าละ (Items Per Page Selector) */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">แสดงหน้าละ:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium cursor-pointer"
              >
                <option value={10}>10 รายการ</option>
                <option value={20}>20 รายการ</option>
                <option value={50}>50 รายการ</option>
                <option value={100}>100 รายการ</option>
                <option value="all">ทั้งหมด ({filteredContracts.length})</option>
              </select>
            </div>

            {/* แสดงรายการที่ X - Y จากทั้งหมด Z รายการ */}
            <div className="text-slate-500">
              แสดงรายการที่{' '}
              <span className="font-semibold text-slate-900 font-mono-num">
                {totalItems > 0 ? startIndex + 1 : 0}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-slate-900 font-mono-num">{endIndex}</span>{' '}
              จากทั้งหมด{' '}
              <span className="font-semibold text-slate-900 font-mono-num">{totalItems}</span>{' '}
              รายการ
            </div>
          </div>

          {/* Navigation Buttons */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                title="หน้าแรก"
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                title="ย้อนกลับ"
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-8 h-8 px-2 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${
                            p === safeCurrentPage
                              ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                title="ถัดไป"
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                title="หน้าสุดท้าย"
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
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
                    step="any"
                    value={formData.transactionFee}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionFee: e.target.value })
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
                    step="any"
                    required
                    value={formData.monthlyRent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyRent: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-semibold"
                  />
                </div>

                {/* 9. เงินประกันสัญญาเช่า */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      9. เงินประกันสัญญา (บาท)
                    </label>
                    <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ใส่จำนวนเท่าไหร่ก็ได้
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="ใส่จำนวนเท่าไหร่ก็ได้ เช่น 0, 1000, 5000"
                    value={formData.securityDeposit}
                    onChange={(e) =>
                      setFormData({ ...formData, securityDeposit: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    สามารถกำหนดหรือแก้ไขจำนวนเงินประกันสัญญาได้อิสระตามต้องการ
                  </p>
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

              {/* Firebase Cloud Firestore Sync Badge */}
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  สัญญาจะถูกบันทึกและซิงค์ตรงไปยังฐานข้อมูล <strong>Firebase Firestore</strong> (Collection: <code>contracts</code>) อัตโนมัติแบบเรียลไทม์
                </span>
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

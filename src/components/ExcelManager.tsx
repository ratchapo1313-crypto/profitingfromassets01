import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  downloadFullWorkbook,
  downloadCategoryExcel,
  downloadTemplateExcel,
  parseUploadedFile
} from '../utils/excelHelper.ts';
import { calculateEndDate, formatCurrency, formatInteger } from '../utils/thaiFormat.ts';
import { getSystemMetrics } from '../utils/marketMetrics.ts';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileDown,
  ArrowRight,
  RefreshCw,
  Building2,
  Store
} from 'lucide-react';

export const ExcelManager: React.FC = () => {
  const { db, importBatch } = useData();
  const { currentUser } = useAuth();
  const canImport = currentUser?.role === 'User';

  const metrics = useMemo(() => getSystemMetrics(db), [db]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const [targetType, setTargetType] = useState<'night' | 'fresh'>('night');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[][] | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setUploadedFileName(file.name);

    try {
      const { rows } = await parseUploadedFile(file);
      if (rows.length < 2) {
        setImportStatus({
          type: 'error',
          message: 'ไฟล์ว่างเปล่า หรือไม่มีข้อมูลแถวที่สามารถนำเข้าได้'
        });
        setParsedData(null);
        return;
      }
      setParsedData(rows);
      setImportStatus({
        type: 'info',
        message: `อ่านข้อมูลสำเร็จ พบ ${rows.length} แถว (รวมหัวตาราง)`
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx, .xls หรือ .csv ที่ถูกต้อง: ' + err.message
      });
      setParsedData(null);
    }
  };

  // Convert parsed rows into domain objects
  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.length < 2) return;
    setIsProcessing(true);

    try {
      const headerRowIndex = parsedData.findIndex(
        (row) =>
          row &&
          row.some(
            (cell) =>
              typeof cell === 'string' &&
              (cell.includes('ลำดับ') ||
                cell.includes('รายการ') ||
                cell.includes('สัญญา') ||
                cell.includes('วันที่') ||
                cell.includes('หมวดหมู่'))
          )
      );

      const actualHeaderIdx = headerRowIndex !== -1 ? headerRowIndex : 0;
      const dataRows = parsedData.slice(actualHeaderIdx + 1).filter((r) => r && r.length > 0 && r[0] !== undefined);

      const contracts = dataRows.map((row, idx) => {
        const assetName = String(row[1] || row[0] || `แผงค้า นำเข้า-${idx + 1}`);
        const contractNo = String(row[2] || `สช. นำเข้า-${idx + 1}/2570`);
        const tenantName = String(row[3] || '');
        const startDate = String(row[4] || '2026-10-01');
        const duration = String(row[5] || '1 ปี');
        const endDate = String(row[6] || calculateEndDate(startDate, 1, 0, 0));
        const transactionFee = parseFloat(row[7]) || 500;
        const monthlyRent = parseFloat(row[8]) || 2000;
        const securityDeposit = parseFloat(row[9]) || monthlyRent * 2;
        const notes = String(row[10] || '');

        return {
          id: `ct-${targetType}-${Date.now()}-${idx}`,
          marketType: targetType,
          order: idx + 1,
          assetName,
          contractNo,
          tenantName,
          startDate,
          duration,
          durationYears: 1,
          durationMonths: 0,
          durationDays: 0,
          endDate,
          transactionFee,
          monthlyRent,
          securityDeposit,
          status: 'active' as const,
          notes,
          updatedAt: new Date().toISOString()
        };
      });

      await importBatch(targetType, importMode, contracts);
      setImportStatus({
        type: 'success',
        message: `นำเข้าข้อมูลสัญญาเช่า ${targetType === 'night' ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'} สำเร็จ ${contracts.length} รายการ (โหมด: ${importMode === 'append' ? 'เพิ่มต่อท้าย' : 'แทนที่ข้อมูลเดิม'}) ข้อมูลอัปเดตตรงกันทุกเมนูทันที`
      });

      setParsedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล: ' + err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              <h1 className="text-lg font-bold text-slate-900">
                ระบบดาวน์โหลดและนำเข้าข้อมูล Excel (.xlsx, .csv)
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <RefreshCw className="w-3 h-3 text-emerald-600" />
                <span>ข้อมูลตรงกัน 5 เมนู 100%</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: ดาวน์โหลด Excel */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Download className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              ดาวน์โหลดรายงานเป็น Excel (.xlsx)
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* Download Full Workbook */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <div className="font-semibold text-emerald-900 text-sm mb-1">
                ดาวน์โหลดทั้งเล่มรายงานครบทุกชีต
              </div>
              <p className="text-emerald-700 text-[11px] mb-3">
                รวม 3 ชีตในไฟล์เดียว: สรุปภาพรวมการจัดหาประโยชน์, ตารางสัญญาตลาดโต้รุ่ง และตารางสัญญาตลาดสด ข้อมูลตรงกันทุกจุด
              </p>
              <button
                type="button"
                onClick={() => downloadFullWorkbook(db)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดเล่มรายงานครบทุกชีต (.xlsx)</span>
              </button>
            </div>

            {/* Download per Category */}
            <div className="pt-2">
              <div className="font-semibold text-slate-800 mb-2">
                หรือเลือกดาวน์โหลดแยกเฉพาะตารางตามตลาด:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadCategoryExcel('night', db)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>ตลาดโต้รุ่ง</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono-num">
                    {metrics.night.totalStalls} ล็อค · {metrics.night.leasedCount} สัญญา ({metrics.night.occupancyRate}%)
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono-num">
                    ค่าเช่า: {formatCurrency(metrics.night.monthlyRent)} บาท/ด.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => downloadCategoryExcel('fresh', db)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>ตลาดสด</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono-num">
                    {metrics.fresh.totalStalls} ล็อค · {metrics.fresh.leasedCount} สัญญา ({metrics.fresh.occupancyRate}%)
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono-num">
                    ค่าเช่า: {formatCurrency(metrics.fresh.monthlyRent)} บาท/ด.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: ระบบ Template */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileDown className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              ระบบดาวน์โหลดไฟล์ตัวอย่าง Template
            </h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            ดาวน์โหลดแบบฟอร์มมาตรฐานที่จัดเตรียมหัวตารางและตัวอย่างข้อมูลไว้เรียบร้อย
            เพื่อให้เจ้าหน้าที่สามารถนำไปกรอกข้อมูลและนำกลับเข้ามาสู่ระบบได้อย่างถูกต้อง
          </p>

          <div className="space-y-2 text-xs">
            {/* Template 1: ตลาดโต้รุ่ง */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                  <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>แบบฟอร์มสัญญาเช่าแผงค้า ตลาดโต้รุ่ง</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded font-medium">แนะนำ</span>
                </div>
                <div className="text-[11px] text-indigo-800">
                  โครงสร้าง: ชื่อล็อค (A-xx), เลขสัญญา, ผู้เช่า, วันที่เริ่ม, ระยะเวลา, ค่าเช่า (2,500 บ./ด.), เงินประกัน
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadTemplateExcel('night_contract')}
                className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-md font-medium transition-colors cursor-pointer shrink-0 ml-2 shadow-xs"
              >
                ดาวน์โหลด
              </button>
            </div>

            {/* Template 2: ตลาดสด */}
            <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-950">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>แบบฟอร์มสัญญาเช่าแผงค้า ตลาดสด</span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  โครงสร้าง: ชื่อล็อค (สด-xx), เลขสัญญา, ผู้เช่า, วันที่เริ่ม, ระยะเวลา, ค่าเช่า (1,800 บ./ด.), เงินประกัน
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadTemplateExcel('fresh_contract')}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-medium transition-colors cursor-pointer shrink-0 ml-2 shadow-xs"
              >
                ดาวน์โหลด
              </button>
            </div>

            {/* Template 3: สัญญาเช่าแผงค้าทั่วไป */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">
                  แบบฟอร์มสัญญาเช่าแผงค้าตลาด (ทั่วไป)
                </div>
                <div className="text-[11px] text-slate-500">
                  โครงสร้างมาตรฐาน: ชื่อล็อค, เลขสัญญา, ผู้เช่า, วันที่เริ่ม, ระยะเวลา, ค่าเช่า, เงินประกัน
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadTemplateExcel('market_contract')}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md font-medium text-slate-700 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ดาวน์โหลด
              </button>
            </div>

            {/* Template 4: กำหนดจำนวนล็อค */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">
                  แบบฟอร์มกำหนดจำนวนล็อคตลาด
                </div>
                <div className="text-[11px] text-slate-500">
                  โครงสร้าง: รายการทรัพย์สิน / ตลาด, จำนวนล็อคทั้งหมด
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadTemplateExcel('stall_inventory')}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md font-medium text-slate-700 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: นำเข้าข้อมูล Excel (.xlsx, .xls, .csv) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              นำเข้าข้อมูลสัญญาเช่า Excel / CSV (.xlsx, .xls, .csv)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            {canImport ? 'สิทธิ์: เจ้าหน้าที่สามารถนำเข้าข้อมูลได้' : 'เฉพาะบัญชี User เท่านั้นที่สามารถนำเข้าได้'}
          </span>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Destination Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              หมวดหมู่ตลาดเป้าหมายที่จะนำเข้าข้อมูล:
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
            >
              <option value="night">ตลาดโต้รุ่ง (สัญญาเช่าแผงค้า)</option>
              <option value="fresh">ตลาดสด (สัญญาเช่าแผงค้า)</option>
            </select>
          </div>

          {/* Import Mode Selector: Append vs Replace */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              ตัวเลือกการนำเข้าข้อมูล (โหมด):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                  importMode === 'append'
                    ? 'border-slate-900 bg-slate-50 font-semibold text-slate-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-slate-900"
                />
                <span>เพิ่มต่อท้าย (Append)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                  importMode === 'replace'
                    ? 'border-red-600 bg-red-50 font-semibold text-red-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-red-600"
                />
                <span>แทนที่ข้อมูลเดิม (Replace)</span>
              </label>
            </div>
          </div>
        </div>

        {/* File Input Box */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100/60 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!canImport}
            onChange={handleFileChange}
            className="hidden"
            id="excel-file-input"
          />
          <label htmlFor="excel-file-input" className="cursor-pointer block">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-800">
              คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              รองรับไฟล์ Excel (.xlsx, .xls) และไฟล์ Comma-Separated Values (.csv)
            </div>
            {uploadedFileName && (
              <div className="mt-2 text-xs font-semibold text-emerald-800">
                ไฟล์ที่เลือก: {uploadedFileName}
              </div>
            )}
          </label>
        </div>

        {/* Status Message */}
        {importStatus && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              importStatus.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : importStatus.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* Preview Table & Confirm Button */}
        {parsedData && parsedData.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                ตัวอย่างข้อมูลที่จะนำเข้า (แสดง {Math.min(parsedData.length, 6)} แถวแรก):
              </span>
              <button
                type="button"
                disabled={isProcessing || !canImport}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                <span>ยืนยันการนำเข้าข้อมูล</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-56">
              <table className="w-full text-left text-[11px] border-collapse bg-white">
                <thead className="bg-slate-100 text-slate-700 sticky top-0">
                  <tr>
                    {parsedData[0]?.map((col: any, idx: number) => (
                      <th key={idx} className="p-2 border-b border-slate-200 whitespace-nowrap">
                        {String(col ?? `คอลัมน์ ${idx + 1}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parsedData.slice(1, 6).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {row.map((val: any, cIdx: number) => (
                        <td key={cIdx} className="p-2 whitespace-nowrap text-slate-800 font-mono-num">
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

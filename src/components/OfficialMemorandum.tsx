import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  toThaiNumerals,
  formatThaiDate,
  formatCurrency,
  formatInteger
} from '../utils/thaiFormat.ts';
import { getSystemMetrics } from '../utils/marketMetrics.ts';
import {
  Printer,
  FileText,
  Calendar,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { exportMemorandumToWord } from '../utils/excelHelper.ts';

export const OfficialMemorandum: React.FC = () => {
  const { db, updateApproval } = useData();
  const { currentUser } = useAuth();
  const memoRef = useRef<HTMLDivElement>(null);

  const [useThaiNumeralsState, setUseThaiNumeralsState] = useState<boolean>(true);
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [docRefNo, setDocRefNo] = useState<string>('มค 52004/ว ');

  // Review & Approval modal state
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [signerName, setSignerName] = useState<string>('');

  // Number / Date helpers based on Thai Numerals toggle
  const num = (val: string | number) => {
    return useThaiNumeralsState ? toThaiNumerals(val) : String(val);
  };

  const curr = (amount: number) => {
    return formatCurrency(amount, useThaiNumeralsState);
  };

  const intNum = (val: number) => {
    return formatInteger(val, useThaiNumeralsState);
  };

  const thaiDateFormatted = (dateStr: string) => {
    return formatThaiDate(dateStr, { useThaiNum: useThaiNumeralsState });
  };

  // Unified metrics guaranteed to be identical across Overview, Night Market, Fresh Market, and Excel
  const metrics = useMemo(() => getSystemMetrics(db), [db]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Export to Word Action
  const handleExportWord = () => {
    if (memoRef.current) {
      const htmlContent = memoRef.current.innerHTML;
      exportMemorandumToWord(
        htmlContent,
        `บันทึกข้อความ_ฝ่ายพัฒนารายได้_กองคลัง_เทศบาลเมืองมหาสารคาม_${reportDate}.doc`
      );
    }
  };

  // Approval handlers
  const handleDirectorVerify = () => {
    updateApproval(
      'Director',
      'verify',
      approvalComment || 'ตรวจสอบความถูกต้องของข้อมูลแล้ว ถูกต้องตามระเบียบ เห็นควรนำเรียนนายกเทศมนตรีเพื่อโปรดพิจารณา',
      signerName || 'ผู้อำนวยการกองคลัง'
    );
  };

  const handleExecutiveApprove = () => {
    updateApproval(
      'Executive',
      'approve',
      approvalComment || 'ทราบผลการดำเนินงาน และอนุมัติการรายงาน ขอให้กำชับติดตามการจัดเก็บให้เป็นไปตามเป้าหมายของเทศบาลต่อไป',
      signerName || 'นายกเทศมนตรีเมืองมหาสารคาม'
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar (Hidden when printing) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">วันที่รายงาน:</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono-num text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="font-semibold">เลขที่หนังสือ:</span>
            <input
              type="text"
              value={docRefNo}
              onChange={(e) => setDocRefNo(e.target.value)}
              className="w-32 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono-num text-xs"
            />
          </div>

          {/* Toggle Thai Numerals */}
          <button
            type="button"
            onClick={() => setUseThaiNumeralsState(!useThaiNumeralsState)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-300"
          >
            {useThaiNumeralsState ? (
              <ToggleRight className="w-4 h-4 text-emerald-700" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-500" />
            )}
            <span>
              {useThaiNumeralsState ? 'ตัวเลขไทย (๐ ๑ ๒ ๓)' : 'เลขอารบิก (0 1 2 3)'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-300"
          >
            <FileText className="w-4 h-4 text-blue-700" />
            <span>ส่งออก Word (.doc)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์ออกกระดาษ (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Role Approval Action Strip (Director / Executive) */}
      {(currentUser?.role === 'Director' || currentUser?.role === 'Executive') && (
        <div className="no-print p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <span className="text-xs font-bold text-indigo-900">
                แถบปฏิบัติการสำหรับ: {currentUser.roleTitle}
              </span>
            </div>
            <span className="text-[11px] text-indigo-700">
              สถานะเอกสาร: {db.memoApproval.executiveStatus === 'approved' ? 'อนุมัติแล้ว' : 'รอการพิจารณา'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <input
              type="text"
              placeholder="ความเห็นเพิ่มเติมในการตรวจทาน / อนุมัติ..."
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              className="sm:col-span-2 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg"
            />
            {currentUser.role === 'Director' ? (
              <button
                type="button"
                onClick={handleDirectorVerify}
                className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-900 text-white font-semibold rounded-lg cursor-pointer"
              >
                ลงนามตรวจทาน (ผู้อำนวยการกองคลัง)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecutiveApprove}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
              >
                ลงนามพิจารณาอนุมัติ (นายกเทศมนตรี)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Official Memorandum Paper View (A4 standard compliant, font Sarabun) */}
      <div className="flex justify-center">
        <div
          ref={memoRef}
          className="print-container bg-white text-black p-8 sm:p-14 shadow-md border border-slate-200 w-full max-w-[210mm] min-h-[297mm] font-sarabun text-[15pt] leading-relaxed"
          style={{ boxSizing: 'border-box' }}
        >
          {/* Official Memorandum Header (ระเบียบงานสารบรรณ - บันทึกข้อความ) */}
          <div className="text-center pb-2">
            <h1 className="text-[28pt] font-bold tracking-wider inline-block">
              บันทึกข้อความ
            </h1>
          </div>

          {/* Header Metadata Lines */}
          <div className="space-y-1.5 pt-3 pb-3 border-b-2 border-black/80 text-[14pt]">
            <div className="flex items-baseline">
              <span className="font-bold whitespace-nowrap w-24">ส่วนราชการ</span>
              <span className="flex-1">
                ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม โทร. {num('0 4371 1111')} ต่อ {num('115')}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline flex-1">
                <span className="font-bold whitespace-nowrap w-12">ที่</span>
                <span>{num(docRefNo)} / {num('2570')}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold whitespace-nowrap mr-2">วันที่</span>
                <span>{thaiDateFormatted(reportDate)}</span>
              </div>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold whitespace-nowrap w-16">เรื่อง</span>
              <span className="font-semibold flex-1">
                รายงานผลการดำเนินงานการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และ ตลาดสด) ประจำปีงบประมาณ พ.ศ. {num('2570')}
              </span>
            </div>
          </div>

          {/* เรียน นายกเทศมนตรีเมืองมหาสารคาม */}
          <div className="pt-4 pb-2 text-[14pt]">
            <span className="font-bold">เรียน</span> นายกเทศมนตรีเมืองมหาสารคาม (ผ่าน ผู้อำนวยการกองคลัง)
          </div>

          {/* Memorandum Body Paragraphs */}
          <div className="space-y-4 text-justify pt-2 text-[14pt] leading-[1.6]">
            <p className="indent-8">
              ด้วยฝ่ายพัฒนารายได้ กองคลัง ได้ดำเนินการจัดหาประโยชน์จากทรัพย์สินของเทศบาลเมืองมหาสารคาม
              (ตลาดโต้รุ่ง และตลาดสด) ประจำปีงบประมาณ พ.ศ. {num('2570')} เพื่อให้การบริหารจัดการทรัพย์สินของเทศบาล
              และการจัดเก็บรายได้เป็นไปด้วยความเรียบร้อย โปร่งใส ตรวจสอบได้ และเกิดประโยชน์สูงสุดต่อทางราชการ
              จึงขอสรุปรายงานผลการดำเนินงาน ณ วันที่ {thaiDateFormatted(reportDate)} ดังรายละเอียดต่อไปนี้
            </p>

            {/* Section 1: ข้อมูลการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และ ตลาดสด) */}
            <div>
              <p className="font-bold text-[14pt]">
                ๑. รายงานผลการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และ ตลาดสด)
              </p>
              <p className="indent-8 text-[13.5pt]">
                จากการสำรวจพื้นที่และบริหารจัดการสัญญาเช่าแผงค้าและล็อคจำหน่ายสินค้าในพื้นที่ตลาดของเทศบาลเมืองมหาสารคาม
                มีผลการดำเนินงานสรุปได้ดังนี้
              </p>

              {/* Market Table 1: Occupancy and Stalls */}
              <div className="mt-2 mb-3 overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[12.5pt]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5">รายการทรัพย์สิน</th>
                      <th className="border border-black p-1.5">จำนวนล็อคทั้งหมด</th>
                      <th className="border border-black p-1.5">มีสัญญาเช่าแล้ว</th>
                      <th className="border border-black p-1.5">ล็อคคงเหลือว่าง</th>
                      <th className="border border-black p-1.5">อัตราการเช่า</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-center">
                      <td className="border border-black p-1.5 text-left font-medium">
                        ๑. ตลาดโต้รุ่ง
                      </td>
                      <td className="border border-black p-1.5">{intNum(metrics.night.totalStalls)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.night.leasedCount)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.night.vacantCount)}</td>
                      <td className="border border-black p-1.5">{num(metrics.night.occupancyRate)}%</td>
                    </tr>
                    <tr className="text-center">
                      <td className="border border-black p-1.5 text-left font-medium">
                        ๒. ตลาดสด
                      </td>
                      <td className="border border-black p-1.5">{intNum(metrics.fresh.totalStalls)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.fresh.leasedCount)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.fresh.vacantCount)}</td>
                      <td className="border border-black p-1.5">{num(metrics.fresh.occupancyRate)}%</td>
                    </tr>
                    <tr className="font-bold text-center bg-slate-50">
                      <td className="border border-black p-1.5 text-right">รวมทั้งสิ้น</td>
                      <td className="border border-black p-1.5">{intNum(metrics.combined.totalStalls)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.combined.leasedCount)}</td>
                      <td className="border border-black p-1.5">{intNum(metrics.combined.vacantCount)}</td>
                      <td className="border border-black p-1.5">{num(metrics.combined.occupancyRate)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: สรุปรายรับทางการเงินและเงินค้ำประกันสัญญา */}
            <div>
              <p className="font-bold text-[14pt]">
                ๒. สรุปรายละเอียดรายรับและเงินประกันสัญญาเช่าทรัพย์สิน
              </p>
              <p className="indent-8 text-[13.5pt]">
                รายละเอียดเงินค่าธรรมเนียมธุรกรรม ค่าเช่าทรัพย์สินรายเดือน และเงินประกันการเช่าที่จัดเก็บรักษาไว้
                ของตลาดทั้งสองแห่ง มีข้อมูลดังนี้
              </p>

              {/* Financial Detail Table */}
              <div className="mt-2 mb-3 overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[12.5pt]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-1.5">รายการทรัพย์สิน</th>
                      <th className="border border-black p-1.5">ค่าธรรมเนียมรวม (บาท)</th>
                      <th className="border border-black p-1.5">ค่าเช่ารวม/เดือน (บาท)</th>
                      <th className="border border-black p-1.5">เงินประกันสัญญา (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-center">
                      <td className="border border-black p-1.5 text-left font-medium">
                        ๑. ตลาดโต้รุ่ง
                      </td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.night.transactionFee)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.night.monthlyRent)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.night.securityDeposit)}</td>
                    </tr>
                    <tr className="text-center">
                      <td className="border border-black p-1.5 text-left font-medium">
                        ๒. ตลาดสด
                      </td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.fresh.transactionFee)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.fresh.monthlyRent)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.fresh.securityDeposit)}</td>
                    </tr>
                    <tr className="font-bold text-center bg-slate-50">
                      <td className="border border-black p-1.5 text-right">รวมทั้งสิ้น</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.combined.transactionFee)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.combined.monthlyRent)}</td>
                      <td className="border border-black p-1.5 text-right">{curr(metrics.combined.securityDeposit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="indent-8 text-[13.5pt]">
                รวมเงินค่าเช่าต่อเดือนทั้งสิ้น {curr(metrics.combined.monthlyRent)} บาท
                เงินประกันสัญญาเช่าที่เทศบาลจัดเก็บรักษาไว้ทั้งสิ้น {curr(metrics.combined.securityDeposit)} บาท
                และค่าธรรมเนียมการทำธุรกรรม {curr(metrics.combined.transactionFee)} บาท
              </p>
            </div>

            {/* Section 3: สรุปและข้อเสนอ */}
            <p className="indent-8">
              จึงเรียนมาเพื่อโปรดทราบผลการดำเนินงานการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และตลาดสด)
              และพิจารณาให้ความเห็นชอบ เพื่อฝ่ายพัฒนารายได้ กองคลัง จะได้ดำเนินการบริหารจัดการตามระเบียบของทางราชการต่อไป
            </p>
          </div>

          {/* 3 Signature Blocks Clearly Positioned */}
          <div className="pt-8 space-y-6 text-[13.5pt]">
            {/* 1. ผู้รายงาน (เจ้าหน้าที่ฝ่ายพัฒนารายได้) */}
            <div className="flex justify-end">
              <div className="w-80 text-center space-y-1">
                <div>(ลงชื่อ)............................................................ผู้รายงาน</div>
                <div className="font-semibold">( {db.memoApproval.reporterName} )</div>
                <div className="text-[12.5pt] text-slate-700">{db.memoApproval.reporterTitle}</div>
                <div className="text-[12pt] text-slate-600">
                  วันที่ {thaiDateFormatted(reportDate)}
                </div>
              </div>
            </div>

            <hr className="border-t border-dashed border-black/40 my-3" />

            {/* 2 & 3: Two-Column Section for Director and Executive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-2">
              {/* 2. ผู้ตรวจสอบ (ผู้อำนวยการกองคลัง) */}
              <div className="border border-black/60 p-3 rounded space-y-2">
                <div className="font-bold underline">ความเห็นของผู้อำนวยการกองคลัง (ผู้ตรวจสอบ)</div>
                <p className="text-[12.5pt] leading-normal text-slate-800">
                  {db.memoApproval.directorComment ||
                    'ตรวจสอบความถูกต้องของรายงานและยอดรับเงินแล้ว ถูกต้องตามระเบียบ เห็นควรนำเรียนนายกเทศมนตรีเมืองมหาสารคามเพื่อโปรดพิจารณา'}
                </p>
                <div className="text-center pt-4 space-y-1">
                  <div>(ลงชื่อ)............................................................ผู้ตรวจทาน</div>
                  <div className="font-semibold">( {db.memoApproval.directorName} )</div>
                  <div className="text-[12pt]">{db.memoApproval.directorTitle}</div>
                  <div className="text-[11.5pt] text-slate-600">
                    {db.memoApproval.directorVerifiedAt
                      ? `ตรวจทานแล้วเมื่อ: ${thaiDateFormatted(
                          db.memoApproval.directorVerifiedAt.split('T')[0]
                        )}`
                      : 'วันที่ ........................................'}
                  </div>
                </div>
              </div>

              {/* 3. ผู้พิจารณาอนุมัติ (นายกเทศมนตรีเมืองมหาสารคาม) */}
              <div className="border border-black/60 p-3 rounded space-y-2">
                <div className="font-bold underline">คำสั่ง / การพิจารณาอนุมัติ (ผู้บริหาร)</div>
                <div className="flex items-center gap-4 text-[13pt] font-semibold">
                  <label className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 border border-black inline-flex items-center justify-center text-xs">
                      {db.memoApproval.executiveStatus === 'approved' ? '✓' : ''}
                    </span>
                    <span>อนุมัติ</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 border border-black inline-flex items-center justify-center text-xs">
                      {db.memoApproval.executiveStatus === 'acknowledged' ? '✓' : ''}
                    </span>
                    <span>ทราบ</span>
                  </label>
                </div>
                <p className="text-[12.5pt] leading-normal text-slate-800">
                  {db.memoApproval.executiveComment ||
                    'ทราบผลการดำเนินงาน และอนุมัติการรายงาน ขอให้กำชับติดตามการจัดเก็บให้เป็นไปตามเป้าหมายของเทศบาลต่อไป'}
                </p>
                <div className="text-center pt-4 space-y-1">
                  <div>(ลงชื่อ)............................................................ผู้มีอำนาจอนุมัติ</div>
                  <div className="font-semibold">( {db.memoApproval.executiveName} )</div>
                  <div className="text-[12pt]">{db.memoApproval.executiveTitle}</div>
                  <div className="text-[11.5pt] text-slate-600">
                    {db.memoApproval.executiveApprovedAt
                      ? `พิจารณาอนุมัติแล้วเมื่อ: ${thaiDateFormatted(
                          db.memoApproval.executiveApprovedAt.split('T')[0]
                        )}`
                      : 'วันที่ ........................................'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

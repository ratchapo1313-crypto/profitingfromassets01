import * as XLSX from 'xlsx';
import { AppDatabase } from '../types.ts';
import { formatThaiDate } from './thaiFormat.ts';
import { getSystemMetrics } from './marketMetrics.ts';

/**
 * Downloads the complete workbook with all synchronized sheets
 * Matches Executive Overview, Night Market, Fresh Market, and Official Memorandum exactly.
 */
export function downloadFullWorkbook(db: AppDatabase): void {
  const wb = XLSX.utils.book_new();
  const metrics = getSystemMetrics(db);
  const todayTh = formatThaiDate(new Date().toISOString().split('T')[0]);

  // 1. Overview Sheet (สรุปภาพรวมการจัดหาประโยชน์จากทรัพย์สิน)
  const overviewData = [
    ['รายงานผลการดำเนินงาน ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม'],
    ['ประจำปีงบประมาณ พ.ศ. 2570'],
    ['รายงานสรุปผลการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และ ตลาดสด)'],
    [`ข้อมูล ณ วันที่ ${todayTh}`],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน / ตลาด',
      'จำนวนล็อคทั้งหมด',
      'มีสัญญาเช่าแล้ว',
      'ล็อคคงเหลือว่าง',
      'อัตราการเช่า (%)',
      'ค่าธรรมเนียมธุรกรรมรวม (บาท)',
      'จำนวนค่าเช่ารวม/เดือน (บาท)',
      'เงินประกันสัญญาเช่ารวม (บาท)'
    ],
    [
      1,
      'ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม',
      metrics.night.totalStalls,
      metrics.night.leasedCount,
      metrics.night.vacantCount,
      `${metrics.night.occupancyRate}%`,
      metrics.night.transactionFee,
      metrics.night.monthlyRent,
      metrics.night.securityDeposit
    ],
    [
      2,
      'ตลาดสด เทศบาลเมืองมหาสารคาม',
      metrics.fresh.totalStalls,
      metrics.fresh.leasedCount,
      metrics.fresh.vacantCount,
      `${metrics.fresh.occupancyRate}%`,
      metrics.fresh.transactionFee,
      metrics.fresh.monthlyRent,
      metrics.fresh.securityDeposit
    ],
    [
      '',
      'รวมทั้งสิ้น (๒ ตลาด)',
      metrics.combined.totalStalls,
      metrics.combined.leasedCount,
      metrics.combined.vacantCount,
      `${metrics.combined.occupancyRate}%`,
      metrics.combined.transactionFee,
      metrics.combined.monthlyRent,
      metrics.combined.securityDeposit
    ],
    [],
    ['หมายเหตุ: ข้อมูลเชื่อมโยงตรงกับหน้าภาพรวมสรุปผล ตลาดโต้รุ่ง ตลาดสด และบันทึกข้อความราชการ']
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'สรุปภาพรวม');

  // 2. Night Market Sheet (ตลาดโต้รุ่ง)
  const nightContracts = metrics.night.contracts;
  const nightData = [
    ['ตารางสัญญาเช่าตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570'],
    [`จำนวนล็อคทั้งหมด: ${metrics.night.totalStalls} ล็อค | มีสัญญาเช่าแล้ว: ${metrics.night.leasedCount} สัญญา | คงเหลือว่าง: ${metrics.night.vacantCount} ล็อค | อัตราการเช่า: ${metrics.night.occupancyRate}%`],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
      'เลขที่สัญญา',
      'ชื่อผู้เช่า / ผู้ประกอบการ',
      'วันที่เริ่มสัญญา',
      'กำหนดระยะเวลาการเช่า',
      'วันที่สิ้นสุดสัญญา',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)',
      'เงินประกันสัญญาเช่า (บาท)',
      'หมายเหตุ'
    ],
    ...nightContracts.map((c, idx) => [
      idx + 1,
      c.assetName,
      c.contractNo,
      c.tenantName,
      c.startDate,
      c.duration,
      c.endDate,
      c.transactionFee,
      c.monthlyRent,
      c.securityDeposit,
      c.notes || ''
    ]),
    [
      '',
      'รวมทั้งสิ้น ตลาดโต้รุ่ง',
      `${nightContracts.length} สัญญา`,
      '',
      '',
      '',
      '',
      metrics.night.transactionFee,
      metrics.night.monthlyRent,
      metrics.night.securityDeposit,
      ''
    ]
  ];
  const wsNight = XLSX.utils.aoa_to_sheet(nightData);
  XLSX.utils.book_append_sheet(wb, wsNight, 'ตลาดโต้รุ่ง');

  // 3. Fresh Market Sheet (ตลาดสด)
  const freshContracts = metrics.fresh.contracts;
  const freshData = [
    ['ตารางสัญญาเช่าตลาดสด เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570'],
    [`จำนวนล็อคทั้งหมด: ${metrics.fresh.totalStalls} ล็อค | มีสัญญาเช่าแล้ว: ${metrics.fresh.leasedCount} สัญญา | คงเหลือว่าง: ${metrics.fresh.vacantCount} ล็อค | อัตราการเช่า: ${metrics.fresh.occupancyRate}%`],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
      'เลขที่สัญญา',
      'ชื่อผู้เช่า / ผู้ประกอบการ',
      'วันที่เริ่มสัญญา',
      'กำหนดระยะเวลาการเช่า',
      'วันที่สิ้นสุดสัญญา',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)',
      'เงินประกันสัญญาเช่า (บาท)',
      'หมายเหตุ'
    ],
    ...freshContracts.map((c, idx) => [
      idx + 1,
      c.assetName,
      c.contractNo,
      c.tenantName,
      c.startDate,
      c.duration,
      c.endDate,
      c.transactionFee,
      c.monthlyRent,
      c.securityDeposit,
      c.notes || ''
    ]),
    [
      '',
      'รวมทั้งสิ้น ตลาดสด',
      `${freshContracts.length} สัญญา`,
      '',
      '',
      '',
      '',
      metrics.fresh.transactionFee,
      metrics.fresh.monthlyRent,
      metrics.fresh.securityDeposit,
      ''
    ]
  ];
  const wsFresh = XLSX.utils.aoa_to_sheet(freshData);
  XLSX.utils.book_append_sheet(wb, wsFresh, 'ตลาดสด');

  // Write and trigger download
  XLSX.writeFile(
    wb,
    `รายงานการจัดหาประโยชน์จากทรัพย์สิน_กองคลัง_เทศบาลเมืองมหาสารคาม_2570_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}

/**
 * Downloads a single category sheet (Night Market or Fresh Market)
 */
export function downloadCategoryExcel(category: 'night' | 'fresh', db: AppDatabase): void {
  const wb = XLSX.utils.book_new();
  const metrics = getSystemMetrics(db);
  const target = category === 'night' ? metrics.night : metrics.fresh;
  const sheetName = category === 'night' ? 'ตลาดโต้รุ่ง' : 'ตลาดสด';

  const data = [
    [`ตารางสัญญาเช่า${sheetName} เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570`],
    [`จำนวนล็อคทั้งหมด: ${target.totalStalls} ล็อค | มีสัญญาเช่าแล้ว: ${target.leasedCount} สัญญา | คงเหลือว่าง: ${target.vacantCount} ล็อค | อัตราการเช่า: ${target.occupancyRate}%`],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
      'เลขที่สัญญา',
      'ชื่อผู้เช่า / ผู้ประกอบการ',
      'วันที่เริ่มสัญญา',
      'กำหนดระยะเวลาการเช่า',
      'วันที่สิ้นสุดสัญญา',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)',
      'เงินประกันสัญญาเช่า (บาท)',
      'หมายเหตุ'
    ],
    ...target.contracts.map((c, idx) => [
      idx + 1,
      c.assetName,
      c.contractNo,
      c.tenantName,
      c.startDate,
      c.duration,
      c.endDate,
      c.transactionFee,
      c.monthlyRent,
      c.securityDeposit,
      c.notes || ''
    ]),
    [
      '',
      `รวมทั้งสิ้น ${sheetName}`,
      `${target.contracts.length} สัญญา`,
      '',
      '',
      '',
      '',
      target.transactionFee,
      target.monthlyRent,
      target.securityDeposit,
      ''
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `สัญญาเช่า_${sheetName}_เทศบาลเมืองมหาสารคาม_2570.xlsx`);
}

/**
 * Downloads standard templates for users to fill in
 */
export function downloadTemplateExcel(
  templateType: 'market_contract' | 'night_contract' | 'fresh_contract' | 'stall_inventory'
): void {
  const wb = XLSX.utils.book_new();

  if (templateType === 'night_contract') {
    const data = [
      ['แบบฟอร์มนำเข้าข้อมูล_สัญญาเช่าแผงค้าตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม (กรุณากรอกข้อมูลแถวที่ 3 เป็นต้นไป)'],
      [
        'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
        'เลขที่สัญญา',
        'ชื่อผู้เช่า / ผู้ประกอบการ',
        'วันที่เริ่มสัญญา (YYYY-MM-DD)',
        'กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 6 เดือน)',
        'วันที่สิ้นสุดสัญญา (YYYY-MM-DD)',
        'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
        'จำนวนค่าเช่า/เดือน (บาท)',
        'เงินประกันสัญญาเช่า (บาท)',
        'หมายเหตุ'
      ],
      ['แผงค้า A-01', 'สช. 001/2570', 'นายมานพ เจริญดี', '2026-10-01', '1 ปี', '2027-09-30', 500, 2500, 5000, 'อาหารและเครื่องดื่ม'],
      ['แผงค้า A-02', 'สช. 002/2570', 'นางสมร ทวีทรัพย์', '2026-10-01', '1 ปี', '2027-09-30', 500, 2500, 5000, 'ของทานเล่น'],
      ['แผงค้า A-03', 'สช. 003/2570', 'นายธวัชชัย มั่งมี', '2026-10-01', '6 เดือน', '2027-03-31', 500, 2500, 5000, '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template_ตลาดโต้รุ่ง');
    XLSX.writeFile(wb, 'Template_สัญญาเช่าแผงค้า_ตลาดโต้รุ่ง_เทศบาลเมืองมหาสารคาม.xlsx');
  } else if (templateType === 'fresh_contract') {
    const data = [
      ['แบบฟอร์มนำเข้าข้อมูล_สัญญาเช่าแผงค้าตลาดสด เทศบาลเมืองมหาสารคาม (กรุณากรอกข้อมูลแถวที่ 3 เป็นต้นไป)'],
      [
        'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
        'เลขที่สัญญา',
        'ชื่อผู้เช่า / ผู้ประกอบการ',
        'วันที่เริ่มสัญญา (YYYY-MM-DD)',
        'กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 6 เดือน)',
        'วันที่สิ้นสุดสัญญา (YYYY-MM-DD)',
        'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
        'จำนวนค่าเช่า/เดือน (บาท)',
        'เงินประกันสัญญาเช่า (บาท)',
        'หมายเหตุ'
      ],
      ['แผงค้า สด-01', 'สช. 001/2570', 'นายบุญมี การค้า', '2026-10-01', '1 ปี', '2027-09-30', 400, 1800, 3600, 'ผักสดและผลไม้'],
      ['แผงค้า สด-02', 'สช. 002/2570', 'นางทองสุข มั่งมี', '2026-10-01', '1 ปี', '2027-09-30', 400, 1800, 3600, 'เนื้อสัตว์และอาหารสด']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template_ตลาดสด');
    XLSX.writeFile(wb, 'Template_สัญญาเช่าแผงค้า_ตลาดสด_เทศบาลเมืองมหาสารคาม.xlsx');
  } else if (templateType === 'market_contract') {
    const data = [
      ['แบบฟอร์มนำเข้าข้อมูล_สัญญาเช่าแผงค้าตลาด (กรุณากรอกข้อมูลแถวที่ 3 เป็นต้นไป)'],
      [
        'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
        'เลขที่สัญญา',
        'ชื่อผู้เช่า / ผู้ประกอบการ',
        'วันที่เริ่มสัญญา (YYYY-MM-DD)',
        'กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 6 เดือน)',
        'วันที่สิ้นสุดสัญญา (YYYY-MM-DD)',
        'ค่าธรรมเนียมการทำธุรกรรม',
        'จำนวนค่าเช่า/เดือน',
        'เงินประกันสัญญาเช่า',
        'หมายเหตุ'
      ],
      ['แผงค้า A-99', 'สช. 099/2570', 'นายมานพ เจริญดี', '2026-10-01', '1 ปี', '2027-09-30', 500, 2500, 5000, ''],
      ['แผงค้า B-99', 'สช. 100/2570', 'นางสมร ทวีทรัพย์', '2026-10-01', '6 เดือน', '2027-03-31', 300, 2000, 4000, '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template_สัญญาเช่า');
    XLSX.writeFile(wb, 'Template_สัญญาเช่าแผงค้าตลาด_เทศบาลเมืองมหาสารคาม.xlsx');
  } else {
    const data = [
      ['แบบฟอร์มกำหนดจำนวนล็อคตลาด เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570'],
      ['รายการทรัพย์สิน / ตลาด', 'จำนวนล็อคทั้งหมด (ล็อค)'],
      ['ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม', 120],
      ['ตลาดสด เทศบาลเมืองมหาสารคาม', 80]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template_จำนวนล็อค');
    XLSX.writeFile(wb, 'Template_กำหนดจำนวนล็อคตลาด_เทศบาลเมืองมหาสารคาม.xlsx');
  }
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or .csv file and returns structured data rows
 */
export async function parseUploadedFile(file: File): Promise<{ sheetNames: string[]; rows: any[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        resolve({
          sheetNames: workbook.SheetNames,
          rows: rows as any[][]
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export Official Memorandum as Word document (.doc)
 */
export function exportMemorandumToWord(
  memoHtmlContent: string,
  fileName: string = 'บันทึกข้อความ_เทศบาลเมืองมหาสารคาม.doc'
): void {
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>บันทึกข้อความ เทศบาลเมืองมหาสารคาม</title>
      <style>
        @page {
          size: 21cm 29.7cm;
          margin: 2cm 2cm 2cm 2.5cm;
        }
        body {
          font-family: 'TH Sarabun PSK', 'Sarabun', 'Angsana New', sans-serif;
          font-size: 16pt;
          line-height: 1.35;
          color: #000;
        }
        h1, h2, h3 {
          font-family: 'TH Sarabun PSK', 'Sarabun', sans-serif;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          margin-bottom: 15px;
        }
        th, td {
          border: 1px solid #333;
          padding: 6px 8px;
          font-size: 14pt;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
      </style>
    </head>
    <body>
  `;
  const footer = '</body></html>';
  const fullHtml = header + memoHtmlContent + footer;

  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

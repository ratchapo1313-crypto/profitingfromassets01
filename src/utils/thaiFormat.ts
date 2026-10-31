/**
 * Utility functions for Thai dates, Thai numerals, currency, and lease end date calculation.
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

export function toThaiNumerals(value: string | number): string {
  const str = String(value);
  return str.replace(/[0-9]/g, (digit) => THAI_DIGITS[parseInt(digit, 10)] || digit);
}

export function fromThaiNumerals(value: string): string {
  return value.replace(/[๐-๙]/g, (thaiDigit) => {
    const idx = THAI_DIGITS.indexOf(thaiDigit);
    return idx !== -1 ? String(idx) : thaiDigit;
  });
}

/**
 * Format YYYY-MM-DD to Thai Buddhist Era Date (พ.ศ.)
 * Note: Local standard CE to BE offset is +543.
 */
export function formatThaiDate(
  dateStr: string,
  options?: { short?: boolean; useThaiNum?: boolean; showDayOfWeek?: boolean }
): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;

  const yearCE = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(yearCE) || isNaN(monthIdx) || isNaN(day)) return dateStr;

  const yearBE = yearCE + 543;
  const monthName = options?.short ? THAI_MONTHS_SHORT[monthIdx] : THAI_MONTHS[monthIdx];

  const result = `${day} ${monthName} ${yearBE}`;
  return options?.useThaiNum ? toThaiNumerals(result) : result;
}

/**
 * Formats a number with comma separators.
 */
export function formatCurrency(amount: number, useThaiNum: boolean = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0.00';
  const formatted = amount.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return useThaiNum ? toThaiNumerals(formatted) : formatted;
}

export function formatInteger(num: number, useThaiNum: boolean = false): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  const formatted = num.toLocaleString('th-TH');
  return useThaiNum ? toThaiNumerals(formatted) : formatted;
}

/**
 * Calculate lease end date based on start date and duration.
 * Government lease convention:
 * 1 year from 2026-10-01 ends on 2027-09-30 (1 day before anniversary).
 * 6 months from 2026-10-01 ends on 2027-03-31.
 */
export function calculateEndDate(
  startDateStr: string,
  years: number = 0,
  months: number = 0,
  days: number = 0
): string {
  if (!startDateStr) return '';
  const parts = startDateStr.split('-');
  if (parts.length < 3) return '';

  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const startDay = parseInt(parts[2], 10);

  const date = new Date(startYear, startMonth, startDay);
  if (isNaN(date.getTime())) return '';

  // Add years and months
  if (years > 0) {
    date.setFullYear(date.getFullYear() + years);
  }
  if (months > 0) {
    date.setMonth(date.getMonth() + months);
  }
  if (days > 0) {
    date.setDate(date.getDate() + days);
  }

  // Minus 1 day for inclusive end date if duration is specified
  if (years > 0 || months > 0 || days > 0) {
    date.setDate(date.getDate() - 1);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses duration description to years, months, days.
 */
export function buildDurationLabel(years: number, months: number, days: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ปี`);
  if (months > 0) parts.push(`${months} เดือน`);
  if (days > 0) parts.push(`${days} วัน`);
  return parts.length > 0 ? parts.join(' ') : '1 ปี';
}

export interface ContractExpiryInfo {
  status: 'expired' | 'critical' | 'warning' | 'normal';
  daysLeft: number;
  label: string;
  badgeClass: string;
  iconType: 'expired' | 'critical' | 'warning' | 'normal';
}

/**
 * Calculates days remaining until lease contract end date and returns alert info.
 * - expired: daysLeft < 0
 * - critical: 0 <= daysLeft <= 30 (expires within 30 days)
 * - warning: 31 <= daysLeft <= 60 (expires within 60 days)
 * - normal: daysLeft > 60
 */
export function getContractExpiryInfo(endDateStr: string): ContractExpiryInfo {
  if (!endDateStr) {
    return {
      status: 'normal',
      daysLeft: 9999,
      label: 'ปกติ',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      iconType: 'normal'
    };
  }

  const parts = endDateStr.split('-');
  if (parts.length < 3) {
    return {
      status: 'normal',
      daysLeft: 9999,
      label: 'ปกติ',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      iconType: 'normal'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      status: 'expired',
      daysLeft,
      label: `หมดสัญญาแล้ว (เกิน ${Math.abs(daysLeft)} วัน)`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      iconType: 'expired'
    };
  } else if (daysLeft === 0) {
    return {
      status: 'critical',
      daysLeft,
      label: 'สิ้นสุดสัญญาวันนี้',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      iconType: 'critical'
    };
  } else if (daysLeft <= 30) {
    return {
      status: 'critical',
      daysLeft,
      label: `ใกล้สิ้นสุด (เหลือ ${daysLeft} วัน)`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
      iconType: 'critical'
    };
  } else if (daysLeft <= 60) {
    return {
      status: 'warning',
      daysLeft,
      label: `ใกล้สิ้นสุด (เหลือ ${daysLeft} วัน)`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      iconType: 'warning'
    };
  } else {
    return {
      status: 'normal',
      daysLeft,
      label: 'ปกติ',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconType: 'normal'
    };
  }
}


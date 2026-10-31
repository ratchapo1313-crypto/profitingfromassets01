export type UserRole = 'User' | 'Director' | 'Executive';

export interface UserAccount {
  username: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  permissions: string[];
}

export type MarketType = 'night' | 'fresh';

export interface MarketLeaseContract {
  id: string;
  marketType: MarketType;
  order: number;
  assetName: string; // รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)
  contractNo: string; // เลขที่สัญญา
  startDate: string; // วันที่เริ่มสัญญา YYYY-MM-DD
  duration: string; // กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 2 ปี, 3 ปี, 6 เดือน)
  durationYears: number;
  durationMonths: number;
  durationDays: number;
  endDate: string; // วันที่สิ้นสุดสัญญา (ระบบคำนวณอัตโนมัติ)
  transactionFee: number; // ค่าธรรมเนียมการทำธุรกรรม
  monthlyRent: number; // จำนวนค่าเช่า/เดือน
  securityDeposit: number; // เงินประกันสัญญาเช่า
  tenantName: string; // ผู้เช่า
  status: 'active' | 'expiring_soon' | 'expired';
  notes?: string;
  updatedAt: string;
}

export interface MarketConfig {
  totalStalls: number;
  name: string;
  description: string;
  location: string;
}

export type RevenueCategory =
  | 'land_building' // ภาษีที่ดินและสิ่งปลูกสร้าง
  | 'signboard' // ภาษีป้าย
  | 'market_night' // ค่าเช่าและค่าธรรมเนียมตลาดโต้รุ่ง
  | 'market_fresh' // ค่าเช่าและค่าธรรมเนียมตลาดสด
  | 'waste_sanitation' // ค่าธรรมเนียมการจัดการมูลฝอยและสิ่งปฏิกูล
  | 'miscellaneous'; // รายได้เบ็ดเตล็ดและอื่นๆ

export interface DailyRevenue {
  id: string;
  date: string; // YYYY-MM-DD
  receiptNo: string; // เลขที่ใบเสร็จ
  category: RevenueCategory;
  categoryLabel: string;
  payerName: string; // ผู้ชำระ
  description: string;
  amount: number; // จำนวนเงิน (บาท)
  paymentMethod: 'cash' | 'transfer' | 'qr';
  recordedBy: string; // บันทึกโดย
  notes?: string;
}

export interface BudgetTarget {
  category: RevenueCategory;
  categoryLabel: string;
  targetAmount: number; // ประมาณการรายรับปี 2570
}

export interface OfficialMemoApproval {
  reporterName: string;
  reporterTitle: string;
  reportedDate: string;
  isReported: boolean;

  directorName: string;
  directorTitle: string;
  directorStatus: 'pending' | 'verified' | 'returned';
  directorComment: string;
  directorVerifiedAt?: string;

  executiveName: string;
  executiveTitle: string;
  executiveStatus: 'pending' | 'approved' | 'acknowledged' | 'returned';
  executiveComment: string;
  executiveApprovedAt?: string;
}

export interface AppDatabase {
  nightMarketConfig: MarketConfig;
  freshMarketConfig: MarketConfig;
  contracts: MarketLeaseContract[];
  dailyRevenues: DailyRevenue[];
  budgetTargets: BudgetTarget[];
  memoApproval: OfficialMemoApproval;
  lastUpdated: string;
}

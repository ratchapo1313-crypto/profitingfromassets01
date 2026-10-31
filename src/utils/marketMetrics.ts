import { AppDatabase, MarketLeaseContract, MarketType } from '../types.ts';

export interface MarketMetrics {
  marketType?: MarketType | 'combined';
  marketName: string;
  totalStalls: number;
  leasedCount: number;
  vacantCount: number;
  occupancyRate: string; // e.g. "75.0"
  occupancyRateNumber: number;
  monthlyRent: number;
  securityDeposit: number;
  transactionFee: number;
  contracts: MarketLeaseContract[];
}

export interface SystemMetrics {
  night: MarketMetrics;
  fresh: MarketMetrics;
  combined: MarketMetrics;
  lastUpdated: string;
}

/**
 * Calculates standard metrics for a market given its contracts and total stalls
 */
export function calculateMarketMetrics(
  contracts: MarketLeaseContract[],
  totalStalls: number,
  marketName: string,
  marketType?: MarketType
): MarketMetrics {
  const safeStalls = Math.max(0, Number(totalStalls) || 0);
  const leasedCount = contracts.length;
  const vacantCount = Math.max(0, safeStalls - leasedCount);
  const occupancyRateNumber = safeStalls > 0 ? (leasedCount / safeStalls) * 100 : 0;
  const occupancyRate = occupancyRateNumber.toFixed(1);

  const monthlyRent = contracts.reduce((sum, c) => sum + (Number(c.monthlyRent) || 0), 0);
  const securityDeposit = contracts.reduce((sum, c) => sum + (Number(c.securityDeposit) || 0), 0);
  const transactionFee = contracts.reduce((sum, c) => sum + (Number(c.transactionFee) || 0), 0);

  return {
    marketType,
    marketName,
    totalStalls: safeStalls,
    leasedCount,
    vacantCount,
    occupancyRate,
    occupancyRateNumber,
    monthlyRent,
    securityDeposit,
    transactionFee,
    contracts
  };
}

/**
 * Gets unified system-wide metrics across Night Market, Fresh Market, and Combined
 * Guaranteed to match across Executive Overview, Market Management, Official Memo, and Excel Export
 */
export function getSystemMetrics(db: AppDatabase): SystemMetrics {
  const nightContracts = db.contracts.filter((c) => c.marketType === 'night');
  const freshContracts = db.contracts.filter((c) => c.marketType === 'fresh');

  const night = calculateMarketMetrics(
    nightContracts,
    db.nightMarketConfig.totalStalls,
    'ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม',
    'night'
  );

  const fresh = calculateMarketMetrics(
    freshContracts,
    db.freshMarketConfig.totalStalls,
    'ตลาดสด เทศบาลเมืองมหาสารคาม',
    'fresh'
  );

  const totalStalls = night.totalStalls + fresh.totalStalls;
  const leasedCount = night.leasedCount + fresh.leasedCount;
  const vacantCount = night.vacantCount + fresh.vacantCount;
  const occupancyRateNumber = totalStalls > 0 ? (leasedCount / totalStalls) * 100 : 0;
  const occupancyRate = occupancyRateNumber.toFixed(1);

  const monthlyRent = night.monthlyRent + fresh.monthlyRent;
  const securityDeposit = night.securityDeposit + fresh.securityDeposit;
  const transactionFee = night.transactionFee + fresh.transactionFee;

  const combined: MarketMetrics = {
    marketType: 'combined',
    marketName: 'รวมทรัพย์สินทั้งสิ้น (ตลาดโต้รุ่ง และ ตลาดสด)',
    totalStalls,
    leasedCount,
    vacantCount,
    occupancyRate,
    occupancyRateNumber,
    monthlyRent,
    securityDeposit,
    transactionFee,
    contracts: [...nightContracts, ...freshContracts]
  };

  return {
    night,
    fresh,
    combined,
    lastUpdated: db.lastUpdated || new Date().toISOString()
  };
}

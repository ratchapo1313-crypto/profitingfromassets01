import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AppDatabase,
  MarketLeaseContract,
  MarketType,
  DailyRevenue
} from '../types.ts';
import { initialDatabase } from '../data/initialData.ts';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { firestore, firestoreDatabaseId, handleFirestoreError, OperationType, testConnection } from '../firebase.ts';

interface DataContextType {
  db: AppDatabase;
  isLoading: boolean;
  lastSyncedAt: string;
  isOnline: boolean;
  isFirebaseConnected: boolean;
  firestoreDatabaseId: string;
  updateMarketStalls: (type: MarketType, totalStalls: number) => Promise<void>;
  addContract: (contract: MarketLeaseContract) => Promise<void>;
  updateContract: (id: string, updatedFields: Partial<MarketLeaseContract>) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  addDailyRevenue: (revenue: DailyRevenue) => Promise<void>;
  deleteDailyRevenue: (id: string) => Promise<void>;
  updateApproval: (
    role: 'Director' | 'Executive',
    action: 'verify' | 'approve' | 'acknowledge' | 'return',
    comment: string,
    name?: string
  ) => Promise<void>;
  importBatch: (
    target: 'night' | 'fresh' | 'revenues',
    mode: 'append' | 'replace',
    items: any[],
    totalStalls?: number
  ) => Promise<void>;
  syncMarketToFirestore: (marketType: MarketType) => Promise<{ success: boolean; count: number; error?: string }>;
  testFirebaseConnection: () => Promise<boolean>;
  resetToDefault: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'mhk_tax_database_v2570';
const FIRESTORE_DOC_PATH = 'app_state/main';

function getLocalData(): AppDatabase {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
  }
  return initialDatabase;
}

function saveLocalData(data: AppDatabase): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase>(() => getLocalData());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString('th-TH'));
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Keep a ref to current db to prevent stale closure during updates
  const dbRef = useRef<AppDatabase>(db);
  useEffect(() => {
    dbRef.current = db;
    saveLocalData(db);
  }, [db]);

  // Sync to Firebase Cloud Firestore
  const syncToCloud = useCallback(async (dataToSync: AppDatabase): Promise<boolean> => {
    try {
      const cleanData = cleanForFirestore(dataToSync);
      const mainDocRef = doc(firestore, 'app_state', 'main');
      await setDoc(mainDocRef, cleanData);
      setIsFirebaseConnected(true);
      setIsOnline(true);
      setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, FIRESTORE_DOC_PATH);
      return false;
    }
  }, []);

  // Fetch full data from Cloud Firestore / Local API
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    let syncedFromCloud = false;

    try {
      const mainDocRef = doc(firestore, 'app_state', 'main');
      const snap = await getDoc(mainDocRef);
      if (snap.exists()) {
        const cloudData = { ...initialDatabase, ...snap.data() } as AppDatabase;
        setDb(cloudData);
        saveLocalData(cloudData);
        setIsFirebaseConnected(true);
        setIsOnline(true);
        setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
        syncedFromCloud = true;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, FIRESTORE_DOC_PATH);
    }

    if (!syncedFromCloud) {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setDb(json.data);
            saveLocalData(json.data);
            setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
            setIsOnline(true);
          }
        }
      } catch {
        setIsOnline(false);
      }
    }

    setIsLoading(false);
  }, []);

  // Initialize Firebase connection and live real-time synchronization
  useEffect(() => {
    let isMounted = true;
    let unsubscribeFirestore: (() => void) | null = null;

    const setupFirebase = async () => {
      try {
        // Test connection on boot
        await testConnection();

        const mainDocRef = doc(firestore, 'app_state', 'main');

        // Check if database exists in Cloud Firestore; if not, initialize with seed
        try {
          const snap = await getDoc(mainDocRef);
          if (snap.exists()) {
            if (isMounted) {
              const cloudData = { ...initialDatabase, ...snap.data() } as AppDatabase;
              setDb(cloudData);
              saveLocalData(cloudData);
              setIsFirebaseConnected(true);
              setIsOnline(true);
              setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
            }
          } else {
            // First time seed to Firestore
            await setDoc(mainDocRef, cleanForFirestore(initialDatabase));
            if (isMounted) {
              setIsFirebaseConnected(true);
              setIsOnline(true);
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, FIRESTORE_DOC_PATH);
        }

        // Live Real-Time Listener: all tabs and devices get instant updates from Firebase
        unsubscribeFirestore = onSnapshot(
          mainDocRef,
          (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
              const cloudData = { ...initialDatabase, ...docSnap.data() } as AppDatabase;
              setDb(cloudData);
              saveLocalData(cloudData);
              setIsFirebaseConnected(true);
              setIsOnline(true);
              setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
            }
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, FIRESTORE_DOC_PATH);
            if (isMounted) setIsFirebaseConnected(false);
          }
        );
      } catch (err) {
        console.warn('Firebase init caught:', err);
      }
    };

    setupFirebase();

    // Secondary backup sync with local express server
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onopen = () => setIsOnline(true);
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.data && isMounted) {
            setDb(parsed.data);
            saveLocalData(parsed.data);
            setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
          }
        } catch {
          // keep existing state
        }
      };
      eventSource.onerror = () => {
        // SSE error, reliance on Firebase
      };
    } catch {
      // EventSource fallback
    }

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (eventSource) eventSource.close();
    };
  }, []);

  // 1. Update Market Stalls (optimistic update + Firebase persistence)
  const updateMarketStalls = async (type: MarketType, totalStalls: number) => {
    const newDb: AppDatabase = {
      ...dbRef.current,
      nightMarketConfig:
        type === 'night'
          ? { ...dbRef.current.nightMarketConfig, totalStalls }
          : dbRef.current.nightMarketConfig,
      freshMarketConfig:
        type === 'fresh'
          ? { ...dbRef.current.freshMarketConfig, totalStalls }
          : dbRef.current.freshMarketConfig,
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    // Persist to Firebase and local server
    syncToCloud(newDb);
    try {
      await fetch(`/api/markets/${type}/stalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalStalls })
      });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 2. Add Contract (optimistic update + Cloud Firestore contracts collection + app_state persistence)
  const addContract = async (contract: MarketLeaseContract) => {
    const targetType = contract.marketType;
    const sameMarket = dbRef.current.contracts.filter((c) => c.marketType === targetType);
    contract.order = sameMarket.length + 1;
    contract.updatedAt = new Date().toISOString();

    const newContracts = [...dbRef.current.contracts, contract];
    const newDb: AppDatabase = {
      ...dbRef.current,
      contracts: newContracts,
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    // Persist to both /contracts/{contractId} and /app_state/main in Cloud Firestore
    try {
      const contractRef = doc(firestore, 'contracts', contract.id);
      await setDoc(contractRef, cleanForFirestore(contract));
      setIsFirebaseConnected(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `contracts/${contract.id}`);
    }

    syncToCloud(newDb);

    try {
      await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contract)
      });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 3. Update Contract (optimistic update + Cloud Firestore contracts collection persistence)
  const updateContract = async (id: string, updatedFields: Partial<MarketLeaseContract>) => {
    let updatedItem: MarketLeaseContract | undefined;
    const newContracts = dbRef.current.contracts.map((c) => {
      if (c.id === id) {
        updatedItem = {
          ...c,
          ...updatedFields,
          updatedAt: new Date().toISOString()
        };
        return updatedItem;
      }
      return c;
    });

    const newDb: AppDatabase = {
      ...dbRef.current,
      contracts: newContracts,
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    // Persist to individual doc in Firestore
    if (updatedItem) {
      try {
        const contractRef = doc(firestore, 'contracts', id);
        await setDoc(contractRef, cleanForFirestore(updatedItem), { merge: true });
        setIsFirebaseConnected(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `contracts/${id}`);
      }
    }

    syncToCloud(newDb);

    try {
      await fetch(`/api/contracts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 4. Delete Contract (optimistic update + Cloud Firestore contracts collection removal)
  const deleteContract = async (id: string) => {
    const target = dbRef.current.contracts.find((c) => c.id === id);
    if (!target) return;

    const targetType = target.marketType;
    const filtered = dbRef.current.contracts.filter((c) => c.id !== id);

    let orderNum = 1;
    const reordered = filtered.map((c) => {
      if (c.marketType === targetType) {
        return { ...c, order: orderNum++ };
      }
      return c;
    });

    const newDb: AppDatabase = {
      ...dbRef.current,
      contracts: reordered,
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    // Remove from individual Firestore contracts collection
    try {
      const contractRef = doc(firestore, 'contracts', id);
      await deleteDoc(contractRef);
      setIsFirebaseConnected(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contracts/${id}`);
    }

    syncToCloud(newDb);

    try {
      await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 5. Add Daily Revenue (optimistic update + Firebase persistence)
  const addDailyRevenue = async (revenue: DailyRevenue) => {
    const newDb: AppDatabase = {
      ...dbRef.current,
      dailyRevenues: [revenue, ...dbRef.current.dailyRevenues],
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    syncToCloud(newDb);
    try {
      await fetch('/api/revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revenue)
      });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 6. Delete Daily Revenue (optimistic update + Firebase persistence)
  const deleteDailyRevenue = async (id: string) => {
    const newDb: AppDatabase = {
      ...dbRef.current,
      dailyRevenues: dbRef.current.dailyRevenues.filter((r) => r.id !== id),
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    syncToCloud(newDb);
    try {
      await fetch(`/api/revenues/${id}`, { method: 'DELETE' });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 7. Update Approval (optimistic update + Firebase persistence)
  const updateApproval = async (
    role: 'Director' | 'Executive',
    action: 'verify' | 'approve' | 'acknowledge' | 'return',
    comment: string,
    name?: string
  ) => {
    const updatedApproval = { ...dbRef.current.memoApproval };
    if (role === 'Director') {
      updatedApproval.directorStatus = action === 'verify' ? 'verified' : 'returned';
      updatedApproval.directorComment = comment;
      if (name) updatedApproval.directorName = name;
      updatedApproval.directorVerifiedAt = new Date().toISOString();
    } else {
      updatedApproval.executiveStatus =
        action === 'approve' ? 'approved' : action === 'acknowledge' ? 'acknowledged' : 'returned';
      updatedApproval.executiveComment = comment;
      if (name) updatedApproval.executiveName = name;
      updatedApproval.executiveApprovedAt = new Date().toISOString();
    }

    const newDb: AppDatabase = {
      ...dbRef.current,
      memoApproval: updatedApproval,
      lastUpdated: new Date().toISOString()
    };
    setDb(newDb);
    saveLocalData(newDb);

    syncToCloud(newDb);
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, action, comment, name })
      });
    } catch {
      // Handled via Firebase and local
    }
  };

  // 8. Batch Import (optimistic update + Firebase persistence)
  const importBatch = async (
    target: 'night' | 'fresh' | 'revenues',
    mode: 'append' | 'replace',
    items: any[],
    totalStalls?: number
  ) => {
    setIsLoading(true);
    let newDb = { ...dbRef.current };
    if (target === 'night' || target === 'fresh') {
      if (mode === 'replace') {
        newDb.contracts = newDb.contracts.filter((c) => c.marketType !== target).concat(items);
      } else {
        newDb.contracts = [...newDb.contracts, ...items];
      }
      if (totalStalls) {
        if (target === 'night') newDb.nightMarketConfig.totalStalls = totalStalls;
        if (target === 'fresh') newDb.freshMarketConfig.totalStalls = totalStalls;
      }
    } else {
      if (mode === 'replace') {
        newDb.dailyRevenues = items;
      } else {
        newDb.dailyRevenues = [...items, ...newDb.dailyRevenues];
      }
    }
    newDb.lastUpdated = new Date().toISOString();
    setDb(newDb);
    saveLocalData(newDb);

    // Save directly to Firebase Cloud Firestore
    await syncToCloud(newDb);

    try {
      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, mode, items, totalStalls })
      });
    } catch {
      // Handled via Firebase and local
    } finally {
      setIsLoading(false);
    }
  };

  // 9. Reset to default initial database
  const resetToDefault = async () => {
    setIsLoading(true);
    setDb(initialDatabase);
    saveLocalData(initialDatabase);
    await syncToCloud(initialDatabase);
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch {
      // Handled
    }
    setIsLoading(false);
  };

  // 10. Explicitly synchronize all contracts of a market to Cloud Firestore 'contracts' collection
  const syncMarketToFirestore = async (
    marketType: MarketType
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    setIsLoading(true);
    try {
      const marketContracts = dbRef.current.contracts.filter((c) => c.marketType === marketType);
      const batch = writeBatch(firestore);

      // Write each contract to 'contracts/{id}' collection
      for (const contract of marketContracts) {
        const contractRef = doc(firestore, 'contracts', contract.id);
        batch.set(contractRef, cleanForFirestore(contract), { merge: true });
      }

      // Also ensure main document is updated
      const mainDocRef = doc(firestore, 'app_state', 'main');
      batch.set(mainDocRef, cleanForFirestore(dbRef.current), { merge: true });

      await batch.commit();

      setIsFirebaseConnected(true);
      setIsOnline(true);
      const nowStr = new Date().toLocaleTimeString('th-TH');
      setLastSyncedAt(nowStr);
      return { success: true, count: marketContracts.length };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      handleFirestoreError(err, OperationType.WRITE, 'contracts');
      return { success: false, count: 0, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // 11. Test Firebase connection
  const testFirebaseConnection = async (): Promise<boolean> => {
    try {
      const ok = await testConnection();
      setIsFirebaseConnected(ok);
      if (ok) {
        setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
      }
      return ok;
    } catch {
      setIsFirebaseConnected(false);
      return false;
    }
  };

  return (
    <DataContext.Provider
      value={{
        db,
        isLoading,
        lastSyncedAt,
        isOnline,
        isFirebaseConnected,
        firestoreDatabaseId,
        updateMarketStalls,
        addContract,
        updateContract,
        deleteContract,
        addDailyRevenue,
        deleteDailyRevenue,
        updateApproval,
        importBatch,
        syncMarketToFirestore,
        testFirebaseConnection,
        resetToDefault,
        refreshData
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

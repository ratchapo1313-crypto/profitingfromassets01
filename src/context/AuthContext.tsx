import React, { createContext, useContext, useState } from 'react';
import { UserAccount, UserRole } from '../types.ts';

interface AuthContextType {
  currentUser: UserAccount | null;
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  systemRoles: {
    role: UserRole;
    title: string;
    description: string;
    permissions: string[];
    credentialsHint: string;
  }[];
}

const SYSTEM_ROLES = [
  {
    role: 'User' as UserRole,
    title: 'เจ้าหน้าที่',
    description: 'ฝ่ายพัฒนารายได้ กองคลัง',
    permissions: [
      'สิทธิ์บันทึกข้อมูลประจำวัน: เพิ่ม / แก้ไข / ลบ สัญญาเช่าแผงค้าตลาดโต้รุ่ง และ ตลาดสด',
      'ปรับจำนวนล็อคทั้งหมด (มีเพิ่ม/ลด ได้)',
      'นำเข้าและส่งออกข้อมูล Excel (.xlsx, .csv)',
      'เข้าสู่ระบบพร้อมกันได้หลายเครื่อง กรอกข้อมูลแล้วเห็นตรงกัน อัปเดตอัตโนมัติ และจัดเก็บฐานข้อมูลทุกครั้ง'
    ],
    credentialsHint: 'User / 1234'
  },
  {
    role: 'Director' as UserRole,
    title: 'ผู้อำนวยการกองคลัง',
    description: 'กองคลัง เทศบาลเมืองมหาสารคาม',
    permissions: [
      'ตรวจสอบรายงานทุกหมวดและตรวจทานความถูกต้อง',
      'ลงนามตรวจทานในบันทึกข้อความทางการราชการ',
      'ดูข้อมูลสัญญาเช่าและการจัดหาประโยชน์จากทรัพย์สิน',
      'เข้าสู่ระบบพร้อมกันได้หลายครั้ง ข้อมูลเชื่อมโยงฐานข้อมูลกลางเดียวกัน'
    ],
    credentialsHint: 'Director / 1234'
  },
  {
    role: 'Executive' as UserRole,
    title: 'ผู้บริหาร (นายกเทศมนตรี)',
    description: 'เทศบาลเมืองมหาสารคาม',
    permissions: [
      'ดูภาพรวมสรุปผลทั้งเทศบาลและการจัดหาประโยชน์จากทรัพย์สิน',
      'พิจารณาอนุมัติ / ทราบ ในบันทึกข้อความทางการราชการ',
      'ส่งออกรายงานภาพรวมผู้บริหารและพิมพ์เอกสารราชการ',
      'เข้าสู่ระบบพร้อมกันได้หลายครั้ง อัปเดตข้อมูลอัตโนมัติ'
    ],
    credentialsHint: 'Executive / 1234'
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start at login screen on initial load as required
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const login = (usernameInput: string, passwordInput: string): { success: boolean; message?: string } => {
    const u = usernameInput.trim();
    const p = passwordInput.trim();

    if (p !== '1234') {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
    }

    if (u === 'User') {
      const user: UserAccount = {
        username: 'User',
        role: 'User',
        roleTitle: 'เจ้าหน้าที่',
        department: 'ฝ่ายพัฒนารายได้ กองคลัง',
        permissions: SYSTEM_ROLES[0].permissions
      };
      setCurrentUser(user);
      return { success: true };
    }

    if (u === 'Director') {
      const user: UserAccount = {
        username: 'Director',
        role: 'Director',
        roleTitle: 'ผู้อำนวยการกองคลัง',
        department: 'กองคลัง เทศบาลเมืองมหาสารคาม',
        permissions: SYSTEM_ROLES[1].permissions
      };
      setCurrentUser(user);
      return { success: true };
    }

    if (u === 'Executive') {
      const user: UserAccount = {
        username: 'Executive',
        role: 'Executive',
        roleTitle: 'ผู้บริหาร (นายกเทศมนตรี)',
        department: 'เทศบาลเมืองมหาสารคาม',
        permissions: SYSTEM_ROLES[2].permissions
      };
      setCurrentUser(user);
      return { success: true };
    }

    return {
      success: false,
      message: 'ชื่อผู้ใช้งานไม่ถูกต้อง อนุญาตเฉพาะ User, Director หรือ Executive เท่านั้น'
    };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, systemRoles: SYSTEM_ROLES }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

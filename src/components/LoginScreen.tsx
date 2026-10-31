import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const res = login(username, password);
    if (!res.success) {
      setErrorMessage(res.message || 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        {/* Title area (strictly no logo as requested) */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            เทศบาลเมืองมหาสารคาม
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            ฝ่ายพัฒนารายได้ กองคลัง
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ระบบรายงานผลการดำเนินงาน ประจำปีงบประมาณ พ.ศ. 2570
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="User / Director / Executive"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

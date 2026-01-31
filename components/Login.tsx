
import React, { useState } from 'react';
import { UserRole, HostelSettings, Supervisor } from '../types.ts';

interface LoginProps {
  onLogin: (role: UserRole, supervisor?: Supervisor) => void;
  settings: HostelSettings;
  supervisors: Supervisor[];
}

const Login: React.FC<LoginProps> = ({ onLogin, settings, supervisors }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('RECEPTIONIST');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize input for robust matching
    const normalizedId = username.trim().toLowerCase();
    const normalizedPass = password.trim();

    // Master Access Dictionary
    const credentials: Record<string, { id: string, pass: string }> = {
      'SUPERADMIN': { id: 'superadmin', pass: 'admin' },
      'ADMIN': { id: 'admin', pass: 'admin' },
      'RECEPTIONIST': { id: 'reception', pass: 'admin' },
      'ACCOUNTANT': { id: 'accounts', pass: 'admin' },
    };

    // 1. Check Master Credentials
    if (credentials[selectedRole]) {
      if (normalizedId === credentials[selectedRole].id && normalizedPass === credentials[selectedRole].pass) {
        onLogin(selectedRole);
        return;
      }
    }

    // 2. Individual Staff lookup (Manager, Waiter, Chef etc)
    const staff = supervisors.find(s => 
      s.role === selectedRole && 
      s.loginId.toLowerCase() === normalizedId && 
      s.password === normalizedPass
    );

    if (staff) {
      onLogin(selectedRole, staff);
      return;
    }

    setError('Access Denied: Invalid Credentials');
  };

  return (
    <div className="min-h-screen bg-[#001a33] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Fullscreen Toggle for Terminal Use */}
      <button 
        onClick={toggleFullscreen}
        className="fixed top-8 right-8 z-50 bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/20 transition-all flex items-center gap-3 shadow-2xl backdrop-blur-md"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Enter Fullscreen</span>
      </button>

      {/* Decorative background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-400/5 rounded-full blur-[150px]"></div>

      <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl p-10 md:p-16 space-y-10 animate-in zoom-in duration-500 relative z-10 border border-slate-100">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-700 rounded-3xl flex items-center justify-center text-white text-3xl font-black mx-auto shadow-2xl">HS</div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Hotel Sphere Pro</h2>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mt-2">Digital Communique • Identity Vault</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest text-center block">Access Department</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['SUPERADMIN', 'ADMIN', 'RECEPTIONIST', 'ACCOUNTANT', 'MANAGER', 'WAITER', 'CHEF'] as UserRole[]).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => { setSelectedRole(role); setError(''); }}
                  className={`py-3 rounded-xl font-black text-[8px] uppercase border-2 transition-all ${selectedRole === role ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-100'}`}
                >
                  {role === 'CHEF' ? 'KITCHEN' : role}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Login Identity</label>
              <input 
                type="text" 
                required
                autoComplete="username"
                className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white focus:border-blue-600 outline-none transition-all shadow-inner text-black uppercase placeholder:normal-case"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin or superadmin"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Secret Key</label>
              <input 
                type="password" 
                required
                autoComplete="current-password"
                className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white focus:border-blue-600 outline-none transition-all shadow-inner text-black"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 animate-bounce">
                <p className="text-[10px] font-black text-red-600 uppercase text-center">{error}</p>
              </div>
            )}
          </div>

          <button type="submit" className="w-full bg-blue-700 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-black hover:-translate-y-1 transition-all active:scale-95">Authorize & Enter Pro</button>
        </form>

        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100/50 text-center">
          <p className="text-[9px] font-black text-blue-900 uppercase opacity-60 mb-2 tracking-widest">Authorized Demo Nodes</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9px] font-bold text-blue-700 uppercase">
             <div className="flex justify-between"><span>Admin ID:</span> <span className="font-black text-slate-900">admin</span></div>
             <div className="flex justify-between"><span>SA ID:</span> <span className="font-black text-slate-900">superadmin</span></div>
             <div className="flex justify-between"><span>Global Pass:</span> <span className="font-black text-slate-900">admin</span></div>
             <div className="flex justify-between"><span>Reception:</span> <span className="font-black text-slate-900">reception</span></div>
          </div>
        </div>

        <p className="text-center text-[10px] font-black text-slate-400 uppercase opacity-40">Powered by Digital Communique • Enterprise v4.2.1</p>
      </div>
    </div>
  );
};

export default Login;

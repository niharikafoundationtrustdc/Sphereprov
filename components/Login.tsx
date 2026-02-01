
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedId = username.trim().toLowerCase();
    const normalizedPass = password.trim();
    
    // Default system credentials
    const credentials: Record<string, { id: string, pass: string }> = {
      'SUPERADMIN': { id: 'superadmin', pass: 'admin' },
      'ADMIN': { id: 'admin', pass: 'admin' },
      'RECEPTIONIST': { id: 'reception', pass: 'admin' },
      'ACCOUNTANT': { id: 'accounts', pass: 'admin' },
    };

    if (credentials[selectedRole]) {
      if (normalizedId === credentials[selectedRole].id && normalizedPass === credentials[selectedRole].pass) {
        onLogin(selectedRole);
        return;
      }
    }

    // Dynamic staff credentials from supervisor table
    const staff = supervisors.find(s => 
      s.role === selectedRole && 
      s.loginId.toLowerCase() === normalizedId && 
      s.password === normalizedPass
    );

    if (staff) {
      onLogin(selectedRole, staff);
      return;
    }

    setError('Access Denied: Invalid Credentials for this Module');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="w-full max-w-lg space-y-12 animate-in zoom-in duration-500 relative z-10">
        
        {/* Branding Area */}
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-[#e65c00] rounded-3xl flex items-center justify-center text-white text-4xl font-black mx-auto shadow-[0_20px_50px_rgba(230,92,0,0.3)]">
            HS
          </div>
          <div>
            <h1 className="text-4xl font-black text-[#1a2b4b] uppercase tracking-tight leading-none">HOTEL SPHERE PRO</h1>
            <p className="text-[11px] font-black text-[#e65c00] uppercase tracking-[0.4em] mt-3">SPHERE CLOUD IDENTITY</p>
          </div>
        </div>

        {/* Access Selection */}
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest text-center">SELECT MODULE ACCESS</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(['SUPERADMIN', 'ADMIN', 'RECEPTIONIST', 'ACCOUNTANT', 'MANAGER', 'WAITER', 'CHEF', 'SUPERVISOR'] as UserRole[]).map(role => (
              <button 
                key={role} 
                type="button" 
                onClick={() => { setSelectedRole(role); setError(''); }} 
                className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all duration-300 border ${
                  selectedRole === role 
                    ? 'bg-[#e65c00] border-[#e65c00] text-white shadow-[0_10px_20px_rgba(230,92,0,0.2)] scale-105' 
                    : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {role === 'CHEF' ? 'KITCHEN' : role === 'SUPERVISOR' ? 'HOUSEKEEPING' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleLogin} className="space-y-8 bg-white p-2 rounded-[2rem] shadow-xl border border-white">
          <div className="space-y-6 px-4 py-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">LOGIN IDENTITY</label>
              <input 
                type="text" 
                required 
                placeholder="USERNAME"
                className="w-full bg-slate-50 border-2 border-transparent focus:border-[#e65c00] p-5 rounded-2xl font-black text-xs text-slate-900 outline-none transition-all shadow-inner uppercase" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">SECRET KEY</label>
              <input 
                type="password" 
                required 
                placeholder="••••••••"
                className="w-full bg-slate-50 border-2 border-transparent focus:border-[#e65c00] p-5 rounded-2xl font-black text-xs text-slate-900 outline-none transition-all shadow-inner" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>
            {error && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in zoom-in">
                <p className="text-[10px] font-black text-red-600 uppercase text-center">{error}</p>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="w-full bg-[#1a2b4b] text-white py-6 rounded-3xl font-black uppercase text-[13px] tracking-[0.2em] shadow-2xl hover:bg-black active:scale-[0.98] transition-all"
          >
            UNLOCK TERMINAL
          </button>
        </form>

        <div className="text-center space-y-2">
          <a 
            href="https://digitalcommunique.in/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[11px] font-black text-slate-400 hover:text-[#e65c00] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
          >
            POWERED BY DIGITAL COMMUNIQUE PRIVATE LIMITED
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest opacity-50">Enterprise Cloud Hosting Authorized Node</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

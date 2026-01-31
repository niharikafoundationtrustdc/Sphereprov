
import React, { useState } from 'react';
import { HostelSettings, Room, RoomStatus } from '../types.ts';
import { exportDatabase, importDatabase } from '../services/db.ts';

interface SuperAdminPanelProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  onClose: () => void;
}

const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ settings, setSettings, rooms, setRooms, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SECURITY' | 'INVENTORY' | 'FINANCE' | 'SYSTEM'>('SECURITY');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleUpdate = (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    setSettings(updated);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (confirm("This will overwrite all current local data. Proceed?")) {
        await importDatabase(file);
        window.location.reload();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Super Header */}
      <header className="bg-black p-8 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleFullscreen}
            className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center border border-white/20 transition-all shadow-2xl"
            title="Toggle Fullscreen"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black text-2xl font-black shadow-2xl">SA</div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Superadmin Command Center</h1>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">System Master Authority Protocol v3.4.0</p>
          </div>
        </div>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all border border-white/10">Exit Command Center</button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-80 bg-black/50 border-r border-white/5 p-8 flex flex-col gap-2">
          <NavTab active={activeTab === 'SECURITY'} label="Security Vault" icon="🔐" onClick={() => setActiveTab('SECURITY')} />
          <NavTab active={activeTab === 'INVENTORY'} label="Global Inventory" icon="🏢" onClick={() => setActiveTab('INVENTORY')} />
          <NavTab active={activeTab === 'FINANCE'} label="Finance Defaults" icon="📊" onClick={() => setActiveTab('FINANCE')} />
          <NavTab active={activeTab === 'SYSTEM'} label="System & Sync" icon="⚙️" onClick={() => setActiveTab('SYSTEM')} />
          
          <div className="mt-auto p-6 bg-blue-900/20 rounded-[2rem] border border-blue-900/30">
             <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Cloud Status</p>
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[11px] font-bold text-white uppercase">Encrypted & Online</span>
             </div>
          </div>
        </aside>

        {/* Main Console Area */}
        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-900">
           {activeTab === 'SECURITY' && (
             <div className="max-w-4xl space-y-10 animate-in slide-in-from-right-8 duration-500">
                <section>
                   <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Active Credentials Audit</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-10">Monitor and update all portal access keys</p>
                   
                   <div className="grid grid-cols-2 gap-8">
                      <PassCard role="Admin Portal" value={tempSettings.adminPassword || 'admin'} onChange={v => handleUpdate('adminPassword', v)} />
                      <PassCard role="Reception Portal" value={tempSettings.receptionistPassword || 'admin'} onChange={v => handleUpdate('receptionistPassword', v)} />
                      <PassCard role="Accountant Portal" value={tempSettings.accountantPassword || 'admin'} onChange={v => handleUpdate('accountantPassword', v)} />
                      <PassCard role="Supervisor Portal" value={tempSettings.supervisorPassword || 'admin'} onChange={v => handleUpdate('supervisorPassword', v)} />
                   </div>
                </section>
                
                <div className="p-8 bg-blue-900/10 border border-blue-900/30 rounded-[3rem] space-y-4">
                   <h3 className="font-black text-blue-400 uppercase text-xs tracking-widest">Master Override Info</h3>
                   <p className="text-xs text-white/70 font-medium leading-relaxed">
                     The system-wide master password is now set to "admin" for all portals as per enterprise policy. Individual staff passwords can be managed in the staff roster under standard Admin settings.
                   </p>
                </div>
             </div>
           )}

           {activeTab === 'INVENTORY' && (
             <div className="max-w-4xl space-y-10 animate-in slide-in-from-right-8 duration-500">
                <section>
                   <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Inventory Control</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-10">Manage the physical property blueprint</p>
                   
                   <div className="bg-black/40 rounded-[3rem] border border-white/5 overflow-hidden">
                      <table className="w-full text-left text-xs">
                         <thead className="bg-white/5 text-white/50 uppercase font-black">
                            <tr><th className="p-6">Unit</th><th className="p-6">Category</th><th className="p-6">Status</th><th className="p-6 text-right">Standard Rate</th></tr>
                         </thead>
                         <tbody className="text-white/80 font-bold uppercase divide-y divide-white/5">
                            {rooms.map(r => (
                               <tr key={r.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-6 font-black text-lg text-white">Room {r.number}</td>
                                  <td className="p-6 opacity-60">{r.type}</td>
                                  <td className="p-6">
                                     <span className={`px-3 py-1 rounded-full text-[9px] font-black border border-current ${r.status === RoomStatus.VACANT ? 'text-green-500' : 'text-blue-500'}`}>
                                        {r.status}
                                     </span>
                                  </td>
                                  <td className="p-6 text-right font-black text-blue-400">₹{r.price}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </section>
             </div>
           )}

           {activeTab === 'FINANCE' && (
             <div className="max-w-3xl space-y-10 animate-in slide-in-from-right-8 duration-500">
                <section className="space-y-8">
                   <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Financial Hard-coding</h2>
                   <SuperInput label="Legal Property Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
                   <SuperInput label="GSTIN Identification" value={tempSettings.gstNumber || ''} onChange={v => handleUpdate('gstNumber', v)} />
                   <div className="grid grid-cols-2 gap-8">
                      <SuperInput label="Global GST Rate (%)" type="number" value={tempSettings.taxRate?.toString() || '12'} onChange={v => handleUpdate('taxRate', parseFloat(v))} />
                      <SuperInput label="Default SAC/HSN" value={tempSettings.hsnCode || '9963'} onChange={v => handleUpdate('hsnCode', v)} />
                   </div>
                   <SuperInput label="Master UPI Gateway ID" value={tempSettings.upiId || ''} onChange={v => handleUpdate('upiId', v)} />
                </section>
             </div>
           )}

           {activeTab === 'SYSTEM' && (
             <div className="max-w-4xl space-y-10 animate-in slide-in-from-right-8 duration-500">
                <section className="space-y-8">
                   <h2 className="text-3xl font-black text-white uppercase tracking-tighter">System Operations</h2>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="bg-black/40 p-10 rounded-[3rem] border border-white/5 space-y-6">
                         <h3 className="font-black text-white uppercase text-xs tracking-widest">Local Storage (Dexie)</h3>
                         <div className="flex justify-between items-center text-xs font-bold text-white/50 uppercase">
                            <span>Status</span>
                            <span className="text-green-500">Optimal</span>
                         </div>
                         <button onClick={exportDatabase} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-[10px] shadow-2xl">Download DB Export</button>
                      </div>
                      <div className="bg-black/40 p-10 rounded-[3rem] border border-white/5 space-y-6">
                         <h3 className="font-black text-white uppercase text-xs tracking-widest">Database Recovery</h3>
                         <p className="text-[10px] text-white/40 font-bold uppercase leading-relaxed">Restore from a previously exported JSON backup file.</p>
                         <div className="relative">
                            <button className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Upload Backup File</button>
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} />
                         </div>
                      </div>
                   </div>
                </section>
                
                <section className="bg-black/60 p-12 rounded-[4rem] border border-blue-900/30 space-y-8">
                   <div className="flex items-center gap-6">
                      <div className="text-4xl">⚡</div>
                      <div>
                         <h3 className="text-xl font-black text-white uppercase tracking-tight">Master Cloud Schema Setup</h3>
                         <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Full SQL Table Construction Script</p>
                      </div>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-3xl border border-white/5 font-mono text-[9px] text-blue-300 leading-relaxed overflow-x-auto h-80 overflow-y-auto custom-scrollbar">
{`-- HOTELSPHERE PRO: MASTER SETUP (RECONSTRUCT TABLES) --
CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, number TEXT, floor INT, type TEXT, price NUMERIC, status TEXT, "currentBookingId" TEXT);
CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, address TEXT, city TEXT, state TEXT, nationality TEXT, "idNumber" TEXT, adults INT, children INT, kids INT, others INT, documents JSONB);
CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, "bookingNo" TEXT, "roomId" TEXT, "guestId" TEXT, "groupId" TEXT, "checkInDate" TEXT, "checkInTime" TEXT, "checkOutDate" TEXT, "checkOutTime" TEXT, status TEXT, charges JSONB, payments JSONB, "basePrice" NUMERIC, discount NUMERIC, mealPlan TEXT, agent TEXT, purpose TEXT, company TEXT);
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, "accountGroup" TEXT, ledger TEXT, amount NUMERIC, "entityName" TEXT, description TEXT, "referenceId" TEXT);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, "groupName" TEXT, "groupType" TEXT, "headName" TEXT, phone TEXT, email TEXT, "orgName" TEXT, "gstNumber" TEXT, "billingPreference" TEXT, documents JSONB, status TEXT);
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, name TEXT, address TEXT, agents JSONB, "roomTypes" JSONB);
CREATE TABLE IF NOT EXISTS "shiftLogs" (id TEXT PRIMARY KEY, "bookingId" TEXT, "guestName" TEXT, "fromRoom" TEXT, "toRoom" TEXT, date TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS "cleaningLogs" (id TEXT PRIMARY KEY, "roomId" TEXT, date TEXT, "staffName" TEXT);
CREATE TABLE IF NOT EXISTS quotations (id TEXT PRIMARY KEY, date TEXT, "guestName" TEXT, amount NUMERIC, remarks TEXT);

-- ENSURE ALL COLUMNS (FIX FOR SCHEMA MISMATCH) --
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "surName" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "givenName" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "dob" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "gstin" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "passportNo" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "passportPlaceOfIssue" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "passportDateOfIssue" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "passportDateOfExpiry" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "visaNo" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "visaType" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "visaPlaceOfIssue" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "visaDateOfIssue" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "visaDateOfExpiry" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "embassyCountry" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "arrivalFrom" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "nextDestination" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "arrivalInIndiaDate" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "stayDurationIndia" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "purposeOfVisit" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "employedInIndia" BOOLEAN;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "contactInIndia" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "cellInIndia" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "residingCountryContact" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "addressInIndia" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "applicationId" TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS "remarks" TEXT;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "secondaryGuest" JSONB;

ALTER TABLE settings ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "signature" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "gstNumber" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "cgstRate" NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "sgstRate" NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "igstRate" NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "adminPassword" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "receptionistPassword" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "accountantPassword" TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "supervisorPassword" TEXT;

-- REFRESH CACHE
NOTIFY pgrst, 'reload schema';`}
                   </div>
                   <p className="text-[10px] text-white/30 font-bold uppercase text-center italic">Run the above SQL in the Supabase Dashboard SQL Editor to resolve all sync mismatches.</p>
                </section>
             </div>
           )}
        </main>
      </div>
    </div>
  );
};

const NavTab = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'text-white/40 hover:bg-white/5'}`}>
    <span className="text-lg">{icon}</span>
    {label}
  </button>
);

const PassCard = ({ role, value, onChange }: any) => (
  <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/5 group hover:border-blue-500/50 transition-all">
    <label className="text-[9px] font-black uppercase text-blue-400 tracking-widest block mb-4">{role}</label>
    <input 
      type="text" 
      className="bg-transparent text-2xl font-black text-white w-full outline-none focus:text-blue-400 transition-colors" 
      value={value} 
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const SuperInput = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">{label}</label>
    <input 
      type={type} 
      className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl font-black text-white text-sm focus:border-blue-600 outline-none transition-all shadow-inner" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);

export default SuperAdminPanel;

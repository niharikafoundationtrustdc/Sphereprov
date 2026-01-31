
import React, { useState, useEffect } from 'react';
/* Fixed relative import path and added AgentConfig to types.ts */
import { HostelSettings, Room, AgentConfig, RoomStatus } from './types';
import { exportDatabase, importDatabase } from './services/db';

interface SettingsProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, setSettings, rooms, setRooms }) => {
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'ROOMS' | 'AGENTS' | 'TAX' | 'CLOUD'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ number: '', floor: 1, type: settings.roomTypes[0] || '', price: 0 });
  const [newRoomType, setNewRoomType] = useState('');
  const [newAgent, setNewAgent] = useState<AgentConfig>({ name: '', commission: 0 });

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...tempSettings, [key]: reader.result as string };
        setTempSettings(updated);
        setSettings(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAgent = () => {
    if (!newAgent.name) return;
    const updated = { ...tempSettings, agents: [...(tempSettings.agents || []), newAgent] };
    setTempSettings(updated);
    setSettings(updated);
    setNewAgent({ name: '', commission: 0 });
  };

  const removeAgent = (name: string) => {
    const updated = { ...tempSettings, agents: tempSettings.agents.filter(a => a.name !== name) };
    setTempSettings(updated);
    setSettings(updated);
  };

  const addRoomType = () => {
    if (!newRoomType) return;
    const updated = { ...tempSettings, roomTypes: [...tempSettings.roomTypes, newRoomType] };
    setTempSettings(updated);
    setSettings(updated);
    setNewRoomType('');
  };

  const removeRoomType = (type: string) => {
    const updated = { ...tempSettings, roomTypes: tempSettings.roomTypes.filter(t => t !== type) };
    setTempSettings(updated);
    setSettings(updated);
  };

  const handleTaxUpdate = (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    setSettings(updated);
  };

  return (
    <div className="p-6 bg-[#f8fafc] min-h-full pb-20 text-black">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl border shadow-sm sticky top-2 z-10">
          <div className="flex gap-1">
            <SubTab active={activeSubTab === 'GENERAL'} label="Property Profile" onClick={() => setActiveSubTab('GENERAL')} />
            <SubTab active={activeSubTab === 'ROOMS'} label="Inventory" onClick={() => setActiveSubTab('ROOMS')} />
            <SubTab active={activeSubTab === 'AGENTS'} label="Agents" onClick={() => setActiveSubTab('AGENTS')} />
            <SubTab active={activeSubTab === 'TAX'} label="Tax Config" onClick={() => setActiveSubTab('TAX')} />
            <SubTab active={activeSubTab === 'CLOUD'} label="Cloud Sync" onClick={() => setActiveSubTab('CLOUD')} />
          </div>
          <div className="px-4 text-[10px] font-black text-black uppercase tracking-widest">
            System Administration
          </div>
        </div>

        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Identity & Branding</h3>
              <Input label="Hostel / Hotel Name" value={tempSettings.name} onChange={v => handleTaxUpdate('name', v)} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase ml-2">Property Address</label>
                <textarea 
                  className="w-full border-2 p-4 rounded-2xl font-bold text-black h-24 outline-none transition-all bg-gray-50 focus:bg-white focus:border-blue-500 shadow-inner resize-none" 
                  value={tempSettings.address} 
                  onChange={e => handleTaxUpdate('address', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase ml-2">Property Logo</label>
                  <div className="h-32 border-2 border-dashed rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                    {tempSettings.logo ? <img src={tempSettings.logo} className="w-full h-full object-contain" /> : <span className="text-[9px] font-black text-black">Upload Logo</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'logo')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase ml-2">Auth. Signature</label>
                  <div className="h-32 border-2 border-dashed rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                    {tempSettings.signature ? <img src={tempSettings.signature} className="w-full h-full object-contain" /> : <span className="text-[9px] font-black text-black">Upload Sign</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'signature')} />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Data Management</h3>
              <div className="space-y-4">
                <button onClick={exportDatabase} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black transition-all">Download Full JSON Backup</button>
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-[10px] font-bold text-black uppercase leading-relaxed">
                  Tip: Regular backups protect your data against browser cache clears. Store the JSON file securely.
                </div>
              </div>
            </section>
          </div>
        )}

        {activeSubTab === 'TAX' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Tax & Compliance Settings</h3>
              <Input label="GST Number" value={tempSettings.gstNumber || ''} onChange={v => handleTaxUpdate('gstNumber', v)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Default GST Rate (%)" type="number" value={tempSettings.taxRate?.toString() || '12'} onChange={v => handleTaxUpdate('taxRate', parseFloat(v))} />
                <Input label="Default HSN Code" value={tempSettings.hsnCode || '9963'} onChange={v => handleTaxUpdate('hsnCode', v)} />
              </div>
              <div className="p-6 bg-blue-50 rounded-2xl text-[11px] font-bold text-black uppercase space-y-2 border-l-4 border-blue-600">
                <p>Tax configuration affects how invoices are generated.</p>
                <p>Current Rate: {tempSettings.taxRate || 12}% (Split evenly into CGST/SGST)</p>
              </div>
            </section>
          </div>
        )}

        {activeSubTab === 'AGENTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Booking Agents & Commissions</h3>
              <div className="flex gap-2">
                <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs bg-gray-50 outline-none focus:border-blue-500 text-black" placeholder="Agent Name" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
                <input className="w-24 border-2 p-3 rounded-xl font-bold text-xs bg-gray-50 outline-none focus:border-blue-500 text-black" placeholder="Comm %" type="number" value={newAgent.commission} onChange={e => setNewAgent({...newAgent, commission: parseFloat(e.target.value) || 0})} />
                <button onClick={addAgent} className="bg-blue-600 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all">Add</button>
              </div>
              <div className="space-y-2 mt-4">
                {tempSettings.agents?.map(a => (
                  <div key={a.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border group">
                    <span className="font-black text-xs uppercase text-black">{a.name} <span className="text-blue-500 ml-2">({a.commission}%)</span></span>
                    <button onClick={() => removeAgent(a.name)} className="text-red-400 hover:text-red-600 font-black text-[9px] uppercase opacity-0 group-hover:opacity-100 transition-all">Remove</button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Room Type Categories</h3>
              <div className="flex gap-2">
                <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs bg-gray-50 outline-none focus:border-blue-500 text-black" placeholder="New Category (e.g. AC SUITE)" value={newRoomType} onChange={e => setNewRoomType(e.target.value)} />
                <button onClick={addRoomType} className="bg-blue-600 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all">Create</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {tempSettings.roomTypes.map(t => (
                  <div key={t} className="flex items-center gap-2 bg-blue-50 text-black px-4 py-2 rounded-xl font-black text-[10px] uppercase border border-blue-100">
                    {t}
                    <button onClick={() => removeRoomType(t)} className="hover:text-red-600">×</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeSubTab === 'ROOMS' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Inventory Enrollment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <Input label="Room Number" value={newRoom.number || ''} onChange={v => setNewRoom({...newRoom, number: v})} />
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-black uppercase ml-2">Category</label>
                  <select className="w-full border-2 p-4 rounded-2xl font-black text-black bg-gray-50 outline-none" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                    {tempSettings.roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Input label="Rate / Day (₹)" value={newRoom.price?.toString() || ''} onChange={v => setNewRoom({...newRoom, price: parseFloat(v) || 0})} />
                <button onClick={() => {
                   if (!newRoom.number) return alert("Room number required");
                   const r = { ...newRoom, id: Date.now().toString(), status: RoomStatus.VACANT } as Room;
                   setRooms([...rooms, r]);
                   setNewRoom({...newRoom, number: ''});
                }} className="bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black transition-all">Add Unit</button>
              </div>
            </section>
            
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
               <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase font-black">
                     <tr><th className="p-5">Room</th><th className="p-5">Type</th><th className="p-5 text-right">Base Price</th><th className="p-5 text-center">Action</th></tr>
                  </thead>
                  <tbody className="divide-y font-bold text-black">
                     {rooms.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                           <td className="p-5 font-black text-lg text-black">{r.number}</td>
                           <td className="p-5"><span className="bg-blue-50 text-black px-3 py-1 rounded-full text-[9px] uppercase font-black">{r.type}</span></td>
                           <td className="p-5 text-right font-black">₹{r.price}</td>
                           <td className="p-5 text-center">
                              <button onClick={() => setRooms(rooms.filter(rm => rm.id !== r.id))} className="text-red-500 hover:underline uppercase text-[9px] font-black">Delete</button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeSubTab === 'CLOUD' && (
          <div className="bg-white p-12 rounded-[3rem] border shadow-sm space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center gap-6 border-b pb-8">
               <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl">☁️</div>
               <div>
                 <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Supabase Real-time Cloud</h2>
                 <p className="text-[10px] font-bold text-black uppercase tracking-widest">Multi-terminal Data Synchronization</p>
               </div>
             </div>
             <div className="p-10 bg-blue-50 border-2 border-dashed border-blue-200 rounded-[3rem] space-y-6">
                <p className="text-xs text-black font-black uppercase tracking-tight">Run this SQL in Supabase Editor to align your cloud schema:</p>
                <pre className="bg-white p-6 rounded-2xl border font-mono text-[10px] text-black overflow-x-auto shadow-inner select-all leading-relaxed">
{`-- SUPABASE SCHEMA ALIGNMENT --
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "gstNumber" TEXT, ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC, ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "entityName" TEXT, ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "groupId" TEXT;`}
                </pre>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-[#003d80] text-white shadow-lg' : 'text-black hover:bg-gray-50'}`}>{label}</button>
);

const Input: React.FC<{ label: string, value: string, onChange: (v: string) => void, type?: string }> = ({ label, value, onChange, type = "text" }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-black uppercase ml-2 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-black outline-none transition-all bg-gray-50 focus:bg-white focus:border-blue-500 shadow-inner text-xs" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export default Settings;

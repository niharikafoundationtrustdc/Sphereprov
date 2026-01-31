
import React, { useState, useEffect } from 'react';
import { HostelSettings, Room, RoomStatus, Booking, Transaction, Supervisor, UserRole } from '../types.ts';
import { exportDatabase, importDatabase, db } from '../services/db.ts';

interface SettingsProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => Promise<any> | void;
  setBookings?: (bookings: Booking[]) => void;
  setTransactions?: (transactions: Transaction[]) => void;
  supervisors: Supervisor[];
  setSupervisors: (supervisors: Supervisor[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, setSettings, rooms, setRooms, setBookings, setTransactions,
  supervisors, setSupervisors
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'ROOMS' | 'STAFF' | 'DATA' | 'TAX' | 'GUEST_PORTAL'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ 
    number: '', 
    floor: 1, 
    block: settings.blocks?.[0] || 'Main',
    type: settings.roomTypes[0] || '', 
    price: 0 
  });
  
  const [newRoomType, setNewRoomType] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<Supervisor>>({ name: '', loginId: '', password: 'admin', role: 'SUPERVISOR', assignedRoomIds: [], status: 'ACTIVE' });

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleUpdate = (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    setSettings(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleUpdate(key, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStaff = async () => {
    if (!newStaff.name || !newStaff.loginId || !newStaff.password || !newStaff.role) return alert("Fill mandatory fields");
    const staff: Supervisor = {
      ...newStaff as Supervisor,
      id: Math.random().toString(36).substr(2, 9),
    };
    const updated = [...supervisors, staff];
    setSupervisors(updated);
    await db.supervisors.put(staff);
    setNewStaff({ name: '', loginId: '', password: 'admin', role: 'SUPERVISOR', assignedRoomIds: [], status: 'ACTIVE' });
    setShowAddStaff(false);
    alert("Staff member registered.");
  };

  const removeStaff = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    const updated = supervisors.filter(s => s.id !== id);
    setSupervisors(updated);
    await db.supervisors.delete(id);
  };

  const addRoom = async () => {
    if (!newRoom.number) return alert("Room number required");
    const r = { ...newRoom, id: Date.now().toString(), status: RoomStatus.VACANT } as Room;
    const result = setRooms([...rooms, r]);
    if (result instanceof Promise) await result;
    setNewRoom({...newRoom, number: ''});
  };

  const addRoomType = () => {
    if (!newRoomType) return;
    const updatedTypes = [...(tempSettings.roomTypes || []), newRoomType];
    handleUpdate('roomTypes', updatedTypes);
    setNewRoomType('');
  };

  const addBlock = () => {
    if (!newBlockName) return;
    const updatedBlocks = [...(tempSettings.blocks || []), newBlockName];
    handleUpdate('blocks', updatedBlocks);
    setNewBlockName('');
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
    <div className="p-4 md:p-8 bg-[#f8fafc] min-h-full pb-32 text-black overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        <div className="flex items-center justify-between bg-white p-2 md:p-3 rounded-2xl md:rounded-[2rem] border shadow-xl sticky top-2 z-10 overflow-x-auto scrollbar-hide no-print gap-1">
          <SubTab active={activeSubTab === 'GENERAL'} label="Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Inventory" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Staff Roster" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'GUEST_PORTAL'} label="Guest App" onClick={() => setActiveSubTab('GUEST_PORTAL')} />
          <SubTab active={activeSubTab === 'TAX'} label="Taxation" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Backups" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in duration-500">
            <section className="lg:col-span-2 bg-white p-6 md:p-10 rounded-3xl md:rounded-[3rem] border shadow-sm space-y-6 md:space-y-8">
              <h3 className="font-black uppercase text-xs tracking-widest border-b pb-4 md:pb-6 text-blue-900">Property Identity</h3>
              <Input label="Business Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Full Postal Address</label>
                <textarea className="w-full border-2 p-4 rounded-2xl font-bold h-24 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all resize-none text-xs" value={tempSettings.address} onChange={e => handleUpdate('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Input label="Reception Phone" value={tempSettings.receptionPhone || ''} onChange={v => handleUpdate('receptionPhone', v)} />
                 <Input label="Room Service" value={tempSettings.roomServicePhone || ''} onChange={v => handleUpdate('roomServicePhone', v)} />
                 <Input label="Guest WiFi Password" value={tempSettings.wifiPassword || ''} onChange={v => handleUpdate('wifiPassword', v)} />
              </div>
            </section>

            <section className="bg-white p-6 md:p-10 rounded-3xl border shadow-sm space-y-6 h-fit">
               <h3 className="font-black uppercase text-xs tracking-widest border-b pb-4 text-blue-900">Brand Assets</h3>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Logo</label>
                   <div className="h-24 bg-slate-50 border-2 border-dashed rounded-3xl flex items-center justify-center relative group overflow-hidden">
                      {tempSettings.logo ? <img src={tempSettings.logo} className="h-full object-contain" /> : <span className="text-[9px] font-black text-slate-300">UPLOAD</span>}
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'logo')} />
                   </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Sign</label>
                   <div className="h-24 bg-slate-50 border-2 border-dashed rounded-3xl flex items-center justify-center relative group overflow-hidden">
                      {tempSettings.signature ? <img src={tempSettings.signature} className="h-full object-contain" /> : <span className="text-[9px] font-black text-slate-300">UPLOAD</span>}
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'signature')} />
                   </div>
                </div>
            </section>
          </div>
        )}

        {activeSubTab === 'ROOMS' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ROOM TYPE MANAGER */}
                <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
                   <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest border-b pb-4">Manage Room Types</h3>
                   <div className="flex gap-2">
                      <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-black" placeholder="New Type (e.g. AC SUITE)" value={newRoomType} onChange={e => setNewRoomType(e.target.value)} />
                      <button onClick={addRoomType} className="bg-blue-600 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all">Create</button>
                   </div>
                   <div className="flex flex-wrap gap-2 mt-4 max-h-40 overflow-y-auto">
                      {(tempSettings.roomTypes || []).map(t => (
                        <div key={t} className="flex items-center gap-2 bg-blue-50 text-blue-900 px-4 py-2 rounded-xl font-black text-[10px] uppercase border border-blue-100">
                          {t}
                          <button onClick={() => handleUpdate('roomTypes', tempSettings.roomTypes.filter(x => x !== t))} className="hover:text-red-600 font-bold ml-1">×</button>
                        </div>
                      ))}
                   </div>
                </section>

                {/* BLOCK MANAGER */}
                <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
                   <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest border-b pb-4">Manage Blocks / Wings</h3>
                   <div className="flex gap-2">
                      <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-black" placeholder="New Block (e.g. WING B)" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} />
                      <button onClick={addBlock} className="bg-blue-600 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all">Create</button>
                   </div>
                   <div className="flex flex-wrap gap-2 mt-4 max-h-40 overflow-y-auto">
                      {(tempSettings.blocks || []).map(b => (
                        <div key={b} className="flex items-center gap-2 bg-emerald-50 text-emerald-900 px-4 py-2 rounded-xl font-black text-[10px] uppercase border border-emerald-100">
                          {b}
                          <button onClick={() => handleUpdate('blocks', tempSettings.blocks?.filter(x => x !== b))} className="hover:text-red-600 font-bold ml-1">×</button>
                        </div>
                      ))}
                   </div>
                </section>
             </div>

             <section className="bg-white p-6 md:p-10 rounded-3xl border shadow-sm space-y-6">
                <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest border-b pb-4">New Room Entry</h3>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-6 items-end">
                   <Input label="Room No" value={newRoom.number} onChange={v => setNewRoom({...newRoom, number: v})} />
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Category</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-[11px] bg-slate-50 outline-none" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                         {(tempSettings.roomTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Block</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-[11px] bg-slate-50 outline-none" value={newRoom.block} onChange={e => setNewRoom({...newRoom, block: e.target.value})}>
                         {(tempSettings.blocks || ['Main']).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                   </div>
                   <Input label="Rate (₹)" type="number" value={newRoom.price} onChange={v => setNewRoom({...newRoom, price: parseFloat(v)})} />
                   <div className="sm:col-span-2">
                      <button onClick={addRoom} className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all">Add Unit</button>
                   </div>
                </div>
             </section>

             <div className="bg-white rounded-3xl border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                   <thead className="bg-blue-900 text-white uppercase font-black">
                      <tr>
                        <th className="p-4">No</th>
                        <th className="p-4">Block</th>
                        <th className="p-4">Floor</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Base Rate</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase">
                      {rooms.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                           <td className="p-4 text-base font-black">{r.number}</td>
                           <td className="p-4"><span className="text-emerald-600 font-black">{r.block || 'Main'}</span></td>
                           <td className="p-4 text-slate-400">Level {r.floor}</td>
                           <td className="p-4"><span className="bg-blue-50 text-blue-900 px-3 py-1 rounded-xl border">{r.type}</span></td>
                           <td className="p-4 text-right font-black">₹{r.price}</td>
                           <td className="p-4 text-center"><button onClick={() => setRooms(rooms.filter(x => x.id !== r.id))} className="text-red-500 font-black hover:underline">Delete</button></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeSubTab === 'STAFF' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <div>
                  <h3 className="font-black uppercase text-xl text-blue-900 tracking-tighter">Team Roster</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage Personnel Access & Roles</p>
                </div>
                <button onClick={() => setShowAddStaff(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add Team Member</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(staff => (
                  <div key={staff.id} className="bg-white border-2 rounded-[2.5rem] p-8 shadow-sm hover:border-blue-500 transition-all group">
                     <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-900 text-xl font-black">{staff.name.charAt(0)}</div>
                        <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase ${staff.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600'}`}>{staff.status}</span>
                     </div>
                     <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{staff.name}</h4>
                     <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">{staff.role}</p>
                     <div className="mt-8 pt-6 border-t flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">ID: {staff.loginId}</p>
                        <button onClick={() => removeStaff(staff.id)} className="text-red-300 hover:text-red-500 font-black uppercase text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                     </div>
                  </div>
                ))}
             </div>

             {showAddStaff && (
               <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                    <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
                       <h3 className="text-xl font-black uppercase tracking-tighter">Add Team Member</h3>
                       <button onClick={() => setShowAddStaff(false)} className="text-[10px] font-black opacity-60 uppercase">Cancel</button>
                    </div>
                    <div className="p-10 space-y-6">
                       <Input label="Full Name" value={newStaff.name} onChange={v => setNewStaff({...newStaff, name: v})} />
                       <div className="grid grid-cols-2 gap-4">
                          <Input label="Login ID" value={newStaff.loginId} onChange={v => setNewStaff({...newStaff, loginId: v})} />
                          <Input label="Secret Key" type="password" value={newStaff.password} onChange={v => setNewStaff({...newStaff, password: v})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Assign Role</label>
                          <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value as UserRole})}>
                             <option value="MANAGER">MANAGER</option>
                             <option value="SUPERVISOR">SUPERVISOR</option>
                             <option value="RECEPTIONIST">RECEPTIONIST</option>
                             <option value="ACCOUNTANT">ACCOUNTANT</option>
                             <option value="WAITER">WAITER</option>
                             <option value="CHEF">CHEF</option>
                             <option value="STOREKEEPER">STOREKEEPER</option>
                          </select>
                       </div>
                       <button onClick={handleSaveStaff} className="w-full bg-blue-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest hover:bg-black transition-all">Authorize Personnel</button>
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {activeSubTab === 'TAX' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
             <section className="bg-white p-8 md:p-12 rounded-[3.5rem] border shadow-sm space-y-10">
                <div className="border-b pb-6">
                   <h3 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Taxation Protocol</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configuring GST & SAC Compliance</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Input label="Property GSTIN Identification" value={tempSettings.gstNumber || ''} onChange={v => handleUpdate('gstNumber', v)} />
                   <Input label="Primary SAC / HSN Code" value={tempSettings.hsnCode || ''} onChange={v => handleUpdate('hsnCode', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-8 rounded-[2.5rem] border">
                   <Input label="Global GST %" type="number" value={tempSettings.taxRate?.toString() || '0'} onChange={v => handleUpdate('taxRate', parseFloat(v) || 0)} />
                   <Input label="CGST %" type="number" value={tempSettings.cgstRate?.toString() || '0'} onChange={v => handleUpdate('cgstRate', parseFloat(v) || 0)} />
                   <Input label="SGST %" type="number" value={tempSettings.sgstRate?.toString() || '0'} onChange={v => handleUpdate('sgstRate', parseFloat(v) || 0)} />
                   <Input label="IGST %" type="number" value={tempSettings.igstRate?.toString() || '0'} onChange={v => handleUpdate('igstRate', parseFloat(v) || 0)} />
                </div>
                
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex gap-6 items-start">
                   <div className="text-2xl mt-1">💡</div>
                   <p className="text-[11px] font-bold text-blue-900 leading-relaxed uppercase">
                      Changes here will reflect on all new invoices and duplicate re-prints. Ensure rates are as per the latest government regulations for hospitality.
                   </p>
                </div>
             </section>
          </div>
        )}

        {activeSubTab === 'DATA' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white p-12 rounded-[3.5rem] border shadow-sm space-y-8 text-center">
                   <div className="w-20 h-20 bg-blue-50 text-blue-900 rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-inner">📤</div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Export Archive</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Download full local database as JSON</p>
                   </div>
                   <button onClick={exportDatabase} className="w-full bg-blue-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest hover:bg-black transition-all">Download Now</button>
                </section>

                <section className="bg-white p-12 rounded-[3.5rem] border shadow-sm space-y-8 text-center">
                   <div className="w-20 h-20 bg-emerald-50 text-emerald-900 rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-inner">📥</div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Restore Node</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Recover data from a backup file</p>
                   </div>
                   <div className="relative">
                      <button className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest transition-all">Upload JSON</button>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} accept=".json" />
                   </div>
                </section>
             </div>
             
             <div className="bg-orange-50 border-2 border-dashed border-orange-200 p-10 rounded-[3rem] text-center">
                <p className="text-[12px] font-black text-orange-900 uppercase tracking-tight">Warning: Restore will overwrite all existing local records.</p>
                <p className="text-[10px] font-bold text-orange-600 uppercase mt-2 opacity-70">Always export a fresh backup before attempting a restore.</p>
             </div>
          </div>
        )}

        {activeSubTab === 'GUEST_PORTAL' && (
           <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              <section className="bg-white p-12 rounded-[3.5rem] border shadow-sm space-y-10">
                 <div className="border-b pb-6">
                    <h3 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Guest Portal Config</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Smart Interaction & Self-Service Nodes</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input label="WiFi Name (SSID)" value={tempSettings.name + '_Guest'} readOnly />
                    <Input label="WiFi Password" value={tempSettings.wifiPassword || ''} onChange={v => handleUpdate('wifiPassword', v)} />
                 </div>

                 <Input label="Standalone Restaurant Menu Link" value={tempSettings.restaurantMenuLink || ''} onChange={v => handleUpdate('restaurantMenuLink', v)} placeholder="https://..." />
                 
                 <div className="flex flex-col items-center gap-6 pt-10 border-t">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-4 border-blue-900">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '?portal=guest')}`} alt="Guest Portal QR" />
                    </div>
                    <div className="text-center">
                       <p className="text-[11px] font-black uppercase text-blue-900">QR CODE FOR GUEST SELF-CHECKIN</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest leading-relaxed">Guests can scan this at reception for <br/> express check-in and room service</p>
                    </div>
                 </div>
              </section>
           </div>
        )}
      </div>
    </div>
  );
};

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-blue-900 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-slate-900'}`}>{label}</button>
);

const Input: React.FC<{ label: string, value: any, onChange?: (v: string) => void, type?: string, readOnly?: boolean, placeholder?: string }> = ({ label, value, onChange, type = "text", readOnly = false, placeholder = "" }) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">{label}</label>
    <input 
      type={type} 
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full border-2 p-3.5 rounded-2xl font-black text-[11px] ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'} transition-all shadow-inner text-black outline-none focus:border-blue-500`} 
      value={value || ''} 
      onChange={e => onChange && onChange(e.target.value)} 
    />
  </div>
);

export default Settings;

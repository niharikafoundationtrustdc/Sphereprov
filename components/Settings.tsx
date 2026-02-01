
import React, { useState, useEffect } from 'react';
import { HostelSettings, Room, RoomStatus, Supervisor, BlockConfig, UserRole } from '../types.ts';
import { exportDatabase, db } from '../services/db.ts';

interface SettingsProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => Promise<any> | void;
  supervisors: Supervisor[];
  setSupervisors: (supervisors: Supervisor[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, setSettings, rooms, setRooms, supervisors, setSupervisors
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'MASTERS' | 'ROOMS' | 'STAFF' | 'TAX' | 'DATA'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  
  // Master Editing States
  const [newRoomType, setNewRoomType] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newMealPlan, setNewMealPlan] = useState('');
  const [newBlock, setNewBlock] = useState<Partial<BlockConfig>>({ name: '', prefix: '', color: 'blue' });

  // Room Management States
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed' });

  // Staff Management States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Supervisor> | null>(null);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleUpdate = async (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    await db.settings.put(updated);
    setSettings(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'signature' | 'wallpaper') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdate(key, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- MASTERS HANDLERS ---
  const addMaster = (field: 'roomTypes' | 'floors' | 'mealPlans', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = tempSettings[field] as string[];
    if (current.includes(value)) return alert("Already exists");
    handleUpdate(field, [...current, value]);
    setter('');
  };

  const removeMaster = (field: 'roomTypes' | 'floors' | 'mealPlans', value: string) => {
    if (!confirm(`Delete master entry "${value}"?`)) return;
    const current = tempSettings[field] as string[];
    handleUpdate(field, current.filter(v => v !== value));
  };

  const addBlock = () => {
    if (!newBlock.name || !newBlock.prefix) return alert("Fill all block fields");
    const current = tempSettings.blocks || [];
    const id = `blk-${Date.now()}`;
    handleUpdate('blocks', [...current, { ...newBlock, id } as BlockConfig]);
    setNewBlock({ name: '', prefix: '', color: 'blue' });
  };

  const removeBlock = (id: string) => {
    if (!confirm("Delete this block configuration?")) return;
    handleUpdate('blocks', tempSettings.blocks.filter(b => b.id !== id));
  };

  // --- ROOM HANDLERS ---
  const handleSaveRoom = async () => {
    if (!newRoom.number || !newRoom.block || !newRoom.type || !newRoom.price || !newRoom.bedType) {
      return alert("Fill all room fields. Ensure Block, Category, Price and Bed Type are set.");
    }
    const block = tempSettings.blocks.find(b => b.name === newRoom.block);
    const finalNumber = `${block?.prefix || ''}${newRoom.number}`;
    
    const roomObj: Room = {
      ...newRoom,
      id: `R-${Date.now()}`,
      number: finalNumber,
      status: RoomStatus.VACANT,
    } as Room;

    await db.rooms.put(roomObj);
    const nextRooms = [...rooms, roomObj];
    setRooms(nextRooms);
    setNewRoom({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed' });
    alert("Room enrolled successfully!");
  };

  const updateRoomField = async (roomId: string, field: keyof Room, value: any) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const updated = { ...room, [field]: value };
    await db.rooms.put(updated);
    setRooms(rooms.map(r => r.id === roomId ? updated : r));
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm("Permanently delete this inventory unit? This cannot be undone.")) return;
    try {
      await db.rooms.delete(id);
      setRooms(rooms.filter(r => r.id !== id));
      alert("Inventory unit removed.");
    } catch (err) {
      alert("Failed to delete room. Check console.");
      console.error(err);
    }
  };

  const handleStaffSave = async () => {
    if (!editingStaff?.name || !editingStaff?.loginId || !editingStaff?.password) return alert("Fill mandatory fields (Name, Login ID, Password)");
    const staffObj: Supervisor = {
      ...editingStaff as Supervisor,
      id: editingStaff.id || `STF-${Date.now()}`,
      status: editingStaff.status || 'ACTIVE',
      role: editingStaff.role || 'WAITER',
      assignedRoomIds: editingStaff.assignedRoomIds || [],
      basicPay: editingStaff.basicPay || 0,
      hra: editingStaff.hra || 0,
      vehicleAllowance: editingStaff.vehicleAllowance || 0,
      otherAllowances: editingStaff.otherAllowances || 0,
    } as Supervisor;
    const nextStaffList = editingStaff.id 
      ? supervisors.map(s => s.id === staffObj.id ? staffObj : s)
      : [...supervisors, staffObj];
    await db.supervisors.put(staffObj);
    setSupervisors(nextStaffList);
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc]/50 min-h-full pb-32 text-black overflow-x-hidden backdrop-blur-sm">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        <div className="flex items-center justify-between bg-white p-2 md:p-3 rounded-2xl md:rounded-[2rem] border shadow-xl sticky top-2 z-10 overflow-x-auto scrollbar-hide no-print gap-1">
          <SubTab active={activeSubTab === 'GENERAL'} label="Property Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'MASTERS'} label="Property Masters" onClick={() => setActiveSubTab('MASTERS')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Inventory Master" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Personnel / HR" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'TAX'} label="Taxation Config" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Global Backups" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'STAFF' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm gap-6">
                <div>
                   <h3 className="text-3xl font-black text-[#1a2b4b] uppercase tracking-tighter">EMPLOYEE REGISTER</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Personnel Management & Salary Configuration</p>
                </div>
                <button 
                   onClick={() => { setEditingStaff({ role: 'WAITER', status: 'ACTIVE', assignedRoomIds: [], basicPay: 0, hra: 0, vehicleAllowance: 0, otherAllowances: 0 }); setShowStaffModal(true); }} 
                   className="bg-[#e65c00] text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all transform hover:scale-105 active:scale-95"
                >
                   + Enroll New Staff
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(staffMember => (
                   <div key={staffMember.id} className="bg-white border-2 border-transparent rounded-[3.5rem] p-8 shadow-sm hover:shadow-2xl hover:border-orange-500 transition-all group cursor-pointer flex flex-col justify-between" onClick={() => { setEditingStaff(staffMember); setShowStaffModal(true); }}>
                      <div>
                         <div className="flex justify-between items-start mb-6">
                            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-2xl font-black text-orange-600 shadow-inner border border-slate-100">
                               {staffMember.photo ? <img src={staffMember.photo} className="w-full h-full object-cover rounded-3xl" /> : staffMember.name.charAt(0)}
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${staffMember.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                               {staffMember.status}
                            </span>
                         </div>
                         <h4 className="text-2xl font-black text-[#1a2b4b] uppercase tracking-tighter leading-none">{staffMember.name}</h4>
                         <div className="flex items-center gap-2 mt-3">
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-blue-100">{staffMember.role}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {staffMember.loginId}</span>
                         </div>
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                         <span>Salary: ₹{staffMember.basicPay || 0}</span>
                         <span className="text-blue-500 font-black">View Profile →</span>
                      </div>
                   </div>
                ))}
                {supervisors.length === 0 && (
                   <div className="col-span-full py-32 text-center text-slate-300 font-black uppercase tracking-[0.2em] border-4 border-dashed rounded-[4rem]">No staff members enrolled</div>
                )}
             </div>
          </div>
        )}

        {/* ... (Other SubTabs logic - GENERAL, MASTERS, ROOMS, TAX, DATA - Remain same) ... */}
        {activeSubTab === 'MASTERS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <MasterBox title="Block Master (e.g. Ayodhya, Mithila)">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                  <input className="md:col-span-2 border-2 p-3 rounded-xl font-bold text-xs" placeholder="Block Name" value={newBlock.name} onChange={e => setNewBlock({...newBlock, name: e.target.value})} />
                  <input className="border-2 p-3 rounded-xl font-bold text-xs" placeholder="Prefix" value={newBlock.prefix} onChange={e => setNewBlock({...newBlock, prefix: e.target.value})} />
                  <select className="border-2 p-3 rounded-xl font-bold text-xs" value={newBlock.color} onChange={e => setNewBlock({...newBlock, color: e.target.value})}>
                     <option value="blue">Blue Theme</option>
                     <option value="orange">Saffron Theme</option>
                     <option value="emerald">Green Theme</option>
                  </select>
               </div>
               <button onClick={addBlock} className="w-full bg-[#e65c00] text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md mb-6">+ Create Block</button>
               <div className="flex flex-wrap gap-3">
                  {(tempSettings.blocks || []).map(b => (
                     <div key={b.id} className={`flex items-center gap-3 px-4 py-2 rounded-2xl border-2 font-black text-[10px] uppercase ${b.color === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-700' : b.color === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        {b.name} ({b.prefix})
                        <button onClick={() => removeBlock(b.id)} className="ml-2 text-rose-500 font-bold hover:scale-110">×</button>
                     </div>
                  ))}
               </div>
            </MasterBox>

            <MasterBox title="Room Category Master (Rates & Types)">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. SUPER PREMIUM ROOM" value={newRoomType} onChange={e => setNewRoomType(e.target.value)} />
                  <button onClick={() => addMaster('roomTypes', newRoomType, setNewRoomType)} className="bg-blue-900 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-md">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {tempSettings.roomTypes.map(t => (
                     <span key={t} className="flex items-center gap-2 bg-slate-50 border px-4 py-2 rounded-xl font-black text-[10px] uppercase">
                        {t}
                        <button onClick={() => removeMaster('roomTypes', t)} className="text-red-400 font-bold ml-1">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>

            <MasterBox title="Floor Configuration">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. Ground Floor, 1st Floor" value={newFloor} onChange={e => setNewFloor(e.target.value)} />
                  <button onClick={() => addMaster('floors', newFloor, setNewFloor)} className="bg-blue-900 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-md">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {(tempSettings.floors || []).map(f => (
                     <span key={f} className="flex items-center gap-2 bg-slate-50 border px-4 py-2 rounded-xl font-black text-[10px] uppercase text-slate-500">
                        {f}
                        <button onClick={() => removeMaster('floors', f)} className="text-red-400 font-bold ml-1">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>

            <MasterBox title="Meal Plan Protocols">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. MAP (Dinner Only)" value={newMealPlan} onChange={e => setNewMealPlan(e.target.value)} />
                  <button onClick={() => addMaster('mealPlans', newMealPlan, setNewMealPlan)} className="bg-blue-900 text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-md">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {tempSettings.mealPlans.map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-4 py-2 rounded-xl font-black text-[10px] uppercase text-slate-500">
                        {m}
                        <button onClick={() => removeMaster('mealPlans', m)} className="text-red-400 font-bold ml-1">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>
          </div>
        )}

        {activeSubTab === 'ROOMS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <h3 className="font-black text-[#e65c00] uppercase text-xs tracking-widest border-b pb-4">Enroll New Inventory Unit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Select Block</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.block} onChange={e => setNewRoom({...newRoom, block: e.target.value})}>
                         <option value="">-- Block --</option>
                         {(tempSettings.blocks || []).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Select Floor</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: e.target.value})}>
                         <option value="">-- Floor --</option>
                         {(tempSettings.floors || []).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                   </div>
                   <Inp label="Room No. (Numeric)" value={newRoom.number} onChange={(v: string) => setNewRoom({...newRoom, number: v})} placeholder="e.g. 101" />
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Category</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                         <option value="">-- Type --</option>
                         {tempSettings.roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Bed Type</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.bedType} onChange={e => setNewRoom({...newRoom, bedType: e.target.value as any})}>
                         <option value="Single Bed">Single Bed</option>
                         <option value="Double Bed">Double Bed</option>
                      </select>
                   </div>
                   <Inp label="Standard Daily Rate (₹)" type="number" value={newRoom.price?.toString()} onChange={(v: string) => setNewRoom({...newRoom, price: parseFloat(v) || 0})} />
                </div>
                <button onClick={handleSaveRoom} className="w-full bg-[#1a2b4b] text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl tracking-widest hover:bg-black transition-all">Authorize Inventory Registry</button>
             </section>

             <section className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="font-black text-[#1a2b4b] uppercase text-xs tracking-widest border-b pb-4 mb-6">Inventory Database (All Fields Editable)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {rooms.map(r => (
                      <div key={r.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-all group">
                         <div>
                            <div className="flex justify-between items-start mb-4">
                               <span className="bg-white px-3 py-1 rounded-full text-[9px] font-black uppercase text-slate-400 border">{r.block} | {r.floor}</span>
                               <button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 font-black text-lg p-1 hover:scale-125 transition-transform">×</button>
                            </div>
                            <h4 className="text-2xl font-black text-blue-900 tracking-tighter leading-none">{r.number}</h4>
                            <div className="flex flex-col gap-1 mt-2">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{r.type}</p>
                               <select 
                                 className="text-[9px] font-black bg-transparent uppercase border-none focus:ring-0 outline-none text-blue-600 p-0"
                                 value={r.bedType} 
                                 onChange={e => updateRoomField(r.id, 'bedType', e.target.value)}
                               >
                                  <option value="Single Bed">Single Bed</option>
                                  <option value="Double Bed">Double Bed</option>
                               </select>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 mt-6">
                            <span className="text-[10px] font-black text-slate-400">₹</span>
                            <input 
                              type="number" 
                              className="bg-transparent text-lg font-black text-[#e65c00] w-full outline-none focus:bg-white focus:px-2 rounded transition-all" 
                              value={r.price} 
                              onChange={e => updateRoomField(r.id, 'price', parseFloat(e.target.value) || 0)} 
                            />
                         </div>
                      </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {activeSubTab === 'TAX' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Tax & Compliance Settings</h3>
              <Input label="GST Number" value={tempSettings.gstNumber || ''} onChange={v => handleUpdate('gstNumber', v)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Default GST Rate (%)" type="number" value={tempSettings.taxRate?.toString() || '12'} onChange={v => handleUpdate('taxRate', parseFloat(v))} />
                <Input label="Default HSN Code" value={tempSettings.hsnCode || '9963'} onChange={v => handleUpdate('hsnCode', v)} />
              </div>
            </section>
          </div>
        )}

        {activeSubTab === 'DATA' && (
          <div className="bg-white p-12 rounded-[3rem] border shadow-sm space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center gap-6 border-b pb-8">
               <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl">💾</div>
               <div>
                 <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Database Management</h2>
               </div>
             </div>
             <button onClick={exportDatabase} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg">Download Global JSON</button>
          </div>
        )}

        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <section className="lg:col-span-2 bg-white/90 p-10 rounded-[3rem] border shadow-sm space-y-8 backdrop-blur-md">
               <h3 className="font-black uppercase text-xs text-[#e65c00] tracking-widest border-b pb-4">Business Identity</h3>
               <Input label="Business Legal Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Postal Address</label>
                 <textarea className="w-full border-2 p-4 rounded-2xl font-bold h-24 bg-slate-50 focus:bg-white outline-none transition-all resize-none text-xs" value={tempSettings.address} onChange={e => handleUpdate('address', e.target.value)} />
               </div>

               <div className="pt-6 border-t">
                  <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest mb-6">Property Wallpaper</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                     <div className="space-y-4">
                        <div className="aspect-video bg-slate-50 border-2 border-dashed rounded-[2.5rem] flex items-center justify-center relative overflow-hidden group shadow-inner">
                           {tempSettings.wallpaper ? (
                              <img src={tempSettings.wallpaper} className="w-full h-full object-cover" />
                           ) : (
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Image Selected</span>
                           )}
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                              <label className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer shadow-xl">
                                 Upload
                                 <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'wallpaper')} />
                              </label>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>
            
            <div className="space-y-8">
               <section className="bg-white/90 p-10 rounded-[3rem] border shadow-sm space-y-8 backdrop-blur-md">
                  <h3 className="font-black uppercase text-xs text-[#e65c00] tracking-widest border-b pb-4">Digital Branding</h3>
                  <div className="space-y-4">
                     {tempSettings.logo ? <img src={tempSettings.logo} className="h-24 mx-auto mb-4 object-contain" /> : <div className="h-24 bg-slate-50 border-2 border-dashed rounded-3xl flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Logo Placeholder</div>}
                     <input type="file" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-orange-50 file:text-[#e65c00] hover:file:bg-orange-100" onChange={e => handleFileUpload(e, 'logo')} />
                  </div>
               </section>
            </div>
          </div>
        )}
      </div>

      {/* STAFF MANAGEMENT MODAL (UX IMPROVED) */}
      {showStaffModal && editingStaff && (
         <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-500 flex flex-col border-[12px] border-white">
               
               {/* Modal Header */}
               <div className="bg-[#1a2b4b] p-10 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner border border-white/5">👤</div>
                     <div>
                        <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{editingStaff.id ? 'Employee Profile' : 'New Enrollment'}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300 mt-2">Personnel Master Registry Node</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setShowStaffModal(false)} className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Discard</button>
                     <button onClick={handleStaffSave} className="bg-[#e65c00] hover:bg-orange-500 px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all transform active:scale-95">Authorize Record</button>
                  </div>
               </div>

               {/* Modal Body */}
               <div className="flex-1 overflow-y-auto p-10 md:p-14 bg-slate-50 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-14">
                     
                     {/* Left Side: Identity & Credentials */}
                     <div className="lg:col-span-7 space-y-12">
                        
                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-8 border-2 border-slate-50">
                           <div className="flex items-center gap-4 border-b pb-4">
                              <span className="w-8 h-8 bg-blue-900 rounded-xl flex items-center justify-center text-white text-[10px] font-black">01</span>
                              <h4 className="text-lg font-black text-blue-900 uppercase tracking-tighter">Primary Identity</h4>
                           </div>
                           <Inp label="Employee Full Legal Name *" value={editingStaff.name} onChange={(v: string) => setEditingStaff({...editingStaff, name: v})} placeholder="As per Govt ID" />
                           <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Module Access (Role)</label>
                                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}>
                                    <option value="RECEPTIONIST">Front Desk Receptionist</option>
                                    <option value="MANAGER">Property General Manager</option>
                                    <option value="WAITER">F&B Service Staff / Waiter</option>
                                    <option value="CHEF">Kitchen Staff / Chef</option>
                                    <option value="SUPERVISOR">Housekeeping Supervisor</option>
                                    <option value="ACCOUNTANT">Financial Accountant</option>
                                    <option value="STOREKEEPER">Inventory Store Keeper</option>
                                 </select>
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Account Status</label>
                                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900" value={editingStaff.status} onChange={e => setEditingStaff({...editingStaff, status: e.target.value as any})}>
                                    <option value="ACTIVE">ACTIVE (Authorized)</option>
                                    <option value="INACTIVE">DEACTIVATED (Locked)</option>
                                 </select>
                              </div>
                           </div>
                           <Inp label="Contact Phone Number" value={editingStaff.phone} onChange={(v: string) => setEditingStaff({...editingStaff, phone: v})} placeholder="99XXXXXXXX" />
                        </section>

                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-8 border-2 border-orange-500/20">
                           <div className="flex items-center gap-4 border-b pb-4">
                              <span className="w-8 h-8 bg-orange-600 rounded-xl flex items-center justify-center text-white text-[10px] font-black">02</span>
                              <h4 className="text-lg font-black text-orange-600 uppercase tracking-tighter">Security Credentials</h4>
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                              <Inp label="System Login Identity *" value={editingStaff.loginId} onChange={(v: string) => setEditingStaff({...editingStaff, loginId: v})} placeholder="username" />
                              <Inp label="Secret Access Key (Pass) *" type="password" value={editingStaff.password} onChange={(v: string) => setEditingStaff({...editingStaff, password: v})} placeholder="••••••••" />
                           </div>
                           <p className="text-[9px] font-bold text-slate-400 uppercase text-center bg-slate-50 py-3 rounded-xl border border-dashed">Sensitive account keys are encrypted during transit</p>
                        </section>

                     </div>

                     {/* Right Side: Compensation & HR */}
                     <div className="lg:col-span-5 space-y-12">
                        
                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-8 border-2 border-slate-50">
                           <div className="flex items-center gap-4 border-b pb-4">
                              <span className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-[10px] font-black">03</span>
                              <h4 className="text-lg font-black text-emerald-600 uppercase tracking-tighter">Compensation Model</h4>
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                              <Inp label="Monthly Basic Salary (₹)" type="number" value={editingStaff.basicPay?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, basicPay: parseFloat(v) || 0})} />
                              <Inp label="HRA Allowance (₹)" type="number" value={editingStaff.hra?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, hra: parseFloat(v) || 0})} />
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                              <Inp label="Vehicle Allowance (₹)" type="number" value={editingStaff.vehicleAllowance?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, vehicleAllowance: parseFloat(v) || 0})} />
                              <Inp label="Special/Other Fix (₹)" type="number" value={editingStaff.otherAllowances?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, otherAllowances: parseFloat(v) || 0})} />
                           </div>
                           <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-xl">
                              <span className="text-[10px] font-black uppercase text-slate-400">Net CTC (Est)</span>
                              <span className="text-2xl font-black tracking-tighter">₹{((editingStaff.basicPay || 0) + (editingStaff.hra || 0) + (editingStaff.vehicleAllowance || 0) + (editingStaff.otherAllowances || 0)).toFixed(0)}</span>
                           </div>
                        </section>

                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-6 border-2 border-slate-50">
                           <div className="flex items-center gap-4 border-b pb-4">
                              <span className="w-8 h-8 bg-slate-400 rounded-xl flex items-center justify-center text-white text-[10px] font-black">04</span>
                              <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Banking & Payout</h4>
                           </div>
                           <Inp label="Bank Name" value={editingStaff.bankName} onChange={(v: string) => setEditingStaff({...editingStaff, bankName: v})} placeholder="e.g. SBI, HDFC" />
                           <Inp label="A/C Number" value={editingStaff.accountNumber} onChange={(v: string) => setEditingStaff({...editingStaff, accountNumber: v})} placeholder="Bank account number" />
                           <Inp label="UAN Number (PF)" value={editingStaff.uanNumber} onChange={(v: string) => setEditingStaff({...editingStaff, uanNumber: v})} placeholder="12 digit UAN" />
                        </section>

                     </div>
                  </div>
               </div>

               {/* Modal Footer (Sticky if needed, but here part of flex column) */}
               <div className="bg-slate-50 border-t p-6 text-center">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">System Node Registry v3.4.0 • Enterprise Resource Access</p>
               </div>

            </div>
         </div>
      )}
    </div>
  );
};

const MasterBox = ({ title, children }: any) => (
   <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
      <h3 className="font-black text-[#1a2b4b] uppercase text-[11px] tracking-widest border-b pb-4">{title}</h3>
      {children}
   </section>
);

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-[#e65c00] text-white shadow-lg' : 'bg-white/80 text-slate-400 hover:text-slate-900'}`}>{label}</button>
);

const Input: React.FC<{ label: string, value: any, onChange?: (v: string) => void, type?: string, readOnly?: boolean, placeholder?: string }> = ({ label, value, onChange, type = "text", readOnly = false, placeholder = "" }) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">{label}</label>
    <input type={type} readOnly={readOnly} placeholder={placeholder} className={`w-full border-2 p-3.5 rounded-2xl font-black text-[11px] ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'} transition-all shadow-inner text-black outline-none focus:border-orange-500`} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />
  </div>
);

const Inp: React.FC<{ label: string, value: any, onChange: (v: string) => void, type?: string, placeholder?: string }> = ({ label, value, onChange, type = "text", placeholder = "" }) => (
   <div className="space-y-1.5 w-full text-left">
     <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
     <input type={type} placeholder={placeholder} className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white outline-none transition-all shadow-inner text-black focus:border-blue-600" value={value || ''} onChange={e => onChange(e.target.value)} />
   </div>
);

export default Settings;

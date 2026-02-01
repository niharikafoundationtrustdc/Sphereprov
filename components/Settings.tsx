
import React, { useState, useEffect } from 'react';
import { HostelSettings, Room, RoomStatus, Supervisor, BlockConfig, UserRole } from '../types.ts';
import { exportDatabase, db } from '../services/db.ts';

interface SettingsProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  supervisors: Supervisor[];
  setSupervisors: (supervisors: Supervisor[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, setSettings, rooms, setRooms, supervisors, setSupervisors
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'MASTERS' | 'ROOMS' | 'STAFF' | 'TAX' | 'DATA'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  
  // Room Management States
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed' });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  // Master Editing States
  const [newRoomType, setNewRoomType] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newMealPlan, setNewMealPlan] = useState('');
  const [newBedType, setNewBedType] = useState('');
  const [newBlock, setNewBlock] = useState<Partial<BlockConfig>>({ name: '', prefix: '', color: 'blue' });

  // Staff Management States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Supervisor> | null>(null);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleUpdate = async (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    await db.settings.put(updated as any);
    setSettings(updated);
  };

  // --- MASTERS HANDLERS ---
  const addMaster = (field: 'roomTypes' | 'floors' | 'mealPlans' | 'bedTypes', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = (tempSettings[field] as string[]) || [];
    if (current.includes(value)) return alert("Already exists");
    handleUpdate(field, [...current, value]);
    setter('');
  };

  const removeMaster = (field: 'roomTypes' | 'floors' | 'mealPlans' | 'bedTypes', value: string) => {
    if (!window.confirm(`Delete master entry "${value}"?`)) return;
    const current = (tempSettings[field] as string[]) || [];
    handleUpdate(field, current.filter(v => v !== value));
  };

  const addBlock = () => {
    if (!newBlock.name || !newBlock.prefix) return alert("Fill block name and prefix.");
    const current = tempSettings.blocks || [];
    const id = `blk-${Date.now()}`;
    handleUpdate('blocks', [...current, { ...newBlock, id } as BlockConfig]);
    setNewBlock({ name: '', prefix: '', color: 'blue' });
  };

  // --- ROOM PERSISTENCE HANDLERS ---
  const handleSaveRoom = async () => {
    if (!newRoom.number || !newRoom.block || !newRoom.floor || !newRoom.type || !newRoom.price || !newRoom.bedType) {
      return alert("Incomplete Data: Please fill all room parameters.");
    }
    
    const blockRef = tempSettings.blocks.find(b => b.name === newRoom.block);
    const prefix = blockRef?.prefix || '';
    const cleanNumber = newRoom.number.startsWith(prefix) ? newRoom.number.substring(prefix.length) : newRoom.number;
    const finalNumber = `${prefix}${cleanNumber}`;
    
    const roomObj: Room = {
      ...newRoom,
      id: editingRoomId || `R-${Date.now()}`,
      number: finalNumber,
      status: rooms.find(r => r.id === editingRoomId)?.status || RoomStatus.VACANT,
    } as Room;

    try {
      await db.rooms.put(roomObj);
      const nextRooms = editingRoomId 
        ? rooms.map(r => r.id === editingRoomId ? roomObj : r)
        : [...rooms, roomObj];
      setRooms(nextRooms);
      setNewRoom({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed' });
      setEditingRoomId(null);
      alert(editingRoomId ? "Unit updated successfully." : "New unit added to inventory.");
    } catch (err) {
      console.error(err);
      alert("Error saving unit.");
    }
  };

  const handleEditRoom = (room: Room) => {
    const blockRef = tempSettings.blocks?.find(b => b.name === room.block);
    const prefix = blockRef?.prefix || '';
    const displayNum = room.number.startsWith(prefix) ? room.number.substring(prefix.length) : room.number;
    
    setNewRoom({ 
      number: displayNum,
      block: room.block,
      floor: room.floor,
      type: room.type,
      price: room.price,
      bedType: room.bedType || 'Double Bed'
    });
    setEditingRoomId(room.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRoom = async (id: string) => {
    const room = rooms.find(r => r.id === id);
    if (!room) return;
    
    // Direct forced delete to ensure reliability
    if (!window.confirm(`PERMANENTLY REMOVE ROOM ${room.number}?\n\nIf this unit is currently occupied, you should perform checkout first to avoid data corruption.`)) return;
    
    try {
      // 1. Remove from local DB
      await db.rooms.delete(id);
      // 2. Update local state
      setRooms(rooms.filter(r => r.id !== id));
      
      if (editingRoomId === id) {
        setEditingRoomId(null);
        setNewRoom({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed' });
      }
      console.log(`Room ${id} deleted successfully.`);
    } catch (e) {
      console.error("Deletion Failed:", e);
      alert("System failed to execute delete command. Please refresh the page.");
    }
  };

  const handleWipeAllRooms = async () => {
    if (rooms.length === 0) return alert("Inventory is already empty.");
    
    const confirmation = window.prompt("⚠️ WARNING: Type 'DELETE ALL' to confirm wiping your entire room inventory. This action is PERMANENT and will sync across devices if cloud is active.");
    if (confirmation !== 'DELETE ALL') return;

    try {
      const ids = rooms.map(r => r.id);
      await db.rooms.bulkDelete(ids);
      setRooms([]);
      alert("FULL INVENTORY WIPE COMPLETE. You can now rebuild your registry.");
    } catch (e) {
      alert("Wipe procedure failed. Error: " + e);
    }
  };

  const handleStaffSave = async () => {
    if (!editingStaff?.name || !editingStaff?.loginId || !editingStaff?.password) return alert("Missing fields.");
    const staffObj: Supervisor = {
      ...editingStaff as Supervisor,
      id: editingStaff.id || `STF-${Date.now()}`,
      status: editingStaff.status || 'ACTIVE',
      assignedRoomIds: editingStaff.assignedRoomIds || [],
    } as Supervisor;
    
    await db.supervisors.put(staffObj);
    const nextStaffList = editingStaff.id 
      ? supervisors.map(s => s.id === staffObj.id ? staffObj : s)
      : [...supervisors, staffObj];
    setSupervisors(nextStaffList);
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'signature' | 'wallpaper') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { handleUpdate(key, reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] min-h-full pb-32 text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl border shadow-sm sticky top-2 z-10 overflow-x-auto scrollbar-hide no-print gap-1">
          <SubTab active={activeSubTab === 'GENERAL'} label="Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'MASTERS'} label="Masters" onClick={() => setActiveSubTab('MASTERS')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Inventory" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Staff HR" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'TAX'} label="Taxation" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Backups" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'MASTERS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
             <MasterBox title="Block Registry">
                <div className="flex gap-2 mb-4">
                   <input className="flex-[2] bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="Name" value={newBlock.name} onChange={e => setNewBlock({...newBlock, name: e.target.value})} />
                   <input className="flex-1 bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="Prefix" value={newBlock.prefix} onChange={e => setNewBlock({...newBlock, prefix: e.target.value})} />
                   <button onClick={addBlock} className="bg-blue-900 text-white px-4 rounded-xl font-black text-[9px] uppercase hover:bg-black transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                   {(tempSettings.blocks || []).map(b => (
                     <div key={b.id} className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border rounded-full text-[10px] font-black text-slate-600">
                        {b.name} ({b.prefix})
                        <button onClick={() => handleUpdate('blocks', tempSettings.blocks.filter(x => x.id !== b.id))} className="text-red-400 font-bold ml-1">×</button>
                     </div>
                   ))}
                </div>
             </MasterBox>

             <MasterBox title="Unit Categories">
                <div className="flex gap-2 mb-4">
                   <input className="flex-1 bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. Deluxe" value={newRoomType} onChange={e => setNewRoomType(e.target.value)} />
                   <button onClick={() => addMaster('roomTypes', newRoomType, setNewRoomType)} className="bg-blue-900 text-white px-4 rounded-xl font-black text-[9px] uppercase hover:bg-black transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                   {(tempSettings.roomTypes || []).map(t => (
                     <span key={t} className="flex items-center gap-2 bg-slate-50 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase">{t} <button onClick={() => removeMaster('roomTypes', t)} className="text-red-300 ml-1">×</button></span>
                   ))}
                </div>
             </MasterBox>

             <MasterBox title="Floor Registry">
                <div className="flex gap-2 mb-4">
                   <input className="flex-1 bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. 1st Floor" value={newFloor} onChange={e => setNewFloor(e.target.value)} />
                   <button onClick={() => addMaster('floors', newFloor, setNewFloor)} className="bg-blue-900 text-white px-4 rounded-xl font-black text-[9px] uppercase hover:bg-black transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                   {(tempSettings.floors || []).map(f => (
                     <span key={f} className="flex items-center gap-2 bg-slate-50 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase">{f} <button onClick={() => removeMaster('floors', f)} className="text-red-300 ml-1">×</button></span>
                   ))}
                </div>
             </MasterBox>

             <MasterBox title="Meal Plans">
                <div className="flex gap-2 mb-4">
                   <input className="flex-1 bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. MAP" value={newMealPlan} onChange={e => setNewMealPlan(e.target.value)} />
                   <button onClick={() => addMaster('mealPlans', newMealPlan, setNewMealPlan)} className="bg-blue-900 text-white px-4 rounded-xl font-black text-[9px] uppercase hover:bg-black transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                   {(tempSettings.mealPlans || []).map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase">{m} <button onClick={() => removeMaster('mealPlans', m)} className="text-red-300 ml-1">×</button></span>
                   ))}
                </div>
             </MasterBox>

             <MasterBox title="Bedding Styles">
                <div className="flex gap-2 mb-4">
                   <input className="flex-1 bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" placeholder="e.g. Twin Bed" value={newBedType} onChange={e => setNewBedType(e.target.value)} />
                   <button onClick={() => addMaster('bedTypes', newBedType, setNewBedType)} className="bg-blue-900 text-white px-4 rounded-xl font-black text-[9px] uppercase hover:bg-black transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                   {(tempSettings.bedTypes || []).map(t => (
                     <span key={t} className="flex items-center gap-2 bg-slate-50 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase">{t} <button onClick={() => removeMaster('bedTypes', t)} className="text-red-300 ml-1">×</button></span>
                   ))}
                </div>
             </MasterBox>
          </div>
        )}

        {activeSubTab === 'ROOMS' && (
           <div className="space-y-8 animate-in fade-in duration-500">
             <section className={`bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8 transition-all ${editingRoomId ? 'ring-4 ring-orange-500/20 shadow-2xl' : ''}`}>
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="font-black text-blue-900 uppercase text-xs tracking-widest">{editingRoomId ? 'Modify Inventory Node' : 'Enroll New Unit'}</h3>
                  <div className="flex gap-4 items-center">
                    {editingRoomId && <button onClick={() => { setEditingRoomId(null); setNewRoom({ number: '', block: '', floor: '', type: '', price: 0 }); }} className="text-[10px] font-black text-rose-500 uppercase px-4 py-2 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all">Cancel Edit</button>}
                    {!editingRoomId && <button onClick={handleWipeAllRooms} className="text-[10px] font-black text-white bg-red-600 px-6 py-2 rounded-xl uppercase hover:bg-black transition-all shadow-lg">Wipe All Inventory ⚠️</button>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Block</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white transition-all outline-none" value={newRoom.block} onChange={e => setNewRoom({...newRoom, block: e.target.value})}>
                         <option value="">Choose...</option>
                         {(tempSettings.blocks || []).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Floor</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white transition-all outline-none" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: e.target.value})}>
                         <option value="">Choose...</option>
                         {(tempSettings.floors || []).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                   </div>
                   <Inp label="Unit #" value={newRoom.number} onChange={(v: string) => setNewRoom({...newRoom, number: v})} placeholder="101" />
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Category</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white transition-all outline-none" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                         <option value="">Choose...</option>
                         {(tempSettings.roomTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Bedding</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white transition-all outline-none" value={newRoom.bedType} onChange={e => setNewRoom({...newRoom, bedType: e.target.value})}>
                         {(tempSettings.bedTypes || []).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                   </div>
                   <Inp label="Daily Rate" type="number" value={newRoom.price?.toString()} onChange={(v: string) => setNewRoom({...newRoom, price: parseFloat(v) || 0})} />
                </div>
                <button onClick={handleSaveRoom} className={`w-full ${editingRoomId ? 'bg-orange-600' : 'bg-blue-900'} text-white py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-xl transition-all hover:brightness-110`}>
                   {editingRoomId ? 'Commit Modification Record' : 'Enroll Inventory Record'}
                </button>
             </section>

             <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#111] text-white font-black uppercase text-[9px]">
                    <tr><th className="p-6">Unit</th><th className="p-6">Floor</th><th className="p-6">Type</th><th className="p-6 text-right">Standard Rate</th><th className="p-6 text-center">Action</th></tr>
                  </thead>
                  <tbody className="divide-y font-bold uppercase text-xs text-slate-700">
                    {rooms.sort((a,b) => a.number.localeCompare(b.number)).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 group">
                        <td className="p-6 font-black text-blue-900 text-lg">
                           {r.number} 
                           <span className="text-[9px] text-slate-300 ml-2 tracking-widest">{r.block}</span>
                        </td>
                        <td className="p-6">{r.floor}</td>
                        <td className="p-6">{r.type}</td>
                        <td className="p-6 text-right text-orange-600 font-black">₹{r.price}</td>
                        <td className="p-6 text-center">
                           <div className="flex gap-4 justify-center">
                              <button onClick={() => handleEditRoom(r)} className="text-blue-500 hover:text-blue-800 font-black uppercase text-[10px] transition-all">Edit</button>
                              <button onClick={() => handleDeleteRoom(r.id)} className="text-rose-400 hover:text-rose-700 font-black uppercase text-[10px] transition-all">Delete</button>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-slate-300 italic font-black uppercase">No units registered. Add your rooms above.</td></tr>}
                  </tbody>
                </table>
             </section>
           </div>
        )}

        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <section className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-6">
               <h3 className="font-black uppercase text-xs text-blue-900 border-b pb-4">Business Identity</h3>
               <Input label="Property Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Postal Address</label>
                 <textarea className="w-full border-2 p-4 rounded-2xl font-bold h-24 bg-slate-50 focus:bg-white outline-none transition-all resize-none text-xs" value={tempSettings.address} onChange={e => handleUpdate('address', e.target.value)} />
               </div>
               <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Digital Signature</label>
                    <div className="h-32 bg-slate-50 border-2 border-dashed rounded-2xl flex items-center justify-center relative group overflow-hidden">
                        {tempSettings.signature ? <img src={tempSettings.signature} className="h-full object-contain" /> : <span className="text-[9px] font-black opacity-30 uppercase">Upload PNG</span>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'signature')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Wallpaper</label>
                    <div className="h-32 bg-slate-50 border-2 border-dashed rounded-2xl flex items-center justify-center relative group overflow-hidden">
                        {tempSettings.wallpaper ? <img src={tempSettings.wallpaper} className="h-full object-cover" /> : <span className="text-[9px] font-black opacity-30 uppercase">Set Background</span>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'wallpaper')} />
                    </div>
                  </div>
               </div>
            </section>
            <section className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-6">
               <h3 className="font-black uppercase text-xs text-blue-900 border-b pb-4">Branding</h3>
               <div className="text-center space-y-4">
                  {tempSettings.logo ? <img src={tempSettings.logo} className="h-32 mx-auto object-contain border p-2 rounded-2xl" /> : <div className="h-32 w-32 bg-slate-50 mx-auto rounded-3xl border-2 border-dashed"></div>}
                  <input type="file" className="block w-full text-[10px] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-blue-50 file:text-blue-700" onChange={e => handleFileUpload(e, 'logo')} />
               </div>
            </section>
          </div>
        )}

        {activeSubTab === 'STAFF' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <div><h3 className="text-2xl font-black text-blue-900 uppercase">Personnel Registry</h3></div>
                <button onClick={() => { setEditingStaff({ role: 'RECEPTIONIST', status: 'ACTIVE' }); setShowStaffModal(true); }} className="bg-orange-600 text-white px-8 py-3 rounded-[1.2rem] font-black text-[10px] uppercase shadow-xl">+ Enroll Staff</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(s => (
                   <div key={s.id} onClick={() => { setEditingStaff(s); setShowStaffModal(true); }} className="bg-white border-2 rounded-[2.5rem] p-8 shadow-sm hover:border-orange-500 cursor-pointer transition-all">
                      <div className="flex justify-between items-start mb-6">
                         <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-xl font-black text-blue-900">{s.name.charAt(0)}</div>
                         <span className={`px-3 py-1 rounded-full text-[8px] font-black border uppercase ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{s.status}</span>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{s.name}</h4>
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1">{s.role}</p>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeSubTab === 'TAX' && (
           <div className="max-w-xl animate-in fade-in duration-500">
             <section className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-6">
                <h3 className="font-black text-blue-900 uppercase text-xs border-b pb-4">Compliance</h3>
                <Input label="GSTIN" value={tempSettings.gstNumber || ''} onChange={v => handleUpdate('gstNumber', v)} />
                <div className="grid grid-cols-2 gap-4">
                   <Input label="GST Rate (%)" type="number" value={tempSettings.taxRate?.toString() || '12'} onChange={v => handleUpdate('taxRate', parseFloat(v))} />
                   <Input label="SAC Code" value={tempSettings.hsnCode || '9963'} onChange={v => handleUpdate('hsnCode', v)} />
                </div>
             </section>
           </div>
        )}

        {activeSubTab === 'DATA' && (
           <div className="bg-white p-12 rounded-[3rem] border shadow-sm space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center gap-6 border-b pb-8">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl">💾</div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Maintenance</h2>
              </div>
              <button onClick={exportDatabase} className="w-full bg-blue-900 text-white py-6 rounded-2xl font-black uppercase text-xs shadow-lg">Download Data Export (.JSON)</button>
           </div>
        )}
      </div>

      {showStaffModal && editingStaff && (
         <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-4 border-blue-900">
               <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase tracking-tighter">{editingStaff.id ? 'Edit Profile' : 'Staff Intake'}</h3>
                  <button onClick={() => setShowStaffModal(false)} className="uppercase text-[10px] font-black opacity-60">Cancel</button>
               </div>
               <div className="p-8 space-y-6">
                  <Inp label="Full Name" value={editingStaff.name} onChange={(v: string) => setEditingStaff({...editingStaff, name: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <Inp label="Login ID" value={editingStaff.loginId} onChange={(v: string) => setEditingStaff({...editingStaff, loginId: v})} />
                    <Inp label="Password" type="password" value={editingStaff.password} onChange={(v: string) => setEditingStaff({...editingStaff, password: v})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assigned Role</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}>
                        <option value="RECEPTIONIST">Receptionist</option>
                        <option value="MANAGER">Manager</option>
                        <option value="SUPERVISOR">Supervisor</option>
                        <option value="CHEF">Chef</option>
                        <option value="WAITER">Waiter</option>
                    </select>
                  </div>
                  <button onClick={handleStaffSave} className="w-full bg-orange-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Save Staff Protocol ✅</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const MasterBox = ({ title, children }: any) => (
  <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm h-full flex flex-col">
     <h3 className="font-black uppercase text-[10px] text-blue-900 border-b pb-4 mb-6 tracking-widest">{title}</h3>
     {children}
  </section>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-blue-900 text-white shadow-md scale-105' : 'bg-transparent text-slate-400 hover:text-blue-900'}`}>{label}</button>
);

const Input = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-900 transition-all text-slate-900 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
   <div className="space-y-1.5 w-full text-left">
     <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
     <input type={type} placeholder={placeholder} className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white outline-none transition-all shadow-inner text-black focus:border-blue-900" value={value || ''} onChange={e => onChange(e.target.value)} />
   </div>
);

export default Settings;

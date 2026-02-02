
import React, { useState, useEffect } from 'react';
import { HostelSettings, Room, RoomStatus, Supervisor, BlockConfig, UserRole, MealPlanConfig } from '../types.ts';
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
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ 
    number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed', defaultMealPlan: '', mealPlanRate: 0 
  });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  
  const [newRoomType, setNewRoomType] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newBlock, setNewBlock] = useState<Partial<BlockConfig>>({ name: '', prefix: '', color: 'blue' });
  
  const [newMealName, setNewMealName] = useState('');
  const [newMealRate, setNewMealRate] = useState('');

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

  const addMaster = (field: 'roomTypes' | 'floors' | 'bedTypes', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = (tempSettings[field] as string[]) || [];
    if (current.includes(value)) return alert("Protocol: Entry exists.");
    handleUpdate(field, [...current, value]);
    setter('');
  };

  const removeMaster = (e: React.MouseEvent, field: 'roomTypes' | 'floors' | 'bedTypes', value: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${value}?`)) return;
    const current = (tempSettings[field] as string[]) || [];
    handleUpdate(field, current.filter(v => v !== value));
  };

  const addMealPlan = () => {
    if (!newMealName || !newMealRate) return;
    const current = tempSettings.mealPlanRates || [];
    const updated = [...current, { name: newMealName, rate: parseFloat(newMealRate) || 0 }];
    handleUpdate('mealPlanRates', updated);
    setNewMealName('');
    setNewMealRate('');
  };

  const removeMealPlan = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${name}?`)) return;
    const current = tempSettings.mealPlanRates || [];
    handleUpdate('mealPlanRates', current.filter(p => p.name !== name));
  };

  const addBlock = () => {
    if (!newBlock.name || !newBlock.prefix) return;
    const current = tempSettings.blocks || [];
    handleUpdate('blocks', [...current, { ...newBlock, id: `blk-${Date.now()}` } as BlockConfig]);
    setNewBlock({ name: '', prefix: '', color: 'blue' });
  };

  const handleSaveRoom = async () => {
    if (!newRoom.number || !newRoom.block) return;
    const roomObj: Room = {
      ...newRoom,
      id: editingRoomId || `R-${Date.now()}`,
      status: rooms.find(r => r.id === editingRoomId)?.status || RoomStatus.VACANT,
    } as Room;
    await db.rooms.put(roomObj);
    const next = editingRoomId ? rooms.map(r => r.id === editingRoomId ? roomObj : r) : [...rooms, roomObj];
    setRooms(next);
    setEditingRoomId(null);
    setNewRoom({ number: '', block: '', floor: '', type: '', price: 0, bedType: 'Double Bed', defaultMealPlan: '', mealPlanRate: 0 });
    alert("Unit information synced to master inventory.");
  };

  const handleEditRoom = (room: Room) => {
    setNewRoom(room);
    setEditingRoomId(room.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRoom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const room = rooms.find(r => r.id === id);
    if (!room) return;

    if (room.status === RoomStatus.OCCUPIED) {
      alert("Operational Conflict: Cannot delete a room that is currently OCCUPIED. Please check out the guest first.");
      return;
    }

    if (!window.confirm(`DANGER: Permanently delete unit ${room.number}? This will also remove all associated historical bookings from the cloud. This action cannot be undone. Proceed?`)) return;

    try {
      await db.rooms.delete(id);
      const updatedRooms = rooms.filter(r => r.id !== id);
      setRooms(updatedRooms);
      alert(`Unit ${room.number} permanently removed from inventory.`);
    } catch (err) {
      console.error("Room Deletion Failure:", err);
      alert("System Error: Could not remove unit. Please ensure you have an active internet connection and cloud permissions.");
    }
  };

  const handleStaffSave = async () => {
    if (!editingStaff?.name || !editingStaff?.loginId) return alert("Missing mandatory fields.");
    const staffObj: Supervisor = {
      ...editingStaff as Supervisor,
      id: editingStaff.id || `STF-${Date.now()}`,
      status: editingStaff.status || 'ACTIVE',
      assignedRoomIds: editingStaff.assignedRoomIds || [],
    } as Supervisor;
    await db.supervisors.put(staffObj);
    const nextList = editingStaff.id ? supervisors.map(s => s.id === staffObj.id ? staffObj : s) : [...supervisors, staffObj];
    setSupervisors(nextList);
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  const toggleStaffRoom = (roomId: string) => {
    if (!editingStaff) return;
    const current = editingStaff.assignedRoomIds || [];
    const next = current.includes(roomId) 
      ? current.filter(id => id !== roomId) 
      : [...current, roomId];
    setEditingStaff({ ...editingStaff, assignedRoomIds: next });
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
    <div className="p-6 md:p-10 bg-slate-50 min-h-full pb-40 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-20 overflow-x-auto scrollbar-hide no-print">
          <SubTab active={activeSubTab === 'GENERAL'} label="Property Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'MASTERS'} label="Global Masters" onClick={() => setActiveSubTab('MASTERS')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Unit Inventory" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Staff Registry" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'TAX'} label="Financials" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Operations" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'MASTERS' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
              <MasterBox title="Blocks">
                 <div className="flex gap-2 mb-4">
                    <input className="flex-1 border border-slate-200 bg-white p-2 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500" placeholder="Name" value={newBlock.name} onChange={e=>setNewBlock({...newBlock, name:e.target.value})} />
                    <input className="w-16 border border-slate-200 bg-white p-2 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500" placeholder="Prefix" value={newBlock.prefix} onChange={e=>setNewBlock({...newBlock, prefix:e.target.value})} />
                    <button onClick={addBlock} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-sm">ADD</button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {(tempSettings.blocks || []).map(b => (
                       <span key={b.id} className="bg-white border border-slate-100 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2 group shadow-sm">
                          {b.name} ({b.prefix})
                          <button onClick={(e) => { e.stopPropagation(); handleUpdate('blocks', tempSettings.blocks.filter(x => x.id !== b.id)); }} className="text-red-400 font-bold">×</button>
                       </span>
                    ))}
                 </div>
              </MasterBox>

              <MasterBox title="Meal Plans & Rates">
                 <div className="flex gap-2 mb-4">
                    <input className="flex-1 border border-slate-200 bg-white p-2 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500" placeholder="Plan (e.g. CP)" value={newMealName} onChange={e=>setNewMealName(e.target.value)} />
                    <input className="w-20 border border-slate-200 bg-white p-2 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500" placeholder="Rate ₹" type="number" value={newMealRate} onChange={e=>setNewMealRate(e.target.value)} />
                    <button onClick={addMealPlan} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-sm">ADD</button>
                 </div>
                 <div className="flex flex-col gap-2">
                    {(tempSettings.mealPlanRates || []).map(p => (
                       <div key={p.name} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 group shadow-sm">
                          <span className="text-[10px] font-black uppercase text-slate-700">{p.name}</span>
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black text-blue-600">₹{p.rate}</span>
                             <button onClick={(e) => removeMealPlan(e, p.name)} className="text-red-400 font-black">×</button>
                          </div>
                       </div>
                    ))}
                 </div>
              </MasterBox>

              {['roomTypes', 'floors', 'bedTypes'].map((field: any) => (
                <MasterBox key={field} title={field.replace(/([A-Z])/g, ' $1').toUpperCase()}>
                   <div className="flex gap-2 mb-4">
                      <input className="flex-1 border border-slate-200 bg-white p-2 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500" placeholder="New entry..." onKeyDown={e => e.key === 'Enter' && addMaster(field, (e.target as any).value, (v) => (e.target as any).value = v)} />
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {(tempSettings[field] as string[] || []).map(t => (
                        <span key={t} className="bg-white border border-slate-100 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2 group shadow-sm">
                          {t}
                          <button onClick={(e) => removeMaster(e, field, t)} className="text-red-400 font-bold">×</button>
                        </span>
                      ))}
                   </div>
                </MasterBox>
              ))}
           </div>
        )}

        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <section className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
               <h3 className="font-black uppercase text-xs text-blue-600 tracking-widest border-b pb-4">Corporate Identity</h3>
               <div className="space-y-6">
                  <Input label="Registered Trade Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Address</label>
                    <textarea className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:border-blue-500 h-24 resize-none shadow-sm" value={tempSettings.address} onChange={e => handleUpdate('address', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <FileField label="Authority Signature" src={tempSettings.signature} onChange={e => handleFileUpload(e, 'signature')} />
                     <FileField label="Property Logo" src={tempSettings.logo} onChange={e => handleFileUpload(e, 'logo')} />
                     <FileField label="System Wallpaper" src={tempSettings.wallpaper} onChange={e => handleFileUpload(e, 'wallpaper')} isWallpaper />
                  </div>
               </div>
            </section>
            <div className="space-y-6">
               <div className="bg-blue-600 p-10 rounded-[2.5rem] shadow-xl text-white">
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2">Cloud Engine</h4>
                  <p className="text-[10px] font-bold uppercase opacity-80 leading-relaxed">Property profiles, logos and wallpapers are synced globally across all authorized modules.</p>
               </div>
            </div>
          </div>
        )}

        {activeSubTab === 'STAFF' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-blue-900 uppercase">Personnel Registry</h3>
                <button onClick={() => { setEditingStaff({ role: 'RECEPTIONIST', status: 'ACTIVE', assignedRoomIds: [] }); setShowStaffModal(true); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Register Staff</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(s => (
                  <div key={s.id} className="bg-white border rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
                     <div>
                        <div className="flex justify-between items-start mb-6">
                           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-600 border border-slate-100">{s.name.charAt(0)}</div>
                           <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{s.status}</span>
                        </div>
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{s.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{s.role}</p>
                        <p className="text-[8px] font-black uppercase text-blue-500 mt-4 tracking-widest">Assigned: {s.assignedRoomIds?.length || 0} Units</p>
                     </div>
                     <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                        <button onClick={() => { setEditingStaff(s); setShowStaffModal(true); }} className="text-blue-600 font-black text-[10px] uppercase">Edit Profile & Assets</button>
                        <button onClick={async (e) => { e.stopPropagation(); if(window.confirm('Wipe personnel?')) { await db.supervisors.delete(s.id); setSupervisors(supervisors.filter(x => x.id !== s.id)); }}} className="text-red-400 font-black text-[10px] uppercase">Delete</button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeSubTab === 'DATA' && (
           <div className="bg-white border-2 rounded-[4rem] shadow-xl p-20 flex flex-col items-center justify-center text-center space-y-10 animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-5xl mb-4">💾</div>
              <div>
                 <h2 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">System Maintenance</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-3">Full Master Data Backup Protocol</p>
              </div>
              <div className="flex gap-4">
                 <button onClick={exportDatabase} className="bg-blue-900 text-white px-12 py-5 rounded-3xl font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">Download Master JSON Backup</button>
              </div>
           </div>
        )}

        {activeSubTab === 'ROOMS' && (
          <div className="space-y-8 animate-in fade-in">
             <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
                <h3 className="font-black uppercase text-xs text-blue-600 tracking-widest">{editingRoomId ? 'Modify Unit' : 'Enroll New Asset'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
                   <Inp label="Unit #" value={newRoom.number} onChange={v => setNewRoom({...newRoom, number: v})} />
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                      <select className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-blue-500" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                         <option value="">Choose...</option>
                         {tempSettings.roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Block</label>
                      <select className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-blue-500" value={newRoom.block} onChange={e => setNewRoom({...newRoom, block: e.target.value})}>
                         <option value="">Choose...</option>
                         {(tempSettings.blocks || []).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                   </div>
                   <Inp label="Daily Rate (₹)" type="number" value={newRoom.price?.toString()} onChange={v => setNewRoom({...newRoom, price: parseFloat(v)})} />
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Meal Plan</label>
                      <select className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-blue-500" value={newRoom.defaultMealPlan} onChange={e => {
                        const plan = tempSettings.mealPlanRates.find(p => p.name === e.target.value);
                        setNewRoom({...newRoom, defaultMealPlan: e.target.value, mealPlanRate: plan?.rate || 0});
                      }}>
                         <option value="">Choose...</option>
                         {tempSettings.mealPlanRates.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                   </div>
                   <Inp label="Plan Rate (₹)" type="number" value={newRoom.mealPlanRate?.toString()} onChange={v => setNewRoom({...newRoom, mealPlanRate: parseFloat(v)})} />
                   <button onClick={handleSaveRoom} className="lg:col-span-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-slate-900 transition-all">{editingRoomId ? 'Update Room' : 'Add to Inventory'}</button>
                </div>
             </section>

             <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                   <thead className="bg-slate-50 text-slate-400 font-black uppercase">
                      <tr>
                        <th className="p-6">Room Master</th>
                        <th className="p-6">Category</th>
                        <th className="p-6">Default Plan</th>
                        <th className="p-6 text-right">Plan Rate</th>
                        <th className="p-6 text-right">Standard Rate</th>
                        <th className="p-6 text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 font-bold uppercase text-slate-700 bg-white">
                      {[...rooms].sort((a,b) => a.number.localeCompare(b.number, undefined, {numeric:true})).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                           <td className="p-6 text-lg font-black text-slate-900">{r.number} <span className="text-[8px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded ml-2">{r.block}</span></td>
                           <td className="p-6">{r.type}</td>
                           <td className="p-6"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px]">{r.defaultMealPlan || 'None'}</span></td>
                           <td className="p-6 text-right font-black text-blue-400">₹{r.mealPlanRate || 0}</td>
                           <td className="p-6 text-right font-black text-blue-600">₹{r.price}</td>
                           <td className="p-6 text-center">
                              <div className="flex gap-2 justify-center">
                                 <button onClick={() => handleEditRoom(r)} className="text-blue-600 underline font-black">Edit</button>
                                 <button onClick={(e) => handleDeleteRoom(e, r.id)} className="text-red-400 underline font-black">Delete</button>
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {showStaffModal && editingStaff && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-3xl animate-in zoom-in flex flex-col max-h-[90vh]">
              <div className="bg-blue-900 p-8 text-white rounded-t-[3rem] flex justify-between items-center shrink-0">
                 <h3 className="text-xl font-black uppercase tracking-tighter">Personnel Profile & Asset Rights</h3>
                 <button onClick={() => setShowStaffModal(false)} className="text-[10px] font-black opacity-60">Cancel</button>
              </div>
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                 <div className="grid grid-cols-2 gap-4">
                    <Inp label="Legal Name" value={editingStaff.name} onChange={v => setEditingStaff({...editingStaff, name: v})} />
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Functional Role</label>
                       <select className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-xs text-slate-900" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}>
                          <option value="RECEPTIONIST">Reception Desk</option>
                          <option value="MANAGER">Management</option>
                          <option value="SUPERVISOR">Housekeeping</option>
                          <option value="CHEF">Kitchen</option>
                          <option value="WAITER">Service</option>
                          <option value="ACCOUNTANT">Audit</option>
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Inp label="Module Login ID" value={editingStaff.loginId} onChange={v => setEditingStaff({...editingStaff, loginId: v})} />
                    <Inp label="Module Password" type="password" value={editingStaff.password} onChange={v => setEditingStaff({...editingStaff, password: v})} />
                 </div>

                 <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Assign Units for Oversight</h4>
                    <p className="text-[9px] text-slate-400 uppercase font-bold italic">Staff will only see these units in their maintenance dashboard</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto p-2 bg-slate-50 rounded-2xl border custom-scrollbar">
                       {[...rooms].sort((a,b) => a.number.localeCompare(b.number, undefined, {numeric: true})).map(r => (
                          <button 
                            key={r.id} 
                            onClick={() => toggleStaffRoom(r.id)}
                            className={`p-3 rounded-xl border-2 font-black text-[10px] transition-all ${editingStaff.assignedRoomIds?.includes(r.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105' : 'bg-white border-white text-slate-400 hover:border-blue-100'}`}
                          >
                             {r.number}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t shrink-0">
                 <button onClick={handleStaffSave} className="w-full bg-blue-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Authorize Personnel Data Update</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const MasterBox = ({ title, children }: any) => (
  <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-full flex flex-col">
     <h3 className="font-black uppercase text-[10px] text-blue-600 border-b pb-4 mb-6 tracking-widest">{title}</h3>
     <div className="flex-1">{children}</div>
  </section>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>{label}</button>
);

const Input = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const Inp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-sm text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const FileField = ({ label, src, onChange, isWallpaper = false }: any) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <div className={`h-32 bg-white border-2 border-dashed rounded-[1.5rem] flex items-center justify-center relative overflow-hidden group shadow-sm ${src ? 'border-blue-200' : 'border-slate-200'}`}>
      {src ? (
         <img src={src} className={`h-full ${isWallpaper ? 'w-full object-cover' : 'object-contain'}`} alt="preview" />
      ) : (
         <span className="text-[9px] font-black text-slate-300 uppercase">Upload</span>
      )}
      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onChange} />
    </div>
  </div>
);

export default Settings;

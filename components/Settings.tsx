
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
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'MASTERS' | 'ROOMS' | 'STAFF' | 'GUEST_APP' | 'API' | 'TAX' | 'DATA'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  
  // Master Editing States
  const [newRoomType, setNewRoomType] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newMealPlan, setNewMealPlan] = useState('');
  const [newBedType, setNewBedType] = useState('');
  const [newBlock, setNewBlock] = useState<Partial<BlockConfig>>({ name: '', prefix: '', color: 'blue' });

  // Room Management States
  const [newRoom, setNewRoom] = useState<Partial<Room>>({ number: '', block: '', floor: '', type: '', price: 0, bedType: '' });

  // Staff Management States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Supervisor> | null>(null);

  useEffect(() => {
    // Ensure all master arrays are initialized
    const sanitized = {
      ...settings,
      roomTypes: settings.roomTypes || [],
      mealPlans: settings.mealPlans || [],
      floors: settings.floors || [],
      bedTypes: settings.bedTypes || ['Single Bed', 'Double Bed'],
      blocks: settings.blocks || [],
      guestAppWelcome: settings.guestAppWelcome || `Hello! I'm your AI Concierge. How can I make your stay memorable today?`,
      guestAppPersona: settings.guestAppPersona || `Professional Travel Expert for Raipur and Chhattisgarh. Expert in preparing detailed local itineraries.`,
      externalApiKey: settings.externalApiKey || ''
    };
    setTempSettings(sanitized);
  }, [settings]);

  const handleUpdate = async (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    await db.settings.put(updated as any);
    setSettings(updated);
  };

  const generateApiKey = () => {
    const key = 'HS-PR-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now().toString().slice(-4);
    handleUpdate('externalApiKey', key);
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
    if (!newBlock.name || !newBlock.prefix) return alert("Fill all block fields");
    const current = tempSettings.blocks || [];
    const id = `blk-${Date.now()}`;
    handleUpdate('blocks', [...current, { ...newBlock, id } as BlockConfig]);
    setNewBlock({ name: '', prefix: '', color: 'blue' });
  };

  const removeBlock = (id: string) => {
    if (!window.confirm("Delete this block configuration?")) return;
    handleUpdate('blocks', tempSettings.blocks.filter(b => b.id !== id));
  };

  // --- ROOM HANDLERS ---
  const handleSaveRoom = async () => {
    if (!newRoom.number || !newRoom.block || !newRoom.floor || !newRoom.type || !newRoom.price || !newRoom.bedType) {
      return alert("Fill all room fields including Floor and Bed Type.");
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
    setNewRoom({ number: '', block: '', floor: '', type: '', price: 0, bedType: '' });
    alert("Room enrolled successfully!");
  };

  const handleDeleteRoom = async (id: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to permanently delete this inventory unit? This action cannot be undone.")) return;
    
    try {
      // Delete from database
      await db.rooms.delete(id);
      // Update application state
      const remainingRooms = rooms.filter(r => r.id !== id);
      setRooms(remainingRooms);
    } catch (error) {
      console.error("Failed to delete room:", error);
      alert("System Error: Could not delete the room. Please refresh and try again.");
    }
  };

  const handleStaffSave = async () => {
    if (!editingStaff?.name || !editingStaff?.loginId || !editingStaff?.password) return alert("Fill mandatory fields (Name, Login, Password)");
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
    
    await db.supervisors.put(staffObj);
    const nextStaffList = editingStaff.id 
      ? supervisors.map(s => s.id === staffObj.id ? staffObj : s)
      : [...supervisors, staffObj];
    setSupervisors(nextStaffList);
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc]/50 min-h-full pb-32 text-black overflow-x-hidden backdrop-blur-sm">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* SubTab Navigation */}
        <div className="flex items-center justify-between bg-white p-2 md:p-3 rounded-2xl md:rounded-[2rem] border shadow-xl sticky top-2 z-10 overflow-x-auto scrollbar-hide no-print gap-1">
          <SubTab active={activeSubTab === 'GENERAL'} label="Property Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'MASTERS'} label="Property Masters" onClick={() => setActiveSubTab('MASTERS')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Inventory Master" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Personnel / HR" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'GUEST_APP'} label="Guest App Settings" onClick={() => setActiveSubTab('GUEST_APP')} />
          <SubTab active={activeSubTab === 'API'} label="API / Integrations" onClick={() => setActiveSubTab('API')} />
          <SubTab active={activeSubTab === 'TAX'} label="Taxation Config" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Backups" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'API' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
             <section className="lg:col-span-5 bg-white p-10 rounded-[3rem] border shadow-sm space-y-10">
                <div>
                   <h3 className="text-2xl font-black text-[#1a2b4b] uppercase tracking-tighter">Integration Gateway</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Authorized Node for Tally & Cloud Bridges</p>
                </div>

                <div className="space-y-6">
                   <div className="bg-[#111] p-8 rounded-[2rem] border-4 border-orange-600/20 shadow-inner group">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] mb-4 block">ACTIVE SECURE ACCESS KEY</label>
                      <div className="flex flex-col gap-4">
                         <div className="bg-black/50 p-4 rounded-xl font-mono text-orange-500 text-sm break-all border border-white/5 select-all">
                            {tempSettings.externalApiKey || 'NO_KEY_GENERATED'}
                         </div>
                         <button 
                            onClick={generateApiKey} 
                            className="bg-orange-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-orange-700 transition-all active:scale-95"
                         >
                            {tempSettings.externalApiKey ? 'Rotate / Refresh Key' : 'Generate Secure API Key'}
                         </button>
                      </div>
                   </div>

                   <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Sync Protocol Status</p>
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[11px] font-black text-blue-900 uppercase">External Handshake Enabled</span>
                      </div>
                   </div>
                </div>
             </section>

             <section className="lg:col-span-7 bg-[#0f172a] p-10 rounded-[3rem] text-white shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-5 scale-[2]">📡</div>
                <div className="relative z-10 space-y-8 h-full flex flex-col">
                   <div>
                      <h3 className="text-xl font-black uppercase tracking-widest text-orange-500">Developer Documentation</h3>
                      <p className="text-sm text-blue-200 mt-2">Use these endpoints to bridge data to Tally or customized dashboards.</p>
                   </div>

                   <div className="space-y-6 flex-1">
                      <div className="space-y-2">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Integration URL</p>
                         <div className="bg-black/40 p-4 rounded-xl font-mono text-xs text-blue-400 border border-white/5">
                            http://your-server-ip:5000/api/external
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <DocCard 
                            title="Tally Vouchers" 
                            path="/accounting" 
                            desc="Fetch transactions asReceipts/Payments for Tally Ledger."
                         />
                         <DocCard 
                            title="Live Occupancy" 
                            path="/occupancy" 
                            desc="Real-time room status & count for dashboards."
                         />
                      </div>

                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                         <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Required Header</p>
                         <code className="text-[11px] font-mono text-slate-300">
                            "x-api-key": "{tempSettings.externalApiKey || 'YOUR_KEY'}"
                         </code>
                      </div>
                   </div>

                   <p className="text-[9px] font-bold text-slate-500 uppercase text-center border-t border-white/5 pt-6">
                      For advanced XML/TCP Tally integration, contact support for the specific Bridge XML mapping files.
                   </p>
                </div>
             </section>
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

               <div className="pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest">Authorized Signature</h3>
                    <p className="text-[9px] text-slate-400 uppercase leading-none">Used for digital validation on invoices</p>
                    <div className="h-40 bg-slate-50 border-2 border-dashed rounded-[2rem] flex items-center justify-center relative overflow-hidden group shadow-inner">
                        {tempSettings.signature ? (
                           <img src={tempSettings.signature} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                        ) : (
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Signature Selected</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                           <label className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer shadow-xl">
                              Upload JPG/PNG
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'signature')} />
                           </label>
                        </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-black uppercase text-xs text-blue-900 tracking-widest">Background Wallpaper</h3>
                    <div className="h-40 bg-slate-50 border-2 border-dashed rounded-[2rem] flex items-center justify-center relative overflow-hidden group shadow-inner">
                        {tempSettings.wallpaper ? (
                           <img src={tempSettings.wallpaper} className="w-full h-full object-cover" />
                        ) : (
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Image Selected</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                           <label className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer shadow-xl">
                              Upload Image
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'wallpaper')} />
                           </label>
                        </div>
                    </div>
                  </div>
               </div>
            </section>
            
            <section className="bg-white/90 p-10 rounded-[3rem] border shadow-sm space-y-8 backdrop-blur-md">
               <h3 className="font-black uppercase text-xs text-[#e65c00] tracking-widest border-b pb-4">Digital Branding</h3>
               <div className="space-y-4 text-center">
                  {tempSettings.logo ? (
                    <div className="p-4 border rounded-3xl bg-slate-50 inline-block mx-auto">
                      <img src={tempSettings.logo} className="h-24 object-contain" />
                    </div>
                  ) : (
                    <div className="h-32 bg-slate-50 border-2 border-dashed rounded-3xl flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Logo Placeholder</div>
                  )}
                  <input type="file" className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-orange-50 file:text-[#e65c00] hover:file:bg-orange-100" onChange={e => handleFileUpload(e, 'logo')} />
               </div>
            </section>
          </div>
        )}

        {activeSubTab === 'GUEST_APP' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
             <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-10">
                <div>
                   <h3 className="text-2xl font-black text-[#1a2b4b] uppercase tracking-tighter">Guest Portal AI Config</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Fine-tune your digital concierge engine</p>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Initial Chat Greeting</label>
                      <textarea 
                         className="w-full bg-[#333] border-none text-white p-5 rounded-2xl font-bold text-xs h-24 outline-none focus:ring-2 ring-orange-500 transition-all resize-none" 
                         value={tempSettings.guestAppWelcome} 
                         onChange={e => handleUpdate('guestAppWelcome', e.target.value)} 
                         placeholder="Enter first message the guest sees..."
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">AI Persona / Expertise Focus</label>
                      <textarea 
                         className="w-full bg-[#333] border-none text-white p-5 rounded-2xl font-bold text-xs h-32 outline-none focus:ring-2 ring-orange-500 transition-all resize-none" 
                         value={tempSettings.guestAppPersona} 
                         onChange={e => handleUpdate('guestAppPersona', e.target.value)} 
                         placeholder="Describe AI expertise (e.g. Local Raipur Expert, Itinerary planner for Chhattisgarh...)"
                      />
                   </div>
                </div>

                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                   <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-3">Live Preview Hint</p>
                   <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-600 italic">"I am a {tempSettings.guestAppPersona?.split('.')[0]}..."</p>
                   </div>
                </div>
             </section>

             <section className="bg-[#1a2b4b] p-10 rounded-[3rem] text-white shadow-2xl flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-10 scale-[3]">🤖</div>
                <div className="relative z-10 space-y-6">
                   <h3 className="text-xl font-black uppercase tracking-widest text-orange-500">Raipur Travel Logic</h3>
                   <p className="text-sm font-medium leading-relaxed text-blue-100">
                      The bot is currently hard-tuned for Raipur/Chhattisgarh tourism. To maximize effectiveness:
                   </p>
                   <ul className="space-y-4 text-[11px] font-bold uppercase tracking-wide text-blue-200">
                      <li className="flex items-center gap-3">
                         <span className="w-6 h-6 bg-blue-800 rounded-lg flex items-center justify-center text-xs">✓</span>
                         Automatic 1, 3, and 5 day itinerary flows
                      </li>
                      <li className="flex items-center gap-3">
                         <span className="w-6 h-6 bg-blue-800 rounded-lg flex items-center justify-center text-xs">✓</span>
                         Distance calculation for Sirpur & Bastar
                      </li>
                      <li className="flex items-center gap-3">
                         <span className="w-6 h-6 bg-blue-800 rounded-lg flex items-center justify-center text-xs">✓</span>
                         Direct link to Transport Desk settings
                      </li>
                   </ul>
                </div>
                <div className="bg-white/10 p-6 rounded-3xl border border-white/10 relative z-10 mt-10">
                   <p className="text-[10px] font-black uppercase text-blue-300 mb-2">System Status</p>
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[11px] font-black uppercase">Gemini-3-Flash Processing Online</span>
                   </div>
                </div>
             </section>
          </div>
        )}

        {activeSubTab === 'MASTERS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            {/* Block Master */}
            <MasterBox title="Block Master">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                  <input className="md:col-span-2 bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Block Name" value={newBlock.name} onChange={e => setNewBlock({...newBlock, name: e.target.value})} />
                  <input className="bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Prefix" value={newBlock.prefix} onChange={e => setNewBlock({...newBlock, prefix: e.target.value})} />
                  <select className="bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs outline-none" value={newBlock.color} onChange={e => setNewBlock({...newBlock, color: e.target.value})}>
                     <option value="blue">Blue</option>
                     <option value="orange">Orange</option>
                     <option value="emerald">Emerald</option>
                  </select>
               </div>
               <button onClick={addBlock} className="w-full bg-[#e65c00] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-md mb-6 hover:brightness-110 active:scale-95 transition-all">+ Create Block</button>
               <div className="flex flex-wrap gap-3">
                  {(tempSettings.blocks || []).map(b => (
                     <div key={b.id} className="flex items-center gap-3 px-6 py-2.5 rounded-full border-2 font-black text-[10px] uppercase bg-white border-slate-100">
                        {b.name} ({b.prefix})
                        <button onClick={() => removeBlock(b.id)} className="ml-2 text-rose-500 font-bold hover:scale-110">×</button>
                     </div>
                  ))}
               </div>
            </MasterBox>

            {/* Room Type / Category Master */}
            <MasterBox title="Room Category Master">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Category Name (e.g. Deluxe)" value={newRoomType} onChange={e => setNewRoomType(e.target.value)} />
                  <button onClick={() => addMaster('roomTypes', newRoomType, setNewRoomType)} className="bg-[#1a2b4b] text-white px-8 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-black transition-all">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {(tempSettings.roomTypes || []).map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-5 py-2.5 rounded-full font-black text-[10px] uppercase text-slate-700">
                        {m}
                        <button onClick={() => removeMaster('roomTypes', m)} className="text-red-400 font-bold ml-1 hover:scale-125 transition-transform">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>

            {/* Floor Master */}
            <MasterBox title="Floor Configuration">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Floor Level (e.g. Ground Floor)" value={newFloor} onChange={e => setNewFloor(e.target.value)} />
                  <button onClick={() => addMaster('floors', newFloor, setNewFloor)} className="bg-[#1a2b4b] text-white px-8 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-black transition-all">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {(tempSettings.floors || []).map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-5 py-2.5 rounded-full font-black text-[10px] uppercase text-slate-700">
                        {m}
                        <button onClick={() => removeMaster('floors', m)} className="text-red-400 font-bold ml-1 hover:scale-125 transition-transform">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>

            {/* Bed Type Master */}
            <MasterBox title="Bedding Masters">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Bedding Type (e.g. King Size)" value={newBedType} onChange={e => setNewBedType(e.target.value)} />
                  <button onClick={() => addMaster('bedTypes', newBedType, setNewBedType)} className="bg-[#1a2b4b] text-white px-8 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-black transition-all">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {(tempSettings.bedTypes || []).map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-5 py-2.5 rounded-full font-black text-[10px] uppercase text-slate-700">
                        {m}
                        <button onClick={() => removeMaster('bedTypes', m)} className="text-red-400 font-bold ml-1 hover:scale-125 transition-transform">×</button>
                     </span>
                  ))}
               </div>
            </MasterBox>

            {/* Meal Plans */}
            <MasterBox title="Meal Plans">
               <div className="flex gap-2 mb-6">
                  <input className="flex-1 bg-[#333] border-none text-white p-3 rounded-xl font-bold text-xs" placeholder="Plan Name (e.g. CP)" value={newMealPlan} onChange={e => setNewMealPlan(e.target.value)} />
                  <button onClick={() => addMaster('mealPlans', newMealPlan, setNewMealPlan)} className="bg-[#1a2b4b] text-white px-8 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-black transition-all">Add</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {(tempSettings.mealPlans || []).map(m => (
                     <span key={m} className="flex items-center gap-2 bg-slate-50 border px-5 py-2.5 rounded-full font-black text-[10px] uppercase text-slate-700">
                        {m}
                        <button onClick={() => removeMaster('mealPlans', m)} className="text-red-400 font-bold ml-1 hover:scale-125 transition-transform">×</button>
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
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Block</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.block} onChange={e => setNewRoom({...newRoom, block: e.target.value})}>
                         <option value="">-- Select --</option>
                         {(tempSettings.blocks || []).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Floor</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: e.target.value})}>
                         <option value="">-- Select --</option>
                         {(tempSettings.floors || []).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                   </div>
                   <Inp label="Unit Number" value={newRoom.number} onChange={(v: string) => setNewRoom({...newRoom, number: v})} placeholder="e.g. 101" />
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Category</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})}>
                         <option value="">-- Select --</option>
                         {(tempSettings.roomTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Bedding</label>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newRoom.bedType} onChange={e => setNewRoom({...newRoom, bedType: e.target.value})}>
                         <option value="">-- Select --</option>
                         {(tempSettings.bedTypes || []).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                   </div>
                   <Inp label="Daily Rate (₹)" type="number" value={newRoom.price?.toString()} onChange={(v: string) => setNewRoom({...newRoom, price: parseFloat(v) || 0})} />
                </div>
                <button onClick={handleSaveRoom} className="w-full bg-[#1a2b4b] text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">Authorize Unit Registry</button>
             </section>

             <section className="bg-white p-10 rounded-[3rem] border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                    <thead className="bg-[#111] text-white font-black uppercase text-[10px]">
                        <tr><th className="p-6">Unit</th><th className="p-6">Floor</th><th className="p-6">Type</th><th className="p-6">Bedding</th><th className="p-6 text-right">Base Rate</th><th className="p-6 text-center" style={{ width: '100px' }}>Action</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold uppercase text-xs">
                        {rooms.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-6 font-black text-blue-900 text-lg">{r.number} <span className="text-[9px] text-slate-300 ml-2">{r.block}</span></td>
                            <td className="p-6">{r.floor}</td>
                            <td className="p-6">{r.type}</td>
                            <td className="p-6">{r.bedType}</td>
                            <td className="p-6 text-right text-orange-600 font-black">₹{r.price.toLocaleString()}</td>
                            <td className="p-6 text-center">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoom(r.id);
                                  }} 
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm mx-auto"
                                  title="Delete inventory unit"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                            </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
             </section>
           </div>
        )}

        {activeSubTab === 'STAFF' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm gap-6">
                <div>
                   <h3 className="text-3xl font-black text-[#1a2b4b] uppercase tracking-tighter">STAFF REGISTRY</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage personnel, module access & salary profiles</p>
                </div>
                <button 
                   onClick={() => { setEditingStaff({ role: 'RECEPTIONIST', status: 'ACTIVE', assignedRoomIds: [], basicPay: 0, hra: 0, vehicleAllowance: 0, otherAllowances: 0 }); setShowStaffModal(true); }} 
                   className="bg-[#e65c00] text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all transform hover:scale-105 active:scale-95"
                >
                   + Enroll Employee
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(staffMember => (
                   <div key={staffMember.id} className="bg-white border-2 border-transparent rounded-[3.5rem] p-8 shadow-sm hover:shadow-2xl hover:border-orange-500 transition-all group cursor-pointer flex flex-col justify-between h-full" onClick={() => { setEditingStaff(staffMember); setShowStaffModal(true); }}>
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
                         <span>Salary: ₹{(staffMember.basicPay || 0).toLocaleString()}</span>
                         <span className="text-blue-500 font-black">Edit Profile →</span>
                      </div>
                   </div>
                ))}
                {supervisors.length === 0 && (
                   <div className="col-span-full py-32 text-center text-slate-300 font-black uppercase tracking-[0.2em] border-4 border-dashed rounded-[4rem]">No staff members currently enrolled</div>
                )}
             </div>
          </div>
        )}

        {activeSubTab === 'TAX' && (
          <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
             <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <h3 className="font-black text-black uppercase text-xs tracking-widest border-b pb-4">Tax Compliance</h3>
                <Input label="Property GSTIN" value={tempSettings.gstNumber || ''} onChange={v => handleUpdate('gstNumber', v)} />
                <div className="grid grid-cols-2 gap-8">
                   <Input label="Global GST Rate (%)" type="number" value={tempSettings.taxRate?.toString() || '12'} onChange={v => handleUpdate('taxRate', parseFloat(v))} />
                   <Input label="Master SAC Code" value={tempSettings.hsnCode || '9963'} onChange={v => handleUpdate('hsnCode', v)} />
                </div>
                <Input label="UPI ID for Payments" value={tempSettings.upiId || ''} onChange={v => handleUpdate('upiId', v)} />
             </section>
          </div>
        )}

        {activeSubTab === 'DATA' && (
          <div className="bg-white p-12 rounded-[3.5rem] border shadow-sm space-y-8 animate-in fade-in duration-500 backdrop-blur-md">
             <div className="flex items-center gap-6 border-b pb-8">
               <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl">💾</div>
               <h2 className="text-2xl font-black text-black uppercase tracking-tighter leading-none">Database Operations</h2>
             </div>
             <button onClick={exportDatabase} className="w-full bg-blue-900 text-white py-6 rounded-2xl font-black text-xs uppercase shadow-lg tracking-widest">Download Full JSON Backup</button>
          </div>
        )}
      </div>

      {/* STAFF ENROLLMENT MODAL */}
      {showStaffModal && editingStaff && (
         <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border-[12px] border-white">
               
               <div className="bg-[#1a2b4b] p-10 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner border border-white/5">👤</div>
                     <div>
                        <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{editingStaff.id ? 'Employee Record' : 'New Staff Intake'}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300 mt-2">Personnel Identity & Access Control</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setShowStaffModal(false)} className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-2xl font-black text-xs uppercase transition-all">Cancel</button>
                     <button onClick={handleStaffSave} className="bg-[#e65c00] hover:bg-orange-500 px-10 py-3 rounded-2xl font-black text-xs uppercase shadow-2xl transition-all transform active:scale-95">Verify & Commit</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-10 md:p-14 bg-slate-50 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-14">
                     <div className="lg:col-span-7 space-y-12">
                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-8 border-2 border-slate-50">
                           <h4 className="text-lg font-black text-blue-900 uppercase tracking-tighter border-b pb-4">A. Identity & Access</h4>
                           <Inp label="Employee Full Legal Name *" value={editingStaff.name} onChange={(v: string) => setEditingStaff({...editingStaff, name: v})} placeholder="As per Govt ID" />
                           <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Module Permissions (Role)</label>
                                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}>
                                    <option value="RECEPTIONIST">Receptionist</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="WAITER">F&B Service / Waiter</option>
                                    <option value="CHEF">Kitchen / Chef</option>
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                 </select>
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Account Status</label>
                                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900" value={editingStaff.status} onChange={e => setEditingStaff({...editingStaff, status: e.target.value as any})}>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">DISABLED</option>
                                 </select>
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                              <Inp label="Login Identity (Username) *" value={editingStaff.loginId} onChange={(v: string) => setEditingStaff({...editingStaff, loginId: v})} placeholder="Staff login ID" />
                              <Inp label="Secret Access Key (Pass) *" type="password" value={editingStaff.password} onChange={(v: string) => setEditingStaff({...editingStaff, password: v})} placeholder="••••••••" />
                           </div>
                        </section>
                     </div>

                     <div className="lg:col-span-5 space-y-12">
                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-8 border-2 border-slate-50">
                           <h4 className="text-lg font-black text-emerald-600 uppercase tracking-tighter border-b pb-4">B. Financial Model</h4>
                           <div className="grid grid-cols-2 gap-6">
                              <Inp label="Monthly Basic Pay (₹)" type="number" value={editingStaff.basicPay?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, basicPay: parseFloat(v) || 0})} />
                              <Inp label="HRA Allowance (₹)" type="number" value={editingStaff.hra?.toString()} onChange={(v: string) => setEditingStaff({...editingStaff, hra: parseFloat(v) || 0})} />
                           </div>
                           <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-xl">
                              <span className="text-[10px] font-black uppercase text-slate-400">Monthly Gross CTC</span>
                              <span className="text-2xl font-black tracking-tighter">₹{((editingStaff.basicPay || 0) + (editingStaff.hra || 0) + (editingStaff.vehicleAllowance || 0) + (editingStaff.otherAllowances || 0)).toLocaleString()}</span>
                           </div>
                        </section>

                        <section className="bg-white p-10 rounded-[3.5rem] shadow-sm space-y-6 border-2 border-slate-50">
                           <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter border-b pb-4">C. Banking</h4>
                           <Inp label="A/C Number" value={editingStaff.accountNumber} onChange={(v: string) => setEditingStaff({...editingStaff, accountNumber: v})} placeholder="Bank account number" />
                           <Inp label="Bank & Branch" value={editingStaff.bankName} onChange={(v: string) => setEditingStaff({...editingStaff, bankName: v})} placeholder="e.g. SBI Main" />
                        </section>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const MasterBox = ({ title, children }: any) => (
   <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6 h-full flex flex-col">
      <h3 className="font-black text-[#1a2b4b] uppercase text-[11px] tracking-widest border-b pb-4">{title}</h3>
      {children}
   </section>
);

const DocCard = ({ title, path, desc }: any) => (
   <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] hover:bg-white/10 transition-all group">
      <p className="text-[9px] font-black uppercase text-orange-500 tracking-widest mb-1">{title}</p>
      <div className="font-mono text-[10px] text-blue-300 bg-black/30 p-2 rounded-lg mb-4">{path}</div>
      <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>
   </div>
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

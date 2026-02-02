import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { BanquetHall, EventBooking, EventType, Guest, CateringItem, EventCatering, CateringIngredient, Transaction, Booking, Room, Charge } from '../types';

interface BanquetModuleProps {
  settings: any;
  guests: Guest[];
  rooms: Room[];
  roomBookings: Booking[];
  onUpdateBooking?: (updated: Booking) => void;
}

const BanquetModule: React.FC<BanquetModuleProps> = ({ settings, guests, rooms, roomBookings, onUpdateBooking }) => {
  const [activeSubTab, setActiveSubTab] = useState<'SCHEDULER' | 'MASTER' | 'CATERING'>('SCHEDULER');
  const [halls, setHalls] = useState<BanquetHall[]>([]);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [cateringMenu, setCateringMenu] = useState<CateringItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedHall, setSelectedHall] = useState<BanquetHall | null>(null);
  const [activeBooking, setActiveBooking] = useState<EventBooking | null>(null);

  // Modal / Form States
  const [editingFoodItem, setEditingFoodItem] = useState<Partial<CateringItem> | null>(null);
  const [paxProjection, setPaxProjection] = useState(100);
  const [showBOM, setShowBOM] = useState<CateringItem | null>(null);
  const [newVenue, setNewVenue] = useState<Partial<BanquetHall>>({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });

  // Settlement Linkage
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [targetRoomBookingId, setTargetRoomBookingId] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const [formData, setFormData] = useState<Partial<EventBooking>>({
    guestName: '', guestPhone: '', eventName: '', eventType: 'Birthday', 
    date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '18:00',
    totalAmount: 0, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE',
    guestCount: 100, decorationCharge: 0, lightingCharge: 0, musicCharge: 0, otherCharges: 0,
    catering: { items: [], plateCount: 0, totalCateringCharge: 0 }
  });

  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      let h = await db.banquetHalls.toArray();
      if (h.length === 0) {
        const defaultHall: BanquetHall = { id: 'hall-001', name: 'Grand Ballroom', capacity: 500, basePrice: 25000, type: 'HALL' };
        await db.banquetHalls.put(defaultHall);
        h = [defaultHall];
      }
      setHalls(h);
      setBookings(await db.eventBookings.toArray());
      
      let cm = await db.cateringMenu.toArray();
      if (cm.length === 0) {
        const defaults: CateringItem[] = [
          { id: 'f1', name: 'Continental Breakfast', category: 'Breakfast', pricePerPlate: 350, ingredients: [{ name: 'Bread', qtyPerPlate: 0.1, unit: 'pkts', unitCost: 40 }, { name: 'Eggs', qtyPerPlate: 2, unit: 'pcs', unitCost: 6 }, { name: 'Butter', qtyPerPlate: 0.02, unit: 'kg', unitCost: 550 }] },
          { id: 'f2', name: 'Standard Thali', category: 'Lunch', pricePerPlate: 450, ingredients: [{ name: 'Rice', qtyPerPlate: 0.15, unit: 'kg', unitCost: 60 }, { name: 'Dal', qtyPerPlate: 0.1, unit: 'kg', unitCost: 140 }, { name: 'Paneer', qtyPerPlate: 0.1, unit: 'kg', unitCost: 420 }] },
          { id: 'f3', name: 'Royal Dinner Buffet', category: 'Dinner', pricePerPlate: 850, ingredients: [{ name: 'Chicken', qtyPerPlate: 0.2, unit: 'kg', unitCost: 240 }, { name: 'Paneer', qtyPerPlate: 0.1, unit: 'kg', unitCost: 420 }, { name: 'Basmati Rice', qtyPerPlate: 0.15, unit: 'kg', unitCost: 110 }] },
        ];
        await db.cateringMenu.bulkPut(defaults);
        cm = defaults;
      }
      setCateringMenu(cm);
    };
    init();
  }, []);

  const calculateCateringTotal = () => {
    const selected = cateringMenu.filter(m => selectedFoodIds.includes(m.id));
    const priceSum = selected.reduce((s, i) => s + i.pricePerPlate, 0);
    return priceSum * (formData.guestCount || 0);
  };

  const getNetTotal = () => {
    const venue = formData.totalAmount || 0;
    const cater = calculateCateringTotal();
    const deco = formData.decorationCharge || 0;
    const light = formData.lightingCharge || 0;
    const music = formData.musicCharge || 0;
    const other = formData.otherCharges || 0;
    const disc = formData.discount || 0;
    return venue + cater + deco + light + music + other - disc;
  };

  const handleSaveVenue = async () => {
    if (!newVenue.name) return;
    const v: BanquetHall = { ...newVenue, id: `VEN-${Date.now()}` } as BanquetHall;
    await db.banquetHalls.put(v);
    setHalls([...halls, v]);
    setNewVenue({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });
  };

  const handleSaveFoodItem = async () => {
    if (!editingFoodItem?.name || !editingFoodItem?.pricePerPlate) return;
    const f: CateringItem = { ...editingFoodItem, id: editingFoodItem.id || `FOOD-${Date.now()}` } as CateringItem;
    await db.cateringMenu.put(f);
    setCateringMenu(await db.cateringMenu.toArray());
    setEditingFoodItem(null);
  };

  const addIngredientToEditing = () => {
    if (!editingFoodItem) return;
    const current = editingFoodItem.ingredients || [];
    setEditingFoodItem({
       ...editingFoodItem,
       ingredients: [...current, { name: '', qtyPerPlate: 0, unit: 'kg', unitCost: 0 }]
    });
  };

  const removeIngredientFromEditing = (index: number) => {
     if (!editingFoodItem || !editingFoodItem.ingredients) return;
     const next = [...editingFoodItem.ingredients];
     next.splice(index, 1);
     setEditingFoodItem({ ...editingFoodItem, ingredients: next });
  };

  const updateIngredientInEditing = (index: number, field: keyof CateringIngredient, value: any) => {
    if (!editingFoodItem || !editingFoodItem.ingredients) return;
    const next = [...editingFoodItem.ingredients];
    next[index] = { ...next[index], [field]: value };
    setEditingFoodItem({ ...editingFoodItem, ingredients: next });
  };

  const calculateFoodCost = (item: Partial<CateringItem>) => {
     return (item.ingredients || []).reduce((acc, ing) => acc + (ing.qtyPerPlate * ing.unitCost), 0);
  };

  const deleteCateringItem = async (id: string) => {
    if (!confirm("Permanently delete this food item?")) return;
    await db.cateringMenu.delete(id);
    setCateringMenu(cateringMenu.filter(m => m.id !== id));
  };

  const handleSaveBooking = async () => {
    if (!formData.guestName || !formData.eventName) return alert("Missing Organizer or Event Title.");
    
    // Hall selection validation
    const hId = formData.hallId || selectedHall?.id;
    if (!hId) return alert("System Conflict: No hall assigned to this booking protocol.");

    const b: EventBooking = {
      ...formData,
      id: formData.id || `EVT-${Date.now()}`,
      hallId: hId,
      totalAmount: getNetTotal(),
      catering: {
        items: cateringMenu.filter(m => selectedFoodIds.includes(m.id)).map(m => ({ itemId: m.id, name: m.name, qty: formData.guestCount || 0, price: m.pricePerPlate })),
        plateCount: formData.guestCount || 0,
        totalCateringCharge: calculateCateringTotal()
      }
    } as EventBooking;

    await db.eventBookings.put(b);
    setBookings(await db.eventBookings.toArray());
    setShowForm(false);
    setSelectedHall(null);
    setSelectedFoodIds([]);
    setFormData({ guestName: '', guestPhone: '', eventName: '', eventType: 'Birthday', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '18:00', totalAmount: 0, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE', guestCount: 100, decorationCharge: 0, lightingCharge: 0, musicCharge: 0, otherCharges: 0 });
    alert(formData.id ? "Event Plan Updated." : "Event Authorized.");
  };

  const handleSettleBill = async () => {
    if (!activeBooking) return;
    const b = activeBooking;
    
    if (settlementMode === 'Mark to Room') {
      if (!targetRoomBookingId) return alert("Select a room folio.");
      const roomB = roomBookings.find(x => x.id === targetRoomBookingId);
      if (roomB) {
        const charge: Charge = { id: `CHG-BNQ-${Date.now()}`, description: `Banquet Event: ${b.eventName} (${b.date})`, amount: b.totalAmount, date: new Date().toISOString() };
        const updatedBooking = { ...roomB, charges: [...(roomB.charges || []), charge] };
        await db.bookings.put(updatedBooking);
        if (onUpdateBooking) onUpdateBooking(updatedBooking);
      }
    } else {
      const tx: Transaction = { id: `TX-BNQ-${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'RECEIPT', accountGroup: 'Direct Income', ledger: `${settlementMode} Account`, amount: b.totalAmount, entityName: b.guestName, description: `Banquet Settle: ${b.eventName}` };
      await db.transactions.put(tx);
    }

    const updated: EventBooking = { ...b, status: 'SETTLED' };
    await db.eventBookings.put(updated);
    setBookings(await db.eventBookings.toArray());
    setActiveBooking(null);
    setShowSettleModal(false);
    alert("Event Folio Settle Complete.");
  };

  const activeResidents = useMemo(() => {
    const active = roomBookings.filter(b => b.status === 'ACTIVE');
    if (!roomSearch) return active;
    const lower = roomSearch.toLowerCase();
    return active.filter(b => {
      const r = rooms.find(room => room.id === b.roomId);
      return r?.number.toLowerCase().includes(lower);
    });
  }, [roomBookings, rooms, roomSearch]);

  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-slate-50 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl shadow-orange-100/30 border border-white">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Venue Console</h2>
          <p className="text-[9px] md:text-[11px] font-bold text-orange-500 uppercase tracking-[0.4em] mt-2">Banquets, Parties & Mega Events</p>
        </div>
        <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100 mt-4 md:mt-0 no-print">
           <SubTab active={activeSubTab === 'SCHEDULER'} label="Schedule" onClick={() => setActiveSubTab('SCHEDULER')} />
           <SubTab active={activeSubTab === 'MASTER'} label="Venues" onClick={() => setActiveSubTab('MASTER')} />
           <SubTab active={activeSubTab === 'CATERING'} label="Catering Master" onClick={() => setActiveSubTab('CATERING')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'SCHEDULER' && (
           <div className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full">
              <div className="overflow-x-auto custom-scrollbar h-full">
                 <table className="w-full border-collapse table-fixed min-w-[1200px]">
                    <thead className="sticky top-0 z-20">
                       <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                          <th className="p-8 w-64 bg-slate-900 sticky left-0 z-30 border-r border-white/5 shadow-xl">Venue Master</th>
                          {days.map(d => (
                             <th key={d} className="p-4 border-r border-white/5 text-center bg-slate-800">
                                {new Date(d).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}
                             </th>
                          ))}
                       </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-700 uppercase bg-white">
                       {halls.map(hall => (
                          <tr key={hall.id} className="border-b h-36 hover:bg-slate-50 transition-colors">
                             <td className="p-8 bg-white sticky left-0 z-10 border-r shadow-md font-black text-orange-600 leading-tight">
                                {hall.name}
                                <div className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest font-extrabold">BASE: ₹{hall.basePrice}</div>
                             </td>
                             {days.map(day => {
                                const b = bookings.find(x => x.hallId === hall.id && x.date === day);
                                return (
                                   <td key={day} className="border-r p-2 relative group">
                                      {b ? (
                                         <div onClick={() => setActiveBooking(b)} className={`absolute inset-0 m-2 rounded-2xl p-4 border-l-4 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95 ${b.status === 'SETTLED' ? 'bg-orange-50 border-orange-600 text-orange-900' : 'bg-emerald-50 border-emerald-600 text-emerald-900'}`}>
                                            <p className="text-[10px] font-black truncate">{b.eventName}</p>
                                            <p className="text-[8px] opacity-60 mt-1 font-extrabold tracking-widest">{b.guestCount} PAX</p>
                                         </div>
                                      ) : (
                                         <button onClick={() => { setSelectedHall(hall); setFormData({ ...formData, date: day, totalAmount: hall.basePrice, hallId: hall.id }); setShowForm(true); }} className="w-full h-full opacity-0 group-hover:opacity-100 bg-orange-50/50 flex items-center justify-center text-orange-400 font-black text-3xl transition-all">+</button>
                                      )}
                                   </td>
                                );
                             })}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeSubTab === 'CATERING' && (
           <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black text-orange-900 uppercase tracking-tighter">Catering Recipe Master</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Plate Rates, Ingredients & Food Costing Analytics</p>
                 </div>
                 <button onClick={() => setEditingFoodItem({ name: '', category: 'Lunch', pricePerPlate: 0, ingredients: [] })} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add Recipe</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar flex-1 pb-10">
                 {cateringMenu.map(f => {
                    const foodCost = calculateFoodCost(f);
                    return (
                      <div key={f.id} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-orange-600 transition-all group">
                         <div>
                            <div className="flex justify-between items-start mb-4">
                               <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{f.category}</span>
                               <span className="text-[9px] font-black uppercase text-slate-300">{(f.ingredients || []).length} Ingredients</span>
                            </div>
                            <h4 className="text-xl font-black text-slate-800 uppercase leading-tight">{f.name}</h4>
                            
                            <div className="mt-6 space-y-2">
                               <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-400">
                                  <span>Selling Price</span>
                                  <span className="text-orange-600 font-black">₹{f.pricePerPlate}</span>
                               </div>
                               <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-400">
                                  <span>Food Cost (Raw)</span>
                                  <span className="text-blue-600 font-black">₹{foodCost.toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-400 border-t pt-2">
                                  <span>Gross Margin</span>
                                  <span className="text-emerald-600 font-black">₹{(f.pricePerPlate - foodCost).toFixed(2)}</span>
                               </div>
                            </div>
                         </div>
                         <div className="mt-8 pt-6 border-t flex gap-4">
                            <button onClick={() => setShowBOM(f)} className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-black uppercase text-[8px] shadow-md">BOM Calc</button>
                            <button onClick={() => setEditingFoodItem({...f})} className="flex-1 border-2 border-slate-100 py-3 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50">Edit</button>
                            <button onClick={() => deleteCateringItem(f.id)} className="text-red-400 font-black text-lg p-2">×</button>
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        )}

        {activeSubTab === 'MASTER' && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
              <div className="lg:col-span-1 bg-white border-2 border-slate-100 rounded-[3rem] p-10 shadow-sm space-y-6 h-fit text-slate-900">
                 <h3 className="font-black text-orange-900 uppercase text-xs border-b pb-4">Define Venue</h3>
                 <MenuInp label="Area Name" value={newVenue.name || ''} onChange={(v:any) => setNewVenue({...newVenue, name: v})} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none text-slate-900" value={newVenue.type} onChange={e => setNewVenue({...newVenue, type: e.target.value as any})}>
                       <option value="HALL">🏢 Hall</option>
                       <option value="LAWN">🌳 Lawn</option>
                    </select>
                 </div>
                 <MenuInp label="Daily Base Price" type="number" value={newVenue.basePrice?.toString()} onChange={(v:any) => setNewVenue({...newVenue, basePrice: parseFloat(v)})} />
                 <button onClick={handleSaveVenue} className="w-full bg-orange-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Register Venue</button>
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {halls.map(h => (
                    <div key={h.id} className="bg-white border-2 border-slate-50 p-10 rounded-[3rem] shadow-sm flex flex-col justify-between hover:border-orange-600 transition-all group text-slate-900">
                       <div className="flex justify-between items-start">
                          <h4 className="text-2xl font-black text-orange-900 uppercase tracking-tighter">{h.name}</h4>
                          <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{h.type}</span>
                       </div>
                       <p className="text-xl font-black text-slate-400 mt-10 uppercase tracking-tighter">Base Rate: <span className="text-slate-900">₹{h.basePrice}</span></p>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* EVENT BOOKING FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[95vh]">
              <div className="bg-blue-900 p-8 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Event Protocol Initiation</h3>
                    <p className="text-[10px] font-black uppercase text-blue-300 mt-1">Venue: {selectedHall?.name} • Schedule: {formData.date}</p>
                 </div>
                 <button onClick={() => setShowForm(false)} className="uppercase text-[10px] font-black opacity-60">Cancel</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white grid grid-cols-1 lg:grid-cols-3 gap-10">
                 <div className="lg:col-span-2 space-y-10">
                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-4 tracking-widest">1. Organizer & Concept</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Inp label="Event Host Name *" value={formData.guestName} onChange={(v:any) => setFormData({...formData, guestName: v})} />
                          <Inp label="WhatsApp / Phone *" value={formData.guestPhone} onChange={(v:any) => setFormData({...formData, guestPhone: v})} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Event Title *" value={formData.eventName} onChange={(v:any) => setFormData({...formData, eventName: v})} />
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Genre</label>
                             <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none text-slate-900" value={formData.eventType} onChange={e => setFormData({...formData, eventType: e.target.value as any})}>
                                <option value="Wedding">Wedding</option>
                                <option value="Corporate">Corporate</option>
                                <option value="Birthday">Birthday</option>
                                <option value="Other">Other Social</option>
                             </select>
                          </div>
                       </div>
                    </section>

                    <section className="space-y-6 text-slate-900">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-4 tracking-widest">2. Infrastructure Charges (₹)</h4>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <Inp label="Venue Base" type="number" value={formData.totalAmount?.toString()} onChange={(v:any) => setFormData({...formData, totalAmount: parseFloat(v)})} />
                          <Inp label="Decoration" type="number" value={formData.decorationCharge?.toString()} onChange={(v:any) => setFormData({...formData, decorationCharge: parseFloat(v)})} />
                          <Inp label="Lighting" type="number" value={formData.lightingCharge?.toString()} onChange={(v:any) => setFormData({...formData, lightingCharge: parseFloat(v)})} />
                          <Inp label="Music/DJ" type="number" value={formData.musicCharge?.toString()} onChange={(v:any) => setFormData({...formData, musicCharge: parseFloat(v)})} />
                       </div>
                    </section>

                    <section className="space-y-6 text-slate-900">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-4 tracking-widest">3. Catering Selection</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Expected Guest Count (PAX)" type="number" value={formData.guestCount?.toString()} onChange={(v:any) => setFormData({...formData, guestCount: parseInt(v) || 0})} />
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Menu Package</label>
                             <div className="flex flex-wrap gap-2 pt-2">
                                {cateringMenu.map(m => (
                                   <button 
                                      key={m.id} 
                                      type="button"
                                      onClick={() => setSelectedFoodIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${selectedFoodIds.includes(m.id) ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 border-white hover:border-orange-100'}`}
                                   >
                                      {m.name}
                                   </button>
                                ))}
                             </div>
                          </div>
                       </div>
                    </section>
                 </div>

                 <div className="space-y-8 bg-slate-50 p-8 rounded-[2.5rem] shadow-inner border border-slate-100 text-slate-900">
                    <h4 className="text-[10px] font-black uppercase text-blue-900 text-center tracking-[0.3em] mb-4">Financial Overview</h4>
                    <div className="space-y-4">
                       <BillLine label="Venue Infrastructure" value={`₹${formData.totalAmount}`} />
                       <BillLine label="Catering (Plate x PAX)" value={`₹${calculateCateringTotal()}`} />
                       <BillLine label="Decoration & Lights" value={`₹{(formData.decorationCharge || 0) + (formData.lightingCharge || 0)}`} />
                       <div className="h-px bg-slate-200"></div>
                       <Inp label="Special Discount (₹)" type="number" value={formData.discount?.toString()} onChange={(v:any) => setFormData({...formData, discount: parseFloat(v)})} />
                    </div>

                    <div className="bg-blue-900 p-8 rounded-[2rem] text-white text-center shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📑</div>
                       <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">Net Project Value</p>
                       <h3 className="text-4xl font-black tracking-tighter">₹{getNetTotal().toFixed(0)}</h3>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                       <Inp label="Advance Paid Now (₹)" type="number" value={formData.advancePaid?.toString()} onChange={(v:any) => setFormData({...formData, advancePaid: parseFloat(v)})} />
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Auth Status</label>
                          <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-white text-slate-900" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                             <option value="TENTATIVE">Tentative / Blocked</option>
                             <option value="CONFIRMED">Confirmed / Advance</option>
                          </select>
                       </div>
                    </div>

                    <button onClick={handleSaveBooking} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Authorize Event Plan ✅</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* ACTIVE BOOKING VIEW / SETTLE MODAL */}
      {activeBooking && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300">
               <div className="bg-emerald-600 p-10 text-white text-center">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{activeBooking.eventName}</h2>
                  <p className="text-[10px] font-bold uppercase opacity-80 mt-2">{activeBooking.guestName} • {activeBooking.date}</p>
               </div>
               <div className="p-10 space-y-8 text-slate-900">
                  <div className="grid grid-cols-2 gap-4">
                     <SummaryItem label="Project Value" value={`₹${activeBooking.totalAmount}`} color="text-blue-900" />
                     <SummaryItem label="Advance Rec" value={`₹${activeBooking.advancePaid}`} color="text-emerald-600" />
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Menu Detail</p>
                     {(activeBooking.catering?.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between text-[11px] font-bold uppercase">
                           <span>{it.name}</span>
                           <span>{it.qty} Plates</span>
                        </div>
                     ))}
                  </div>

                  {activeBooking.status !== 'SETTLED' && (
                     <div className="pt-6 border-t flex gap-4">
                        <button onClick={() => setShowSettleModal(true)} className="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">Process Settle</button>
                        <button onClick={() => { if(confirm('Cancel Event?')) db.eventBookings.delete(activeBooking!.id).then(() => { setBookings(bookings.filter(x => x.id !== activeBooking!.id)); setActiveBooking(null); }) }} className="flex-1 text-red-400 font-black uppercase text-[10px]">Cancel Project</button>
                     </div>
                  )}
                  <button onClick={() => setActiveBooking(null)} className="w-full py-4 text-slate-300 font-black uppercase text-[10px]">Close Console</button>
               </div>
            </div>
         </div>
      )}

      {/* SETTLE PROTOCOL MODAL */}
      {showSettleModal && activeBooking && (
         <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300">
               <div className="bg-blue-900 p-10 text-white text-center">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Event Settlement Node</h2>
                  <p className="text-[10px] font-black uppercase opacity-60 mt-2">Payable: ₹{activeBooking.totalAmount - activeBooking.advancePaid}</p>
               </div>
               <div className="p-12 space-y-8 text-slate-900">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Identify Resident (Optional)</label>
                     <div className="relative">
                        <input type="text" placeholder="Search Room Number..." className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 mb-3" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                        <select className="w-full border-2 p-4 rounded-2xl font-black text-xs text-slate-900" value={targetRoomBookingId} onChange={e => setTargetRoomBookingId(e.target.value)}>
                           <option value="">-- STANDALONE BILL --</option>
                           {activeResidents.map(b => (
                              <option key={b.id} value={b.id}>ROOM {rooms.find(r => r.id === b.roomId)?.number} - {guests.find(g => g.id === b.guestId)?.name}</option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Payment Node</label>
                     <div className="grid grid-cols-2 gap-2">
                        {['Cash', 'UPI', 'Card', 'Mark to Room'].map(mode => (
                           <button key={mode} onClick={() => setSettlementMode(mode)} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>{mode}</button>
                        ))}
                     </div>
                  </div>
                  <div className="pt-8 border-t flex gap-4 text-slate-900">
                     <button onClick={() => setShowSettleModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs">Cancel</button>
                     <button onClick={handleSettleBill} className="flex-[3] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-[1.02]">Execute Settle Protocol</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Other Modals (Recipe Builder, etc) omitted for brevity as they are unchanged */}
    </div>
  );
};

// Internal components
const SummaryItem = ({ label, value, color }: any) => (
   <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex flex-col justify-center items-center text-center">
      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black tracking-tighter ${color}`}>{value}</p>
   </div>
);

const BillLine = ({ label, value, isNegative }: any) => (
   <div className={`flex justify-between items-center text-[12px] font-black uppercase ${isNegative ? 'text-rose-500' : 'text-slate-800'}`}>
      <span>{label}</span>
      <span>{value}</span>
   </div>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-10 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shrink-0 ${active ? 'bg-orange-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-orange-900 hover:bg-white'}`}>{label}</button>
);

const MenuInp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-xl font-black text-[11px] bg-slate-50 outline-none focus:bg-white focus:border-orange-600 transition-all text-slate-900 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "", className = "" }: any) => (
  <div className={`space-y-1 w-full text-left ${className}`}>
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-orange-500 transition-all text-black shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default BanquetModule;

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
  const [showProjectionConsole, setShowProjectionConsole] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  // Settlement Linkage
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [targetRoomBookingId, setTargetRoomBookingId] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  // Modal / Form States
  const [editingFoodItem, setEditingFoodItem] = useState<Partial<CateringItem> | null>(null);
  const [paxProjection, setPaxProjection] = useState(100);
  const [showBOM, setShowBOM] = useState<CateringItem | null>(null);
  const [newVenue, setNewVenue] = useState<Partial<BanquetHall>>({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });

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
    
    const b: EventBooking = {
      ...formData,
      id: formData.id || `EVT-${Date.now()}`,
      hallId: formData.hallId || selectedHall!.id,
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
                                         <button onClick={() => { setSelectedHall(hall); setFormData({ ...formData, date: day, totalAmount: hall.basePrice }); setShowForm(true); }} className="w-full h-full opacity-0 group-hover:opacity-100 bg-orange-50/50 flex items-center justify-center text-orange-400 font-black text-3xl transition-all">+</button>
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
              <div className="lg:col-span-1 bg-white border-2 border-slate-100 rounded-[3rem] p-10 shadow-sm space-y-6 h-fit">
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

      {/* RECIPE BUILDER MODAL */}
      {editingFoodItem && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
              <div className="bg-orange-600 p-8 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-2xl font-black uppercase tracking-tighter">Recipe Blueprint Generator</h3>
                 <button onClick={() => setEditingFoodItem(null)} className="uppercase text-[10px] font-black opacity-60">Cancel</button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Inp label="Recipe Name" value={editingFoodItem.name || ''} onChange={(v:any) => setEditingFoodItem({...editingFoodItem, name: v})} />
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Meal Category</label>
                       <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingFoodItem.category} onChange={e => setEditingFoodItem({...editingFoodItem, category: e.target.value})}>
                          <option value="Breakfast">Breakfast</option>
                          <option value="Lunch">Lunch</option>
                          <option value="Dinner">Dinner</option>
                          <option value="Hi-Tea">Hi-Tea / Snacks</option>
                       </select>
                    </div>
                    <Inp label="Plate Selling Rate (₹)" type="number" value={editingFoodItem.pricePerPlate?.toString()} onChange={(v:any) => setEditingFoodItem({...editingFoodItem, pricePerPlate: parseFloat(v) || 0})} />
                 </div>

                 <div className="space-y-6">
                    <div className="flex justify-between items-end border-b pb-4">
                       <h4 className="text-xl font-black text-slate-900 uppercase">Ingredient Mapping (BOM)</h4>
                       <button onClick={addIngredientToEditing} className="bg-blue-900 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">+ Add Raw Material</button>
                    </div>
                    
                    <div className="border rounded-[2rem] overflow-hidden">
                       <table className="w-full text-left text-[11px] uppercase font-bold">
                          <thead className="bg-slate-900 text-white font-black text-[9px]">
                             <tr>
                                <th className="p-4">Ingredient Name</th>
                                <th className="p-4 w-24 text-center">Unit</th>
                                <th className="p-4 w-32 text-right">Qty / Plate</th>
                                <th className="p-4 w-32 text-right">Unit Rate (₹)</th>
                                <th className="p-4 w-32 text-right">Cost Contrib.</th>
                                <th className="p-4 w-12 text-center"></th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                             {(editingFoodItem.ingredients || []).map((ing, idx) => (
                                <tr key={idx}>
                                   <td className="p-3">
                                      <input className="w-full bg-slate-50 p-2 rounded-lg outline-none focus:bg-white" value={ing.name} onChange={e => updateIngredientInEditing(idx, 'name', e.target.value)} placeholder="e.g. Basmati Rice" />
                                   </td>
                                   <td className="p-3">
                                      <input className="w-full bg-slate-50 p-2 rounded-lg text-center outline-none" value={ing.unit} onChange={e => updateIngredientInEditing(idx, 'unit', e.target.value)} placeholder="kg" />
                                   </td>
                                   <td className="p-3">
                                      <input type="number" className="w-full bg-slate-50 p-2 rounded-lg text-right outline-none" value={ing.qtyPerPlate} onChange={e => updateIngredientInEditing(idx, 'qtyPerPlate', parseFloat(e.target.value) || 0)} />
                                   </td>
                                   <td className="p-3">
                                      <input type="number" className="w-full bg-slate-50 p-2 rounded-lg text-right outline-none" value={ing.unitCost} onChange={e => updateIngredientInEditing(idx, 'unitCost', parseFloat(e.target.value) || 0)} />
                                   </td>
                                   <td className="p-3 text-right font-black text-blue-900">₹{(ing.qtyPerPlate * ing.unitCost).toFixed(2)}</td>
                                   <td className="p-3 text-center">
                                      <button onClick={() => removeIngredientFromEditing(idx)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                   </td>
                                </tr>
                             ))}
                             {(!editingFoodItem.ingredients || editingFoodItem.ingredients.length === 0) && (
                                <tr><td colSpan={6} className="p-10 text-center opacity-20 italic">No ingredients mapped yet.</td></tr>
                             )}
                          </tbody>
                          <tfoot className="bg-orange-50 font-black">
                             <tr>
                                <td colSpan={4} className="p-4 text-right text-orange-900">Calculated Food Cost / Plate:</td>
                                <td className="p-4 text-right text-orange-600 text-lg">₹{calculateFoodCost(editingFoodItem).toFixed(2)}</td>
                                <td></td>
                             </tr>
                          </tfoot>
                       </table>
                    </div>
                 </div>
              </div>
              <div className="p-8 border-t flex gap-4 bg-slate-50">
                 <button onClick={() => setEditingFoodItem(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs">Discard</button>
                 <button onClick={handleSaveFoodItem} className="flex-[3] bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-[1.02] transition-all">Authorize Recipe & Rate ✅</button>
              </div>
           </div>
        </div>
      )}

      {/* BOM CALCULATOR / PROJECTOR MODAL */}
      {showBOM && (
         <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border-[10px] border-white">
               <div className="bg-blue-900 p-10 text-white flex justify-between items-center">
                  <div>
                     <h3 className="text-3xl font-black uppercase tracking-tighter">Raw Material Requirement Projector</h3>
                     <p className="text-[10px] font-black uppercase text-blue-300 mt-2">BOM Logic for: {showBOM.name}</p>
                  </div>
                  <button onClick={() => setShowBOM(null)} className="uppercase text-[10px] font-black opacity-60">Close</button>
               </div>
               <div className="p-12 space-y-12 overflow-y-auto custom-scrollbar flex-1">
                  <div className="bg-blue-50 p-10 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-8 shadow-inner border border-blue-100">
                     <div className="space-y-1 text-center md:text-left">
                        <label className="text-[10px] font-black uppercase text-blue-900 tracking-widest ml-1">Input Target Guests (PAX)</label>
                        <input 
                           type="number" 
                           className="bg-transparent text-6xl font-black text-blue-900 border-b-4 border-blue-200 outline-none w-48 text-center md:text-left" 
                           value={paxProjection} 
                           onChange={e => setPaxProjection(parseInt(e.target.value) || 0)} 
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-10 text-right">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue Forecast</p>
                           <p className="text-3xl font-black text-orange-600 tracking-tighter">₹{(showBOM.pricePerPlate * paxProjection).toFixed(0)}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Material Cost</p>
                           <p className="text-3xl font-black text-blue-900 tracking-tighter">₹{(calculateFoodCost(showBOM) * paxProjection).toFixed(0)}</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">Consolidated Procurement List (Requirement)</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(showBOM.ingredients || []).map((ing, i) => (
                           <div key={i} className="p-6 bg-slate-50 border rounded-[2rem] flex justify-between items-center hover:border-blue-600 transition-all group">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-lg font-black text-blue-900">{i+1}</div>
                                 <div>
                                    <p className="text-[12px] font-black text-slate-800 uppercase leading-none">{ing.name}</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{ing.qtyPerPlate} {ing.unit} per plate</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-xl font-black text-blue-900">{(ing.qtyPerPlate * paxProjection).toFixed(2)} <span className="text-[9px] text-slate-400 font-bold uppercase">{ing.unit}</span></p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Est ₹{(ing.qtyPerPlate * paxProjection * ing.unitCost).toFixed(0)}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="p-8 border-t flex justify-center bg-slate-50">
                  <button onClick={() => window.print()} className="bg-slate-900 text-white px-14 py-4 rounded-2xl font-black uppercase text-xs shadow-xl tracking-widest hover:bg-black transition-all">Download Shopping List PDF 📄</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

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

const InpWhite = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 text-white">
    <label className="text-[10px] font-black uppercase opacity-60 ml-2 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 border-white/20 p-4 rounded-2xl font-black text-xs bg-white/10 text-white outline-none focus:bg-white/20 shadow-inner" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export default BanquetModule;


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

  // Settlement Linkage
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [targetRoomBookingId, setTargetRoomBookingId] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  // Modal / Form States
  const [editingFoodItem, setEditingFoodItem] = useState<Partial<CateringItem> | null>(null);
  const [projectionCount, setProjectionCount] = useState(100);
  const [newVenue, setNewVenue] = useState<Partial<BanquetHall>>({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });

  const [formData, setFormData] = useState<Partial<EventBooking>>({
    guestName: '', guestPhone: '', eventName: '', eventType: 'Corporate', 
    date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '18:00',
    totalAmount: 0, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE',
    guestCount: 100, catering: { items: [], plateCount: 0, totalCateringCharge: 0 }
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
          { id: 'f1', name: 'Continental Breakfast', category: 'Breakfast', pricePerPlate: 350, ingredients: [{ name: 'Bread', qtyPerPlate: 2, unit: 'slices' }, { name: 'Eggs', qtyPerPlate: 1, unit: 'unit' }] },
          { id: 'f2', name: 'Standard Thali', category: 'Lunch', pricePerPlate: 450, ingredients: [{ name: 'Rice', qtyPerPlate: 150, unit: 'grams' }, { name: 'Dal', qtyPerPlate: 100, unit: 'ml' }] },
          { id: 'f3', name: 'Royal Dinner Buffet', category: 'Dinner', pricePerPlate: 850, ingredients: [{ name: 'Chicken', qtyPerPlate: 200, unit: 'grams' }, { name: 'Paneer', qtyPerPlate: 100, unit: 'grams' }] },
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

  const handleSaveVenue = async () => {
    if (!newVenue.name) return;
    const v: BanquetHall = { ...newVenue, id: `VEN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` } as BanquetHall;
    await db.banquetHalls.put(v);
    setHalls([...halls, v]);
    setNewVenue({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });
  };

  const handleSaveFoodItem = async () => {
    if (!editingFoodItem?.name || !editingFoodItem?.pricePerPlate) return;
    const f: CateringItem = { 
      ...editingFoodItem, 
      id: editingFoodItem.id || `FOOD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` 
    } as CateringItem;
    await db.cateringMenu.put(f);
    setCateringMenu(await db.cateringMenu.toArray());
    setEditingFoodItem(null);
    alert("Menu Recipe Updated.");
  };

  // Added deleteCateringItem function to fix reference error
  const deleteCateringItem = async (id: string) => {
    if (!confirm("Permanently delete this food item?")) return;
    await db.cateringMenu.delete(id);
    setCateringMenu(cateringMenu.filter(m => m.id !== id));
  };

  const handleSaveBooking = async () => {
    if (!formData.guestName || !formData.eventName) return alert("Missing Organizer or Event Title.");
    
    const cateringCharge = calculateCateringTotal();
    const venuePrice = formData.totalAmount || 0;
    const finalTotal = venuePrice + cateringCharge;

    const b: EventBooking = {
      ...formData,
      id: formData.id || `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      hallId: formData.hallId || selectedHall!.id,
      totalAmount: finalTotal,
      catering: {
        items: cateringMenu.filter(m => selectedFoodIds.includes(m.id)).map(m => ({ itemId: m.id, name: m.name, qty: formData.guestCount || 0, price: m.pricePerPlate })),
        plateCount: formData.guestCount || 0,
        totalCateringCharge: cateringCharge
      }
    } as EventBooking;

    await db.eventBookings.put(b);
    setBookings(await db.eventBookings.toArray());
    setShowForm(false);
    setSelectedHall(null);
    setSelectedFoodIds([]);
    setFormData({ guestName: '', guestPhone: '', eventName: '', eventType: 'Corporate', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '18:00', totalAmount: 0, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE', guestCount: 100 });
    alert(formData.id ? "Event Plan Updated." : "Event Authorized.");
  };

  const handleEditExistingBooking = (b: EventBooking) => {
    setFormData({ ...b });
    setSelectedHall(halls.find(h => h.id === b.hallId) || null);
    setSelectedFoodIds(b.catering?.items.map(i => i.itemId) || []);
    setShowForm(true);
    setActiveBooking(null);
  };

  const handleSettleBill = async () => {
    if (!activeBooking) return;
    const b = activeBooking;
    
    if (settlementMode === 'Mark to Room') {
      if (!targetRoomBookingId) return alert("Select a room folio.");
      const roomB = roomBookings.find(x => x.id === targetRoomBookingId);
      if (roomB) {
        const charge: Charge = {
          id: `CHG-BNQ-${Date.now()}`,
          description: `Banquet Event: ${b.eventName} (${b.date})`,
          amount: b.totalAmount,
          date: new Date().toISOString()
        };
        const updatedBooking = { ...roomB, charges: [...(roomB.charges || []), charge] };
        await db.bookings.put(updatedBooking);
        if (onUpdateBooking) onUpdateBooking(updatedBooking);
      }
    } else {
      const tx: Transaction = {
        id: `TX-BNQ-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'RECEIPT',
        accountGroup: 'Direct Income',
        ledger: `${settlementMode} Account`,
        amount: b.totalAmount,
        entityName: b.guestName,
        description: `Banquet Settle: ${b.eventName}`
      };
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

  const aggregatedPrepStats = useMemo(() => {
    if (!editingFoodItem?.ingredients) return [];
    return editingFoodItem.ingredients.map(ing => ({
      name: ing.name,
      totalQty: (ing.qtyPerPlate || 0) * projectionCount,
      unit: ing.unit
    }));
  }, [editingFoodItem, projectionCount]);

  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-[#f8fafc] animate-in fade-in duration-700">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">Venues & Banquets</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Halls, Lawns & Scale Catering Prep</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl no-print">
           <SubTab active={activeSubTab === 'SCHEDULER'} label="Schedule" onClick={() => setActiveSubTab('SCHEDULER')} />
           <SubTab active={activeSubTab === 'MASTER'} label="Venues" onClick={() => setActiveSubTab('MASTER')} />
           <SubTab active={activeSubTab === 'CATERING'} label="Catering Master" onClick={() => setActiveSubTab('CATERING')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'SCHEDULER' && (
           <div className="bg-white border-2 rounded-[3.5rem] shadow-sm overflow-hidden flex flex-col h-full">
              <div className="overflow-x-auto custom-scrollbar h-full">
                 <table className="w-full border-collapse table-fixed min-w-[1200px]">
                    <thead className="sticky top-0 z-20">
                       <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                          <th className="p-6 w-56 bg-slate-900 sticky left-0 z-30 border-r border-white/5">Venue</th>
                          {days.map(d => (
                             <th key={d} className="p-4 border-r border-white/5 text-center bg-slate-800">
                                {new Date(d).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}
                             </th>
                          ))}
                       </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-700 uppercase bg-white">
                       {halls.map(hall => (
                          <tr key={hall.id} className="border-b h-32 hover:bg-slate-50 transition-colors">
                             <td className="p-6 bg-white sticky left-0 z-10 border-r shadow-sm font-black text-blue-900 leading-tight">
                                {hall.name}
                                <div className="text-[8px] text-slate-400 mt-1 uppercase tracking-widest">Rate: ₹{hall.basePrice}</div>
                             </td>
                             {days.map(day => {
                                const b = bookings.find(x => x.hallId === hall.id && x.date === day);
                                return (
                                   <td key={day} className="border-r p-2 relative group">
                                      {b ? (
                                         <div onClick={() => setActiveBooking(b)} className={`absolute inset-0 m-1.5 rounded-2xl p-3 border-l-4 shadow-md cursor-pointer transition-all hover:scale-105 ${b.status === 'SETTLED' ? 'bg-blue-50 border-blue-600 text-blue-900' : 'bg-green-50 border-green-600 text-green-900'}`}>
                                            <p className="text-[9px] font-black truncate">{b.eventName}</p>
                                            <p className="text-[7px] opacity-60 mt-0.5">{b.guestCount} PAX</p>
                                            {b.catering && <span className="text-[6px] bg-blue-600 text-white px-1.5 py-0.5 rounded-md mt-1 inline-block uppercase">Food Plan: ON</span>}
                                         </div>
                                      ) : (
                                         <button onClick={() => { setSelectedHall(hall); setFormData({ guestName: '', guestPhone: '', eventName: '', eventType: 'Corporate', date: day, startTime: '10:00', endTime: '18:00', totalAmount: hall.basePrice, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE', guestCount: 100 }); setShowForm(true); }} className="w-full h-full opacity-0 group-hover:opacity-100 bg-blue-50/40 flex items-center justify-center text-blue-400 font-black text-2xl transition-all">+</button>
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

        {activeSubTab === 'MASTER' && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
              <div className="lg:col-span-1 bg-white border-2 rounded-[3rem] p-10 shadow-sm space-y-6 h-fit">
                 <h3 className="font-black text-blue-900 uppercase text-xs border-b pb-4">Define Venue</h3>
                 <MenuInp label="Area Name" value={newVenue.name || ''} onChange={(v:any) => setNewVenue({...newVenue, name: v})} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none text-slate-900" value={newVenue.type} onChange={e => setNewVenue({...newVenue, type: e.target.value as any})}>
                       <option value="HALL">🏢 Hall</option>
                       <option value="LAWN">🌳 Lawn</option>
                    </select>
                 </div>
                 <MenuInp label="Daily Base Price" type="number" value={newVenue.basePrice?.toString()} onChange={(v:any) => setNewVenue({...newVenue, basePrice: parseFloat(v)})} />
                 <button onClick={handleSaveVenue} className="w-full bg-blue-900 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Register Venue</button>
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {halls.map(h => (
                    <div key={h.id} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-blue-600 transition-all group text-slate-900">
                       <div className="flex justify-between items-start">
                          <h4 className="text-xl font-black text-blue-900 uppercase leading-tight">{h.name}</h4>
                          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{h.type}</span>
                       </div>
                       <p className="text-lg font-black text-slate-400 mt-6 uppercase">₹{h.basePrice} <span className="text-[10px] tracking-widest font-bold">/ Session</span></p>
                       <button onClick={async () => { if(confirm("Remove venue?")) { await db.banquetHalls.delete(h.id); setHalls(halls.filter(x => x.id !== h.id)); } }} className="mt-8 text-red-300 font-black uppercase text-[9px] text-left opacity-0 group-hover:opacity-100">Delete Venue</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeSubTab === 'CATERING' && (
           <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 flex justify-between items-center shadow-sm">
                 <div>
                    <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Food Production Registry</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage Menu Items, Costs & Preparations</p>
                 </div>
                 <button onClick={() => { setEditingFoodItem({ name: '', category: 'Lunch', pricePerPlate: 0, ingredients: [] }); }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add To Menu Box</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-10">
                 {cateringMenu.map(f => (
                    <div key={f.id} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-blue-600 transition-all group text-slate-900">
                       <div>
                          <div className="flex justify-between items-start mb-4">
                             <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{f.category}</span>
                             <div className="flex gap-2">
                                <button onClick={() => { setEditingFoodItem({...f}); setProjectionCount(100); setShowProjectionConsole(true); }} className="text-emerald-600 font-black text-[9px] uppercase hover:underline">Project PAX</button>
                                <button onClick={() => setEditingFoodItem({...f})} className="text-blue-500 font-black text-[9px] uppercase hover:underline">Edit</button>
                                <button onClick={() => deleteCateringItem(f.id)} className="text-red-400 font-black text-[9px] uppercase hover:underline">Del</button>
                             </div>
                          </div>
                          <h4 className="text-xl font-black text-slate-800 uppercase leading-tight">{f.name}</h4>
                          <p className="text-lg font-black text-blue-900 mt-4">₹{f.pricePerPlate} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">/ Plate</span></p>
                       </div>
                       <div className="mt-6 pt-6 border-t border-slate-50">
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-3">Preparation metrics</p>
                          <div className="flex flex-wrap gap-1.5">
                             {f.ingredients?.slice(0, 3).map((ing, i) => (
                                <span key={i} className="text-[7px] font-black uppercase px-2 py-1 bg-slate-100 rounded-md text-slate-500">{ing.name}</span>
                             ))}
                             {(f.ingredients?.length || 0) > 3 && <span className="text-[7px] font-black uppercase px-2 py-1 bg-blue-50 rounded-md text-blue-400">+{f.ingredients!.length - 3} More</span>}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* PROJECTION CONSOLE MODAL */}
      {showProjectionConsole && editingFoodItem && (
         <div className="fixed inset-0 z-[250] bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
               <div className="bg-emerald-600 p-10 text-white text-center">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Production Projection</h3>
                  <p className="text-[10px] font-black uppercase opacity-60 mt-1">{editingFoodItem.name}</p>
               </div>
               <div className="p-12 space-y-10">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Select Targeted Guest Count (PAX)</p>
                     <div className="flex justify-center gap-3">
                        {[100, 200, 500, 1000].map(cnt => (
                           <button 
                             key={cnt} 
                             onClick={() => setProjectionCount(cnt)}
                             className={`px-8 py-3 rounded-xl font-black text-xs transition-all border-2 ${projectionCount === cnt ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                           >
                              {cnt}
                           </button>
                        ))}
                        <input type="number" placeholder="Custom" className="w-24 border-2 p-3 rounded-xl text-center font-black text-slate-900" onChange={(e) => setProjectionCount(parseInt(e.target.value) || 1)} />
                     </div>
                  </div>

                  <div className="bg-slate-50 border rounded-[2rem] p-8 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                     <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Calculated Raw Requirements for {projectionCount} PAX</h4>
                     {aggregatedPrepStats.length > 0 ? (
                        <div className="divide-y text-slate-900">
                           {aggregatedPrepStats.map((ing, i) => (
                              <div key={i} className="flex justify-between py-4">
                                 <span className="text-xs font-black uppercase text-slate-700">{ing.name}</span>
                                 <span className="text-sm font-black text-emerald-700">
                                    {ing.totalQty >= 1000 && (ing.unit === 'grams' || ing.unit === 'ml') 
                                       ? `${(ing.totalQty/1000).toFixed(2)} ${ing.unit === 'grams' ? 'KG' : 'LTR'}` 
                                       : `${ing.totalQty} ${ing.unit}`}
                                 </span>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <p className="text-center py-10 text-slate-300 font-bold uppercase text-[9px]">No ingredients defined.</p>
                     )}
                  </div>
                  <button onClick={() => { setShowProjectionConsole(false); setEditingFoodItem(null); }} className="w-full py-5 text-slate-400 font-black uppercase text-xs hover:text-slate-900 border-t">Close Projection</button>
               </div>
            </div>
         </div>
      )}

      {/* Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#f1f5f9] w-full max-w-6xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 max-h-[92vh] flex flex-col border-8 border-white">
             <div className="bg-blue-900 p-10 text-white flex justify-between items-center shrink-0">
                <div>
                   <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{formData.id ? 'Modify Event Plan' : 'Event Master Intake'}</h3>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mt-2">Venue Deployment & Catering Planner</p>
                </div>
                <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-all font-black text-[10px] uppercase">Discard</button>
             </div>
             <div className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-4 space-y-8">
                      <div className="p-8 bg-white rounded-[3rem] shadow-sm space-y-6">
                         <h4 className="text-[10px] font-black uppercase text-blue-900 tracking-widest border-b pb-4">A. Organizer Master Data</h4>
                         <Inp label="Client / Guest Name *" value={formData.guestName} onChange={(v:any) => setFormData({...formData, guestName: v})} />
                         <Inp label="Phone Number" value={formData.guestPhone} onChange={(v:any) => setFormData({...formData, guestPhone: v})} />
                         <Inp label="Event Occasion Title *" value={formData.eventName} onChange={(v:any) => setFormData({...formData, eventName: v})} placeholder="e.g. Wedding Reception" />
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">PAX (Guests) *</label>
                              <input type="number" className="w-full border-2 p-4 rounded-2xl font-black text-xl bg-blue-50 text-blue-900 focus:bg-white transition-all outline-none" value={formData.guestCount} onChange={(e:any) => setFormData({...formData, guestCount: parseInt(e.target.value) || 0})} />
                           </div>
                           <Inp label="Venue Rate (₹)" type="number" value={formData.totalAmount?.toString()} onChange={(v:any) => setFormData({...formData, totalAmount: parseFloat(v) || 0})} />
                         </div>
                      </div>
                   </div>

                   <div className="lg:col-span-8 space-y-8">
                      <div className="p-8 bg-white rounded-[3rem] shadow-sm flex flex-col min-h-[400px]">
                         <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h4 className="text-[10px] font-black uppercase text-blue-900 tracking-widest">B. Menu Selection Box</h4>
                            <div className="flex gap-2">
                               <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-[9px] uppercase">{selectedFoodIds.length} Selected</span>
                               <button onClick={() => setSelectedFoodIds([])} className="text-slate-300 font-black text-[9px] uppercase hover:text-red-500">Clear</button>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
                            {cateringMenu.map(m => (
                               <button 
                                 key={m.id} 
                                 onClick={() => setSelectedFoodIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                 className={`p-5 rounded-2xl border-2 transition-all text-left flex flex-col justify-between group ${selectedFoodIds.includes(m.id) ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-white text-slate-700 hover:border-blue-200'}`}
                               >
                                  <div>
                                     <p className={`text-[12px] font-black uppercase leading-tight ${selectedFoodIds.includes(m.id) ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
                                     <p className={`text-[8px] font-bold uppercase mt-1 ${selectedFoodIds.includes(m.id) ? 'text-blue-200' : 'text-slate-400'}`}>{m.category}</p>
                                  </div>
                                  <p className={`text-base font-black mt-4 ${selectedFoodIds.includes(m.id) ? 'text-white' : 'text-blue-900'}`}>₹{m.pricePerPlate}</p>
                               </button>
                            ))}
                         </div>
                      </div>

                      <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                         <div className="flex gap-10">
                            <div>
                               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Venue Cost</p>
                               <p className="text-2xl font-black">₹{(formData.totalAmount || 0).toFixed(2)}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Catering Net</p>
                               <p className="text-2xl font-black">₹{calculateCateringTotal().toFixed(2)}</p>
                            </div>
                         </div>
                         <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0 md:pl-10">
                            <p className="text-[11px] font-black uppercase text-white/50 mb-1">Total Authorization</p>
                            <p className="text-5xl font-black tracking-tighter text-blue-400">₹{((formData.totalAmount || 0) + calculateCateringTotal()).toFixed(2)}</p>
                            <button onClick={handleSaveBooking} className="mt-8 bg-blue-600 text-white px-14 py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl hover:scale-105 active:scale-95 transition-all">
                               {formData.id ? 'Apply Modifications' : 'Authorize Event Plan'}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Editing Food Item Modal */}
      {editingFoodItem && !showProjectionConsole && (
         <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
               <div className="bg-blue-900 p-8 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{editingFoodItem.id ? 'Edit Menu Item' : 'New Menu Item'}</h3>
                  <button onClick={() => setEditingFoodItem(null)} className="uppercase text-[10px] font-black opacity-60">Cancel</button>
               </div>
               <div className="p-10 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-slate-900">
                  <Inp label="Dish Name" value={editingFoodItem.name} onChange={(v:any) => setEditingFoodItem({...editingFoodItem, name: v})} />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                        <select className="w-full border-2 p-3.5 rounded-2xl font-black text-xs bg-slate-50 outline-none text-slate-900" value={editingFoodItem.category} onChange={e => setEditingFoodItem({...editingFoodItem, category: e.target.value as any})}>
                           <option value="Breakfast">Breakfast</option>
                           <option value="Lunch">Lunch</option>
                           <option value="Dinner">Dinner</option>
                           <option value="Snacks">Snacks</option>
                           <option value="Beverage">Beverage</option>
                        </select>
                     </div>
                     <Inp label="Plate Price" type="number" value={editingFoodItem.pricePerPlate?.toString()} onChange={(v:any) => setEditingFoodItem({...editingFoodItem, pricePerPlate: parseFloat(v) || 0})} />
                  </div>
                  
                  <div className="space-y-4 border-t pt-4">
                     <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Ingredients (Recipie Logic)</p>
                        <button onClick={() => setEditingFoodItem({...editingFoodItem, ingredients: [...(editingFoodItem.ingredients || []), { name: '', qtyPerPlate: 0, unit: 'grams' }]})} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-black text-[9px] uppercase border">+ Add Ingredient</button>
                     </div>
                     <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {editingFoodItem.ingredients?.map((ing, i) => (
                           <div key={i} className="flex gap-2 animate-in slide-in-from-top-1">
                              <input className="flex-1 border-2 p-2 rounded-xl text-[10px] font-bold text-slate-900 bg-slate-50" placeholder="e.g. Rice" value={ing.name} onChange={e => {
                                 const updated = [...editingFoodItem.ingredients!];
                                 updated[i].name = e.target.value;
                                 setEditingFoodItem({...editingFoodItem, ingredients: updated});
                              }} />
                              <input type="number" className="w-16 border-2 p-2 rounded-xl text-[10px] font-bold text-slate-900 bg-slate-50" placeholder="Qty" value={ing.qtyPerPlate} onChange={e => {
                                 const updated = [...editingFoodItem.ingredients!];
                                 updated[i].qtyPerPlate = parseFloat(e.target.value) || 0;
                                 setEditingFoodItem({...editingFoodItem, ingredients: updated});
                              }} />
                              <select className="w-20 border-2 p-2 rounded-xl text-[9px] font-black text-slate-900 bg-slate-50" value={ing.unit} onChange={e => {
                                 const updated = [...editingFoodItem.ingredients!];
                                 updated[i].unit = e.target.value;
                                 setEditingFoodItem({...editingFoodItem, ingredients: updated});
                              }}>
                                 <option value="grams">Grams</option>
                                 <option value="ml">ML</option>
                                 <option value="unit">Unit</option>
                                 <option value="slices">Slice</option>
                              </select>
                              <button onClick={() => setEditingFoodItem({...editingFoodItem, ingredients: editingFoodItem.ingredients!.filter((_, idx) => idx !== i)})} className="text-red-500 font-bold px-2">×</button>
                           </div>
                        ))}
                     </div>
                  </div>
                  
                  <button onClick={handleSaveFoodItem} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Commit to Master Registry</button>
               </div>
            </div>
         </div>
      )}

      {activeBooking && !showSettleModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border-8 border-slate-50">
             <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                <div>
                   <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{activeBooking.eventName}</h3>
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">{activeBooking.date} • {activeBooking.guestCount} PAX</p>
                </div>
                <button onClick={() => setActiveBooking(null)} className="text-[10px] font-black opacity-60">Close</button>
             </div>
             <div className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                   <div className="flex justify-between items-end border-b pb-6 mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Billing Amount</span>
                      <span className="text-4xl font-black text-blue-900 tracking-tighter">₹{(activeBooking.totalAmount || 0).toFixed(2)}</span>
                   </div>
                   {activeBooking.catering && (
                      <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 shadow-inner">
                         <div className="flex justify-between items-center border-b border-blue-100 pb-4 mb-4">
                            <p className="text-[11px] font-black text-blue-900 uppercase">Catering Detail Plan</p>
                            <button onClick={() => handleEditExistingBooking(activeBooking)} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">Modify Event</button>
                         </div>
                         {activeBooking.catering.items.map((it, i) => (
                            <div key={i} className="flex justify-between text-[12px] font-bold text-slate-700 mb-3 hover:text-blue-600 transition-colors">
                               <span className="uppercase">{it.name} (x{it.qty})</span>
                               <span className="font-black">₹{(it.price * it.qty).toFixed(2)}</span>
                            </div>
                         ))}
                         <div className="mt-6 pt-6 border-t border-blue-100 flex justify-between font-black text-blue-900 uppercase text-xs">
                            <span>Net Catering Sum</span>
                            <span>₹{activeBooking.catering.totalCateringCharge.toFixed(2)}</span>
                         </div>
                      </div>
                   )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => setShowSettleModal(true)} className="bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">Settle Folio</button>
                   <button onClick={() => setActiveBooking(null)} className="bg-slate-100 text-slate-400 py-5 rounded-[1.5rem] font-black uppercase text-[10px] hover:bg-slate-200 transition-all">Dismiss</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {showSettleModal && activeBooking && (
        <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-emerald-600 p-8 text-white text-center">
                 <h3 className="text-2xl font-black uppercase tracking-tighter">Event Settlement</h3>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-1">Value: ₹{(activeBooking.totalAmount || 0).toFixed(2)}</p>
              </div>
              <div className="p-10 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Payment Target</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Cash', 'UPI', 'Mark to Room'].map(mode => (
                          <button key={mode} onClick={() => setSettlementMode(mode)} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{mode}</button>
                       ))}
                    </div>
                 </div>

                 {settlementMode === 'Mark to Room' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                       <input type="text" placeholder="Find Resident Room..." className="w-full border-2 p-3 rounded-xl font-black text-xs bg-slate-50 outline-none focus:border-emerald-600 text-slate-900" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                       <div className="max-h-40 overflow-y-auto custom-scrollbar border rounded-xl p-1 space-y-1">
                          {activeResidents.map(b => (
                             <button key={b.id} onClick={() => setTargetRoomBookingId(b.id)} className={`w-full text-left p-3 rounded-lg flex justify-between items-center ${targetRoomBookingId === b.id ? 'bg-emerald-50 border-emerald-200 border text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                <span className="font-black">Room {rooms.find(r => r.id === b.roomId)?.number}</span>
                                <span className="text-[9px] font-bold">{guests.find(g => g.id === b.guestId)?.name}</span>
                             </button>
                          ))}
                       </div>
                    </div>
                 )}

                 <div className="flex gap-4">
                    <button onClick={() => setShowSettleModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Back</button>
                    <button onClick={handleSettleBill} className="flex-[2] bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg">Finalize Entry</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shrink-0 ${active ? 'bg-blue-900 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-blue-900 hover:bg-white'}`}>{label}</button>
);

const MenuInp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-xl font-black text-[11px] bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-all text-black shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default BanquetModule;

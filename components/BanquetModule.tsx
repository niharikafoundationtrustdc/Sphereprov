
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
  const [projectionCount, setProjectionCount] = useState(100);
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

  const shareBillWhatsApp = (b: EventBooking) => {
    const hallName = halls.find(h => h.id === b.hallId)?.name || 'Venue';
    const message = `*EVENT BILL SUMMARY - ${settings.name}*\n\n` +
      `*Event:* ${b.eventName}\n` +
      `*Venue:* ${hallName}\n` +
      `*Guest:* ${b.guestName}\n` +
      `*Date:* ${b.date}\n\n` +
      `*Breakdown:*\n` +
      `• Venue Base: ₹${b.totalAmount - (b.catering?.totalCateringCharge || 0) - b.decorationCharge - b.lightingCharge - b.musicCharge - b.otherCharges + b.discount}\n` +
      `• Catering: ₹${b.catering?.totalCateringCharge || 0}\n` +
      `• Decoration: ₹${b.decorationCharge}\n` +
      `• Lighting: ₹${b.lightingCharge}\n` +
      `• Music/DJ: ₹${b.musicCharge}\n` +
      `• Discount: -₹${b.discount}\n\n` +
      `*Total Final:* ₹${b.totalAmount.toFixed(2)}\n\n` +
      `Thank you for choosing ${settings.name}!`;
    window.open(`https://wa.me/${b.guestPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
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
           <SubTab active={activeSubTab === 'CATERING'} label="Catering" onClick={() => setActiveSubTab('CATERING')} />
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
                                            <div className="flex gap-1 mt-3">
                                               {b.catering && <span className="w-2 h-2 rounded-full bg-orange-600" title="Catering Included"></span>}
                                               {b.decorationCharge > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Decoration Included"></span>}
                                               {b.musicCharge > 0 && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Music/DJ Included"></span>}
                                            </div>
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

        {/* CATERING & MASTER tabs would follow similar Enterprise Orange styling */}
        {activeSubTab === 'CATERING' && (
           <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black text-orange-900 uppercase tracking-tighter">Event Food Library</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Plate Rates & Raw Production Metrics</p>
                 </div>
                 <button onClick={() => setEditingFoodItem({ name: '', category: 'Lunch', pricePerPlate: 0, ingredients: [] })} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add New Entry</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar flex-1 pb-10">
                 {cateringMenu.map(f => (
                    <div key={f.id} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-orange-600 transition-all group">
                       <div>
                          <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase mb-4 inline-block">{f.category}</span>
                          <h4 className="text-xl font-black text-slate-800 uppercase leading-tight">{f.name}</h4>
                          <p className="text-lg font-black text-orange-600 mt-4">₹{f.pricePerPlate} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">/ Plate</span></p>
                       </div>
                       <div className="mt-8 pt-6 border-t flex justify-between">
                          <button onClick={() => setEditingFoodItem({...f})} className="text-[10px] font-black uppercase text-blue-600 hover:underline">Edit Plan</button>
                          <button onClick={() => deleteCateringItem(f.id)} className="text-[10px] font-black uppercase text-red-400 hover:underline">Remove</button>
                       </div>
                    </div>
                 ))}
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

      {/* NEW EVENT FORM MODAL - UPDATED WITH PARTY PLANNING CHARGES */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-0 md:p-6">
          <div className="bg-[#f8fafc] w-full max-w-[1200px] h-full md:h-[95vh] rounded-none md:rounded-[4rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12 duration-500 flex flex-col border-4 md:border-[12px] border-white">
             <div className="bg-orange-600 p-8 md:p-12 text-white flex justify-between items-center shrink-0">
                <div>
                   <h3 className="text-2xl md:text-5xl font-black uppercase tracking-tighter leading-none">{formData.id ? 'Modify Event Plan' : 'Party Master Intake'}</h3>
                   <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] text-orange-100 mt-2 md:mt-4 opacity-90">Official Venue Deployment Console</p>
                </div>
                <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 p-4 md:p-6 rounded-3xl transition-all font-black text-xs md:text-sm uppercase tracking-widest">Discard</button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-14 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-4 space-y-8">
                      <section className="bg-white p-10 rounded-[3.5rem] border shadow-sm space-y-8">
                         <h4 className="text-[11px] font-black uppercase text-orange-600 tracking-widest border-b pb-4">Organizer Discovery</h4>
                         <Inp label="Organizer Name / Client *" value={formData.guestName} onChange={(v:any) => setFormData({...formData, guestName: v})} />
                         <Inp label="Mobile Contact *" value={formData.guestPhone} onChange={(v:any) => setFormData({...formData, guestPhone: v})} />
                         <Inp label="Occasion / Event Title *" value={formData.eventName} onChange={(v:any) => setFormData({...formData, eventName: v})} placeholder="e.g. Advik's 1st Birthday" />
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                               <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Guest Count (PAX) *</label>
                               <input type="number" className="w-full border-2 p-4 rounded-2xl font-black text-2xl bg-orange-50/50 text-orange-900 outline-none focus:bg-white focus:border-orange-500 transition-all shadow-inner" value={formData.guestCount} onChange={(e:any) => setFormData({...formData, guestCount: parseInt(e.target.value) || 0})} />
                            </div>
                            <Inp label="Venue Base Rate (₹)" type="number" value={formData.totalAmount?.toString()} onChange={(v:any) => setFormData({...formData, totalAmount: parseFloat(v) || 0})} />
                         </div>
                      </section>

                      <section className="bg-orange-900 p-10 rounded-[3.5rem] text-white space-y-8 shadow-2xl">
                         <h4 className="text-[11px] font-black uppercase text-orange-300 tracking-widest border-b border-white/10 pb-4">Party Add-ons (Billable)</h4>
                         <div className="grid grid-cols-2 gap-6">
                            <InpWhite label="Decoration Charge" type="number" value={formData.decorationCharge?.toString()} onChange={v => setFormData({...formData, decorationCharge: parseFloat(v) || 0})} />
                            <InpWhite label="Lighting Charge" type="number" value={formData.lightingCharge?.toString()} onChange={v => setFormData({...formData, lightingCharge: parseFloat(v) || 0})} />
                            <InpWhite label="Music / DJ / Sound" type="number" value={formData.musicCharge?.toString()} onChange={v => setFormData({...formData, musicCharge: parseFloat(v) || 0})} />
                            <InpWhite label="Other Misc." type="number" value={formData.otherCharges?.toString()} onChange={v => setFormData({...formData, otherCharges: parseFloat(v) || 0})} />
                         </div>
                      </section>
                   </div>

                   <div className="lg:col-span-8 flex flex-col gap-10">
                      <section className="bg-white p-10 rounded-[4rem] border shadow-sm flex-1 flex flex-col">
                         <div className="flex justify-between items-center mb-10 border-b pb-6">
                            <h4 className="text-xl font-black uppercase text-slate-900 tracking-tighter">Plate Planning (Catering)</h4>
                            <span className="bg-orange-100 text-orange-600 px-6 py-2 rounded-2xl font-black text-xs uppercase shadow-sm">{selectedFoodIds.length} Items Selected</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[450px] custom-scrollbar pr-2 pb-6">
                            {cateringMenu.map(m => (
                               <button 
                                 key={m.id} 
                                 onClick={() => setSelectedFoodIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                 className={`p-6 rounded-[2.5rem] border-2 transition-all text-left flex flex-col justify-between group ${selectedFoodIds.includes(m.id) ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-[1.03] z-10' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-orange-300'}`}
                               >
                                  <div>
                                     <p className="text-[13px] font-extrabold uppercase leading-tight">{m.name}</p>
                                     <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${selectedFoodIds.includes(m.id) ? 'text-orange-200' : 'text-slate-400'}`}>{m.category}</p>
                                  </div>
                                  <p className="text-xl font-black mt-6 tracking-tighter">₹{m.pricePerPlate} <span className="text-[10px] font-bold opacity-60">/ pax</span></p>
                               </button>
                            ))}
                         </div>
                      </section>

                      <section className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl flex flex-col md:flex-row justify-between items-center gap-12 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-[80px]"></div>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-10 flex-1 w-full">
                            <div>
                               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Venue & Plan</p>
                               <p className="text-2xl font-black tracking-tighter">₹{(formData.totalAmount || 0).toFixed(0)}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Catering Sum</p>
                               <p className="text-2xl font-black tracking-tighter">₹{calculateCateringTotal().toFixed(0)}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Party Addons</p>
                               <p className="text-2xl font-black tracking-tighter">₹{( (formData.decorationCharge || 0) + (formData.lightingCharge || 0) + (formData.musicCharge || 0) + (formData.otherCharges || 0) ).toFixed(0)}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Discount (-)</p>
                               <input type="number" className="bg-white/5 border border-white/10 rounded-xl p-2 w-full text-xl font-black outline-none focus:bg-white/10" value={formData.discount} onChange={e => setFormData({...formData, discount: parseFloat(e.target.value) || 0})} />
                            </div>
                         </div>
                         <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/5 pt-10 md:pt-0 md:pl-12 w-full md:w-auto shrink-0">
                            <p className="text-[12px] font-black uppercase text-white/40 tracking-[0.4em] mb-2">Net Authorization</p>
                            <p className="text-6xl md:text-7xl font-black tracking-tighter text-orange-500 leading-none">₹{getNetTotal().toFixed(0)}</p>
                            <button onClick={handleSaveBooking} className="mt-10 w-full md:w-auto bg-orange-600 text-white px-20 py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:scale-[1.05] active:scale-95 transition-all tracking-[0.2em]">Authorize Event ✅</button>
                         </div>
                      </section>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* ACTIVE BOOKING DETAIL / SUMMARY MODAL */}
      {activeBooking && !showSettleModal && !showInvoicePreview && (
        <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border-8 border-slate-50">
              <div className="bg-orange-600 p-10 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{activeBooking.eventName}</h3>
                    <p className="text-[10px] font-black text-orange-100 uppercase tracking-widest mt-2">{activeBooking.date} • Log ID: #{activeBooking.id.slice(-6)}</p>
                 </div>
                 <button onClick={() => setActiveBooking(null)} className="bg-white/20 p-4 rounded-2xl hover:bg-white/30 transition-all font-black text-xs uppercase">Close</button>
              </div>
              <div className="p-12 space-y-10 overflow-y-auto custom-scrollbar flex-1">
                 <div className="grid grid-cols-2 gap-4">
                    <SummaryItem label="Final Amount" value={`₹${activeBooking.totalAmount.toFixed(2)}`} color="text-orange-600" />
                    <SummaryItem label="PAX Status" value={`${activeBooking.guestCount} Guests`} color="text-slate-900" />
                 </div>
                 
                 <div className="bg-slate-50 p-10 rounded-[3.5rem] space-y-6 shadow-inner border border-slate-100">
                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">Bill Components</p>
                    <BillLine label="Venue Booking" value={`₹${activeBooking.totalAmount - (activeBooking.catering?.totalCateringCharge || 0) - activeBooking.decorationCharge - activeBooking.lightingCharge - activeBooking.musicCharge - activeBooking.otherCharges + activeBooking.discount}`} />
                    {activeBooking.catering && <BillLine label={`Catering (${activeBooking.catering.plateCount} Plates)`} value={`₹${activeBooking.catering.totalCateringCharge}`} />}
                    {activeBooking.decorationCharge > 0 && <BillLine label="Party Decorations" value={`₹${activeBooking.decorationCharge}`} />}
                    {activeBooking.lightingCharge > 0 && <BillLine label="Professional Lighting" value={`₹${activeBooking.lightingCharge}`} />}
                    {activeBooking.musicCharge > 0 && <BillLine label="DJ & Music Services" value={`₹${activeBooking.musicCharge}`} />}
                    {activeBooking.discount > 0 && <BillLine label="Event Discount" value={`-₹${activeBooking.discount}`} isNegative />}
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => shareBillWhatsApp(activeBooking)} className="flex-1 bg-[#25D366] text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 hover:brightness-95 transition-all">
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                       Share Recap
                    </button>
                    <button onClick={() => setShowInvoicePreview(true)} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all">
                       Print Master Bill
                    </button>
                 </div>
                 
                 <div className="flex gap-4 pt-6 border-t">
                    <button onClick={() => setShowSettleModal(true)} className="flex-[2] bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl hover:scale-105 transition-all">Finalize & Settle Folio</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PRINT PREVIEW BANQUET BILL */}
      {showInvoicePreview && activeBooking && (
         <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col no-print-backdrop">
            <div className="bg-black p-4 flex justify-between items-center no-print">
               <p className="text-white font-black uppercase text-xs tracking-widest opacity-50">Banquet & Party Dispatch Console</p>
               <div className="flex gap-4">
                  <button onClick={() => window.print()} className="bg-orange-600 text-white px-10 py-2.5 rounded-xl font-black text-xs uppercase shadow-xl">Print [P]</button>
                  <button onClick={() => setShowInvoicePreview(false)} className="text-white px-8 py-2.5 bg-white/10 rounded-xl font-black text-xs uppercase border border-white/20">Close</button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-500/20 p-4 md:p-14 custom-scrollbar">
               <BanquetInvoiceView b={activeBooking} settings={settings} venueName={halls.find(h => h.id === activeBooking.hallId)?.name || 'Venue'} />
            </div>
         </div>
      )}

      {/* SETTLEMENT MODAL (Consistent with Dining/Other modules) */}
      {showSettleModal && activeBooking && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-emerald-600 p-10 text-white text-center">
                 <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Event Settlement</h2>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Value: ₹{activeBooking.totalAmount.toFixed(2)}</p>
              </div>
              <div className="p-12 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Payment Target</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Cash', 'UPI', 'Mark to Room'].map(mode => (
                          <button key={mode} onClick={() => setSettlementMode(mode)} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>{mode}</button>
                       ))}
                    </div>
                 </div>
                 {settlementMode === 'Mark to Room' && (
                    <div className="space-y-4 animate-in slide-in-from-top-4">
                       <input type="text" placeholder="Find Resident Room..." className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:border-emerald-600 text-slate-900" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                       <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-2xl p-2 space-y-1">
                          {activeResidents.map(b => (
                             <button key={b.id} onClick={() => setTargetRoomBookingId(b.id)} className={`w-full text-left p-3 rounded-xl flex justify-between items-center transition-all ${targetRoomBookingId === b.id ? 'bg-emerald-50 border-emerald-200 border-2 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                <span className="font-black">Room {rooms.find(r => r.id === b.roomId)?.number}</span>
                                <span className="text-[9px] font-bold uppercase">{guests.find(g => g.id === b.guestId)?.name}</span>
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
                 <div className="flex gap-4">
                    <button onClick={() => setShowSettleModal(false)} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px]">Back</button>
                    <button onClick={handleSettleBill} className="flex-[2] bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl tracking-widest">Verify & Settle ✅</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const BanquetInvoiceView = ({ b, settings, venueName }: any) => (
  <div className="bg-white p-12 w-[210mm] min-h-[297mm] mx-auto border shadow-2xl font-sans text-[11px] leading-tight invoice-sheet text-slate-900 uppercase font-bold">
     <div className="flex justify-between items-center border-b-4 border-orange-600 pb-10 mb-10">
        <div className="flex items-center gap-8">
           {settings.logo && <div className="w-24 h-24 p-2 border rounded-2xl flex items-center justify-center"><img src={settings.logo} className="max-h-full max-w-full object-contain" /></div>}
           <div>
              <h1 className="text-3xl font-black text-orange-900 tracking-tighter leading-none">{settings.name}</h1>
              <p className="text-[10px] font-bold text-slate-400 mt-2 max-w-xs">{settings.address}</p>
              <p className="text-[10px] font-black text-orange-600 mt-1">GSTIN: {settings.gstNumber || 'N/A'}</p>
           </div>
        </div>
        <div className="text-right">
           <h2 className="text-xl font-black text-orange-900">EVENT INVOICE</h2>
           <p className="text-[9px] text-slate-300 mt-1">Invoice ID: #{b.id.slice(-8)}</p>
           <p className="text-[10px] font-black mt-4">Date: {new Date().toLocaleDateString('en-GB')}</p>
        </div>
     </div>

     <div className="grid grid-cols-2 gap-20 mb-12">
        <div className="space-y-2">
           <p className="text-[8px] font-black text-slate-300 tracking-widest">Organizer / Host</p>
           <p className="text-sm font-black text-slate-900">{b.guestName}</p>
           <p className="text-[10px] text-slate-500">{b.guestPhone}</p>
        </div>
        <div className="text-right space-y-2">
           <p className="text-[8px] font-black text-slate-300 tracking-widest">Event Detail</p>
           <p className="text-sm font-black text-slate-900">{b.eventName}</p>
           <p className="text-[10px] text-slate-500">{venueName} • {b.date}</p>
        </div>
     </div>

     <table className="w-full text-left mb-12 border-t-2 border-b-2 py-8">
        <thead>
           <tr className="text-[9px] font-black text-slate-400 border-b">
              <th className="pb-6">Description of Services</th>
              <th className="pb-6 text-center">Unit / PAX</th>
              <th className="pb-6 text-right">Net Amount (₹)</th>
           </tr>
        </thead>
        <tbody className="font-black text-[11px] text-slate-800">
           <tr className="border-b border-slate-50">
              <td className="py-6">Venue Hosting & Base Logistics</td>
              <td className="py-6 text-center">1 Session</td>
              <td className="py-6 text-right">₹{(b.totalAmount - (b.catering?.totalCateringCharge || 0) - b.decorationCharge - b.lightingCharge - b.musicCharge - b.otherCharges + b.discount).toFixed(2)}</td>
           </tr>
           {b.catering && (
              <tr className="border-b border-slate-50">
                 <td className="py-6">Food Production & Catering ({b.catering.items.length} Menu Items)</td>
                 <td className="py-6 text-center">{b.catering.plateCount} Plates</td>
                 <td className="py-6 text-right">₹{b.catering.totalCateringCharge.toFixed(2)}</td>
              </tr>
           )}
           {b.decorationCharge > 0 && (
              <tr className="border-b border-slate-50">
                 <td className="py-6">Party Decorations & Floral Arrangement</td>
                 <td className="py-6 text-center">Lump-sum</td>
                 <td className="py-6 text-right">₹{b.decorationCharge.toFixed(2)}</td>
              </tr>
           )}
           {b.lightingCharge > 0 && (
              <tr className="border-b border-slate-50">
                 <td className="py-6">Professional Lighting & Ambience</td>
                 <td className="py-6 text-center">Lump-sum</td>
                 <td className="py-6 text-right">₹{b.lightingCharge.toFixed(2)}</td>
              </tr>
           )}
           {b.musicCharge > 0 && (
              <tr className="border-b border-slate-50">
                 <td className="py-6">DJ, Music & Sound System Deployment</td>
                 <td className="py-6 text-center">Professional</td>
                 <td className="py-6 text-right">₹{b.musicCharge.toFixed(2)}</td>
              </tr>
           )}
           {b.discount > 0 && (
              <tr>
                 <td className="py-6 text-rose-500">Event Specific Discount / Loyalty Rebate</td>
                 <td className="py-6 text-center text-rose-500">Global</td>
                 <td className="py-6 text-right text-rose-500">-₹{b.discount.toFixed(2)}</td>
              </tr>
           )}
        </tbody>
     </table>

     <div className="flex justify-end">
        <div className="w-80 bg-orange-50 p-10 rounded-[2.5rem] border border-orange-100">
           <div className="flex justify-between text-[10px] text-slate-400 mb-2"><span>SUBTOTAL</span><span>₹{b.totalAmount.toFixed(2)}</span></div>
           <div className="flex justify-between text-[10px] text-slate-400 border-b pb-4 mb-4"><span>TAXES (COMPLIMENTARY)</span><span>₹0.00</span></div>
           <div className="flex justify-between items-end">
              <span className="text-[9px] font-black text-orange-900 tracking-widest">NET PAYABLE</span>
              <span className="text-3xl font-black text-orange-600 tracking-tighter">₹{b.totalAmount.toFixed(0)}</span>
           </div>
        </div>
     </div>

     <div className="mt-20 grid grid-cols-2 gap-40 text-center">
        <div className="border-t-2 pt-4"><p className="text-[10px] font-black text-slate-300">AUTHORIZED CLIENT SIGN</p></div>
        <div className="border-t-2 pt-4">
           {settings.signature && <img src={settings.signature} className="h-10 mx-auto mix-blend-multiply mb-1" />}
           <p className="text-[10px] font-black text-orange-900">PROPERTY MANAGER</p>
        </div>
     </div>
     
     <div className="mt-20 text-center opacity-30 text-[8px] font-black tracking-[0.4em]">
        GENERATED VIA HOTELSPHERE PRO • ENTERPRISE NODE AUTHORIZED
     </div>
  </div>
);

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

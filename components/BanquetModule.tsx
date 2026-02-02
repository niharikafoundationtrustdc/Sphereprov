
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { subscribeToTable } from '../services/supabase';
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
  const [isSaving, setIsSaving] = useState(false);

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

  const refreshData = async () => {
    setHalls(await db.banquetHalls.toArray());
    setBookings(await db.eventBookings.toArray());
    setCateringMenu(await db.cateringMenu.toArray());
  };

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
          { id: 'f1', name: 'Continental Breakfast', category: 'Breakfast', pricePerPlate: 350 },
          { id: 'f2', name: 'Standard Thali', category: 'Lunch', pricePerPlate: 450 },
          { id: 'f3', name: 'Royal Dinner Buffet', category: 'Dinner', pricePerPlate: 850 },
        ];
        await db.cateringMenu.bulkPut(defaults);
        cm = defaults;
      }
      setCateringMenu(cm);
    };
    init();

    const sub1 = subscribeToTable('event_bookings', refreshData);
    const sub2 = subscribeToTable('banquet_halls', refreshData);
    const sub3 = subscribeToTable('catering_menu', refreshData);

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

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
    return (venue + cater + deco + light + music + other) - disc;
  };

  const handleSaveVenue = async () => {
    if (!newVenue.name) return;
    const v: BanquetHall = { ...newVenue, id: `VEN-${Date.now()}` } as BanquetHall;
    await db.banquetHalls.put(v);
    refreshData();
    setNewVenue({ name: '', capacity: 100, basePrice: 15000, type: 'HALL' });
  };

  const handleSaveBooking = async () => {
    if (!formData.guestName || !formData.eventName) {
      alert("⚠️ Mandatory Fields Missing: Please enter Organizer Name and Event Title.");
      return;
    }
    
    const hId = formData.hallId || selectedHall?.id;
    if (!hId) {
      alert("⚠️ Configuration Error: No venue associated with this selection.");
      return;
    }

    setIsSaving(true);
    try {
      const b: EventBooking = {
        ...formData,
        id: formData.id || `EVT-${Date.now()}`,
        hallId: hId,
        totalAmount: getNetTotal(),
        catering: {
          items: cateringMenu.filter(m => selectedFoodIds.includes(m.id)).map(m => ({ 
            itemId: m.id, 
            name: m.name, 
            qty: formData.guestCount || 0, 
            price: m.pricePerPlate 
          })),
          plateCount: formData.guestCount || 0,
          totalCateringCharge: calculateCateringTotal()
        }
      } as EventBooking;

      await db.eventBookings.put(b);
      await refreshData();
      setShowForm(false);
      setSelectedHall(null);
      setSelectedFoodIds([]);
      alert("✅ Event successfully authorized and synced to cloud.");
    } catch (err) {
      console.error("Save Event Error:", err);
      alert("❌ Database Conflict: Could not save event.");
    } finally {
      setIsSaving(false);
    }
  };

  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const handleOpenForm = (hall: BanquetHall, day: string) => {
    setSelectedHall(hall);
    setFormData({
      guestName: '', guestPhone: '', eventName: '', eventType: 'Birthday', 
      date: day, startTime: '10:00', endTime: '18:00',
      totalAmount: hall.basePrice, advancePaid: 0, discount: 0, paymentMode: 'Cash', status: 'TENTATIVE',
      guestCount: 100, decorationCharge: 0, lightingCharge: 0, musicCharge: 0, otherCharges: 0,
      hallId: hall.id
    });
    setSelectedFoodIds([]);
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-slate-50 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl shadow-orange-100/30 border border-white shrink-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Venue Console</h2>
          <p className="text-[9px] md:text-[11px] font-bold text-orange-500 uppercase tracking-[0.4em] mt-2">Banquets, Parties & Mega Events</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-100 mt-4 md:mt-0 no-print">
           <SubTab active={activeSubTab === 'SCHEDULER'} label="Schedule" onClick={() => setActiveSubTab('SCHEDULER')} />
           <SubTab active={activeSubTab === 'MASTER'} label="Venues" onClick={() => setActiveSubTab('MASTER')} />
           <SubTab active={activeSubTab === 'CATERING'} label="Catering Master" onClick={() => setActiveSubTab('CATERING')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'SCHEDULER' && (
           <div className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full">
              <div className="overflow-x-auto custom-scrollbar h-full">
                 <table className="w-full border-collapse table-fixed min-w-[1400px]">
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
                          <tr key={hall.id} className="border-b min-h-[160px] hover:bg-slate-50 transition-colors">
                             <td className="p-8 bg-white sticky left-0 z-10 border-r shadow-md font-black text-orange-600 leading-tight">
                                {hall.name}
                                <div className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest font-extrabold">BASE: {formatCurrency(hall.basePrice)}</div>
                             </td>
                             {days.map(day => {
                                const dailyBookings = bookings
                                  .filter(x => x.hallId === hall.id && x.date === day)
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                                  
                                return (
                                   <td key={day} className="border-r p-2 group align-top">
                                      <div className="flex flex-col gap-2 min-h-[140px]">
                                         {dailyBookings.map(b => (
                                            <div 
                                              key={b.id}
                                              onClick={() => setActiveBooking(b)} 
                                              className={`rounded-xl p-3 border-l-4 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${b.status === 'SETTLED' ? 'bg-orange-50 border-orange-600 text-orange-900' : 'bg-emerald-50 border-emerald-600 text-emerald-900'}`}
                                            >
                                               <div className="flex justify-between items-start mb-1">
                                                  <p className="text-[9px] font-black truncate max-w-[80px]">{b.eventName}</p>
                                                  <span className="text-[7px] font-black opacity-50">{b.startTime} - {b.endTime}</span>
                                               </div>
                                               <p className="text-[7px] opacity-60 font-extrabold tracking-widest uppercase">{b.guestCount} PAX • {b.guestName.split(' ')[0]}</p>
                                            </div>
                                         ))}
                                         
                                         <button 
                                            onClick={() => handleOpenForm(hall, day)} 
                                            className="w-full h-10 mt-auto border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-slate-300 font-black text-xl hover:bg-orange-50 hover:border-orange-200 hover:text-orange-500 transition-all"
                                         >
                                            +
                                         </button>
                                      </div>
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
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full text-slate-900">
              <div className="lg:col-span-1 bg-white border-2 border-slate-100 rounded-[3rem] p-10 shadow-sm space-y-6 h-fit">
                 <h3 className="font-black text-orange-900 uppercase text-xs border-b pb-4 tracking-widest leading-none">Define Venue</h3>
                 <MenuInp label="Area Name" value={newVenue.name || ''} onChange={(v:any) => setNewVenue({...newVenue, name: v})} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none text-slate-900 shadow-inner" value={newVenue.type} onChange={e => setNewVenue({...newVenue, type: e.target.value as any})}>
                       <option value="HALL">🏢 Hall</option>
                       <option value="LAWN">🌳 Lawn</option>
                    </select>
                 </div>
                 <MenuInp label="Daily Base Price" type="number" value={newVenue.basePrice?.toString()} onChange={(v:any) => setNewVenue({...newVenue, basePrice: parseFloat(v)})} />
                 <button onClick={handleSaveVenue} className="w-full bg-orange-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Register Venue</button>
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {halls.map(h => (
                    <div key={h.id} className="bg-white border-2 border-slate-50 p-10 rounded-[3rem] shadow-sm flex flex-col justify-between hover:border-orange-600 transition-all group">
                       <div className="flex justify-between items-start">
                          <h4 className="text-2xl font-black text-orange-900 uppercase tracking-tighter leading-none">{h.name}</h4>
                          <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{h.type}</span>
                       </div>
                       <p className="text-xl font-black text-slate-400 mt-10 uppercase tracking-tighter">Base Rate: <span className="text-slate-900">{formatCurrency(h.basePrice)}</span></p>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* EVENT BOOKING FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
           <div className="bg-white w-full max-w-6xl md:rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-full md:max-h-[95vh] border-t-8 border-blue-900">
              <div className="bg-blue-900 p-8 md:p-12 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none">Event Protocol Initiation</h3>
                    <p className="text-[10px] md:text-xs font-black uppercase text-blue-300 mt-2 tracking-widest">Venue: {selectedHall?.name} • Date: {formData.date}</p>
                 </div>
                 <button onClick={() => setShowForm(false)} className="uppercase text-[11px] font-black opacity-60 hover:opacity-100 transition-opacity border-2 border-white/20 px-6 py-2 rounded-2xl">Cancel</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-14 custom-scrollbar bg-white grid grid-cols-1 lg:grid-cols-3 gap-12 text-slate-900">
                 <div className="lg:col-span-2 space-y-12">
                    <section className="space-y-8">
                       <h4 className="text-[11px] font-black uppercase text-slate-400 border-b pb-4 tracking-[0.2em]">1. Organizer & Deployment</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Inp label="Event Host Name *" value={formData.guestName} onChange={(v:any) => setFormData({...formData, guestName: v})} placeholder="Full legal name" />
                          <Inp label="WhatsApp / Phone *" value={formData.guestPhone} onChange={(v:any) => setFormData({...formData, guestPhone: v})} placeholder="10-digit mobile" />
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Inp label="Event Title *" value={formData.eventName} onChange={(v:any) => setFormData({...formData, eventName: v})} placeholder="e.g. Wedding Reception" />
                          <Inp label="Mission Start (Time)" type="time" value={formData.startTime} onChange={(v:any) => setFormData({...formData, startTime: v})} />
                          <Inp label="Mission End (Time)" type="time" value={formData.endTime} onChange={(v:any) => setFormData({...formData, endTime: v})} />
                       </div>
                    </section>

                    <section className="space-y-8">
                       <h4 className="text-[11px] font-black uppercase text-slate-400 border-b pb-4 tracking-[0.2em]">2. Infrastructure Charges</h4>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <Inp label="Venue Base" type="number" value={formData.totalAmount?.toString()} onChange={(v:any) => setFormData({...formData, totalAmount: parseFloat(v) || 0})} />
                          <Inp label="Decoration" type="number" value={formData.decorationCharge?.toString()} onChange={(v:any) => setFormData({...formData, decorationCharge: parseFloat(v) || 0})} />
                          <Inp label="Lighting" type="number" value={formData.lightingCharge?.toString()} onChange={(v:any) => setFormData({...formData, lightingCharge: parseFloat(v) || 0})} />
                          <Inp label="Music/DJ" type="number" value={formData.musicCharge?.toString()} onChange={(v:any) => setFormData({...formData, musicCharge: parseFloat(v) || 0})} />
                       </div>
                    </section>

                    <section className="space-y-8">
                       <h4 className="text-[11px] font-black uppercase text-slate-400 border-b pb-4 tracking-[0.2em]">3. Catering Configuration</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <Inp label="Guaranteed PAX" type="number" value={formData.guestCount?.toString()} onChange={(v:any) => setFormData({...formData, guestCount: parseInt(v) || 0})} />
                          <div className="space-y-3">
                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Menu Plan</label>
                             <div className="flex flex-wrap gap-2">
                                {cateringMenu.map(m => (
                                   <button 
                                      key={m.id} 
                                      type="button"
                                      onClick={() => setSelectedFoodIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${selectedFoodIds.includes(m.id) ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-white hover:border-orange-200'}`}
                                   >
                                      {m.name}
                                   </button>
                                ))}
                             </div>
                          </div>
                       </div>
                    </section>
                 </div>

                 <div className="space-y-8 bg-slate-50 p-10 rounded-[3.5rem] shadow-inner border border-slate-100 flex flex-col">
                    <h4 className="text-[11px] font-black uppercase text-blue-900 text-center tracking-[0.4em] mb-4">Financial Dashboard</h4>
                    <div className="space-y-6 flex-1">
                       <BillLine label="Infrastructure Base" value={formatCurrency(formData.totalAmount || 0)} />
                       <BillLine label="Catering Projection" value={formatCurrency(calculateCateringTotal())} />
                       <BillLine label="Utility Services" value={formatCurrency((formData.decorationCharge || 0) + (formData.lightingCharge || 0) + (formData.musicCharge || 0))} />
                       <div className="h-px bg-slate-200 my-4"></div>
                       <Inp label="Authorized Discount (₹)" type="number" value={formData.discount?.toString()} onChange={(v:any) => setFormData({...formData, discount: parseFloat(v) || 0})} />
                    </div>

                    <div className="bg-blue-950 p-10 rounded-[2.5rem] text-white text-center shadow-3xl relative overflow-hidden group mt-10 border-4 border-blue-900">
                       <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><span className="text-8xl">📑</span></div>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">Net Project Valuation</p>
                       <h3 className="text-5xl font-black tracking-tighter">₹{getNetTotal().toFixed(0)}</h3>
                    </div>

                    <div className="space-y-6 pt-10 border-t">
                       <Inp label="Token Advance Rec (₹)" type="number" value={formData.advancePaid?.toString()} onChange={(v:any) => setFormData({...formData, advancePaid: parseFloat(v) || 0})} />
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Protocol Status</label>
                          <select className="w-full border-2 p-5 rounded-2xl font-black text-xs bg-white text-slate-900 outline-none focus:border-blue-900 shadow-sm appearance-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                             <option value="TENTATIVE">TENTATIVE / SLOT BLOCKED</option>
                             <option value="CONFIRMED">CONFIRMED / DEPOSIT PAID</option>
                          </select>
                       </div>
                    </div>

                    <button 
                      onClick={handleSaveBooking} 
                      disabled={isSaving}
                      className={`w-full ${isSaving ? 'bg-slate-400' : 'bg-orange-600'} text-white py-8 mt-10 rounded-[2.5rem] font-black uppercase text-sm shadow-2xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3`}
                    >
                      {isSaving ? 'Synchronizing Cloud...' : 'Authorize Event Plan ✅'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* ACTIVE BOOKING VIEW */}
      {activeBooking && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300">
               <div className="bg-emerald-600 p-10 text-white text-center">
                  <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{activeBooking.eventName}</h2>
                  <p className="text-[10px] font-bold uppercase opacity-80 mt-2">{activeBooking.guestName} • {activeBooking.date} • {activeBooking.startTime} - {activeBooking.endTime}</p>
               </div>
               <div className="p-10 space-y-8 text-slate-900">
                  <div className="grid grid-cols-2 gap-4">
                     <SummaryItem label="Project Value" value={formatCurrency(activeBooking.totalAmount)} color="text-blue-900" />
                     <SummaryItem label="Advance Rec" value={formatCurrency(activeBooking.advancePaid)} color="text-emerald-600" />
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Menu Detail</p>
                     {(activeBooking.catering?.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between text-[11px] font-bold uppercase">
                           <span>{it.name}</span>
                           <span>{it.qty} Plates</span>
                        </div>
                     ))}
                     {activeBooking.catering?.items?.length === 0 && <p className="text-[10px] italic text-slate-400 text-center">No catering assigned</p>}
                  </div>

                  <div className="pt-6 border-t flex gap-4">
                    <button onClick={() => { if(confirm('Cancel Event?')) db.eventBookings.delete(activeBooking!.id).then(refreshData).then(() => setActiveBooking(null)); }} className="flex-1 text-red-400 font-black uppercase text-[10px] border-2 border-red-50 rounded-2xl py-4 hover:bg-red-50 transition-all">Cancel Mission</button>
                    <button onClick={() => setActiveBooking(null)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">Dismiss</button>
                  </div>
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
   <div className={`flex justify-between items-center text-[13px] font-black uppercase ${isNegative ? 'text-rose-500' : 'text-slate-800'}`}>
      <span className="opacity-40">{label}</span>
      <span>{value}</span>
   </div>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-10 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shrink-0 ${active ? 'bg-orange-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-orange-900 hover:bg-white'}`}>{label}</button>
);

const MenuInp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full border-2 p-5 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-orange-600 transition-all text-slate-900 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "", className = "" }: any) => (
  <div className={`space-y-2 w-full text-left ${className}`}>
    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full border-2 p-5 rounded-[1.8rem] font-black text-[13px] bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-all text-black shadow-inner placeholder:text-slate-300" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default BanquetModule;

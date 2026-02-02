
import React, { useState, useEffect, useMemo } from 'react';
import { Room, Guest, Booking, HostelSettings, Payment, RoomStatus, Occupant, MealPlanConfig } from '../types.ts';
import { INDIAN_STATES } from '../constants.tsx';

interface RoomAssignment {
  roomId: string;
  roomNumber: string;
  tariff: number;
  discount: number;
  type: string;
}

interface GuestCheckinProps {
  room: Room;
  allRooms: Room[];
  existingGuests: Guest[];
  onClose: () => void;
  onSave: (data: { guest: Partial<Guest>, bookings: any[] }) => void;
  settings: HostelSettings;
  initialSelectedRoomIds?: string[];
}

const GuestCheckin: React.FC<GuestCheckinProps> = ({ 
  room, 
  allRooms, 
  existingGuests, 
  onClose, 
  onSave, 
  settings,
  initialSelectedRoomIds = [],
}) => {
  const [guest, setGuest] = useState<Partial<Guest>>({
    name: '', gender: 'Male', phone: '', email: '', address: '', city: '', state: 'Chhattisgarh',
    nationality: 'Indian', idType: 'Aadhar', idNumber: '', adults: 1, children: 0, kids: 0, others: 0, documents: {}
  });

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  
  const [mealPlan, setMealPlan] = useState('EP (Room Only)');
  const [mealRate, setMealRate] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);

  useEffect(() => {
    const now = new Date();
    setCheckInDate(now.toISOString().split('T')[0]);
    setCheckInTime(now.toTimeString().split(' ')[0].substring(0, 5));
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    
    const initialIds = initialSelectedRoomIds.length > 0 ? initialSelectedRoomIds : [room.id];
    const assignments = initialIds.map(id => {
      const r = allRooms.find(x => x.id === id);
      return { roomId: id, roomNumber: r?.number || '?', tariff: r?.price || 0, discount: 0, type: r?.type || '?' };
    });
    
    setRoomAssignments(assignments);
  }, []);

  // Update meal rate when meal plan changes based on global master settings
  useEffect(() => {
    const config = (settings.mealPlanRates || []).find(p => p.name === mealPlan);
    if (config) {
      setMealRate(config.rate);
    } else {
      setMealRate(0);
    }
  }, [mealPlan, settings.mealPlanRates]);

  const totals = useMemo(() => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) || 1;
    const roomRent = roomAssignments.reduce((acc, r) => acc + (r.tariff * nights), 0);
    const totalHeads = (guest.adults || 0) + (guest.children || 0) + occupants.length;
    const mealCharges = (mealRate * totalHeads * nights);
    const subTotal = roomRent + mealCharges - overallDiscount;
    const tax = (subTotal * (settings.taxRate || 0)) / 100;
    return { roomRent, mealCharges, subTotal, tax, grandTotal: subTotal + tax, nights, totalHeads };
  }, [roomAssignments, mealRate, overallDiscount, guest.adults, guest.children, occupants.length, settings.taxRate, checkInDate, checkOutDate]);

  const handleAddOccupant = () => {
    setOccupants([...occupants, { id: `occ-${Date.now()}`, name: '', gender: 'Male' }]);
  };

  const updateOccupant = (index: number, field: keyof Occupant, value: any) => {
    const next = [...occupants];
    next[index] = { ...next[index], [field]: value };
    setOccupants(next);
  };

  const handleRemoveOccupant = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (!window.confirm("Remove this occupant?")) return;
    setOccupants(occupants.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'PRIMARY' | 'OCCUPANT', field: string, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'PRIMARY') {
        setGuest(prev => ({ ...prev, documents: { ...prev.documents, [field]: reader.result } }));
      } else if (type === 'OCCUPANT' && typeof index === 'number') {
        updateOccupant(index, field as any, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!guest.name || !guest.phone || roomAssignments.length === 0) return alert("Validation: Name and Phone required.");
    const initialPayments = advanceAmount > 0 ? [{ id: 'ADV-' + Date.now(), amount: advanceAmount, date: new Date().toISOString(), method: paymentMode, remarks: 'Check-in Advance' }] : [];
    const gid = roomAssignments.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;
    const bookings = roomAssignments.map(ra => ({
      bookingNo: 'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      roomId: ra.roomId, groupId: gid, checkInDate, checkInTime, checkOutDate, checkOutTime, status: 'ACTIVE',
      basePrice: ra.tariff, discount: (overallDiscount / roomAssignments.length), mealPlan, adults: guest.adults, occupants: occupants,
      charges: mealRate > 0 ? [{ id: `MEAL-${Date.now()}`, description: `Catering: ${mealPlan}`, amount: (mealRate * totals.totalHeads * totals.nights), date: new Date().toISOString() }] : [], 
      payments: initialPayments
    }));
    onSave({ guest, bookings });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-7xl rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col h-full md:h-[94vh] overflow-hidden font-sans border border-slate-200">
        
        <div className="bg-slate-50 p-6 md:p-8 border-b flex justify-between items-center no-print shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all shadow-sm">←</button>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Guest Enrollment</h2>
              <div className="flex items-center gap-3 mt-1">
                 <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-100 px-2 py-0.5 rounded">Security Cleared</p>
                 <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{checkInDate} | {checkInTime}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full text-slate-400 transition-all text-xl">×</button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
          <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-12 bg-white">
            
            <section className="space-y-8">
              <SectionHeader label="01" title="Primary Identity" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                   <Inp label="WhatsApp / Mobile Number *" value={guest.phone} onChange={(v:any) => setGuest({...guest, phone: v})} placeholder="99XXXXXXX" />
                </div>
                <div className="md:col-span-2">
                   <Inp label="Full Legal Name *" value={guest.name} onChange={(v:any) => setGuest({...guest, name: v})} placeholder="As per ID Document" />
                </div>
                <Inp label="Nationality" value={guest.nationality} onChange={(v:any) => setGuest({...guest, nationality: v})} />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Biological Gender</label>
                  <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-[13px] text-slate-900 outline-none focus:border-blue-500 transition-all" value={guest.gender} onChange={e => setGuest({...guest, gender: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">ID Type</label>
                  <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-[13px] text-slate-900 outline-none focus:border-blue-500 transition-all" value={guest.idType} onChange={e => setGuest({...guest, idType: e.target.value as any})}>
                    <option value="Aadhar">Aadhar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <Inp label="Doc Reference #" value={guest.idNumber} onChange={(v:any) => setGuest({...guest, idNumber: v})} placeholder="ID Number" />
              </div>
            </section>

            <section className="space-y-8">
               <SectionHeader label="02" title="KYC Documents" />
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DocBox label="ID: FRONT" src={guest.documents?.aadharFront} onChange={(e:any) => handleFileUpload(e, 'PRIMARY', 'aadharFront')} />
                  <DocBox label="ID: BACK" src={guest.documents?.aadharBack} onChange={(e:any) => handleFileUpload(e, 'PRIMARY', 'aadharBack')} />
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-blue-500 transition-all text-center shadow-inner">
                     {guest.documents?.photo ? (
                        <img src={guest.documents.photo} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl" />
                     ) : (
                        <div className="w-16 h-16 bg-white border rounded-full flex items-center justify-center text-2xl mb-3 shadow-sm">📸</div>
                     )}
                     <p className="text-[9px] font-black uppercase text-slate-400 mb-4">Live Portrait</p>
                     <button className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-blue-600 transition-all">Start Camera</button>
                  </div>
               </div>
            </section>

            <section className="space-y-8 pb-10">
               <div className="flex justify-between items-center">
                  <SectionHeader label="03" title="Companions" />
                  <button onClick={handleAddOccupant} className="text-blue-600 font-black text-[10px] uppercase tracking-widest border-2 border-blue-100 px-6 py-2 rounded-xl hover:bg-blue-50 transition-all">+ Add Companion</button>
               </div>
               
               <div className="space-y-4">
                  {occupants.map((occ, idx) => (
                    <div key={occ.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-sm">
                       <div className="md:col-span-1 flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-200">#{idx+1}</span>
                       </div>
                       <div className="md:col-span-5">
                          <Inp label="Guest Name" value={occ.name} onChange={(v:string) => updateOccupant(idx, 'name', v)} />
                       </div>
                       <div className="md:col-span-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                          <select className="w-full bg-white border border-slate-200 p-4 rounded-xl text-[12px] font-bold text-slate-900" value={occ.gender} onChange={e => updateOccupant(idx, 'gender', e.target.value as any)}>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                          </select>
                       </div>
                       <div className="md:col-span-3 flex flex-col gap-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Identity Front</label>
                          <div className="relative h-12 bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                             {occ.idFront ? (
                                <img src={occ.idFront} className="w-full h-full object-cover" />
                             ) : (
                                <span className="text-[8px] font-black text-slate-300 uppercase">Upload</span>
                             )}
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'OCCUPANT', 'idFront', idx)} />
                          </div>
                       </div>
                       <div className="md:col-span-1 text-center">
                          <button onClick={(e) => handleRemoveOccupant(e, idx)} className="text-red-400 hover:text-red-600 font-black text-xl transition-colors">×</button>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          </div>

          <div className="w-full lg:w-[420px] bg-slate-50 border-l border-slate-200 p-8 md:p-10 space-y-10 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <h3 className="font-black text-[11px] uppercase text-slate-400 tracking-[0.4em] text-center border-b pb-6">Folio Summary</h3>
            
            <div className="space-y-8">
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Check-In Date" type="date" value={checkInDate} onChange={setCheckInDate} />
                  <Inp label="Check-In Time" type="time" value={checkInTime} onChange={setCheckInTime} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Exp. Check-Out" type="date" value={checkOutDate} onChange={setCheckOutDate} />
                  <Inp label="Checkout Time" type="time" value={checkOutTime} onChange={setCheckOutTime} />
               </div>

               <div className="space-y-3 pt-4">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Assigned Inventory</p>
                  {roomAssignments.map((ra, idx) => (
                    <div key={ra.roomId} className="bg-white p-6 rounded-[1.8rem] border border-slate-200 space-y-4 shadow-sm">
                       <div className="flex justify-between items-center">
                          <span className="text-xl font-black text-slate-900 uppercase">Unit {ra.roomNumber}</span>
                          <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">{ra.type}</span>
                       </div>
                       <Inp label="Override Folio Tariff (₹)" type="number" value={ra.tariff.toString()} onChange={(v:any) => {
                          const next = [...roomAssignments];
                          next[idx].tariff = parseFloat(v) || 0;
                          setRoomAssignments(next);
                       }} />
                    </div>
                  ))}
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Package Plan</label>
                    <select className="w-full bg-white border border-slate-200 p-4 rounded-xl font-black text-[11px] text-slate-900 outline-none focus:border-blue-500" value={mealPlan} onChange={e => setMealPlan(e.target.value)}>
                      <option value="EP (Room Only)">EP (Room Only)</option>
                      {(settings.mealPlanRates || []).map(p => <option key={p.name} value={p.name}>{p.name} (₹{p.rate}/head)</option>)}
                    </select>
                  </div>
                  <Inp label="Calculated Rate" type="number" value={mealRate.toString()} readOnly />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Discount (₹)" type="number" value={overallDiscount.toString()} onChange={(v:any) => setOverallDiscount(parseFloat(v) || 0)} />
                  <Inp label="Advance (₹)" type="number" value={advanceAmount.toString()} onChange={(v:any) => setAdvanceAmount(parseFloat(v) || 0)} />
               </div>

               <div className="bg-blue-600 p-10 rounded-[2.5rem] shadow-xl text-center space-y-4 text-white animate-in zoom-in">
                  <p className="text-[10px] font-black uppercase text-blue-100 tracking-widest">Est. Grand Total</p>
                  <h4 className="text-5xl font-black tracking-tighter">₹{totals.grandTotal.toFixed(0)}</h4>
                  <div className="h-px bg-white/20 mx-4"></div>
                  <div className="flex justify-between text-[10px] font-black px-2">
                     <span className="uppercase opacity-70">Tax @ {settings.taxRate}%</span>
                     <span className="bg-white/20 px-3 py-0.5 rounded">₹{totals.tax.toFixed(0)}</span>
                  </div>
               </div>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 mt-4 rounded-[1.8rem] font-black uppercase text-xs shadow-2xl hover:bg-blue-600 transition-all transform active:scale-95">Commit Resident Registry</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ label, title }: any) => (
  <div className="flex items-center gap-6">
    <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-lg">{label}</span>
    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800">{title}</h3>
    <div className="flex-1 h-px bg-slate-100"></div>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "", readOnly = false }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} readOnly={readOnly} className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-[13px] text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-300 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const DocBox = ({ label, src, onChange }: any) => (
  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center group relative overflow-hidden hover:border-blue-500 transition-all cursor-pointer shadow-inner">
     {src ? (
        <img src={src} className="w-full h-full object-cover" />
     ) : (
        <div className="text-center px-4">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 group-hover:text-blue-500 transition-colors">{label}</p>
           <div className="w-10 h-10 bg-white border rounded-xl mx-auto flex items-center justify-center text-xl font-black text-slate-300 group-hover:text-blue-500 shadow-sm">+</div>
        </div>
     )}
     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onChange} />
  </div>
);

export default GuestCheckin;

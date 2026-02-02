import React, { useState, useEffect, useMemo } from 'react';
import { Room, Guest, Booking, HostelSettings, Payment, RoomStatus, Occupant, MealPlanConfig } from '../types.ts';
import { INDIAN_STATES } from '../constants.tsx';
import GRCFormView from './GRCFormView.tsx';

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
  room, allRooms, existingGuests, onClose, onSave, settings, initialSelectedRoomIds = []
}) => {
  const [showGRC, setShowGRC] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [guest, setGuest] = useState<Partial<Guest>>({
    name: '', gender: 'Male', phone: '', email: '', address: '', city: '', state: 'Chhattisgarh',
    nationality: 'Indian', idType: 'Aadhar Card', idNumber: '', adults: 1, children: 0, kids: 0, others: 0, documents: {}
  });

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [mealPlan, setMealPlan] = useState('EP (Room Only)');
  const [mealRate, setMealRate] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceMode, setAdvanceMode] = useState('Cash');
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);

  useEffect(() => {
    const now = new Date();
    setCheckInDate(now.toISOString().split('T')[0]);
    setCheckInTime(now.toTimeString().split(' ')[0].substring(0, 5));
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    const initialIds = initialSelectedRoomIds.length > 0 ? initialSelectedRoomIds : [room.id];
    setRoomAssignments(initialIds.map(id => {
      const r = allRooms.find(x => x.id === id);
      return { roomId: id, roomNumber: r?.number || '?', tariff: r?.price || 0, discount: 0, type: r?.type || '?' };
    }));
  }, []);

  const handleLookup = () => {
    if (!guest.phone || guest.phone.length < 10) return alert("Enter 10-digit mobile for lookup.");
    const found = existingGuests.find(g => g.phone === guest.phone);
    if (found) {
      setGuest({ ...found });
      alert(`CRM Match: Welcome back ${found.name}! Profile synced.`);
    } else {
      alert("No existing record found for this number.");
    }
  };

  const handleAddOccupant = () => {
    setOccupants([...occupants, { id: `occ-${Date.now()}`, name: '', gender: 'Male' }]);
  };

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

  const handleSave = () => {
    if (!guest.name || !guest.phone || roomAssignments.length === 0) return alert("Missing mandatory data: Name and Mobile required.");
    const initialPayments = advanceAmount > 0 ? [{ id: 'ADV-' + Date.now(), amount: advanceAmount, date: new Date().toISOString(), method: advanceMode, remarks: 'Stay Advance' }] : [];
    const gid = roomAssignments.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;
    const bookings = roomAssignments.map(ra => ({
      bookingNo: 'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      roomId: ra.roomId, groupId: gid, checkInDate, checkInTime, checkOutDate, checkOutTime, status: 'ACTIVE',
      basePrice: ra.tariff, discount: (overallDiscount / roomAssignments.length), mealPlan, adults: guest.adults, occupants: occupants,
      charges: mealRate > 0 ? [{ id: `MEAL-${Date.now()}`, description: `Meal Plan: ${mealPlan}`, amount: (mealRate * totals.totalHeads * totals.nights), date: new Date().toISOString() }] : [], 
      payments: initialPayments
    }));
    onSave({ guest, bookings });
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>, type: keyof Guest['documents']) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setGuest(prev => ({ ...prev, documents: { ...prev.documents, [type]: reader.result as string } }));
      reader.readAsDataURL(file);
    }
  };

  if (showGRC) {
     return (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col no-print-backdrop">
           <div className="bg-black p-4 flex justify-between items-center no-print">
              <div className="flex gap-4">
                 <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-xl">Print GRC Form</button>
                 <button onClick={() => setShowGRC(false)} className="text-white px-6 py-2 border border-white/20 rounded-xl font-black text-xs uppercase hover:bg-white/10">Return to Form</button>
              </div>
              <p className="text-white font-black uppercase text-[10px] opacity-40 tracking-widest">Digital Registration Registry</p>
           </div>
           <div className="flex-1 overflow-y-auto bg-gray-500/30 p-10 custom-scrollbar">
              <GRCFormView 
                 guest={guest} 
                 booking={{ checkInDate, checkInTime, checkOutDate, checkOutTime }} 
                 room={allRooms.find(r => r.id === roomAssignments[0]?.roomId) || {}} 
                 settings={settings} 
              />
           </div>
        </div>
     );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
      <div className="bg-[#f8fafc] w-full max-w-7xl rounded-none md:rounded-[3.5rem] shadow-3xl flex flex-col h-full md:h-[94vh] overflow-hidden border-4 border-white animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 border-b flex justify-between items-center no-print shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">←</button>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Guest Enrollment</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{checkInDate} | {checkInTime}</p>
                <button 
                  onClick={() => setIsExpress(!isExpress)}
                  className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${isExpress ? 'bg-orange-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                >
                   {isExpress ? 'EXPRESS MODE ACTIVE (60s)' : 'ENTER EXPRESS MODE'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setShowGRC(true)} className="bg-white border-2 border-slate-100 text-slate-400 px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:border-blue-600 hover:text-blue-600 transition-all">Preview GRC</button>
             <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-slate-200 rounded-2xl text-slate-300 transition-all text-2xl font-black">×</button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
          <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-16 bg-white">
            
            {/* 01 Identity */}
            <section className="space-y-10">
              <SectionHeader label="01" title="Primary Identity & CRM Scan" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 relative">
                   <Inp label="WhatsApp / Mobile Number *" value={guest.phone} onChange={(v:any) => setGuest({...guest, phone: v})} placeholder="99XXXXXXX" />
                   <button onClick={handleLookup} className="absolute right-3 bottom-3 bg-blue-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-black transition-all">Look Up</button>
                </div>
                <div className="md:col-span-2">
                   <Inp label="Full Legal Name *" value={guest.name} onChange={(v:any) => setGuest({...guest, name: v})} placeholder="As per Identification Doc" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Biological Gender</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-[13px] text-slate-900 outline-none focus:border-blue-600" value={guest.gender} onChange={e => setGuest({...guest, gender: e.target.value as any})}>
                    <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </select>
                </div>
                <Inp label="Nationality" value={guest.nationality} onChange={(v:any) => setGuest({...guest, nationality: v})} />
                {!isExpress && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Document Type</label>
                      <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-[13px] text-slate-900 outline-none focus:border-blue-600" value={guest.idType} onChange={e => setGuest({...guest, idType: e.target.value as any})}>
                        <option value="Aadhar Card">Aadhar Card</option><option value="Passport">Passport</option><option value="Voter ID">Voter ID</option><option value="Driving License">Driving License</option>
                      </select>
                    </div>
                    <Inp label="Doc Reference #" value={guest.idNumber} onChange={(v:any) => setGuest({...guest, idNumber: v})} placeholder="ID Number" />
                  </>
                )}
              </div>
              {!isExpress && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Inp label="Direct Email" value={guest.email} onChange={(v:any) => setGuest({...guest, email: v})} placeholder="guest@domain.com" />
                    <Inp label="City / Hometown" value={guest.city} onChange={(v:any) => setGuest({...guest, city: v})} />
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">State / Province</label>
                      <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-[13px] text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner" value={guest.state} onChange={e => setGuest({...guest, state: e.target.value})}>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Full Residential Address</label>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-bold text-sm text-slate-900 h-24 resize-none outline-none focus:border-blue-600 shadow-inner" value={guest.address} onChange={e => setGuest({...guest, address: e.target.value})} placeholder="Street, Landmark, State, Zip..."></textarea>
                  </div>
                </>
              )}
            </section>

            {/* 02 KYC Docs */}
            {!isExpress && (
              <section className="space-y-10">
                <SectionHeader label="02" title="KYC Document Vault" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <DocBox label="ID: FRONT" src={guest.documents?.aadharFront} onChange={(e:any) => handleDocUpload(e, 'aadharFront')} />
                    <DocBox label="ID: BACK" src={guest.documents?.aadharBack} onChange={(e:any) => handleDocUpload(e, 'aadharBack')} />
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-4 border-dashed border-slate-100 rounded-[3rem] text-center shadow-inner group hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden">
                      {guest.documents?.photo ? <img src={guest.documents.photo} className="w-32 h-32 rounded-full object-cover border-8 border-white shadow-2xl" /> : <div className="w-20 h-20 bg-white border rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm">📸</div>}
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] group-hover:text-blue-600">Capture Portrait</p>
                      <input type="file" accept="image/*" capture="user" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e:any) => handleDocUpload(e, 'photo')} />
                    </div>
                </div>
              </section>
            )}

            {/* 03 Occupants */}
            {!isExpress && (
              <section className="space-y-10">
                <div className="flex justify-between items-end border-b pb-6">
                    <SectionHeader label="03" title="Secondary Occupants" />
                    <button onClick={handleAddOccupant} className="bg-blue-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">+ Add Person</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {occupants.map((occ, idx) => (
                      <div key={occ.id} className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex flex-col gap-5 animate-in slide-in-from-bottom-4 shadow-sm group">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Occupant #{idx+1}</span>
                            <button onClick={() => setOccupants(occupants.filter(o => o.id !== occ.id))} className="text-red-300 hover:text-red-600 font-black text-xs uppercase">Discard</button>
                        </div>
                        <Inp label="Name" value={occ.name} onChange={(v:string) => {
                            const next = [...occupants]; next[idx].name = v; setOccupants(next);
                        }} />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Gender</label>
                              <select className="w-full bg-white border border-slate-100 p-3 rounded-xl font-bold text-xs" value={occ.gender} onChange={e => {
                                  const next = [...occupants]; next[idx].gender = e.target.value as any; setOccupants(next);
                              }}>
                                  <option value="Male">Male</option><option value="Female">Female</option>
                              </select>
                            </div>
                            <div className="relative overflow-hidden bg-white border border-dashed rounded-xl h-[45px] flex items-center justify-center">
                              <span className="text-[8px] font-black text-slate-300 uppercase">{occ.idFront ? 'ID ATTACHED' : 'ATTACH ID'}</span>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                                  const file = e.target.files?.[0]; if(!file) return;
                                  const r = new FileReader(); r.onload = () => { const n = [...occupants]; n[idx].idFront = r.result as string; setOccupants(n); };
                                  r.readAsDataURL(file);
                              }} />
                            </div>
                        </div>
                      </div>
                    ))}
                    {occupants.length === 0 && <div className="col-span-full py-12 text-center opacity-20 italic font-black uppercase tracking-widest border-2 border-dashed rounded-[2.5rem]">No secondary guests added to folio</div>}
                </div>
              </section>
            )}
          </div>

          {/* Right Column Summary */}
          <div className="w-full lg:w-[450px] bg-slate-50 border-l border-slate-200 p-10 space-y-10 flex flex-col shrink-0 overflow-y-auto custom-scrollbar shadow-2xl relative z-10">
            <h3 className="font-black text-[12px] uppercase text-slate-400 tracking-[0.4em] text-center border-b border-slate-200 pb-8">Folio Sizing & Master Plan</h3>
            
            <div className="space-y-10">
               <div className="grid grid-cols-2 gap-6">
                  <Inp label="Exp. Check-Out" type="date" value={checkOutDate} onChange={setCheckOutDate} />
                  <Inp label="Check-Out Time" type="time" value={checkOutTime} onChange={setCheckOutTime} />
               </div>

               {!isExpress && (
                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Service Packages</p>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Meal Plan (Master)</label>
                          <select className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 outline-none focus:border-blue-600" value={mealPlan} onChange={e => {
                             const plan = settings.mealPlanRates.find(p => p.name === e.target.value);
                             setMealPlan(e.target.value);
                             setMealRate(plan?.rate || 0);
                          }}>
                             {settings.mealPlans.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                       </div>
                       <Inp label="Daily Meal Rate (₹)" type="number" value={mealRate.toString()} onChange={(v:any) => setMealRate(parseFloat(v) || 0)} />
                    </div>
                 </div>
               )}

               <div className="space-y-4 pt-4 border-t border-slate-200">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Financial Pre-Auth</p>
                  <div className="grid grid-cols-2 gap-4">
                     <Inp label="Advance Payment (₹)" type="number" value={advanceAmount.toString()} onChange={(v:any) => setAdvanceAmount(parseFloat(v) || 0)} />
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Mode</label>
                        <select className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 outline-none focus:border-blue-600" value={advanceMode} onChange={e => setAdvanceMode(e.target.value)}>
                           <option value="Cash">Cash Account</option><option value="UPI">UPI/Digital</option><option value="Card">Bank Card</option>
                        </select>
                     </div>
                  </div>
                  {!isExpress && <Inp label="Manager Discount (₹)" type="number" value={overallDiscount.toString()} onChange={(v:any) => setOverallDiscount(parseFloat(v) || 0)} />}
               </div>

               <div className="bg-blue-600 p-12 rounded-[3.5rem] shadow-2xl text-center space-y-6 text-white border-4 border-blue-500 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><span className="text-9xl">📑</span></div>
                  <p className="text-[11px] font-black uppercase text-blue-100 tracking-[0.3em] relative z-10">Bill Authorization Node</p>
                  <h4 className="text-6xl font-black tracking-tighter relative z-10 leading-none">₹{totals.grandTotal.toFixed(0)}</h4>
                  <div className="h-px bg-white/20 mx-4 relative z-10"></div>
                  <div className="flex justify-between text-[11px] font-black px-4 relative z-10">
                     <span className="uppercase opacity-70">Tax @ {settings.taxRate}%</span>
                     <span className="bg-white/20 px-4 py-1 rounded-xl">₹{totals.tax.toFixed(0)}</span>
                  </div>
               </div>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white py-8 mt-6 rounded-[2.5rem] font-black uppercase text-sm shadow-2xl hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-95">Verify & Authorize Stay ✅</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ label, title }: any) => (<div className="flex items-center gap-6"><span className="w-14 h-14 bg-blue-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-lg shadow-xl">{label}</span><h3 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">{title}</h3><div className="flex-1 h-px bg-slate-100"></div></div>);
const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (<div className="space-y-1.5 w-full text-left"><label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label><input type={type} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-[13px] text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner placeholder:text-slate-300" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>);
const DocBox = ({ label, src, onChange }: any) => (<div className="aspect-video bg-slate-50 border-4 border-dashed border-slate-100 rounded-[2.5rem] flex items-center justify-center group relative overflow-hidden shadow-inner hover:border-blue-200 transition-all">{src ? <img src={src} className="w-full h-full object-cover" /> : <div className="text-center px-4"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 group-hover:text-blue-500 transition-colors">{label}</p><div className="w-12 h-12 bg-white border-2 border-slate-50 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black text-slate-200 shadow-sm group-hover:text-blue-500 group-hover:border-blue-100">+</div></div>}<input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onChange} /></div>);

export default GuestCheckin;
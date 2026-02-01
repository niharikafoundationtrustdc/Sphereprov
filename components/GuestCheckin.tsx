
import React, { useState, useEffect, useMemo } from 'react';
import { Room, Guest, Booking, HostelSettings, Payment, RoomStatus, Occupant } from '../types.ts';
import { INDIAN_STATES } from '../constants.tsx';
import CameraCapture from './CameraCapture.tsx';

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
  onSwitchToReservation?: () => void;
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
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeDocCapture, setActiveDocCapture] = useState<{ type: string, id?: string, field?: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    setCheckInDate(now.toISOString().split('T')[0]);
    setCheckInTime(now.toTimeString().split(' ')[0].substring(0, 5));
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    const initialIds = initialSelectedRoomIds.length > 0 ? initialSelectedRoomIds : [room.id];
    setRoomAssignments(initialIds.map(id => {
      const r = allRooms.find(x => x.id === id);
      return { roomId: id, roomNumber: r?.number || '?', tariff: r?.price || 0, discount: 0, type: r?.type || '?' };
    }));
  }, []);

  const totals = useMemo(() => {
    const nights = Math.max(1, Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86400000)) || 1;
    const subTotal = roomAssignments.reduce((acc, r) => acc + ((r.tariff * nights) - r.discount), 0);
    const tax = (subTotal * (settings.taxRate || 0)) / 100;
    return { subTotal, tax, grandTotal: subTotal + tax };
  }, [roomAssignments, settings.taxRate, checkInDate, checkOutDate]);

  const handleSave = () => {
    if (!guest.name || !guest.phone || roomAssignments.length === 0) return alert("Fill mandatory fields.");
    const initialPayments = advanceAmount > 0 ? [{ id: 'ADV-' + Date.now(), amount: advanceAmount, date: new Date().toISOString(), method: paymentMode, remarks: 'Advance during check-in' }] : [];
    const gid = roomAssignments.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;
    const bookings = roomAssignments.map(ra => ({
      bookingNo: 'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      roomId: ra.roomId, groupId: gid, checkInDate, checkInTime, checkOutDate, checkOutTime, status: 'ACTIVE',
      basePrice: ra.tariff, discount: ra.discount, mealPlan, adults: guest.adults, occupants: occupants,
      charges: [], payments: initialPayments
    }));
    onSave({ guest, bookings });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
      <div className="bg-[#0f172a] w-full max-w-7xl rounded-none md:rounded-[3rem] shadow-2xl flex flex-col h-full md:h-[94vh] overflow-hidden border border-white/10">
        
        <div className="bg-[#020617] p-8 border-b border-white/5 flex justify-between items-center no-print">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-slate-400 hover:text-white transition-all">←</button>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Registry Protocol</h2>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">Authorized Resident Intake</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 transition-all">×</button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12 bg-[#0a0f1e]">
            
            <section className="space-y-8">
              <SectionHeader label="01" title="Primary Identity" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                   <Inp label="Mobile Number *" value={guest.phone} onChange={(v:any) => setGuest({...guest, phone: v})} />
                </div>
                <div className="md:col-span-2">
                   <Inp label="Full Legal Name *" value={guest.name} onChange={(v:any) => setGuest({...guest, name: v})} />
                </div>
                <Inp label="Nationality" value={guest.nationality} onChange={(v:any) => setGuest({...guest, nationality: v})} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Gender</label>
                  <select className="w-full bg-[#1e293b] border border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500" value={guest.gender} onChange={e => setGuest({...guest, gender: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">ID Type</label>
                  <select className="w-full bg-[#1e293b] border border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500" value={guest.idType} onChange={e => setGuest({...guest, idType: e.target.value as any})}>
                    <option value="Aadhar">Aadhar</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>
                <Inp label="ID Ref #" value={guest.idNumber} onChange={(v:any) => setGuest({...guest, idNumber: v})} />
              </div>
            </section>

            <section className="space-y-8">
               <SectionHeader label="02" title="Assets & Verification" />
               <div className="grid grid-cols-3 gap-6">
                  <div className="aspect-video bg-slate-900 border border-white/10 rounded-[2rem] flex items-center justify-center group relative overflow-hidden">
                     <span className="text-[10px] font-black text-slate-600 uppercase">Aadhar Front</span>
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <div className="aspect-video bg-slate-900 border border-white/10 rounded-[2rem] flex items-center justify-center group relative overflow-hidden">
                     <span className="text-[10px] font-black text-slate-600 uppercase">Aadhar Back</span>
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-white/10 rounded-[2rem]">
                     <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-500 mb-4 border border-white/5">📸</div>
                     <button className="bg-orange-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">LIVE PHOTO</button>
                  </div>
               </div>
            </section>
          </div>

          {/* Right Summary Sidebar */}
          <div className="w-full lg:w-[400px] bg-[#020617] border-l border-white/5 p-10 space-y-8 flex flex-col flex-shrink-0">
            <h3 className="font-black text-[11px] uppercase text-slate-500 tracking-[0.4em] text-center border-b border-white/5 pb-6">FOLIO MASTER</h3>
            <div className="flex-1 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Arriving" type="date" value={checkInDate} onChange={setCheckInDate} />
                  <Inp label="Time" type="time" value={checkInTime} onChange={setCheckInTime} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Departure" type="date" value={checkOutDate} onChange={setCheckOutDate} />
                  <Inp label="Time" type="time" value={checkOutTime} onChange={setCheckOutTime} />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Package Plan</label>
                 <select className="w-full bg-[#111] border border-white/10 p-4 rounded-2xl font-black text-[11px] text-white outline-none focus:border-orange-500" value={mealPlan} onChange={e => setMealPlan(e.target.value)}>
                   <option value="EP (Room Only)">EP (Room Only)</option>
                   <option value="CP (Room + B/Fast)">CP (Room + B/Fast)</option>
                 </select>
               </div>

               <div className="bg-[#0f172a] p-10 rounded-[3rem] border border-white/5 shadow-2xl text-center space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">NET PAYABLE</p>
                  <h4 className="text-5xl font-black text-white tracking-tighter">₹{totals.grandTotal.toFixed(0)}</h4>
                  <div className="h-px bg-white/5 mx-10"></div>
                  <div className="flex justify-between text-[11px] font-black text-slate-400 px-4">
                     <span>TAX @ {settings.taxRate}%</span>
                     <span className="text-white">₹{totals.tax.toFixed(0)}</span>
                  </div>
               </div>
               
               <Inp label="Advance Payment (₹)" type="number" value={advanceAmount.toString()} onChange={(v:any) => setAdvanceAmount(parseFloat(v))} />
            </div>

            <button onClick={handleSave} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-[0_20px_50px_rgba(230,92,0,0.2)] hover:bg-orange-700 transition-all transform active:scale-95">AUTHORIZE INTAKE ✅</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ label, title }: any) => (
  <div className="flex items-center gap-4">
    <span className="w-10 h-10 bg-orange-600 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">{label}</span>
    <h3 className="text-xl font-black uppercase tracking-tight text-white">{title}</h3>
    <div className="flex-1 h-px bg-white/5"></div>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-2 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">{label}</label>
    <input type={type} className="w-full bg-[#111] border border-white/10 p-4 rounded-2xl font-black text-[12px] text-white outline-none focus:border-orange-500 transition-all shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default GuestCheckin;

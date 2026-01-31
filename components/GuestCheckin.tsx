
import React, { useState, useEffect, useMemo } from 'react';
import { Room, Guest, Booking, HostelSettings, Payment, RoomStatus, Occupant } from '../types.ts';
import { INDIAN_STATES } from '../constants.tsx';
import CameraCapture from './CameraCapture.tsx';
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
    name: '',
    gender: 'Male',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    nationality: 'Indian',
    idType: 'Aadhar',
    idNumber: '',
    adults: 1,
    children: 0,
    kids: 0,
    others: 0, 
    documents: {}
  });

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [secondaryGuest, setSecondaryGuest] = useState({
    name: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    documents: { aadharFront: '', aadharBack: '' }
  });

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
  const [showGRCPreview, setShowGRCPreview] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);

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
      return {
        roomId: id,
        roomNumber: r?.number || '?',
        tariff: r?.price || 0,
        discount: 0,
        type: r?.type || '?'
      };
    });
    setRoomAssignments(assignments);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const stayDuration = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  }, [checkInDate, checkOutDate]);

  const financialTotals = useMemo(() => {
    const nights = stayDuration;
    const subTotal = roomAssignments.reduce((acc, r) => acc + ((r.tariff * nights) - r.discount), 0);
    const taxRate = settings.taxRate || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    return { subTotal, taxAmount, grandTotal };
  }, [roomAssignments, settings.taxRate, stayDuration]);

  const handleSearchGuest = () => {
    if (!guest.phone) return;
    const found = existingGuests.find(g => g.phone === guest.phone);
    if (found) setGuest({ ...found });
    else alert("No previous record found.");
  };

  const addOccupant = () => {
    setOccupants([...occupants, { id: Math.random().toString(36).substr(2, 9), name: '', gender: 'Male' }]);
  };

  const removeOccupant = (id: string) => {
    setOccupants(occupants.filter(o => o.id !== id));
  };

  const updateOccupant = (id: string, field: keyof Occupant, value: string) => {
    setOccupants(occupants.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: { type: string, id?: string, field?: string }) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => applyDocumentUpdate(target, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const applyDocumentUpdate = (target: { type: string, id?: string, field?: string }, data: string) => {
    if (target.type === 'OCCUPANT' && target.id && target.field) {
      setOccupants(prev => prev.map(o => o.id === target.id ? { ...o, [target.field as keyof Occupant]: data } : o));
    } else if (target.type === 'SECONDARY') {
      setSecondaryGuest(prev => ({ ...prev, documents: { ...prev.documents, [target.field as any]: data } }));
    } else {
      setGuest(prev => ({ ...prev, documents: { ...prev.documents, [target.field as any]: data } }));
    }
  };

  const handleCameraCapture = (imageData: string) => {
    if (activeDocCapture) applyDocumentUpdate(activeDocCapture as any, imageData);
    setIsCameraOpen(false);
    setActiveDocCapture(null);
  };

  const handleSave = () => {
    if (!guest.name || !guest.phone || roomAssignments.length === 0) {
      alert("Please fill name, phone and select at least one room.");
      return;
    }

    const initialPayments: Payment[] = advanceAmount > 0 ? [{
      id: 'ADV-' + Date.now(),
      amount: advanceAmount,
      date: new Date().toISOString(),
      method: paymentMode,
      remarks: 'Advance during check-in'
    }] : [];

    const sessionGroupId = roomAssignments.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;

    const bookings = roomAssignments.map(ra => ({
      bookingNo: 'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      roomId: ra.roomId,
      groupId: sessionGroupId,
      checkInDate, checkInTime, checkOutDate, checkOutTime,
      status: 'ACTIVE',
      basePrice: ra.tariff,
      discount: ra.discount, 
      mealPlan,
      adults: guest.adults, children: guest.children, kids: guest.kids, others: guest.others,
      charges: [], payments: initialPayments,
      occupants: occupants,
      secondaryGuest: secondaryGuest.name ? secondaryGuest : undefined
    }));

    onSave({ guest, bookings });
  };

  const vacantRooms = allRooms.filter(r => r.status === RoomStatus.VACANT && !roomAssignments.some(ra => ra.roomId === r.id));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="bg-[#f8fafc] w-full max-w-7xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden">
        
        <div className="bg-[#003d80] p-6 md:p-8 text-white flex justify-between items-center no-print flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleFullscreen}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center border border-white/20 transition-all shadow-lg"
              title="Toggle Fullscreen"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">Resident Registration</h2>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-1">Multi-Checkin & Master Intake Console</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowGRCPreview(true)} className="bg-blue-600 text-white px-4 md:px-6 py-3 rounded-2xl font-black text-[10px] md:text-xs uppercase shadow-xl hover:bg-black transition-all">Print GRC</button>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-12 bg-white">
            
            <section className="space-y-6">
              <SectionTitle index="01" title="Primary Guest Profile" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex gap-2 items-end md:col-span-2">
                  <Inp label="Mobile Number *" value={guest.phone} onChange={(v: string) => setGuest({...guest, phone: v})} />
                  <button onClick={handleSearchGuest} className="bg-blue-600 text-white px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase mb-0.5 shadow-lg">Lookup</button>
                </div>
                <Inp label="Full Name *" value={guest.name} onChange={(v: string) => setGuest({...guest, name: v})} className="md:col-span-2" />
                <Inp label="Nationality" value={guest.nationality} onChange={(v: string) => setGuest({...guest, nationality: v})} />
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                  <select className="w-full border-2 p-3.5 rounded-2xl text-[12px] font-black bg-slate-50 outline-none" value={guest.gender} onChange={e => setGuest({...guest, gender: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Document Type</label>
                  <select className="w-full border-2 p-3.5 rounded-2xl text-[12px] font-black bg-slate-50 outline-none" value={guest.idType} onChange={e => setGuest({...guest, idType: e.target.value as any})}>
                    <option value="Aadhar">Aadhar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="PAN">PAN Card</option>
                    <option value="VoterId">Voter ID</option>
                    <option value="License">Driving License</option>
                    <option value="Other">Other ID</option>
                  </select>
                </div>
                <Inp label="ID Reference Number" value={guest.idNumber} onChange={(v: string) => setGuest({...guest, idNumber: v})} />
                <Inp label="Email Address" value={guest.email} onChange={(v: string) => setGuest({...guest, email: v})} className="md:col-span-2" />
                <Inp label="Home Address" value={guest.address} onChange={(v: string) => setGuest({...guest, address: v})} className="md:col-span-2" />
                <Inp label="City" value={guest.city} onChange={(v: string) => setGuest({...guest, city: v})} />
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">State</label>
                  <select className="w-full border-2 p-3.5 rounded-2xl text-[12px] font-black bg-slate-50 outline-none" value={guest.state} onChange={e => setGuest({...guest, state: e.target.value})}>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex justify-between items-center">
                 <SectionTitle index="02" title="Group Occupants Registry" />
                 <button onClick={addOccupant} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black text-[9px] uppercase border-2 border-blue-100 hover:bg-blue-600 hover:text-white transition-all">+ Add Person</button>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {occupants.map((occ, idx) => (
                  <div key={occ.id} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6 relative group">
                     <button onClick={() => removeOccupant(occ.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 font-black text-xs">REMOVE</button>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-2">
                           <Inp label={`Occupant ${idx + 1} Full Name`} value={occ.name} onChange={(v: string) => updateOccupant(occ.id, 'name', v)} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                           <select className="w-full border-2 p-3.5 rounded-2xl text-[12px] font-black bg-white" value={occ.gender} onChange={e => updateOccupant(occ.id, 'gender', e.target.value as any)}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                           </select>
                        </div>
                        <div className="flex items-end gap-3">
                           <DocBoxMini label="ID Front" src={occ.idFront} onUpload={e => handleFileUpload(e, {type:'OCCUPANT', id: occ.id, field:'idFront'})} onSnap={() => { setActiveDocCapture({type:'OCCUPANT', id: occ.id, field:'idFront'}); setIsCameraOpen(true); }} />
                           <DocBoxMini label="ID Back" src={occ.idBack} onUpload={e => handleFileUpload(e, {type:'OCCUPANT', id: occ.id, field:'idBack'})} onSnap={() => { setActiveDocCapture({type:'OCCUPANT', id: occ.id, field:'idBack'}); setIsCameraOpen(true); }} />
                        </div>
                     </div>
                  </div>
                ))}
                {occupants.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed rounded-[3rem] text-slate-300 font-bold uppercase text-[10px]">No additional occupants added. Click "+ Add Person" to record group members.</div>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <SectionTitle index="03" title="KYC Assets & Photos" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                   <h4 className="text-[9px] font-black uppercase text-slate-400">Primary Identification</h4>
                   <div className="grid grid-cols-2 gap-4">
                    <DocBox label="ID Front" src={guest.documents?.aadharFront} onChange={(e: any) => handleFileUpload(e, {type:'PRIMARY', field:'aadharFront'})} onCapture={() => { setActiveDocCapture({type:'PRIMARY', field:'aadharFront'}); setIsCameraOpen(true); }} />
                    <DocBox label="ID Back" src={guest.documents?.aadharBack} onChange={(e: any) => handleFileUpload(e, {type:'PRIMARY', field:'aadharBack'})} onCapture={() => { setActiveDocCapture({type:'PRIMARY', field:'aadharBack'}); setIsCameraOpen(true); }} />
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-[2rem] bg-slate-50">
                   {guest.documents?.photo ? <img src={guest.documents.photo} className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white" /> : <div className="text-[9px] font-black text-slate-300">LIVE PHOTO</div>}
                   <button onClick={() => { setActiveDocCapture({type:'PRIMARY', field:'photo'}); setIsCameraOpen(true); }} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">Snap Face</button>
                </div>
                <div className="space-y-4">
                   <h4 className="text-[9px] font-black uppercase text-slate-400">Compliance Logic</h4>
                   <Inp label="Traveling From" value={guest.arrivalFrom} onChange={(v: string) => setGuest({...guest, arrivalFrom: v})} />
                   <Inp label="Next Destination" value={guest.nextDestination} onChange={(v: string) => setGuest({...guest, nextDestination: v})} />
                </div>
              </div>
            </section>

            <section className="space-y-6 pb-20">
              <div className="flex justify-between items-end border-b pb-4">
                 <SectionTitle index="04" title="Stay Inventory & Tariff" />
                 <button onClick={() => setShowRoomPicker(true)} className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">+ Add Room</button>
              </div>
              <div className="border rounded-[2.5rem] overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-900 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-5">Unit</th>
                      <th className="p-5">Category</th>
                      <th className="p-5 w-40 text-right">Daily Tariff (₹)</th>
                      <th className="p-5 w-40 text-right">One Time Discount (₹)</th>
                      <th className="p-5 w-40 text-right">Stay Value (₹)</th>
                      <th className="p-5 w-16 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-bold uppercase text-[12px] bg-white">
                    {roomAssignments.map((ra) => (
                      <tr key={ra.roomId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5 font-black text-lg text-blue-900 leading-none">{ra.roomNumber}</td>
                        <td className="p-5 text-slate-400 text-[10px]">{ra.type}</td>
                        <td className="p-5 text-right">
                          <input type="number" className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl p-2.5 font-black text-right outline-none text-blue-900" value={ra.tariff} onChange={(e) => setRoomAssignments(prev => prev.map(r => r.roomId === ra.roomId ? { ...r, tariff: parseFloat(e.target.value) || 0 } : r))} />
                        </td>
                        <td className="p-5 text-right">
                          <input type="number" className="w-full bg-red-50/30 border-2 border-transparent focus:border-red-500 rounded-xl p-2.5 font-black text-right outline-none text-red-600" value={ra.discount} onChange={(e) => setRoomAssignments(prev => prev.map(r => r.roomId === ra.roomId ? { ...r, discount: parseFloat(e.target.value) || 0 } : r))} />
                        </td>
                        <td className="p-5 text-right font-black text-green-700">₹{((ra.tariff * stayDuration) - ra.discount).toFixed(2)}</td>
                        <td className="p-5 text-center">
                           <button onClick={() => setRoomAssignments(roomAssignments.filter(r => r.roomId !== ra.roomId))} className="text-red-300 hover:text-red-600 text-xl transition-colors">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="lg:hidden pb-10">
               <button onClick={handleSave} className="w-full bg-[#003d80] text-white py-6 rounded-3xl font-black uppercase text-sm shadow-2xl hover:bg-black transition-all">Authorize Check-in Now</button>
            </div>
          </div>

          <div className="w-full lg:w-[380px] bg-slate-50 border-t lg:border-t-0 lg:border-l p-8 space-y-8 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar">
            <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest border-b pb-4">Folio Master Summary</h3>
            <div className="space-y-6 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Arrival Timeline</label>
                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-white p-3 rounded-2xl border text-[11px] font-black">{checkInDate}</div>
                   <div className="bg-white p-3 rounded-2xl border text-[11px] font-black">{checkInTime}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <Inp label="Exp. Checkout" type="date" value={checkOutDate} onChange={setCheckOutDate} />
                 <Inp label="Time" type="time" value={checkOutTime} onChange={setCheckOutTime} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Package Plan</label>
                <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-white outline-none" value={mealPlan} onChange={e => setMealPlan(e.target.value)}>
                  <option value="EP (Room Only)">EP (Room Only)</option>
                  <option value="CP (Room + B/Fast)">CP (Room + B/Fast)</option>
                  <option value="MAP (Room + 2 Meals)">MAP (Room + 2 Meals)</option>
                  <option value="AP (Room + All Meals)">AP (Room + All Meals)</option>
                </select>
              </div>
              <div className="h-px bg-slate-200"></div>
              <div className="space-y-4 p-8 bg-white border rounded-[2.5rem] shadow-sm">
                 <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Taxable Net</span>
                    <span>₹{financialTotals.subTotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>GST @ {settings.taxRate}%</span>
                    <span>₹{financialTotals.taxAmount.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between items-end border-t pt-4">
                    <p className="text-[10px] font-black uppercase text-blue-900 leading-none">Grand Total</p>
                    <p className="text-3xl font-black text-blue-900 leading-none tracking-tighter">₹{financialTotals.grandTotal.toFixed(2)}</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 <Inp label="Advance Settlement (₹)" type="number" value={advanceAmount.toString()} onChange={(v: string) => setAdvanceAmount(parseFloat(v) || 0)} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Receipt Mode</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black text-[11px] bg-white outline-none" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                       <option value="Cash">Cash Account</option>
                       <option value="UPI">Digital (UPI)</option>
                       <option value="Card">Bank Card</option>
                    </select>
                 </div>
              </div>
            </div>
            <div className="space-y-3 pt-6 lg:sticky lg:bottom-0 bg-slate-50 z-20 pb-4">
              <button onClick={handleSave} className="w-full bg-[#003d80] text-white py-6 rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:bg-black hover:scale-[1.02] transition-all">Authorize Check-in Now</button>
              <button onClick={onClose} className="w-full py-2 text-slate-400 font-black uppercase text-[9px] hover:text-red-500 transition-colors">Discard Registry</button>
            </div>
          </div>
        </div>

        {showRoomPicker && (
          <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
                   <h3 className="text-xl font-black uppercase tracking-tighter leading-tight">Inventory Selector</h3>
                   <button onClick={() => setShowRoomPicker(false)} className="uppercase text-[10px] font-black">Close</button>
                </div>
                <div className="p-10">
                   <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Select target vacant units for registration</p>
                   <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                      {vacantRooms.map(vr => (
                        <button key={vr.id} onClick={() => setRoomAssignments([...roomAssignments, { roomId: vr.id, roomNumber: vr.number, tariff: vr.price, discount: 0, type: vr.type }])} className="p-4 bg-slate-50 border-2 border-white hover:border-blue-500 rounded-2xl font-black uppercase transition-all shadow-sm">
                           <div className="text-lg leading-none">{vr.number}</div>
                        </button>
                      ))}
                      {vacantRooms.length === 0 && <p className="col-span-full text-center py-10 text-slate-300 italic">No available inventory found</p>}
                   </div>
                </div>
             </div>
          </div>
        )}

        {showGRCPreview && (
          <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col no-print-backdrop overflow-hidden">
             <div className="bg-black p-4 flex justify-between items-center no-print">
                <p className="text-white font-black uppercase text-xs">Form-C Official Preview</p>
                <button onClick={() => setShowGRCPreview(false)} className="text-white font-black uppercase text-xs">Close Preview [X]</button>
             </div>
             <div className="flex-1 overflow-y-auto bg-gray-500/20 p-8 custom-scrollbar">
                <GRCFormView guest={guest} booking={{ checkInDate, checkInTime, checkOutDate, checkOutTime }} room={room} settings={settings} />
             </div>
          </div>
        )}
      </div>
      {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => { setIsCameraOpen(false); setActiveDocCapture(null); }} />}
    </div>
  );
};

const SectionTitle = ({ index, title }: { index: string, title: string }) => (
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 bg-blue-900 rounded-2xl flex items-center justify-center text-white font-black text-xs shrink-0">{index}</div>
    <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">{title}</h3>
    <div className="h-px bg-slate-100 flex-1 ml-2"></div>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", className = "" }: any) => (
  <div className={`space-y-1 w-full text-left ${className}`}>
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-3.5 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:border-blue-500 transition-all text-black" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const DocBoxMini = ({ label, src, onUpload, onSnap }: any) => (
   <div className="relative w-16 h-12 bg-white border border-dashed rounded-lg flex flex-col items-center justify-center overflow-hidden group">
      {src ? <img src={src} className="w-full h-full object-cover" /> : <span className="text-[6px] font-black text-slate-300 uppercase">{label}</span>}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/80 flex items-center justify-center gap-1 transition-opacity">
         <div className="relative overflow-hidden p-1">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} />
         </div>
         <button type="button" onClick={onSnap} className="p-1">
            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
         </button>
      </div>
   </div>
);

const DocBox = ({ label, src, onChange, onCapture }: any) => (
  <div className="relative aspect-video bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center group hover:border-blue-400 transition-all shadow-sm">
    {src ? (
      <img src={src} className="w-full h-full object-cover" />
    ) : (
      <div className="text-center p-2">
        <svg className="w-6 h-6 text-slate-200 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center block">{label}</span>
      </div>
    )}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center gap-2 transition-opacity">
       <div className="relative overflow-hidden bg-white p-2 rounded-lg cursor-pointer">
          <span className="text-[8px] font-black uppercase">Upload</span>
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onChange} />
       </div>
       <button type="button" onClick={onCapture} className="bg-blue-600 text-white p-2 rounded-lg text-[8px] font-black uppercase">Snap</button>
    </div>
  </div>
);

export default GuestCheckin;

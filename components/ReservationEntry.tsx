
import React, { useState, useEffect } from 'react';
import { Guest, Room, HostelSettings } from '../types.ts';
import CameraCapture from './CameraCapture.tsx';

interface ReservationEntryProps {
  onClose: () => void;
  existingGuests: Guest[];
  rooms: Room[];
  // Fix: Align onSave signature with handleCheckinSave in App.tsx
  onSave: (data: { 
    guest: Partial<Guest>, 
    bookings: any[] 
  }) => void;
  settings: HostelSettings;
}

const ReservationEntry: React.FC<ReservationEntryProps> = ({ onClose, existingGuests, rooms, onSave, settings }) => {
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('11:00');

  const [mobileNo, setMobileNo] = useState('');
  const [guestName, setGuestName] = useState('');
  const [gender, setGender] = useState<'Male'|'Female'|'Other'>('Male');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [nationality, setNationality] = useState('Indian');
  const [purpose, setPurpose] = useState('TOUR');
  
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [kids, setKids] = useState('0');
  const [others, setOthers] = useState('0'); // Extra Bed

  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [discount, setDiscount] = useState('0');
  const [mealPlan, setMealPlan] = useState('EP (Room Only)');
  const [bookingAgent, setBookingAgent] = useState('Direct');

  const [secondaryGuest, setSecondaryGuest] = useState({
    name: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    documents: { aadharFront: '', aadharBack: '' }
  });

  const [bookingNo, setBookingNo] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Guest['documents']>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeDocCapture, setActiveDocCapture] = useState<{ type: keyof Guest['documents'], isSecondary: boolean } | null>(null);

  useEffect(() => {
    const d = new Date();
    setCheckInDate(d.toLocaleDateString('en-CA'));
    setCheckInTime(d.toTimeString().split(' ')[0].substring(0, 5));
    const tomorrow = new Date(d);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCheckOutDate(tomorrow.toLocaleDateString('en-CA'));
    setBookingNo('RES-' + Date.now().toString().slice(-6));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleSearchGuest = () => {
    const found = existingGuests.find(g => g.phone === mobileNo);
    if (found) {
      setGuestName(found.name);
      setGender(found.gender || 'Male');
      setEmail(found.email);
      setIdNumber(found.idNumber || '');
      setAddress(found.address);
      setCity(found.city);
      setState(found.state);
      setNationality(found.nationality || 'Indian');
      setDocuments(found.documents || {});
    } else {
      alert("No record found.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: keyof Guest['documents'], isSecondary = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        applyDocumentUpdate(docType, reader.result as string, isSecondary);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyDocumentUpdate = (docType: keyof Guest['documents'], data: string, isSecondary: boolean) => {
    if (isSecondary) {
      setSecondaryGuest(prev => ({ ...prev, documents: { ...prev.documents, [docType]: data } }));
    } else {
      setDocuments(prev => ({ ...prev, [docType]: data }));
    }
  };

  const handleCameraCapture = (imageData: string) => {
    if (activeDocCapture) {
      applyDocumentUpdate(activeDocCapture.type, imageData, activeDocCapture.isSecondary);
    }
    setIsCameraOpen(false);
    setActiveDocCapture(null);
  };

  const handleSave = () => {
    if (!mobileNo || !guestName || selectedRoomIds.length === 0) return alert("Fill mandatory fields and select a room.");
    
    // Fix: Construct bookings array to match App.tsx expectations
    const initialPayments = parseFloat(advanceAmount) > 0 ? [{
      id: 'ADV-' + Date.now(),
      amount: parseFloat(advanceAmount),
      date: new Date().toISOString(),
      method: advanceMethod,
      remarks: 'Advance during reservation'
    }] : [];

    const sessionGroupId = selectedRoomIds.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;

    const bookings = selectedRoomIds.map(roomId => {
      const r = rooms.find(x => x.id === roomId);
      return {
        bookingNo: 'RES-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        roomId: roomId,
        groupId: sessionGroupId,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        status: 'RESERVED',
        basePrice: r?.price || 0,
        discount: parseFloat(discount) || 0,
        mealPlan,
        agent: bookingAgent,
        adults: parseInt(adults),
        children: parseInt(children),
        kids: parseInt(kids),
        others: parseInt(others),
        charges: [],
        payments: initialPayments,
        secondaryGuest: secondaryGuest.name ? secondaryGuest : undefined,
        purpose: purpose
      };
    });

    onSave({
      guest: { 
        name: guestName, gender, phone: mobileNo, email, address, city, state, 
        nationality, idNumber, adults: parseInt(adults), children: parseInt(children), 
        kids: parseInt(kids), others: parseInt(others), documents, purposeOfVisit: purpose
      },
      bookings
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[1400px] h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
        <div className="bg-[#f59e0b] px-10 py-6 flex justify-between items-center text-white no-print">
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleFullscreen}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center border border-white/20 transition-all shadow-lg"
              title="Toggle Fullscreen"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Advanced Reservation Registry</h2>
              <p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-1">Ref ID: {bookingNo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden no-print">
          {/* Guest Info Column */}
          <div className="w-[380px] border-r bg-slate-50/50 p-8 overflow-y-auto custom-scrollbar space-y-6">
            <SectionHeader title="Guest Stay Details" />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Arrival Date" type="date" value={checkInDate} onChange={setCheckInDate} />
              <Inp label="Arrival Time" type="time" value={checkInTime} onChange={setCheckInTime} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Departure Date" type="date" value={checkOutDate} onChange={setCheckOutDate} />
              <Inp label="Departure Time" type="time" value={checkOutTime} onChange={setCheckOutTime} />
            </div>
            <div className="flex gap-2 items-end">
              <Inp label="Mobile No *" value={mobileNo} onChange={setMobileNo} />
              <button type="button" onClick={handleSearchGuest} className="bg-orange-500 text-white px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all mb-0.5">Find</button>
            </div>
            <Inp label="Display Name *" value={guestName} onChange={setGuestName} />
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                 <select className="w-full border-2 p-3 rounded-2xl text-[12px] font-black bg-white" value={gender} onChange={e => setGender(e.target.value as any)}>
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                   <option value="Other">Other</option>
                 </select>
               </div>
               <Inp label="Nationality" value={nationality} onChange={setNationality} />
            </div>
            
            <SectionHeader title="Stay & Meals" />
            <div className="space-y-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Meal Plan</label>
                 <select className="w-full border-2 p-3 rounded-2xl text-[12px] font-black bg-white" value={mealPlan} onChange={e => setMealPlan(e.target.value)}>
                   <option value="EP (Room Only)">EP (Room Only)</option>
                   <option value="CP (Room + B/Fast)">CP (Room + B/Fast)</option>
                   <option value="MAP (Room + 2 Meals)">MAP (Room + 2 Meals)</option>
                   <option value="AP (Room + All Meals)">AP (Room + All Meals)</option>
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Adult" type="number" value={adults} onChange={setAdults} />
                  <Inp label="Extra Bed" type="number" value={others} onChange={setOthers} />
               </div>
            </div>
          </div>

          {/* KYC & Identity Column */}
          <div className="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar bg-white">
            <SectionHeader title="Identity Document Vault" />
            <div className="grid grid-cols-3 gap-6">
              <DocBox label="Aadhar Front" src={documents.aadharFront} onUpload={e => handleFileUpload(e, 'aadharFront')} onCapture={() => { setActiveDocCapture({type:'aadharFront', isSecondary:false}); setIsCameraOpen(true); }} />
              <DocBox label="Aadhar Back" src={documents.aadharBack} onUpload={e => handleFileUpload(e, 'aadharBack')} onCapture={() => { setActiveDocCapture({type:'aadharBack', isSecondary:false}); setIsCameraOpen(true); }} />
              <DocBox label="PAN Card" src={documents.pan} onUpload={e => handleFileUpload(e, 'pan')} onCapture={() => { setActiveDocCapture({type:'pan', isSecondary:false}); setIsCameraOpen(true); }} />
              <div className="flex flex-col items-center justify-center gap-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-6">
                {documents.photo ? <img src={documents.photo} className="w-20 h-20 rounded-full object-cover" /> : <div className="text-[8px] font-black text-slate-300">GUEST PHOTO</div>}
                <button type="button" onClick={() => { setActiveDocCapture({type:'photo', isSecondary:false}); setIsCameraOpen(true); }} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Capture Guest</button>
              </div>
            </div>

            <SectionHeader title="Financial Information" />
            <div className="grid grid-cols-3 gap-6 bg-orange-50/50 p-8 rounded-[3rem] border border-orange-100">
               <Inp label="Advance Receive (₹)" type="number" value={advanceAmount} onChange={setAdvanceAmount} />
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Payment Mode</label>
                 <select className="w-full border-2 p-3 rounded-2xl text-[12px] font-black bg-white" value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}>
                   <option value="Cash">Cash Account</option>
                   <option value="UPI">UPI / Scan</option>
                   <option value="Card">Credit/Debit Card</option>
                   <option value="Bank">Bank Transfer</option>
                 </select>
               </div>
               <Inp label="Flat Discount (₹)" type="number" value={discount} onChange={setDiscount} />
            </div>
          </div>

          {/* Room Selection Column */}
          <div className="w-[320px] border-l bg-slate-50/50 p-8 flex flex-col">
            <SectionHeader title="Inventory Selection" />
            <div className="flex-1 mt-6 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-2 gap-3">
                {rooms.map(r => (
                  <button key={r.id} onClick={() => setSelectedRoomIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])} className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedRoomIds.includes(r.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-white hover:border-orange-200'}`}>Room {r.number}</button>
                ))}
              </div>
            </div>
            <button onClick={handleSave} className="w-full mt-8 bg-orange-600 text-white font-black py-5 rounded-[1.5rem] uppercase shadow-2xl hover:bg-black transition-all text-xs">Post Reservation</button>
          </div>
        </div>
      </div>
      {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => { setIsCameraOpen(false); setActiveDocCapture(null); }} />}
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-wider">{title}</h3>
  </div>
);

const Inp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-3 rounded-2xl text-[12px] font-black text-black bg-white focus:border-orange-500 transition-all outline-none" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

const DocBox = ({ label, src, onUpload, onCapture }: any) => (
  <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden hover:border-orange-400 transition-all group">
    {src ? <img src={src} className="w-full h-full object-cover" /> : (
      <div className="text-center p-4">
        <svg className="w-6 h-6 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        <span className="text-[9px] font-black uppercase text-slate-400 block">{label}</span>
      </div>
    )}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center gap-2 transition-opacity">
       <div className="relative overflow-hidden bg-white p-2 rounded-lg cursor-pointer">
          <span className="text-[8px] font-black uppercase">Upload</span>
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} />
       </div>
       <button type="button" onClick={onCapture} className="bg-orange-600 text-white p-2 rounded-lg text-[8px] font-black uppercase">Snap</button>
    </div>
  </div>
);

export default ReservationEntry;

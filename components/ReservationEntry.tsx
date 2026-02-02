import React, { useState, useEffect } from 'react';
import { Guest, Room, HostelSettings } from '../types.ts';
import CameraCapture from './CameraCapture.tsx';

interface ReservationEntryProps {
  onClose: () => void;
  existingGuests: Guest[];
  rooms: Room[];
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
  const [state, setState] = useState('Chhattisgarh');
  const [nationality, setNationality] = useState('Indian');
  const [purpose, setPurpose] = useState('TOUR');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [kids, setKids] = useState('0');
  const [others, setOthers] = useState('0');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [discount, setDiscount] = useState('0');
  const [mealPlan, setMealPlan] = useState('EP (Room Only)');
  const [bookingAgent, setBookingAgent] = useState('Direct');
  
  const [showSecondary, setShowSecondary] = useState(false);
  const [secondaryGuest, setSecondaryGuest] = useState({
    name: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '',
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

  const handlePhoneChange = (val: string) => {
    setMobileNo(val);
    if (val.length >= 10) {
      const found = existingGuests.find(g => g.phone === val);
      if (found) {
        setGuestName(found.name);
        setGender(found.gender || 'Male');
        setEmail(found.email || '');
        setIdNumber(found.idNumber || '');
        setAddress(found.address || '');
        setCity(found.city || '');
        setState(found.state || 'Chhattisgarh');
        setNationality(found.nationality || 'Indian');
        setDocuments(found.documents || {});
        alert(`CRM Sync: Returning guest ${found.name} identified.`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string, isSecondary = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => applyDocumentUpdate(docType as any, reader.result as string, isSecondary);
      reader.readAsDataURL(file);
    }
  };

  const applyDocumentUpdate = (docType: keyof Guest['documents'], data: string, isSecondary: boolean) => {
    if (isSecondary) setSecondaryGuest(prev => ({ ...prev, documents: { ...prev.documents, [docType]: data } }));
    else setDocuments(prev => ({ ...prev, [docType]: data }));
  };

  const handleCameraCapture = (imageData: string) => {
    if (activeDocCapture) applyDocumentUpdate(activeDocCapture.type, imageData, activeDocCapture.isSecondary);
    setIsCameraOpen(false);
    setActiveDocCapture(null);
  };

  const handleSave = () => {
    if (!mobileNo || !guestName || selectedRoomIds.length === 0) return alert("Fill mandatory fields and select a room.");
    const initialPayments = parseFloat(advanceAmount) > 0 ? [{ id: 'ADV-' + Date.now(), amount: parseFloat(advanceAmount), date: new Date().toISOString(), method: advanceMethod, remarks: 'Advance during reservation' }] : [];
    const sessionGroupId = selectedRoomIds.length > 1 ? 'GRP-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;
    const bookings = selectedRoomIds.map(roomId => {
      const r = rooms.find(x => x.id === roomId);
      return {
        bookingNo: 'RES-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        roomId: roomId,
        groupId: sessionGroupId,
        checkInDate, checkInTime, checkOutDate, checkOutTime,
        status: 'RESERVED',
        basePrice: r?.price || 0,
        discount: parseFloat(discount) || 0,
        mealPlan,
        agent: bookingAgent,
        adults: parseInt(adults), children: parseInt(children), kids: parseInt(kids), others: parseInt(others),
        charges: [], payments: initialPayments,
        secondaryGuest: secondaryGuest.name ? secondaryGuest : undefined,
        purpose: purpose
      };
    });
    onSave({ guest: { name: guestName, gender, phone: mobileNo, email, address, city, state, nationality, idNumber, adults: parseInt(adults), children: parseInt(children), kids: parseInt(kids), others: parseInt(others), documents, purposeOfVisit: purpose }, bookings });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 text-slate-900">
      <div className="bg-white w-full max-w-[1400px] h-full md:h-[95vh] rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
        <div className="bg-[#f59e0b] px-4 md:px-10 py-4 md:py-6 flex justify-between items-center text-white no-print">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Reservation Registry</h2>
              <p className="hidden sm:block text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-1">Ref ID: {bookingNo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 md:p-3 hover:bg-white/10 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
          <div className="w-full lg:w-[380px] border-r bg-slate-50/50 p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
            <SectionHeader title="Stay Details" />
            <div className="grid grid-cols-2 gap-3">
              <Inp label="Arrival" type="date" value={checkInDate} onChange={setCheckInDate} />
              <Inp label="Time" type="time" value={checkInTime} onChange={setCheckInTime} />
            </div>
            <Inp label="WhatsApp / Phone (CRM)*" value={mobileNo} onChange={handlePhoneChange} placeholder="99XXXXXXX" />
            <Inp label="Guest Display Name *" value={guestName} onChange={setGuestName} />
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Gender</label>
                 <select className="w-full border-2 p-3 rounded-xl text-[11px] font-black bg-white text-slate-900 outline-none" value={gender} onChange={e => setGender(e.target.value as any)}>
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                 </select>
               </div>
               <Inp label="Nationality" value={nationality} onChange={setNationality} />
            </div>
            <Inp label="City / Region" value={city} onChange={setCity} />
          </div>

          <div className="flex-1 p-4 md:p-10 space-y-8 overflow-y-auto custom-scrollbar bg-white">
            <div className="flex justify-between items-center">
              <SectionHeader title="Documentation Vault" />
              <button onClick={() => setShowSecondary(!showSecondary)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${showSecondary ? 'bg-orange-100 text-orange-600 shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                {showSecondary ? '- Remove Companion' : '+ Add Companion'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <DocBox label="ID Front" src={documents.aadharFront} onUpload={(e:any) => handleFileUpload(e, 'aadharFront')} onCapture={() => { setActiveDocCapture({type:'aadharFront', isSecondary:false}); setIsCameraOpen(true); }} />
              <DocBox label="ID Back" src={documents.aadharBack} onUpload={(e:any) => handleFileUpload(e, 'aadharBack')} onCapture={() => { setActiveDocCapture({type:'aadharBack', isSecondary:false}); setIsCameraOpen(true); }} />
              <div className="flex flex-col items-center justify-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-4">
                {documents.photo ? <img src={documents.photo} className="w-16 h-16 rounded-full object-cover shadow-md" /> : <div className="text-[8px] font-black text-slate-300 uppercase">PHOTO</div>}
                <button onClick={() => { setActiveDocCapture({type:'photo', isSecondary:false}); setIsCameraOpen(true); }} className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-sm">Capture</button>
              </div>
            </div>

            {showSecondary && (
              <div className="space-y-6 p-8 bg-orange-50/30 rounded-[3rem] border border-orange-100 animate-in slide-in-from-top-4 shadow-sm">
                <SectionHeader title="Secondary Guest (Companion)" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Inp label="Full Name" value={secondaryGuest.name} onChange={(v:any) => setSecondaryGuest({...secondaryGuest, name: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Gender</label>
                      <select className="w-full border-2 p-3 rounded-xl text-[11px] font-black bg-white text-slate-900 outline-none focus:border-orange-500" value={secondaryGuest.gender} onChange={e => setSecondaryGuest({...secondaryGuest, gender: e.target.value as any})}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <Inp label="Phone" value={secondaryGuest.phone} onChange={(v:any) => setSecondaryGuest({...secondaryGuest, phone: v})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DocBox label="Companion ID Front" src={secondaryGuest.documents.aadharFront} onUpload={(e:any) => handleFileUpload(e, 'aadharFront', true)} onCapture={() => { setActiveDocCapture({type:'aadharFront', isSecondary:true}); setIsCameraOpen(true); }} />
                  <DocBox label="Companion ID Back" src={secondaryGuest.documents.aadharBack} onUpload={(e:any) => handleFileUpload(e, 'aadharBack', true)} onCapture={() => { setActiveDocCapture({type:'aadharBack', isSecondary:true}); setIsCameraOpen(true); }} />
                </div>
              </div>
            )}

            <SectionHeader title="Financial Authorization" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-orange-50/50 p-6 rounded-[2rem] border border-orange-100">
               <Inp label="Advance Booking (₹)" type="number" value={advanceAmount} onChange={setAdvanceAmount} />
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Mode</label>
                 <select className="w-full border-2 p-3 rounded-xl text-[11px] font-black bg-white text-slate-900 outline-none focus:border-orange-500" value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}>
                   <option value="Cash">Cash Account</option>
                   <option value="UPI">Digital (UPI)</option>
                   <option value="Bank">Bank Transfer</option>
                 </select>
               </div>
               <Inp label="Special Discount (₹)" type="number" value={discount} onChange={setDiscount} />
            </div>
          </div>

          <div className="w-full lg:w-[320px] border-l bg-slate-50/50 p-6 flex flex-col shadow-inner">
            <SectionHeader title="Asset Selection" />
            <div className="flex-1 mt-4 overflow-y-auto custom-scrollbar pr-1">
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                {rooms.map(r => (
                  <button key={r.id} onClick={() => setSelectedRoomIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])} className={`p-3 rounded-lg border-2 text-[10px] font-black uppercase transition-all ${selectedRoomIds.includes(r.id) ? 'bg-orange-500 text-white border-orange-500 shadow-lg scale-105' : 'bg-white text-slate-600 border-white hover:border-orange-200'}`}>{r.number}</button>
                ))}
              </div>
            </div>
            <button onClick={handleSave} className="w-full mt-6 bg-orange-600 text-white font-black py-5 rounded-[1.5rem] uppercase shadow-2xl hover:bg-black transition-all text-xs tracking-widest">Commit Reservation</button>
          </div>
        </div>
      </div>
      {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => { setIsCameraOpen(false); setActiveDocCapture(null); }} />}
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-1.5 h-5 bg-orange-500 rounded-full"></div>
    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-wider">{title}</h3>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input 
      type={type} 
      className="w-full border-2 p-3 rounded-xl text-[11px] font-black text-slate-900 bg-white focus:border-orange-500 outline-none transition-all shadow-sm placeholder:text-slate-300" 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
    />
  </div>
);

const DocBox = ({ label, src, onUpload, onCapture }: any) => (
  <div className="relative aspect-video bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden group shadow-sm transition-all hover:border-orange-200">
    {src ? <img src={src} className="w-full h-full object-cover" /> : (
      <div className="text-center p-2">
        <svg className="w-5 h-5 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
      </div>
    )}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center gap-2 transition-all">
       <div className="relative overflow-hidden bg-white p-2 rounded-xl cursor-pointer shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
          <span className="text-[7px] font-black uppercase text-blue-900">Upload</span>
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} />
       </div>
       <button type="button" onClick={onCapture} className="bg-orange-600 text-white p-2 rounded-xl text-[7px] font-black uppercase shadow-xl transform scale-75 group-hover:scale-100 transition-transform">Snap</button>
    </div>
  </div>
);

export default ReservationEntry;
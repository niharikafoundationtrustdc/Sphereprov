
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Room, RoomStatus, Guest, Booking, HostelSettings, MenuItem, KOT } from '../types';
import CameraCapture from './CameraCapture';
import { GoogleGenAI } from '@google/genai';

interface GuestPortalProps {
  settings: HostelSettings;
  allRooms: Room[];
  onCheckinComplete: () => void;
}

const GuestPortal: React.FC<GuestPortalProps> = ({ settings, allRooms, onCheckinComplete }) => {
  const [view, setView] = useState<'HOME' | 'CHECKIN' | 'ORDER' | 'CHAT' | 'FIND_ROOM'>('HOME');
  const [mobile, setMobile] = useState('');
  const [guestName, setGuestName] = useState('');
  const [idFront, setIdFront] = useState('');
  const [bookingRef, setBookingRef] = useState<Booking | null>(null);
  const [searchMobile, setSearchMobile] = useState('');
  const [autoTable, setAutoTable] = useState<string | null>(null);
  
  // Order state
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [orderProcessing, setOrderProcessing] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect table parameter from URL (e.g., from QR scan)
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      setAutoTable(tableParam);
      // If table identified, show welcome message and go to order view maybe?
      console.debug(`Identified Guest Location: Table/Room ${tableParam}`);
    }

    db.menuItems.toArray().then(setMenu);
    
    // Set initial greeting from settings
    const welcome = settings.guestAppWelcome || `Hello! I'm your AI Concierge at ${settings.name}. How can I make your stay memorable today?`;
    setChatMessages([{ role: 'model', text: welcome }]);

    // Try to auto-load booking from session storage if exists
    const savedBookingId = sessionStorage.getItem('activeBookingId');
    if (savedBookingId) {
       db.bookings.get(savedBookingId).then(b => {
          if (b && b.status === 'ACTIVE') setBookingRef(b);
       });
    }
  }, [settings]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const findMyRoom = async () => {
     if (!searchMobile) return alert("Enter your registered mobile number.");
     const guest = await db.guests.where('phone').equals(searchMobile).first();
     if (!guest) return alert("No active registration found for this number.");
     const booking = await db.bookings.where('guestId').equals(guest.id).filter(b => b.status === 'ACTIVE').first();
     if (!booking) return alert("No active room found for this profile.");
     
     setBookingRef(booking);
     sessionStorage.setItem('activeBookingId', booking.id);
     setView('HOME');
  };

  const handleSelfCheckin = async () => {
    if (!mobile || !guestName || !idFront) return alert("Please fill all details and upload ID.");
    const room = allRooms.find(r => r.status === RoomStatus.VACANT);
    if (!room) return alert("No rooms available. Contact reception.");

    const guestId = `G-SELF-${Date.now()}`;
    const newGuest: Guest = {
      id: guestId, name: guestName, phone: mobile, email: '', address: 'Self Check-in',
      city: '', state: '', nationality: 'Indian', idType: 'Aadhar', idNumber: 'PENDING',
      adults: 1, children: 0, kids: 0, others: 0, documents: { aadharFront: idFront }
    };

    const now = new Date();
    const checkOutDate = new Date(now);
    checkOutDate.setDate(now.getDate() + 1);

    const booking: Booking = {
      id: `B-SELF-${Date.now()}`,
      bookingNo: `BK-S-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      roomId: room.id, guestId: guestId,
      checkInDate: now.toISOString().split('T')[0],
      checkInTime: now.toTimeString().split(' ')[0].substring(0, 5),
      checkOutDate: checkOutDate.toISOString().split('T')[0],
      checkOutTime: '11:00', status: 'ACTIVE', charges: [], payments: [],
      basePrice: room.price, discount: 0
    };

    await db.guests.put(newGuest);
    await db.bookings.put(booking);
    await db.rooms.update(room.id, { status: RoomStatus.OCCUPIED, currentBookingId: booking.id });

    setBookingRef(booking);
    sessionStorage.setItem('activeBookingId', booking.id);
    alert(`Authorized! Welcome to Room ${room.number}`);
    onCheckinComplete();
    setView('HOME');
  };

  const handleOrder = async () => {
    // If we have a QR scanned table, we allow ordering even without a bookingRef (as walk-in)
    const tableId = autoTable ? `TABLE-${autoTable}` : (bookingRef ? `ROOM-${allRooms.find(r => r.id === bookingRef.roomId)?.number}` : null);
    
    if (!tableId) {
       setView('FIND_ROOM');
       return;
    }
    if (cart.length === 0) return;

    setOrderProcessing(true);
    
    const kot: KOT = {
      id: `KOT-G-${Date.now()}`,
      tableId: tableId,
      outletId: menu[0]?.outletId || 'rest-main',
      waiterId: 'GUEST_PORTAL_QR',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, notes: `QR Self-Order` })),
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      bookingId: bookingRef?.id
    };

    await db.kots.put(kot);
    setCart([]);
    setOrderProcessing(false);
    alert(`Order Transmitted! Kitchen is notified for ${tableId}.`);
    setView('HOME');
  };

  const handleChat = async () => {
    if (!userInput.trim() || isTyping) return;

    const userText = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...chatMessages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction: `You are the professional AI Concierge and Raipur/Chhattisgarh Expert for ${settings.name}.
          
          PROPERTY DETAILS:
          Address: ${settings.address}. 
          WiFi: ${settings.wifiPassword || 'Guest_WiFi'}. 
          Room Service: Call ${settings.roomServicePhone || 'Reception'}.

          YOUR EXPERTISE & MISSION:
          1. Persona: ${settings.guestAppPersona || 'Expert Travel Guide for Chhattisgarh'}.
          2. Itinerary Planning: When asked for an itinerary, provide detailed, time-blocked plans (Day 1, Day 2, etc.).
          3. Local Highlights: Focus on Raipur landmarks (Marine Drive, Nandan Van, Mahant Ghasidas Memorial Museum), Sirpur (Historical sites), Chitrakote Falls, and Barnawapara Wildlife Sanctuary.
          
          RESPONSE STYLE:
          - Use Markdown for bolding and lists.
          - Be welcoming, professional, and helpful.`
        }
      });

      const modelResponse = response.text;
      if (modelResponse) {
        setChatMessages(prev => [...prev, { role: 'model', text: modelResponse }]);
      }
    } catch (err) {
      console.error("Concierge Error:", err);
      setChatMessages(prev => [...prev, { role: 'model', text: "I apologize, but I'm having trouble connecting to my service." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans selection:bg-orange-100 overflow-hidden">
      <header className="bg-gradient-to-r from-orange-600 to-orange-800 p-6 text-white text-center shadow-2xl relative z-10">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
           {view !== 'HOME' && <button onClick={() => setView('HOME')} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">←</button>}
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{settings.name}</h1>
        <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.3em] mt-1">
          {autoTable ? `Direct Access: Table ${autoTable}` : 'Smart Interaction Node'}
        </p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full flex flex-col relative overflow-hidden">
        {view === 'HOME' && (
          <div className="p-6 space-y-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl text-center border-2 border-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><span className="text-9xl">🛎️</span></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase mb-2">Hostel Guest Portal</h2>
              <p className="text-xs text-slate-400 mb-10 font-bold uppercase tracking-widest">Self-Service Terminal</p>
              
              <div className="grid grid-cols-2 gap-4">
                <MenuCard icon="🍽️" label="Order Food" onClick={() => setView('ORDER')} color="bg-orange-600" desc={autoTable ? `Serving Table ${autoTable}` : "In-Room Dining"} />
                <MenuCard icon="🔑" label="60s Check-in" onClick={() => setView('CHECKIN')} color="bg-blue-600" desc="Fast Identity" />
                <MenuCard icon="🤖" label="AI Concierge" onClick={() => setView('CHAT')} color="bg-indigo-600" desc="Raipur & Travel" />
                <MenuCard icon="🏨" label="Find My Room" onClick={() => setView('FIND_ROOM')} color="bg-slate-800" desc="Log into Folio" />
              </div>
            </div>

            {bookingRef && (
              <div className="bg-[#1a1a1a] p-8 rounded-[3rem] text-white shadow-2xl animate-in slide-in-from-top-4 border-l-[12px] border-orange-600">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Current Active Folio</p>
                      <h3 className="text-3xl font-black tracking-tighter">Room {allRooms.find(r => r.id === bookingRef.roomId)?.number}</h3>
                   </div>
                   <div className="bg-orange-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase">LINKED</div>
                </div>
              </div>
            )}
            
            {autoTable && !bookingRef && (
               <div className="bg-white p-6 rounded-[2rem] border-2 border-orange-500 shadow-lg animate-pulse flex items-center gap-4">
                  <span className="text-3xl">📍</span>
                  <div>
                     <p className="text-[10px] font-black uppercase text-orange-600">Location Identified</p>
                     <p className="text-sm font-bold text-slate-800">You are seated at Table {autoTable}</p>
                  </div>
               </div>
            )}
          </div>
        )}

        {view === 'FIND_ROOM' && (
           <div className="p-6 h-full flex flex-col animate-in slide-in-from-bottom-6">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-white space-y-8">
                 <div className="text-center">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Locate Folio</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Access room service & AI assistants</p>
                 </div>
                 <Inp label="Registered Mobile Number" value={searchMobile} onChange={setSearchMobile} placeholder="Enter number..." />
                 <button onClick={findMyRoom} className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-2xl hover:bg-black transition-all">Link My Room</button>
                 <button onClick={() => setView('CHECKIN')} className="w-full text-blue-600 font-black text-[10px] uppercase">Don't have a room? Express Check-in</button>
              </div>
           </div>
        )}

        {view === 'ORDER' && (
          <div className="p-6 h-full flex flex-col overflow-hidden animate-in fade-in">
             <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-2 border-white h-full flex flex-col">
                <div className="flex justify-between items-center border-b pb-6 mb-6">
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Dining Menu</h2>
                      <p className="text-[9px] font-black text-orange-600 uppercase mt-1">
                        {autoTable ? `Direct serving Table ${autoTable}` : 'Auto-marked to your room bill'}
                      </p>
                   </div>
                   <button onClick={() => setView('HOME')} className="text-slate-300 font-black text-xs uppercase">Back</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                   {menu.map(item => (
                     <div key={item.id} className="p-5 bg-slate-50 rounded-3xl flex justify-between items-center border border-slate-100 hover:border-orange-200 transition-all group">
                       <div className="flex-1">
                         <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${item.dietaryType === 'VEG' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                           <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                         </div>
                         <p className="text-[10px] font-bold text-orange-600 mt-1">₹{item.price}</p>
                       </div>
                       <button onClick={() => {
                         const ex = cart.find(c => c.item.id === item.id);
                         if (ex) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                         else setCart([...cart, {item, qty: 1}]);
                       }} className="bg-white border-2 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-orange-600 shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-all">+</button>
                     </div>
                   ))}
                </div>
                {cart.length > 0 && (
                  <div className="pt-8 border-t space-y-6 mt-6 animate-in slide-in-from-bottom-4">
                     <div className="flex justify-between font-black text-xl text-slate-900 uppercase">
                       <span>Total Order</span>
                       <span className="text-orange-700 tracking-tighter">₹{cart.reduce((s,c) => s + (c.item.price * c.qty), 0).toFixed(2)}</span>
                     </div>
                     <button onClick={handleOrder} disabled={orderProcessing} className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-xl hover:bg-black transition-all">
                       {autoTable ? 'Send to Kitchen Now' : 'Place Order (Room Mark)'}
                     </button>
                  </div>
                )}
             </div>
          </div>
        )}

        {view === 'CHAT' && (
          <div className="h-full flex flex-col animate-in slide-in-from-right-4 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden p-4">
              <div className="flex-1 overflow-y-auto space-y-6 mb-4 pr-1 custom-scrollbar px-2">
                 {chatMessages.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-medium leading-relaxed shadow-sm ${
                       m.role === 'user' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-100 whitespace-pre-wrap'
                     }`}>
                       {m.text}
                     </div>
                   </div>
                 ))}
                 {isTyping && (
                   <div className="flex justify-start">
                     <div className="bg-white text-slate-400 p-4 rounded-[2rem] rounded-bl-none text-xs italic shadow-sm border border-slate-50">
                        Ambassador is preparing your guide...
                     </div>
                   </div>
                 )}
                 <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white rounded-[2.5rem] shadow-2xl border-2 border-white flex gap-3 items-center">
                 <input 
                   disabled={isTyping}
                   className="flex-1 p-4 rounded-2xl font-bold text-sm bg-slate-50 outline-none text-slate-900" 
                   value={userInput} 
                   onChange={e => setUserInput(e.target.value)} 
                   placeholder={isTyping ? "Consulting local maps..." : "Ask for Raipur itineraries..."} 
                   onKeyDown={e => e.key === 'Enter' && handleChat()} 
                 />
                 <button 
                   disabled={isTyping || !userInput.trim()}
                   onClick={() => handleChat()} 
                   className={`bg-orange-600 text-white w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all ${isTyping ? 'opacity-50 grayscale' : 'hover:scale-105 active:scale-95'}`}
                 >
                   {isTyping ? '⏳' : '✈️'}
                 </button>
              </div>
            </div>
          </div>
        )}

        {view === 'CHECKIN' && (
          <div className="p-6 h-full flex flex-col animate-in slide-in-from-bottom-6 overflow-y-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-white space-y-8">
              <div className="text-center">
                 <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">60s Check-in</h2>
              </div>
              <Inp label="Your Full Name *" value={guestName} onChange={setGuestName} placeholder="As per ID" />
              <Inp label="WhatsApp Number *" value={mobile} onChange={setMobile} placeholder="For room entry" />
              <div className="space-y-3">
                <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center relative overflow-hidden">
                  {idFront ? <img src={idFront} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-300 uppercase">Upload ID</span>}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => setIdFront(r.result as string);
                      r.readAsDataURL(file);
                    }
                  }} />
                </div>
              </div>
              <button onClick={handleSelfCheckin} className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-2xl">Start My Stay</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MenuCard = ({ icon, label, onClick, color, desc }: any) => (
  <button onClick={onClick} className={`${color} p-6 rounded-[2.5rem] text-white flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden group`}>
    <span className="text-4xl mb-1">{icon}</span>
    <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
    <span className="text-[7px] font-bold uppercase opacity-60 tracking-widest">{desc}</span>
  </button>
);

const Inp = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">{label}</label>
    <input className="w-full border-2 p-5 rounded-3xl font-bold text-sm bg-slate-50 focus:bg-white focus:border-orange-600 transition-all outline-none text-slate-900 shadow-inner" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default GuestPortal;


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
  const [view, setView] = useState<'HOME' | 'CHECKIN' | 'ORDER' | 'CHAT'>('HOME');
  const [mobile, setMobile] = useState('');
  const [guestName, setGuestName] = useState('');
  const [idFront, setIdFront] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [bookingRef, setBookingRef] = useState<Booking | null>(null);
  
  // Order state
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: `Hello! I'm your AI Concierge at ${settings.name}. How can I make your stay memorable today? I can help with room service, local attractions, or even build a custom travel itinerary for you!` }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.menuItems.toArray().then(setMenu);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const handleSelfCheckin = async () => {
    if (!mobile || !guestName || !idFront) return alert("Please fill all details and upload ID.");
    
    const room = allRooms.find(r => r.status === RoomStatus.VACANT);
    if (!room) return alert("No rooms available for immediate check-in. Please contact reception.");

    const guestId = `G-SELF-${Date.now()}`;
    const newGuest: Guest = {
      id: guestId,
      name: guestName,
      phone: mobile,
      email: '',
      address: 'Self Check-in',
      city: '',
      state: '',
      nationality: 'Indian',
      idType: 'Aadhar',
      idNumber: 'PENDING',
      adults: 1,
      children: 0,
      kids: 0,
      others: 0,
      documents: { aadharFront: idFront }
    };

    const now = new Date();
    const checkOutDate = new Date(now);
    checkOutDate.setDate(now.getDate() + 1);

    const booking: Booking = {
      id: `B-SELF-${Date.now()}`,
      bookingNo: `BK-S-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      roomId: room.id,
      guestId: guestId,
      checkInDate: now.toISOString().split('T')[0],
      checkInTime: now.toTimeString().split(' ')[0].substring(0, 5),
      checkOutDate: checkOutDate.toISOString().split('T')[0],
      checkOutTime: '11:00',
      status: 'ACTIVE',
      charges: [],
      payments: [],
      basePrice: room.price,
      discount: 0
    };

    await db.guests.put(newGuest);
    await db.bookings.put(booking);
    
    const updatedRoom = { ...room, status: RoomStatus.OCCUPIED, currentBookingId: booking.id };
    await db.rooms.put(updatedRoom);

    const msg = `*Welcome to ${settings.name}!* \n\nHello ${guestName}, we are happy to have you in Room ${room.number}. \n\n*Important Links & Info:* \n🍴 Order Food: ${settings.restaurantMenuLink || window.location.href + '?portal=guest'} \n📶 WiFi Pass: ${settings.wifiPassword || 'hotel123'} \n📞 Reception: ${settings.receptionPhone || '9'} \n🛎️ Room Service: ${settings.roomServicePhone || '8'} \n\nEnjoy your stay!`;
    const whatsappUrl = `https://wa.me/${mobile.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');

    setBookingRef(booking);
    alert("Check-in successful! Welcome message sent to WhatsApp.");
    onCheckinComplete();
    setView('HOME');
  };

  const handleOrder = async () => {
    if (!bookingRef) return alert("Please check in first.");
    if (cart.length === 0) return;

    const kot: KOT = {
      id: `KOT-G-${Date.now()}`,
      tableId: 'ROOM_SERVICE',
      outletId: menu[0]?.outletId || 'default',
      waiterId: 'GUEST_SELF',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, notes: `Room Service Order` })),
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      bookingId: bookingRef.id
    };

    await db.kots.put(kot);
    setCart([]);
    alert("Order placed! Your meal is being prepared.");
    setView('HOME');
  };

  const handleChat = async (overrideInput?: string) => {
    const text = overrideInput || userInput;
    if (!text.trim()) return;
    
    const userMsg = { role: 'user' as const, text };
    setChatMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        SYSTEM INSTRUCTION:
        You are 'SphereConcierge', the highly sophisticated AI Travel Assistant for ${settings.name}.
        The guest is staying in room ${bookingRef?.roomId || 'TBA'}.
        
        GOALS:
        1. If asked for a travel plan or itinerary, provide a structured, hour-by-hour plan for the city. 
        2. Suggest local food, cultural spots, and transport options.
        3. Be professional, warm, and luxurious in tone.
        4. Use Markdown formatting (bold, lists, etc.) for readability.
        5. If they ask about hotel facilities, remind them: WiFi Pass is '${settings.wifiPassword}', Reception is '${settings.receptionPhone}'.

        GUEST INPUT: ${text}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const modelMsg = { role: 'model' as const, text: response.text || 'I apologize, but I am unable to process that right now. How else can I assist?' };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'model', text: 'Cloud connection interrupted. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans selection:bg-blue-100 overflow-hidden">
      <header className="bg-gradient-to-r from-[#003d80] to-[#001a33] p-6 text-white text-center shadow-2xl relative z-10">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
           {view !== 'HOME' && (
             <button onClick={() => setView('HOME')} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
             </button>
           )}
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{settings.name}</h1>
        <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.3em] mt-1">Smart Guest Portal</p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full flex flex-col relative overflow-hidden">
        {view === 'HOME' && (
          <div className="p-6 space-y-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl text-center border-2 border-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><span className="text-9xl">🏨</span></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase mb-2">Welcome to your stay</h2>
              <p className="text-xs text-slate-400 mb-10 font-bold uppercase tracking-widest">Self-Service Experience</p>
              
              <div className="grid grid-cols-2 gap-4">
                <MenuCard icon="🔑" label="60s Check-in" onClick={() => setView('CHECKIN')} color="bg-blue-600" desc="Fast identity verify" />
                <MenuCard icon="🍽️" label="In-Room Dining" onClick={() => setView('ORDER')} color="bg-emerald-600" desc="Order from menu" />
                <MenuCard icon="🤖" label="AI Concierge" onClick={() => setView('CHAT')} color="bg-indigo-600" desc="Travel & Itineraries" />
                <MenuCard icon="🛜" label="Fast WiFi" onClick={() => alert(`SSID: ${settings.name}_Guest\nPassword: ${settings.wifiPassword}`)} color="bg-orange-500" desc="Get password" />
              </div>
            </div>

            {bookingRef && (
              <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl animate-in slide-in-from-top-4">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Active Registration</p>
                      <h3 className="text-3xl font-black tracking-tighter">Room {allRooms.find(r => r.id === bookingRef.roomId)?.number}</h3>
                   </div>
                   <div className="bg-blue-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase">Authorized</div>
                </div>
                <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[9px] font-black text-white/40 uppercase">Checkout</p>
                      <p className="text-xs font-black uppercase">{bookingRef.checkOutDate}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-white/40 uppercase">Folio Ref</p>
                      <p className="text-xs font-black uppercase">#{bookingRef.bookingNo.slice(-6)}</p>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'CHECKIN' && (
          <div className="p-6 h-full flex flex-col animate-in slide-in-from-bottom-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-white space-y-8">
              <div className="text-center">
                 <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Express Entry</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Completion time: ~60 Seconds</p>
              </div>
              <Inp label="Your Full Name *" value={guestName} onChange={setGuestName} placeholder="As per ID Proof" />
              <Inp label="WhatsApp Mobile Number *" value={mobile} onChange={setMobile} placeholder="For digital welcome" />
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">ID Documentation (Photo)</label>
                <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center relative overflow-hidden group hover:border-blue-500 transition-all">
                  {idFront ? <img src={idFront} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Upload ID Card</span>}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => setIdFront(r.result as string);
                      r.readAsDataURL(file);
                    }
                  }} />
                </div>
                <button onClick={() => setIsCameraOpen(true)} className="w-full py-2 text-[10px] font-black uppercase text-blue-600 hover:text-blue-900 transition-colors">Or Capture Live Snap 📸</button>
              </div>
              <button onClick={handleSelfCheckin} className="w-full bg-[#003d80] text-white py-6 rounded-3xl font-black uppercase text-sm shadow-2xl hover:bg-black transition-all hover:scale-[1.02]">Finalize Check-in</button>
            </div>
          </div>
        )}

        {view === 'ORDER' && (
          <div className="p-6 h-full flex flex-col overflow-hidden animate-in fade-in">
             <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-2 border-white h-full flex flex-col">
                <div className="flex justify-between items-center border-b pb-6 mb-6">
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Kitchen Menu</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Direct Room Service Delivery</p>
                   </div>
                   <button onClick={() => setView('HOME')} className="text-slate-300 font-black text-xs uppercase hover:text-slate-900">Close</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                   {menu.map(item => (
                     <div key={item.id} className="p-5 bg-slate-50 rounded-3xl flex justify-between items-center border border-slate-100 hover:border-blue-200 transition-all group">
                       <div>
                         <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                         <p className="text-[10px] font-bold text-blue-600 mt-0.5">₹{item.price}</p>
                       </div>
                       <button onClick={() => {
                         const ex = cart.find(c => c.item.id === item.id);
                         if (ex) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                         else setCart([...cart, {item, qty: 1}]);
                       }} className="bg-white border-2 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">+</button>
                     </div>
                   ))}
                </div>
                {cart.length > 0 && (
                  <div className="pt-8 border-t space-y-6 mt-6 animate-in slide-in-from-bottom-4">
                     <div className="flex justify-between font-black text-xl text-slate-900 uppercase">
                       <span>Net Order Total</span>
                       <span className="text-blue-700 tracking-tighter">₹{cart.reduce((s,c) => s + (c.item.price * c.qty), 0).toFixed(2)}</span>
                     </div>
                     <button onClick={handleOrder} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-xl hover:bg-black transition-all">Submit Order to Kitchen</button>
                  </div>
                )}
             </div>
          </div>
        )}

        {view === 'CHAT' && (
          <div className="h-full flex flex-col animate-in slide-in-from-right-4 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden bg-white/40 backdrop-blur-md p-4">
              <div className="flex-1 overflow-y-auto space-y-6 mb-4 pr-1 custom-scrollbar px-2">
                 {chatMessages.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-medium leading-relaxed shadow-sm ${
                       m.role === 'user' 
                       ? 'bg-[#003d80] text-white rounded-br-none' 
                       : 'bg-white text-slate-800 rounded-bl-none border border-slate-100 whitespace-pre-wrap'
                     }`}>
                       {m.text}
                     </div>
                   </div>
                 ))}
                 {isTyping && (
                   <div className="flex justify-start">
                     <div className="bg-white/80 p-5 rounded-[2rem] rounded-bl-none border border-slate-100 flex gap-2 items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Assistant is thinking...</span>
                     </div>
                   </div>
                 )}
                 <div ref={chatEndRef} />
              </div>

              {/* QUICK ACTIONS */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 px-2">
                 <QuickChip label="Plan a 2-day trip 🗺️" onClick={() => handleChat("I want a detailed 2-day sightseeing itinerary for the city.")} />
                 <QuickChip label="Best local food 🍛" onClick={() => handleChat("What are the best local restaurants and street food spots nearby?")} />
                 <QuickChip label="Room Service 🛎️" onClick={() => handleChat("How can I order room service and what are the timings?")} />
                 <QuickChip label="WiFi Details 🛜" onClick={() => handleChat("What is the WiFi password?")} />
              </div>

              <div className="p-4 bg-white rounded-[2.5rem] shadow-2xl border-2 border-white flex gap-3 items-center">
                 <input 
                   className="flex-1 p-4 rounded-2xl font-bold text-sm bg-slate-50 outline-none focus:bg-white transition-all text-slate-900" 
                   value={userInput} 
                   onChange={e => setUserInput(e.target.value)} 
                   placeholder="Ask for an itinerary or help..." 
                   onKeyPress={e => e.key === 'Enter' && handleChat()} 
                 />
                 <button onClick={() => handleChat()} className="bg-indigo-600 text-white w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-lg hover:bg-black transition-all shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isCameraOpen && <CameraCapture onCapture={data => { setIdFront(data); setIsCameraOpen(false); }} onClose={() => setIsCameraOpen(false)} />}
    </div>
  );
};

const MenuCard = ({ icon, label, onClick, color, desc }: any) => (
  <button onClick={onClick} className={`${color} p-6 rounded-[2.5rem] text-white flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all relative overflow-hidden group`}>
    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <span className="text-4xl mb-1">{icon}</span>
    <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
    <span className="text-[7px] font-bold uppercase opacity-60 tracking-widest">{desc}</span>
  </button>
);

const QuickChip = ({ label, onClick }: any) => (
  <button onClick={onClick} className="bg-white border border-slate-200 px-6 py-2.5 rounded-full text-[10px] font-black text-slate-600 whitespace-nowrap hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
    {label}
  </button>
);

const Inp = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">{label}</label>
    <input className="w-full border-2 p-5 rounded-3xl font-bold text-sm bg-slate-50 focus:bg-white focus:border-blue-600 transition-all outline-none text-slate-900 shadow-inner" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default GuestPortal;

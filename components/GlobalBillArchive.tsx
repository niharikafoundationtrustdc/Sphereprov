
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Booking, DiningBill, EventBooking, FacilityUsage, GroupProfile, Guest, Room, HostelSettings, RoomStatus } from '../types';
import InvoiceView from './InvoiceView';

interface GlobalBillArchiveProps {
  onClose: () => void;
  settings: HostelSettings;
  guests: Guest[];
  rooms: Room[];
}

const GlobalBillArchive: React.FC<GlobalBillArchiveProps> = ({ onClose, settings, guests, rooms }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ROOM' | 'DINING' | 'FACILITY' | 'EVENT' | 'GROUP'>('ALL');
  
  const [data, setData] = useState<{
    roomBookings: Booking[];
    diningBills: DiningBill[];
    eventBookings: EventBooking[];
    facilityUsage: FacilityUsage[];
    groups: GroupProfile[];
  }>({
    roomBookings: [],
    diningBills: [],
    eventBookings: [],
    facilityUsage: [],
    groups: []
  });

  const [selectedRecord, setSelectedRecord] = useState<{ type: string, data: any } | null>(null);

  useEffect(() => {
    const load = async () => {
      setData({
        roomBookings: await db.bookings.toArray(),
        diningBills: await db.diningBills.toArray(),
        eventBookings: await db.eventBookings.toArray(),
        facilityUsage: await db.facilityUsage.toArray(),
        groups: await db.groups.toArray()
      });
    };
    load();
  }, []);

  const results = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const list: any[] = [];

    if (filter === 'ALL' || filter === 'ROOM') {
      data.roomBookings.forEach(b => {
        const guest = guests.find(g => g.id === b.guestId);
        const room = rooms.find(r => r.id === b.roomId);
        if (b.bookingNo.toLowerCase().includes(term) || (guest?.name || '').toLowerCase().includes(term) || (guest?.phone || '').includes(term) || (room?.number || '').includes(term)) {
          list.push({ type: 'ROOM', date: b.checkInDate, title: `Room ${room?.number || '?'}`, sub: guest?.name || 'Unknown', phone: guest?.phone, amount: b.basePrice, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'DINING') {
      data.diningBills.forEach(b => {
        if (b.billNo.toLowerCase().includes(term) || (b.guestName || '').toLowerCase().includes(term) || (b.guestPhone || '').includes(term)) {
          list.push({ type: 'DINING', date: (b.date || '').split('T')[0], title: `Dining Bill #${b.billNo}`, sub: b.guestName || 'Walk-in', phone: b.guestPhone, amount: b.grandTotal, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'EVENT') {
      data.eventBookings.forEach(b => {
        if ((b.eventName || '').toLowerCase().includes(term) || (b.guestName || '').toLowerCase().includes(term) || (b.guestPhone || '').includes(term)) {
          list.push({ type: 'EVENT', date: b.date, title: `Event: ${b.eventName}`, sub: b.guestName, phone: b.guestPhone, amount: b.totalAmount, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'FACILITY') {
      data.facilityUsage.forEach(u => {
        const guest = guests.find(g => g.id === u.guestId);
        const name = guest?.name || (u as any).outsiderInfo?.name || 'Walk-in';
        const phone = guest?.phone || (u as any).outsiderInfo?.phone || '';
        if (name.toLowerCase().includes(term) || phone.includes(term)) {
          list.push({ type: 'FACILITY', date: (u.startTime || '').split('T')[0], title: u.facilityId, sub: name, phone: phone, amount: u.amount, raw: u });
        }
      });
    }

    if (filter === 'ALL' || filter === 'GROUP') {
      data.groups.forEach(g => {
        if (g.groupName.toLowerCase().includes(term) || g.headName.toLowerCase().includes(term) || g.phone.includes(term)) {
          list.push({ type: 'GROUP', date: '-', title: `Group: ${g.groupName}`, sub: g.headName, phone: g.phone, amount: 0, raw: g });
        }
      });
    }

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data, searchTerm, filter, guests, rooms]);

  const shareWhatsApp = (res: any) => {
    if (!res.phone) return alert("No phone number available.");
    const msg = `*BILLING UPDATE - ${settings.name}*\n\nRef: ${res.title}\nDate: ${res.date}\nAmount: ₹${res.amount.toFixed(2)}\n\nThank you for choosing us!`;
    window.open(`https://wa.me/${res.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#f8fafc] w-full max-w-6xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
        
        <div className="bg-[#001a33] p-10 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Global Archive</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-2">Search receipts, share or print</p>
          </div>
          <button onClick={onClose} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all font-black uppercase text-xs">Close</button>
        </div>

        <div className="p-8 space-y-6 shrink-0 border-b bg-white">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input 
              type="text" 
              placeholder="Search Name, Phone, Bill No..." 
              className="flex-1 border-2 border-slate-200 p-5 rounded-2xl font-black text-sm bg-white text-slate-900 outline-none focus:border-blue-600 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-1 bg-slate-50 p-1.5 rounded-2xl border w-full md:w-auto overflow-x-auto scrollbar-hide">
              {(['ALL', 'ROOM', 'DINING', 'FACILITY', 'EVENT', 'GROUP'] as const).map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400 hover:text-blue-900'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((res, i) => (
            <div key={i} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-4">
                 <span className="text-[8px] font-black uppercase px-4 py-1 rounded-full bg-blue-100 text-blue-700">{res.type}</span>
              </div>
              <div className="mb-8">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{res.date}</p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{res.title}</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">{res.sub}</p>
              </div>
              <div className="flex flex-col gap-3 border-t pt-6">
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-[8px] font-black uppercase text-slate-300">Net Amount</p>
                    <p className="text-xl font-black text-blue-900">₹{res.amount.toFixed(2)}</p>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => shareWhatsApp(res)} className="flex-1 bg-[#25D366] text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg">WhatsApp</button>
                    <button onClick={() => setSelectedRecord({ type: res.type, data: res.raw })} className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg">View & Print</button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-[250] bg-slate-900 flex flex-col no-print-backdrop">
           <div className="bg-black p-4 flex justify-between items-center no-print">
              <button onClick={() => setSelectedRecord(null)} className="text-white px-8 py-2 border border-white/20 rounded-xl font-black text-xs uppercase">Close</button>
              <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-xl">Print [P]</button>
           </div>
           <div className="flex-1 overflow-y-auto bg-gray-500/30 p-10 custom-scrollbar">
              {selectedRecord.type === 'ROOM' && (
                <InvoiceView 
                  guest={guests.find(g => g.id === selectedRecord.data.guestId) || {} as any}
                  booking={selectedRecord.data}
                  room={rooms.find(r => r.id === selectedRecord.data.roomId) || {} as any}
                  settings={settings}
                  payments={selectedRecord.data.payments || []}
                />
              )}
              {selectedRecord.type === 'DINING' && (
                <div className="bg-white p-12 max-w-xl mx-auto rounded-3xl shadow-2xl">
                   <h1 className="text-2xl font-black uppercase text-center mb-8">{settings.name} - DINING</h1>
                   <div className="border-t border-b py-4 mb-4">
                      {selectedRecord.data.items.map((it: any, j: number) => (
                        <div key={j} className="flex justify-between text-sm py-1">
                           <span>{it.name} x{it.quantity}</span>
                           <span>₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                   </div>
                   <div className="text-right text-xl font-black">TOTAL: ₹{selectedRecord.data.grandTotal}</div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default GlobalBillArchive;

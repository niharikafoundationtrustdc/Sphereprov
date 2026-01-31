
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
// Fix: Import RoomStatus from types
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
          list.push({ type: 'ROOM', date: b.checkInDate, title: `Room ${room?.number || '?'}`, sub: guest?.name || 'Unknown', amount: b.basePrice, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'DINING') {
      data.diningBills.forEach(b => {
        if (b.billNo.toLowerCase().includes(term) || (b.guestName || '').toLowerCase().includes(term) || (b.guestPhone || '').includes(term)) {
          list.push({ type: 'DINING', date: (b.date || '').split('T')[0], title: `Dining Bill #${b.billNo}`, sub: b.guestName || 'Walk-in', amount: b.grandTotal, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'EVENT') {
      data.eventBookings.forEach(b => {
        if ((b.eventName || '').toLowerCase().includes(term) || (b.guestName || '').toLowerCase().includes(term) || (b.guestPhone || '').includes(term)) {
          list.push({ type: 'EVENT', date: b.date, title: `Event: ${b.eventName}`, sub: b.guestName, amount: b.totalAmount, raw: b });
        }
      });
    }

    if (filter === 'ALL' || filter === 'FACILITY') {
      data.facilityUsage.forEach(u => {
        const guest = guests.find(g => g.id === u.guestId);
        const name = guest?.name || (u as any).outsiderInfo?.name || 'Walk-in';
        const phone = guest?.phone || (u as any).outsiderInfo?.phone || '';
        if (name.toLowerCase().includes(term) || phone.includes(term)) {
          list.push({ type: 'FACILITY', date: (u.startTime || '').split('T')[0], title: u.facilityId, sub: name, amount: u.amount, raw: u });
        }
      });
    }

    if (filter === 'ALL' || filter === 'GROUP') {
      data.groups.forEach(g => {
        if (g.groupName.toLowerCase().includes(term) || g.headName.toLowerCase().includes(term) || g.phone.includes(term)) {
          list.push({ type: 'GROUP', date: '-', title: `Group: ${g.groupName}`, sub: g.headName, amount: 0, raw: g });
        }
      });
    }

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data, searchTerm, filter, guests, rooms]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#f8fafc] w-full max-w-6xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
        
        <div className="bg-[#001a33] p-10 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Universal Bill Archive</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-2">Duplicate Receipts • Cross-Module Search</p>
          </div>
          <button onClick={onClose} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all font-black uppercase text-xs">Exit Archive</button>
        </div>

        <div className="p-8 space-y-6 shrink-0 border-b bg-white">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative w-full">
              <input 
                type="text" 
                placeholder="Search Guest Name, Phone, Bill No, Room..." 
                className="w-full border-2 border-slate-200 p-5 rounded-2xl font-black text-sm bg-white text-slate-900 outline-none focus:border-blue-600 transition-all shadow-sm placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="absolute right-6 top-5 opacity-30 text-xl">🔍</span>
            </div>
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
            <div key={i} className="bg-white border-2 border-slate-50 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:border-blue-600 transition-all group relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-4">
                 <span className={`text-[8px] font-black uppercase px-4 py-1 rounded-full ${
                   res.type === 'DINING' ? 'bg-green-100 text-green-700' :
                   res.type === 'FACILITY' ? 'bg-sky-100 text-sky-700' :
                   res.type === 'EVENT' ? 'bg-orange-100 text-orange-700' :
                   'bg-blue-100 text-blue-700'
                 }`}>{res.type}</span>
              </div>
              <div className="mb-8">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{res.date}</p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{res.title}</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">{res.sub}</p>
              </div>
              <div className="flex justify-between items-end border-t pt-6">
                 <div>
                    <p className="text-[8px] font-black uppercase text-slate-300">Amount</p>
                    <p className="text-xl font-black text-blue-900">₹{res.amount.toFixed(2)}</p>
                 </div>
                 <button 
                   onClick={() => setSelectedRecord({ type: res.type, data: res.raw })}
                   className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest group-hover:bg-blue-600 transition-colors shadow-lg"
                 >
                    Reprint Bill
                 </button>
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div className="col-span-full py-40 text-center opacity-20 flex flex-col items-center">
               <span className="text-6xl mb-4">📂</span>
               <p className="font-black uppercase tracking-[0.3em] text-xl">No Matching Records</p>
            </div>
          )}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-[250] bg-slate-900 flex flex-col no-print-backdrop">
           <div className="bg-black p-4 flex justify-between items-center no-print">
              <p className="text-white font-black uppercase text-xs">Duplicate Bill Preview • {selectedRecord.type}</p>
              <div className="flex gap-4">
                 <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-xl">Print [P]</button>
                 <button onClick={() => setSelectedRecord(null)} className="text-white px-8 py-2 border border-white/20 rounded-xl font-black text-xs uppercase">Close [Esc]</button>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto bg-gray-500/30 p-10 custom-scrollbar">
              {selectedRecord.type === 'ROOM' && (
                <InvoiceView 
                  guest={guests.find(g => g.id === selectedRecord.data.guestId) || { id: 'unknown', name: 'Archived Guest', phone: '', documents: {} } as Guest}
                  booking={selectedRecord.data}
                  room={rooms.find(r => r.id === selectedRecord.data.roomId) || { id: 'unknown', number: '?', floor: 0, type: 'Unknown', price: 0, status: RoomStatus.VACANT }}
                  settings={settings}
                  payments={selectedRecord.data.payments || []}
                />
              )}
              {selectedRecord.type === 'DINING' && (
                <DiningInvoiceView bill={selectedRecord.data} settings={settings} />
              )}
              {(selectedRecord.type !== 'ROOM' && selectedRecord.type !== 'DINING') && (
                <div className="bg-white p-12 max-w-3xl mx-auto rounded-xl shadow-2xl text-center font-black uppercase text-slate-900">
                  Detailed duplicate view for {selectedRecord.type} coming soon.
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

const DiningInvoiceView = ({ bill, settings }: { bill: DiningBill, settings: HostelSettings }) => (
  <div className="bg-white p-10 w-[148mm] min-h-[210mm] mx-auto border shadow-2xl font-sans text-[11px] leading-tight invoice-sheet text-slate-900">
     <div className="text-center border-b-2 pb-6 mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tighter text-blue-900">{settings.name}</h1>
        <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">{settings.address}</p>
        <p className="text-[10px] font-black text-blue-700 mt-2">DINING BILL • #{bill.billNo}</p>
     </div>
     <div className="flex justify-between mb-8 font-bold uppercase text-[9px]">
        <div>
           <p className="text-slate-400">Date: {new Date(bill.date).toLocaleString()}</p>
           <p>Station: Table {bill.tableNumber}</p>
        </div>
        <div className="text-right">
           <p>Guest: {bill.guestName}</p>
           {bill.roomBookingId && <p className="text-blue-600">Post to Room</p>}
        </div>
     </div>
     <table className="w-full text-left mb-8 border-t border-b py-4">
        <thead>
           <tr className="text-[8px] font-black uppercase text-slate-400">
              <th className="pb-3">Item</th>
              <th className="pb-3 text-center">Qty</th>
              <th className="pb-3 text-right">Price</th>
              <th className="pb-3 text-right">Total</th>
           </tr>
        </thead>
        <tbody className="font-bold uppercase">
           {(bill.items || []).map((it, i) => (
              <tr key={i}>
                 <td className="py-2">{it.name}</td>
                 <td className="py-2 text-center">x{it.quantity}</td>
                 <td className="py-2 text-right">₹{it.price.toFixed(2)}</td>
                 <td className="py-2 text-right">₹{(it.price * it.quantity).toFixed(2)}</td>
              </tr>
           ))}
        </tbody>
     </table>
     <div className="space-y-2 font-black uppercase text-right border-t pt-4">
        <div className="flex justify-between text-[10px] opacity-60"><span>Subtotal</span><span>₹{(bill.subTotal || 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-[10px] opacity-60"><span>Tax</span><span>₹{(bill.taxAmount || 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-lg border-t pt-2 text-blue-900 tracking-tighter"><span>Grand Total</span><span>₹{(bill.grandTotal || 0).toFixed(2)}</span></div>
     </div>
     <div className="mt-12 text-center text-[9px] font-black opacity-30 uppercase tracking-widest">
        *** Thank you for dining with us ***
     </div>
  </div>
);

export default GlobalBillArchive;

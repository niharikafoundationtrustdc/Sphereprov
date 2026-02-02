import React, { useState, useMemo } from 'react';
import { Booking, Guest, Room, Charge, Payment, RoomStatus, Transaction } from '../types.ts';
import InvoiceView from './InvoiceView.tsx';

interface StayManagementProps {
  booking: Booking;
  guest: Guest;
  room: Room;
  allRooms: Room[];
  allBookings: Booking[];
  settings: any;
  onUpdate: (booking: Booking) => void;
  onAddPayment: (bookingId: string, payment: Payment) => void;
  onUpdateGuest: (guest: Guest) => void;
  onShiftRoom: (bookingId: string, newRoomId: string, reason: string) => void;
  onClose: () => void;
}

const StayManagement: React.FC<StayManagementProps> = ({ 
  booking, guest, room, allRooms, allBookings, settings, onUpdate, onAddPayment, onUpdateGuest, onShiftRoom, onClose 
}) => {
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showShiftConsole, setShowShiftConsole] = useState(false);
  
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'Cash', remarks: '' });
  const [newCharge, setNewCharge] = useState({ description: '', amount: '' });
  const [newShift, setNewShift] = useState({ roomId: '', reason: '' });
  const [extendDate, setExtendDate] = useState(booking.checkOutDate);

  const totals = useMemo(() => {
    const start = new Date(booking.checkInDate);
    const end = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) || 1;
    const roomRent = (booking.basePrice || 0) * nights;
    const serviceCharges = (booking.charges || []).reduce((sum, c) => sum + c.amount, 0);
    const totalPayments = (booking.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const discount = booking.discount || 0;
    const taxable = roomRent + serviceCharges - discount;
    const tax = (taxable * (settings.taxRate || 0)) / 100;
    const grandTotal = taxable + tax;
    const balance = grandTotal - totalPayments;
    return { roomRent, serviceCharges, totalPayments, discount, taxable, tax, grandTotal, balance, nights };
  }, [booking, settings.taxRate]);

  const handleCheckout = () => {
    if (totals.balance > 0 && !confirm(`Unsettled Balance: ₹${totals.balance.toFixed(0)}. Checkout?`)) return;
    const now = new Date();
    onUpdate({ ...booking, status: 'COMPLETED', checkOutDate: now.toISOString().split('T')[0], checkOutTime: now.toTimeString().split(' ')[0].slice(0, 5) });
    onClose();
  };

  const handlePostCharge = () => {
     if (!newCharge.description || !newCharge.amount) return alert("Validation: Description and Amount required.");
     const charge: Charge = {
        id: `CHG-${Date.now()}`,
        description: newCharge.description,
        amount: parseFloat(newCharge.amount),
        date: new Date().toISOString()
     };
     onUpdate({ ...booking, charges: [...(booking.charges || []), charge] });
     setNewCharge({ description: '', amount: '' });
     setShowAddCharge(false);
  };

  const shareWhatsApp = () => {
    const msg = `*STAY SUMMARY: ${settings.name}*\n\n` +
      `*Guest:* ${guest.name}\n` +
      `*Room:* ${room.number} (${room.type})\n` +
      `*Nights:* ${totals.nights}\n` +
      `--------------------------\n` +
      `*Total Bill:* ₹${totals.grandTotal.toFixed(0)}\n` +
      `*Total Received:* ₹${totals.totalPayments.toFixed(0)}\n` +
      `*Pending Balance:* ₹${totals.balance.toFixed(0)}\n\n` +
      `Please contact reception for detailed digital invoice. Thank you!`;
    window.open(`https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExtendStay = () => {
    if (extendDate === booking.checkOutDate) return;
    onUpdate({ ...booking, checkOutDate: extendDate });
    alert("Stay authorization extended.");
  };

  const handleExecuteShift = () => {
     if (!newShift.roomId || !newShift.reason) return alert("Select new room and provide shift reason.");
     onShiftRoom(booking.id, newShift.roomId, newShift.reason);
     setShowShiftConsole(false);
     onClose();
  };

  const availableForShift = useMemo(() => {
     return allRooms.filter(r => r.status === RoomStatus.VACANT || r.status === RoomStatus.DIRTY);
  }, [allRooms]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-7xl h-full md:h-[94vh] rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-12">
        
        <div className="bg-slate-50 p-8 border-b flex flex-col md:flex-row justify-between items-center no-print shrink-0 gap-6">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">←</button>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">{guest.name}</h2>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Room {room.number} • {room.type}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
             <button onClick={shareWhatsApp} className="bg-[#25D366] text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:brightness-90 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                WhatsApp Summary
             </button>
             <button onClick={() => setShowShiftConsole(true)} className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:bg-blue-600 hover:text-white transition-all">Shift Unit</button>
             <button onClick={() => setShowPrintView(true)} className="bg-white border border-slate-200 px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:border-blue-600">Invoice Preview</button>
             <button onClick={handleCheckout} className="bg-orange-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-slate-900 transition-all">Authorize Checkout</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-4 gap-10 bg-white">
          <div className="lg:col-span-3 space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <SummaryStat label="BALANCE" value={`₹${totals.balance.toFixed(0)}`} color="bg-rose-50 text-rose-600 border-rose-100" />
               <SummaryStat label="RECEIVED" value={`₹${totals.totalPayments.toFixed(0)}`} color="bg-emerald-50 text-emerald-600 border-emerald-100" />
               <SummaryStat label="DISCOUNT" value={`₹${totals.discount.toFixed(0)}`} color="bg-orange-50 text-orange-600 border-orange-100" />
               <SummaryStat label="BILL TOTAL" value={`₹${totals.grandTotal.toFixed(0)}`} color="bg-blue-50 text-blue-600 border-blue-100" />
            </div>

            <section className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 space-y-8">
              <div className="flex justify-between items-center border-b pb-6">
                <h3 className="font-black text-slate-900 uppercase text-sm">Folio Timeline</h3>
                <div className="flex gap-2">
                   <button onClick={() => setShowAddCharge(true)} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase">Post Charge</button>
                   <button onClick={() => setShowAddPayment(true)} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">New Receipt</button>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div>
                       <p className="text-[11px] font-black text-slate-900 uppercase">Room Rent</p>
                       <p className="text-[9px] font-bold text-slate-400 mt-1">{totals.nights} NIGHTS @ ₹{booking.basePrice}</p>
                    </div>
                    <p className="text-lg font-black text-slate-900">₹{totals.roomRent.toFixed(0)}</p>
                 </div>
                 {(booking.charges || []).map(c => (
                   <div key={c.id} className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div>
                         <p className="text-[11px] font-black text-slate-900 uppercase">{c.description}</p>
                         <p className="text-[8px] font-bold text-slate-400 mt-1">{c.date.split('T')[0]}</p>
                      </div>
                      <p className="text-lg font-black text-orange-600">₹{c.amount.toFixed(0)}</p>
                   </div>
                 ))}
                 {(booking.payments || []).map(p => (
                   <div key={p.id} className="flex justify-between items-center p-5 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm">
                      <div>
                         <p className="text-[11px] font-black text-emerald-700 uppercase">Payment: {p.method}</p>
                         <p className="text-[8px] font-bold text-emerald-400 mt-1">{p.date.split('T')[0]}</p>
                      </div>
                      <p className="text-lg font-black text-emerald-600">−₹{p.amount.toFixed(0)}</p>
                   </div>
                 ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl space-y-6">
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50 mb-3">Payable Balance</p>
                <h3 className="text-5xl font-black tracking-tighter">₹{totals.balance.toFixed(0)}</h3>
              </div>
              <button onClick={() => setShowAddPayment(true)} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg hover:scale-105 transition-all">Settle Account</button>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
               <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-4 tracking-widest">Modify Stay</h4>
               <div className="space-y-4">
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase text-slate-400 ml-1">New Checkout Date</label>
                     <input type="date" className="w-full border-2 p-3 rounded-xl font-black text-xs bg-white text-slate-900 outline-none" value={extendDate} onChange={e => setExtendDate(e.target.value)} />
                  </div>
                  <button onClick={handleExtendStay} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-md hover:bg-black transition-all">Extend Authorization</button>
               </div>
            </div>
          </div>
        </div>

        {/* MODAL: POST CHARGE */}
        {showAddCharge && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-3xl animate-in zoom-in">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center rounded-t-[2.5rem]">
                   <h3 className="text-xl font-black text-slate-900 uppercase">Post Extra Charge</h3>
                   <button onClick={() => setShowAddCharge(false)} className="text-slate-400 text-2xl font-black">×</button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Charge Description</label>
                      <input type="text" className="w-full bg-white border-2 border-slate-200 p-4 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-blue-500" placeholder="e.g. Extra Bed / Late Checkout" value={newCharge.description} onChange={e => setNewCharge({...newCharge, description: e.target.value})} />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Amount (₹)</label>
                      <input type="number" className="w-full bg-white border-2 border-slate-200 p-4 rounded-xl text-2xl font-black text-blue-900 outline-none focus:border-blue-500" value={newCharge.amount} onChange={e => setNewCharge({...newCharge, amount: e.target.value})} />
                   </div>
                   <button onClick={handlePostCharge} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Commit to Folio</button>
                </div>
             </div>
          </div>
        )}

        {/* MODAL: ROOM SHIFT */}
        {showShiftConsole && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-3xl animate-in zoom-in overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-10 border-b bg-blue-900 text-white flex justify-between items-center">
                   <div>
                     <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Unit Shift Console</h3>
                     <p className="text-[10px] font-bold uppercase text-blue-300 mt-2">Moving folio from {room.number} to a new unit</p>
                   </div>
                   <button onClick={() => setShowShiftConsole(false)} className="text-white/40 text-xs font-black uppercase">Dismiss</button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                   <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-4">1. Select Destination Unit</h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                         {availableForShift.map(r => (
                           <button 
                             key={r.id} 
                             onClick={() => setNewShift({...newShift, roomId: r.id})}
                             className={`aspect-square rounded-2xl border-2 font-black uppercase flex flex-col items-center justify-center transition-all ${newShift.roomId === r.id ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-xl' : 'bg-slate-50 border-white text-slate-300 hover:border-blue-200'}`}
                           >
                              <span className="text-lg leading-none">{r.number}</span>
                              <span className="text-[7px] mt-1 opacity-60">{r.type.split(' ')[0]}</span>
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-4">2. Protocol: Shift Justification</h4>
                      <textarea 
                        className="w-full bg-white border-2 p-5 rounded-[2rem] font-bold text-sm text-slate-900 outline-none focus:border-blue-500 h-32 resize-none shadow-inner" 
                        placeholder="State reason for shifting (e.g. Guest Request, Technical Fault, Cleaning Needed)..."
                        value={newShift.reason}
                        onChange={e => setNewShift({...newShift, reason: e.target.value})}
                      ></textarea>
                   </div>
                </div>
                <div className="p-8 bg-slate-50 border-t flex gap-4">
                   <button onClick={() => setShowShiftConsole(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs">Cancel Shift</button>
                   <button onClick={handleExecuteShift} className="flex-[3] bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-[1.02] transition-all">Authorize Shift & Mark Old Unit Dirty</button>
                </div>
             </div>
          </div>
        )}

        {showAddPayment && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-3xl animate-in zoom-in">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center rounded-t-[2.5rem]">
                   <h3 className="text-xl font-black text-slate-900 uppercase">Record Receipt</h3>
                   <button onClick={() => setShowAddPayment(false)} className="text-slate-400 text-2xl font-black">×</button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Amount (₹)</label>
                      <input type="number" className="w-full bg-white border-2 border-slate-200 p-4 rounded-xl text-3xl font-black text-slate-900 text-center outline-none focus:border-blue-500" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400">Ledger</label>
                      <select className="w-full bg-white border-2 border-slate-200 p-4 rounded-xl font-black text-sm text-slate-900" value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI/Online</option>
                          <option value="Card">Bank Card</option>
                      </select>
                   </div>
                   <button onClick={() => {
                      const amt = parseFloat(newPayment.amount) || 0;
                      if(amt > 0) {
                         onAddPayment(booking.id, { id: `PAY-${Date.now()}`, amount: amt, date: new Date().toISOString(), method: newPayment.method });
                         setShowAddPayment(false);
                      }
                   }} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Post Payment</button>
                </div>
             </div>
          </div>
        )}

        {showPrintView && (
           <div className="fixed inset-0 z-[300] bg-white flex flex-col no-print-backdrop">
              <div className="p-4 bg-slate-100 flex justify-between items-center no-print">
                 <button onClick={() => setShowPrintView(false)} className="bg-white border px-6 py-2 rounded-xl text-[10px] font-black">Close [X]</button>
                 <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-2 rounded-xl text-[10px] font-black shadow-lg">Print Document</button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                 <InvoiceView guest={guest} booking={booking} room={room} settings={settings} payments={booking.payments || []} />
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

const SummaryStat = ({ label, value, color }: any) => (
  <div className={`p-6 rounded-[2rem] border-2 shadow-sm flex flex-col justify-center text-center ${color}`}>
    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">{label}</p>
    <p className="text-2xl font-black tracking-tighter">{value}</p>
  </div>
);

export default StayManagement;
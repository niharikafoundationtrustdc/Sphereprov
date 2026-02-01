
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
  onShiftRoom: (newRoomId: string) => void;
  onClose: () => void;
}

const StayManagement: React.FC<StayManagementProps> = ({ 
  booking, guest, room, allRooms, allBookings, settings, onUpdate, onAddPayment, onUpdateGuest, onShiftRoom, onClose 
}) => {
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  
  const [newCharge, setNewCharge] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'Cash', remarks: '' });

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
    if (totals.balance > 0 && !confirm(`Unsettled Balance of ₹${totals.balance.toFixed(0)}. Checkout anyway?`)) return;
    const now = new Date();
    onUpdate({ ...booking, status: 'COMPLETED', checkOutDate: now.toISOString().split('T')[0], checkOutTime: now.toTimeString().split(' ')[0].slice(0, 5) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-4">
      <div className="bg-[#0f172a] w-full max-w-7xl h-full md:h-[94vh] rounded-none md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in slide-in-from-bottom-12 duration-500">
        
        <div className="bg-[#020617] p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center no-print flex-shrink-0 gap-6 border-b border-white/5">
          <div className="flex items-center gap-10">
            <button onClick={onClose} className="w-14 h-14 bg-white/5 rounded-[1.5rem] border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">←</button>
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{guest.name}</h2>
              <p className="text-[12px] font-black text-orange-500 uppercase tracking-[0.4em] mt-3">FOLIO MASTER: UNIT {room.number}</p>
            </div>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
             <button onClick={() => setShowPrintView(true)} className="flex-1 md:flex-none bg-orange-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">GENERATE INVOICE</button>
             <button onClick={handleCheckout} className="flex-1 md:flex-none bg-rose-600/20 border border-rose-600/50 text-rose-500 px-10 py-5 rounded-2xl font-black uppercase text-xs hover:bg-rose-600 hover:text-white transition-all">SET CHECKOUT</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-14 grid grid-cols-1 lg:grid-cols-4 gap-14 custom-scrollbar no-print bg-[#0a0f1e]">
          <div className="lg:col-span-3 space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <SummaryStat label="BALANCE" value={`₹${totals.balance.toFixed(0)}`} color="bg-rose-950/40 border-rose-500/30 text-rose-500" />
               <SummaryStat label="RECEIVED" value={`₹${totals.totalPayments.toFixed(0)}`} color="bg-emerald-950/40 border-emerald-500/30 text-emerald-500" />
               <SummaryStat label="DISCOUNT" value={`₹${totals.discount.toFixed(0)}`} color="bg-orange-950/40 border-orange-500/30 text-orange-500" />
               <SummaryStat label="TOTAL BILL" value={`₹${totals.grandTotal.toFixed(0)}`} color="bg-blue-950/40 border-blue-500/30 text-blue-500" />
            </div>

            <section className="bg-[#111827] p-12 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-8">
                <div>
                   <h3 className="font-black text-white uppercase text-sm tracking-[0.2em]">Folio Chronology</h3>
                   <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Stay Audit Trail</p>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setShowAddCharge(true)} className="bg-slate-800 text-slate-300 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5">POST CHARGE</button>
                   <button onClick={() => setShowAddPayment(true)} className="bg-orange-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg">POST RECEIPT</button>
                </div>
              </div>

              <div className="space-y-6">
                 {/* Standard Stay Line */}
                 <div className="flex justify-between items-center p-6 bg-slate-900 border border-white/5 rounded-[2rem]">
                    <div>
                       <p className="text-[12px] font-black text-white uppercase">ROOM RENT ({room.type})</p>
                       <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{totals.nights} NIGHTS @ ₹{booking.basePrice}</p>
                    </div>
                    <p className="text-xl font-black text-white">₹{totals.roomRent.toFixed(0)}</p>
                 </div>

                 {(booking.charges || []).map(c => (
                   <div key={c.id} className="flex justify-between items-center p-6 bg-slate-900 border border-white/5 rounded-[2rem]">
                      <div>
                         <p className="text-[12px] font-black text-white uppercase">{c.description}</p>
                         <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{c.date.split('T')[0]}</p>
                      </div>
                      <p className="text-xl font-black text-orange-500">₹{c.amount.toFixed(0)}</p>
                   </div>
                 ))}
                 
                 {(booking.payments || []).map(p => (
                   <div key={p.id} className="flex justify-between items-center p-6 bg-emerald-950/20 border border-emerald-500/20 rounded-[2rem]">
                      <div>
                         <p className="text-[12px] font-black text-emerald-500 uppercase">PAYMENT: {p.method}</p>
                         <p className="text-[9px] font-bold text-emerald-900 mt-1 uppercase">{p.date.split('T')[0]}</p>
                      </div>
                      <p className="text-xl font-black text-emerald-400">−₹{p.amount.toFixed(0)}</p>
                   </div>
                 ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <div className="bg-[#111827] p-10 rounded-[4rem] text-white shadow-2xl space-y-10 border border-white/5 text-center">
              <div>
                <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.4em] mb-4">BALANCE DUE</p>
                <h3 className="text-6xl font-black tracking-tighter text-white">₹{totals.balance.toFixed(0)}</h3>
              </div>
              <button onClick={() => setShowAddPayment(true)} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-[0_20px_40px_rgba(230,92,0,0.2)] hover:scale-105 transition-all">SETTLE NOW</button>
            </div>
            
            <div className="bg-[#020617] p-10 rounded-[3.5rem] border border-white/5 space-y-4 shadow-xl">
               <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-b border-white/5 pb-4">Folio Operations</h4>
               <SidebarAction label="Assign Extra Bed" />
               <SidebarAction label="Room Shift" />
               <SidebarAction label="Apply Discount" />
               <SidebarAction label="Merge Folio" />
            </div>
          </div>
        </div>

        {showAddPayment && (
          <FolioModal title="Record Transaction" onClose={() => setShowAddPayment(false)}>
            <div className="space-y-8">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Amount to pay (₹)</label>
                 <input type="number" className="w-full bg-[#111] border border-white/10 p-5 rounded-[2rem] text-4xl font-black text-white text-center outline-none focus:border-orange-500 transition-all" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} />
               </div>
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Mode</label>
                <select className="w-full bg-[#111] border border-white/10 p-4 rounded-2xl font-black text-sm text-white" value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})}>
                    <option value="Cash">Cash Account</option>
                    <option value="UPI">Digital (Scan)</option>
                    <option value="Card">Terminal (Card)</option>
                </select>
              </div>
              <button onClick={() => {
                const amt = parseFloat(newPayment.amount) || 0;
                if(amt > 0) {
                   onAddPayment(booking.id, { id: `PAY-${Date.now()}`, amount: amt, date: new Date().toISOString(), method: newPayment.method });
                   setShowAddPayment(false);
                   setNewPayment({ amount: '', method: 'Cash', remarks: '' });
                }
              }} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase text-sm shadow-xl">VERIFY & POST RECEIPT</button>
            </div>
          </FolioModal>
        )}

        {showPrintView && (
           <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col no-print-backdrop">
              <div className="bg-black p-4 flex justify-between items-center no-print border-b border-white/5">
                 <button onClick={() => setShowPrintView(false)} className="bg-white/5 border border-white/10 text-white px-8 py-2 rounded-xl font-black uppercase text-[10px]">CLOSE [X]</button>
                 <button onClick={() => window.print()} className="bg-orange-600 text-white px-10 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg">PRINT DOCUMENT</button>
              </div>
              <div className="flex-1 overflow-y-auto p-14 bg-white/5 custom-scrollbar">
                 <InvoiceView guest={guest} booking={booking} room={room} settings={settings} payments={booking.payments || []} />
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

const SummaryStat = ({ label, value, color }: any) => (
  <div className={`${color} p-8 rounded-[3rem] border shadow-2xl flex flex-col justify-center text-center`}>
    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">{label}</p>
    <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
  </div>
);

const SidebarAction = ({ label, onClick }: any) => (
  <button onClick={onClick} className="w-full py-4 px-8 rounded-2xl bg-white/5 border border-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-orange-500 transition-all text-left">
    {label}
  </button>
);

const FolioModal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
    <div className="bg-[#0f172a] rounded-[4rem] w-full max-w-md overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 border-t-8 border-t-orange-600">
      <div className="p-10 md:p-14">{children}</div>
      <button onClick={onClose} className="w-full py-6 text-slate-600 font-black uppercase text-[10px] border-t border-white/5 hover:text-white transition-all">CANCEL REQUEST</button>
    </div>
  </div>
);

export default StayManagement;

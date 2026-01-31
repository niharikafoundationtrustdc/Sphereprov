
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
  const [showRoomShift, setShowRoomShift] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [duplicateBillTarget, setDuplicateBillTarget] = useState<Payment | null>(null);
  const [isConsolidated, setIsConsolidated] = useState(false);
  
  const [newCharge, setNewCharge] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'Cash', remarks: '' });
  const [newOutDate, setNewOutDate] = useState(booking.checkOutDate);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const relatedBookings = useMemo(() => {
    if (!booking.groupId) return [booking];
    return allBookings.filter(b => b.groupId === booking.groupId && (b.status === 'ACTIVE' || b.status === 'RESERVED'));
  }, [booking.groupId, allBookings]);

  const totals = useMemo(() => {
    const activeBookings = isConsolidated ? relatedBookings : [booking];
    let totalRoomRent = 0;
    let totalCharges = 0;
    let totalPayments = 0;
    let totalDiscount = 0;
    activeBookings.forEach(b => {
      const start = new Date(b.checkInDate);
      const end = new Date(b.checkOutDate);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
      totalRoomRent += (b.basePrice || 0) * nights;
      totalCharges += (b.charges || []).reduce((sum, c) => sum + c.amount, 0);
      totalPayments += (b.payments || []).reduce((sum, p) => sum + p.amount, 0);
      totalDiscount += (b.discount || 0);
    });
    const taxableSum = totalRoomRent + totalCharges - totalDiscount;
    const taxRate = settings.taxRate || 0;
    const taxAmount = (taxableSum * taxRate) / 100;
    const grandTotal = taxableSum + taxAmount;
    const balance = grandTotal - totalPayments;
    return { totalCharges, totalPayments, roomRent: totalRoomRent, totalDiscount, taxableSum, taxAmount, grandTotal, balance, count: activeBookings.length };
  }, [booking, relatedBookings, isConsolidated, settings.taxRate]);

  const handleShareWhatsApp = () => {
    const message = `*BILLING SUMMARY - ${settings.name}*\n\n` +
      `*Guest:* ${guest.name}\n` +
      `*Room:* ${room.number}\n` +
      `*Folio:* ${booking.bookingNo}\n\n` +
      `*Stay Duration:* ${stayDuration()} Nights\n` +
      `*Net Bill Value:* ₹${totals.grandTotal.toFixed(2)}\n` +
      `*Paid Amount:* ₹${totals.totalPayments.toFixed(2)}\n` +
      `*Pending Balance:* ₹${totals.balance.toFixed(2)}\n\n` +
      `Please contact the front desk for detailed invoice. Thank you!`;
    const whatsappUrl = `https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const stayDuration = () => {
    const start = new Date(booking.checkInDate);
    const end = new Date(booking.checkOutDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  };

  const handleCheckout = () => {
    if (totals.balance > 0 && !confirm(`Pending balance of ₹${totals.balance.toFixed(2)}. Proceed with checkout?`)) return;
    const now = new Date();
    const actualOutDate = now.toISOString().split('T')[0];
    const actualOutTime = now.toTimeString().split(' ')[0].substring(0, 5);
    if (isConsolidated) {
      relatedBookings.forEach(b => {
        onUpdate({ ...b, status: 'COMPLETED', checkOutDate: actualOutDate, checkOutTime: actualOutTime });
      });
    } else {
      onUpdate({ ...booking, status: 'COMPLETED', checkOutDate: actualOutDate, checkOutTime: actualOutTime });
    }
    onClose();
  };

  const handlePostPayment = () => {
    const totalAmt = parseFloat(newPayment.amount) || 0;
    if (totalAmt <= 0) return;
    const payment: Payment = { id: Math.random().toString(36).substr(2, 9), amount: totalAmt, date: new Date().toISOString(), method: newPayment.method, remarks: newPayment.remarks };
    onAddPayment(booking.id, payment);
    setShowAddPayment(false); 
    setNewPayment({ amount: '', method: 'Cash', remarks: '' });
  };

  const handlePostCharge = () => {
    const amt = parseFloat(newCharge.amount) || 0;
    if (amt <= 0 || !newCharge.description) return;
    const charge: Charge = { id: `CHG-${Date.now()}`, description: newCharge.description, amount: amt, date: new Date().toISOString() };
    onUpdate({ ...booking, charges: [...(booking.charges || []), charge] });
    setShowAddCharge(false);
    setNewCharge({ description: '', amount: '' });
  };

  const handleExtendStay = () => {
     if (new Date(newOutDate) <= new Date(booking.checkInDate)) return alert("Invalid Date");
     onUpdate({ ...booking, checkOutDate: newOutDate });
     setShowExtension(false);
     alert("Stay Extended Successfully.");
  };

  const vacantRooms = allRooms.filter(r => r.status === RoomStatus.VACANT);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
      <div className="bg-[#f8fafc] w-full max-w-7xl h-full md:h-[94vh] rounded-none md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-12 duration-700">
        
        <div className="bg-[#003d80] p-6 md:p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center no-print flex-shrink-0 gap-6">
          <div className="flex items-center gap-4 md:gap-10">
            <button onClick={onClose} className="w-12 h-12 md:w-14 md:h-14 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl transition-all border border-white/20 shadow-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-xl md:text-4xl font-black uppercase tracking-tighter leading-none truncate max-w-[200px] md:max-w-none">{guest.name}</h2>
              <p className="text-[8px] md:text-[12px] font-bold text-blue-100 uppercase tracking-widest mt-2 md:mt-3 opacity-90">
                Unit {room.number} • Folio #{booking.bookingNo.slice(-6)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <button onClick={handleShareWhatsApp} className="flex-1 md:flex-none bg-[#25D366] text-white flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-xs shadow-2xl">
               WhatsApp
             </button>
             <button onClick={() => setShowPrintView(true)} className="flex-1 md:flex-none bg-emerald-600 flex items-center justify-center gap-2 md:gap-4 px-4 md:px-10 py-3 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-xs shadow-2xl">
               Full Bill
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-14 grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-14 custom-scrollbar no-print">
          <div className="lg:col-span-3 space-y-8 md:space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
               <SummaryStat label="Pending" value={`₹${totals.balance.toFixed(0)}`} color="bg-rose-50 text-rose-700 border-rose-200" />
               <SummaryStat label="Receipts" value={`₹${totals.totalPayments.toFixed(0)}`} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
               <SummaryStat label="Discount" value={`₹${totals.totalDiscount.toFixed(0)}`} color="bg-orange-50 text-orange-700 border-orange-200" />
               <SummaryStat label="Total" value={`₹${totals.grandTotal.toFixed(0)}`} color="bg-blue-50 text-blue-700 border-blue-200" />
            </div>

            <section className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border shadow-sm space-y-8 md:space-y-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-50 pb-6 md:pb-8 gap-4">
                <div>
                   <h3 className="font-black text-blue-900 uppercase text-xs md:text-sm tracking-widest">History & Settlement</h3>
                   <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-1">Recorded charges and receipts</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                   <button onClick={() => setShowAddCharge(true)} className="flex-1 sm:flex-none bg-slate-100 text-slate-600 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[9px] uppercase border">Charge</button>
                   <button onClick={() => setShowAddPayment(true)} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-lg">Settle</button>
                </div>
              </div>

              <div className="space-y-4">
                 {(booking.charges || []).length > 0 && (
                    <div className="space-y-2 mb-8">
                       <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-300 ml-2 mb-2">Services</p>
                       {(booking.charges || []).map(c => (
                          <div key={c.id} className="flex justify-between items-center p-4 bg-white border rounded-xl shadow-sm">
                             <div>
                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{c.description}</p>
                                <p className="text-[7px] font-bold text-slate-400">{c.date.split('T')[0]}</p>
                             </div>
                             <p className="text-xs md:text-sm font-black text-blue-900">₹{c.amount.toFixed(2)}</p>
                          </div>
                       ))}
                    </div>
                 )}

                 <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-300 ml-2 mb-2">Receipts</p>
                 {(booking.payments || []).map(p => (
                   <div key={p.id} className="flex justify-between items-center p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                      <div>
                         <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 mb-1">{p.method}</p>
                         <p className="text-lg md:text-xl font-black text-slate-800 tracking-tight">₹{p.amount.toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => { setDuplicateBillTarget(p); setShowPrintView(true); }}
                        className="bg-white border-2 border-slate-200 text-slate-500 px-4 md:px-6 py-2 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase shadow-sm"
                      >
                         Reprint
                      </button>
                   </div>
                 ))}
              </div>
            </section>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div className="bg-[#003d80] p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] text-white shadow-3xl space-y-6 md:space-y-10 border-4 md:border-8 border-white/5 text-center">
              <div>
                <p className="text-[10px] md:text-[11px] font-black uppercase text-blue-300 tracking-widest mb-2">Balance Due</p>
                <h3 className="text-3xl md:text-5xl font-black tracking-tighter">₹{totals.balance.toFixed(0)}</h3>
              </div>
              <div className="space-y-3 md:space-y-4">
                 <button onClick={() => setShowAddPayment(true)} className="w-full bg-emerald-500 text-white py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[10px] md:text-xs shadow-2xl">Settle Now</button>
                 {booking.status === 'ACTIVE' && (
                    <button onClick={handleCheckout} className="w-full bg-rose-600 text-white py-5 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase text-[11px] md:text-sm shadow-2xl">Checkout</button>
                 )}
              </div>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border shadow-sm space-y-3 md:space-y-4">
               <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-300 tracking-widest px-2">Actions</p>
               <SidebarAction label="Add Service Charge" onClick={() => setShowAddCharge(true)} />
               <SidebarAction label="Extend Stay" onClick={() => setShowExtension(true)} />
               <SidebarAction label="Room Shift" onClick={() => setShowRoomShift(true)} />
            </div>
          </div>
        </div>

        {showAddCharge && (
           <FolioModal title="Apply Charge" onClose={() => setShowAddCharge(false)}>
              <div className="space-y-6">
                 <FolioInput label="Service Description" value={newCharge.description} onChange={(v: string) => setNewCharge({...newCharge, description: v})} />
                 <FolioInput label="Amount (₹)" type="number" value={newCharge.amount} onChange={(v: string) => setNewCharge({...newCharge, amount: v})} />
                 <button onClick={handlePostCharge} className="w-full bg-blue-900 text-white py-5 rounded-2xl md:rounded-3xl font-black uppercase text-xs shadow-xl">Post Charge</button>
              </div>
           </FolioModal>
        )}

        {showPrintView && (
          <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col overflow-hidden">
             <div className="bg-black p-4 flex justify-between items-center">
                <button onClick={() => { setShowPrintView(false); setDuplicateBillTarget(null); }} className="text-white bg-white/10 px-6 py-2 rounded-lg font-black uppercase text-[10px]">Close</button>
                <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-black uppercase text-[10px]">Print</button>
             </div>
             <div className="flex-1 overflow-y-auto bg-gray-500/30 p-4 md:p-14 custom-scrollbar">
                <InvoiceView guest={guest} booking={booking} room={room} settings={settings} payments={duplicateBillTarget ? [duplicateBillTarget] : (booking.payments || [])} />
             </div>
          </div>
        )}

        {showAddPayment && (
          <FolioModal title="Record Receipt" onClose={() => setShowAddPayment(false)}>
            <div className="space-y-6">
              <FolioInput label="Amount (₹)" type="number" value={newPayment.amount} onChange={(v: string) => setNewPayment({...newPayment, amount: v})} />
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Mode</label>
                <select className="w-full border-2 p-4 rounded-2xl font-black text-xs" value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                </select>
              </div>
              <button onClick={handlePostPayment} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Authorize Receipt</button>
            </div>
          </FolioModal>
        )}
      </div>
    </div>
  );
};

const SummaryStat = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className={`${color} p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border md:border-2 shadow-sm flex flex-col justify-center`}>
    <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-70 mb-1 md:mb-2">{label}</p>
    <p className="text-lg md:text-2xl font-black tracking-tighter leading-none">{value}</p>
  </div>
);

const SidebarAction = ({ label, onClick }: { label: string, onClick: () => void }) => (
  <button onClick={onClick} className="w-full py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border border-slate-100 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-600 hover:text-blue-900 transition-all text-left">
    {label}
  </button>
);

const FolioModal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[250] bg-slate-900/80 flex items-center justify-center p-4">
    <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] w-full max-w-md overflow-hidden shadow-2xl">
      <div className="bg-slate-900 p-6 md:p-8 text-white text-center font-black uppercase text-[10px] md:text-xs tracking-widest">{title}</div>
      <div className="p-8 md:p-10">{children}</div>
      <button onClick={onClose} className="w-full py-5 md:py-6 text-slate-300 font-black uppercase text-[9px] md:text-[10px] border-t">Close</button>
    </div>
  </div>
);

const FolioInput = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1 text-left">
    <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-3.5 md:p-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm bg-slate-50 outline-none text-black" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export default StayManagement;


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
    const charge: Charge = {
       id: `CHG-${Date.now()}`,
       description: newCharge.description,
       amount: amt,
       date: new Date().toISOString()
    };
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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
      <div className="bg-[#f8fafc] w-full max-w-7xl h-[94vh] rounded-[3.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-12 duration-700">
        
        <div className="bg-[#003d80] p-8 md:p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center no-print flex-shrink-0 gap-6">
          <div className="flex items-center gap-6 md:gap-10">
            <button onClick={onClose} className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/20 shadow-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none">{guest.name}</h2>
              <p className="text-[10px] md:text-[12px] font-bold text-blue-100 uppercase tracking-widest mt-3 opacity-90">
                Unit {room.number} • Stay: {booking.checkInDate} to {booking.checkOutDate} • Folio #{booking.bookingNo}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button onClick={handleShareWhatsApp} className="bg-[#25D366] text-white flex items-center gap-3 px-8 py-5 rounded-2xl hover:brightness-110 transition-all font-black uppercase text-xs shadow-2xl">
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
               WhatsApp Bill
             </button>
             <button onClick={() => setShowPrintView(true)} className="bg-emerald-600 flex items-center gap-4 px-10 py-5 rounded-2xl hover:bg-emerald-700 transition-all font-black uppercase text-xs shadow-2xl">
               <span className="text-xl">🖨️</span>
               Generate Full Bill
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-14 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-14 custom-scrollbar no-print">
          <div className="lg:col-span-3 space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <SummaryStat label="Pending Balance" value={`₹${totals.balance.toFixed(2)}`} color="bg-rose-50 text-rose-700 border-rose-200" />
               <SummaryStat label="Receipts" value={`₹${totals.totalPayments.toFixed(2)}`} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
               <SummaryStat label="Discount Applied" value={`-₹${totals.totalDiscount.toFixed(2)}`} color="bg-orange-50 text-orange-700 border-orange-200" />
               <SummaryStat label="Net Bill Value" value={`₹${totals.grandTotal.toFixed(2)}`} color="bg-blue-50 text-blue-700 border-blue-200" />
            </div>

            <section className="bg-white p-8 md:p-12 rounded-[3.5rem] border shadow-sm space-y-10">
              <div className="flex justify-between items-center border-b-2 border-slate-50 pb-8">
                <div>
                   <h3 className="font-black text-blue-900 uppercase text-sm tracking-widest">History & Settlement</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Recorded charges and receipts for this folio</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setShowAddCharge(true)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-black text-[9px] uppercase border">Add Service</button>
                   <button onClick={() => setShowAddPayment(true)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-emerald-700 shadow-lg">Settle New Receipt</button>
                </div>
              </div>

              <div className="space-y-4">
                 {(booking.charges || []).length > 0 && (
                    <div className="space-y-3 mb-10">
                       <p className="text-[9px] font-black uppercase text-slate-300 ml-4 mb-2">Service Charges & Aggregated Bills</p>
                       {(booking.charges || []).map(c => (
                          <div key={c.id} className="flex justify-between items-center p-5 bg-white border rounded-2xl shadow-sm">
                             <div>
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{c.description}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-1">{c.date.split('T')[0]}</p>
                             </div>
                             <p className="text-sm font-black text-blue-900">₹{c.amount.toFixed(2)}</p>
                          </div>
                       ))}
                    </div>
                 )}

                 <p className="text-[9px] font-black uppercase text-slate-300 ml-4 mb-2">Receipt History</p>
                 {(booking.payments || []).map(p => (
                   <div key={p.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
                      <div>
                         <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{p.date.split('T')[0]} • {p.method}</p>
                         <p className="text-xl font-black text-slate-800 tracking-tight">₹{p.amount.toFixed(2)}</p>
                         {p.remarks && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Note: {p.remarks}</p>}
                      </div>
                      <button 
                        onClick={() => { setDuplicateBillTarget(p); setShowPrintView(true); }}
                        className="bg-white border-2 border-slate-200 text-slate-500 px-6 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-blue-900 hover:text-white hover:border-blue-900 shadow-sm transition-all"
                      >
                         Duplicate Receipt
                      </button>
                   </div>
                 ))}
                 {(booking.payments || []).length === 0 && (
                   <div className="py-20 text-center border-2 border-dashed rounded-[3rem] text-slate-300 font-black uppercase tracking-widest text-[10px]">No receipts recorded for this folio</div>
                 )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <div className="bg-[#003d80] p-10 rounded-[4rem] text-white shadow-3xl space-y-10 border-8 border-white/5 text-center">
              <p className="text-[11px] font-black uppercase text-blue-300 tracking-widest mb-3">Balance Due</p>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter">₹{totals.balance.toFixed(2)}</h3>
              <div className="space-y-4 pt-4">
                 <button onClick={() => setShowAddPayment(true)} className="w-full bg-emerald-500 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">Settle Bill Now</button>
                 {booking.status === 'ACTIVE' && (
                    <button onClick={handleCheckout} className="w-full bg-rose-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-2xl hover:bg-black transition-all">Authorize Checkout</button>
                 )}
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-4">
               <p className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-2 px-2">Additional Actions</p>
               <SidebarAction label="Add Service Charge" onClick={() => setShowAddCharge(true)} />
               <SidebarAction label="Extend Stay" onClick={() => setShowExtension(true)} />
               <SidebarAction label="Room Shift / Change" onClick={() => setShowRoomShift(true)} />
            </div>
          </div>
        </div>

        {/* MODALS */}
        {showAddCharge && (
           <FolioModal title="Apply Service Charge" onClose={() => setShowAddCharge(false)}>
              <div className="space-y-6">
                 <FolioInput label="Service Description" value={newCharge.description} onChange={(v: string) => setNewCharge({...newCharge, description: v})} placeholder="e.g. Extra Laundry, Minibar..." />
                 <FolioInput label="Amount (₹)" type="number" value={newCharge.amount} onChange={(v: string) => setNewCharge({...newCharge, amount: v})} />
                 <button onClick={handlePostCharge} className="w-full bg-blue-900 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">Post Charge to Room</button>
              </div>
           </FolioModal>
        )}

        {showExtension && (
           <FolioModal title="Extend Stay Protocol" onClose={() => setShowExtension(false)}>
              <div className="space-y-6">
                 <FolioInput label="New Checkout Date" type="date" value={newOutDate} onChange={setNewOutDate} />
                 <div className="p-4 bg-blue-50 rounded-2xl text-[10px] font-bold text-blue-900 uppercase">
                    Tariff will be automatically recalculated based on daily base rate of ₹{booking.basePrice}.
                 </div>
                 <button onClick={handleExtendStay} className="w-full bg-blue-900 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">Confirm Extension</button>
              </div>
           </FolioModal>
        )}

        {showRoomShift && (
           <FolioModal title="Inventory Shift Logic" onClose={() => setShowRoomShift(false)}>
              <div className="space-y-6">
                 <p className="text-[10px] font-black text-slate-400 uppercase text-center mb-4">Select Target Vacant Unit</p>
                 <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto custom-scrollbar p-1">
                    {vacantRooms.map(vr => (
                       <button 
                          key={vr.id} 
                          onClick={() => { if(confirm(`Confirm room change to ${vr.number}?`)) { onShiftRoom(vr.id); setShowRoomShift(false); } }}
                          className="p-4 bg-slate-50 border-2 rounded-2xl hover:border-blue-600 transition-all font-black text-xs"
                       >
                          {vr.number}
                       </button>
                    ))}
                    {vacantRooms.length === 0 && <p className="col-span-full py-10 text-center opacity-30 font-black uppercase text-[10px]">No Vacant Units Available</p>}
                 </div>
              </div>
           </FolioModal>
        )}

        {/* PRINT VIEW PORTAL */}
        {showPrintView && (
          <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col no-print-backdrop overflow-hidden">
             <div className="bg-black p-5 flex justify-between items-center no-print">
                <div className="flex gap-4">
                   <button onClick={() => window.print()} className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs shadow-xl">Confirm Print</button>
                   <button onClick={() => { setShowPrintView(false); setDuplicateBillTarget(null); }} className="bg-white/10 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs border border-white/20">Close Preview</button>
                </div>
                <p className="text-white/40 font-black uppercase text-[10px] tracking-widest">{duplicateBillTarget ? 'SINGLE RECEIPT REPRINT' : 'FULL FOLIO INVOICE'}</p>
             </div>
             <div className="flex-1 overflow-y-auto bg-gray-500/30 p-14 custom-scrollbar">
                <InvoiceView 
                  guest={guest} 
                  booking={booking}
                  room={room} 
                  settings={settings} 
                  payments={duplicateBillTarget ? [duplicateBillTarget] : (booking.payments || [])}
                />
             </div>
          </div>
        )}

        {showAddPayment && (
          <FolioModal title="Record Receipt" onClose={() => setShowAddPayment(false)}>
            <div className="space-y-8">
              <FolioInput label="Payment Amount (₹)" type="number" value={newPayment.amount} onChange={(v: string) => setNewPayment({...newPayment, amount: v})} />
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400">Payment Protocol</label>
                <select className="w-full border-2 p-4 rounded-2xl font-black text-xs" value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank">Bank Transfer</option>
                </select>
              </div>
              <button onClick={handlePostPayment} className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">Verify & Post Receipt</button>
            </div>
          </FolioModal>
        )}
      </div>
    </div>
  );
};

const SummaryStat = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className={`${color} p-6 md:p-8 rounded-[2.5rem] border-2 shadow-sm flex flex-col justify-center`}>
    <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-2">{label}</p>
    <p className="text-xl md:text-2xl font-black tracking-tighter leading-none">{value}</p>
  </div>
);

const SidebarAction = ({ label, onClick }: { label: string, onClick: () => void }) => (
  <button onClick={onClick} className="w-full py-4 px-6 rounded-2xl border-2 border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-600 hover:text-blue-900 transition-all text-left">
    {label}
  </button>
);

const FolioModal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[250] bg-slate-900/80 flex items-center justify-center p-4">
    <div className="bg-white rounded-[3.5rem] w-full max-w-md overflow-hidden shadow-2xl">
      <div className="bg-slate-900 p-8 text-white text-center font-black uppercase text-xs tracking-widest">{title}</div>
      <div className="p-10">{children}</div>
      <button onClick={onClose} className="w-full py-6 text-slate-300 font-black uppercase text-[10px] border-t">Close</button>
    </div>
  </div>
);

const FolioInput = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-2 text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-sm bg-slate-50 focus:bg-white focus:border-blue-500 transition-all text-black outline-none" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default StayManagement;

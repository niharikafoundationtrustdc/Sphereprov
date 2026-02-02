import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { TravelBooking, Guest, Booking, Room, Transaction, Payment } from '../types';

interface TravelModuleProps {
  guests: Guest[];
  bookings: Booking[];
  rooms: Room[];
  settings: any;
  onUpdateBooking?: (updated: Booking) => void;
}

const TravelModule: React.FC<TravelModuleProps> = ({ guests, bookings, rooms, settings, onUpdateBooking }) => {
  const [activeBookings, setActiveBookings] = useState<TravelBooking[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<TravelBooking> & { instantPaid: boolean, paymentMode: string }>({
    guestId: '', guestName: '', vehicleType: 'Sedan', vehicleNumber: '', driverName: '',
    pickupLocation: 'Property Lobby', dropLocation: '', date: new Date().toISOString().split('T')[0],
    time: '10:00', kmUsed: 0, daysOfTravelling: 1, amount: 0, status: 'BOOKED',
    instantPaid: false, paymentMode: 'Cash'
  });

  useEffect(() => {
    db.travelBookings.toArray().then(setActiveBookings);
  }, []);

  const handleSaveTravel = async () => {
    if (!formData.guestId && !formData.guestName) return alert("CRITICAL: Please select or enter a valid name.");
    if (!formData.amount || formData.amount <= 0) return alert("CRITICAL: Please enter the Fare Amount.");
    
    setIsProcessing(true);
    try {
      const t: TravelBooking = {
        id: `TRV-${Date.now()}`,
        guestId: formData.guestId || '',
        guestName: formData.guestName || '',
        vehicleType: formData.vehicleType || 'Sedan',
        vehicleNumber: formData.vehicleNumber || '',
        driverName: formData.driverName || '',
        pickupLocation: formData.pickupLocation || '',
        dropLocation: formData.dropLocation || '',
        date: formData.date || '',
        time: formData.time || '',
        kmUsed: formData.kmUsed || 0,
        daysOfTravelling: formData.daysOfTravelling || 1,
        amount: formData.amount || 0,
        status: formData.status || 'BOOKED',
        roomBookingId: formData.roomBookingId
      };

      await db.travelBookings.put(t);
      
      // SYNC TO ROOM FOLIO IF RESIDENT
      if (formData.roomBookingId) {
        const b = bookings.find(x => x.id === formData.roomBookingId);
        if (b) {
          let updatedPayments = b.payments || [];
          if (formData.instantPaid) {
            updatedPayments = [...updatedPayments, {
              id: `PAY-TRV-${Date.now()}`,
              amount: t.amount,
              date: new Date().toISOString(),
              method: formData.paymentMode,
              remarks: `Immediate Transport Payment: ${t.vehicleType}`
            }];
          }

          const updated = { 
            ...b, 
            charges: [...(b.charges || []), { 
              id: `CHG-TRV-${Date.now()}`, 
              description: `Transport: ${t.vehicleType} (${t.vehicleNumber})`, 
              amount: t.amount, 
              date: new Date().toISOString() 
            }],
            payments: updatedPayments
          };
          await db.bookings.put(updated);
          if (onUpdateBooking) onUpdateBooking(updated);
        }
      } else {
        const tx: Transaction = {
          id: `TX-TRV-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'RECEIPT',
          accountGroup: 'Direct Income',
          ledger: `${formData.paymentMode} Account`,
          amount: t.amount,
          entityName: t.guestName,
          description: `Transport Service: ${t.vehicleType} (${t.vehicleNumber})`
        };
        await db.transactions.put(tx);
      }

      setActiveBookings([t, ...activeBookings]);
      setShowForm(false);
      alert(`✅ Transport Protocol Committed. Linked to ${formData.roomBookingId ? 'Room Folio' : 'Standalone Billing'}.`);
      
      setFormData({
        guestId: '', guestName: '', vehicleType: 'Sedan', vehicleNumber: '', driverName: '',
        pickupLocation: 'Property Lobby', dropLocation: '', date: new Date().toISOString().split('T')[0],
        time: '10:00', kmUsed: 0, daysOfTravelling: 1, amount: 0, status: 'BOOKED',
        instantPaid: false, paymentMode: 'Cash'
      });
      setGuestSearch('');
    } catch (err) {
      alert("System Conflict: Could not save travel record.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredGuests = useMemo(() => {
     const activeCheckins = bookings.filter(b => b.status === 'ACTIVE');
     if (!guestSearch) return activeCheckins;
     const lower = guestSearch.toLowerCase();
     return activeCheckins.filter(b => {
        const guest = guests.find(g => g.id === b.guestId);
        const roomNum = rooms.find(r => r.id === b.roomId)?.number || '';
        return guest?.name.toLowerCase().includes(lower) || roomNum.includes(lower);
     });
  }, [bookings, guests, rooms, guestSearch]);

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-[#f8fafc]">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">Travel Desk Console</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-2">Fleet Management & Guest Logistics Portal</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all hover:scale-105">+ New Dispatch</button>
      </div>

      <div className="flex-1 bg-white border-2 rounded-[3.5rem] shadow-sm overflow-hidden flex flex-col h-full">
         <div className="overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[1200px]">
               <thead className="bg-slate-900 text-white font-black uppercase sticky top-0 z-10 shadow-lg">
                  <tr>
                    <th className="p-8">Resident / Client</th>
                    <th className="p-8">Fleet Detail</th>
                    <th className="p-8">Mission Route</th>
                    <th className="p-8 text-center">Metrics</th>
                    <th className="p-8 text-right">Fare (₹)</th>
                    <th className="p-8 text-center">Protocol</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-bold uppercase text-slate-700">
                  {activeBookings.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 h-24">
                       <td className="p-8">
                          <p className="text-blue-900 font-black text-sm">{t.guestName}</p>
                          <p className="text-[8px] text-slate-400 tracking-widest mt-1">LOG ID: #{t.id.slice(-6)}</p>
                       </td>
                       <td className="p-8">
                          <p className="text-[11px] font-black uppercase text-blue-600">{t.vehicleType}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{t.vehicleNumber} • {t.driverName}</p>
                       </td>
                       <td className="p-8 text-[11px]">
                          <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>{t.pickupLocation}</div>
                          <div className="flex items-center gap-3 mt-1.5 opacity-60"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>{t.dropLocation}</div>
                       </td>
                       <td className="p-8 text-center text-[10px]"><div className="bg-slate-100 px-3 py-1 rounded-lg inline-block">{t.kmUsed} KM • {t.daysOfTravelling} Days</div></td>
                       <td className="p-8 text-right font-black text-2xl text-blue-900">₹{t.amount.toFixed(2)}</td>
                       <td className="p-8 text-center"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black border uppercase shadow-sm ${t.status === 'BOOKED' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-green-50 border-green-100 text-green-600'}`}>{t.status}</span></td>
                    </tr>
                  ))}
                  {activeBookings.length === 0 && <tr><td colSpan={6} className="p-48 text-center text-slate-200 font-black uppercase italic tracking-[0.3em]">No dispatch logs found</td></tr>}
               </tbody>
            </table>
         </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-blue-900 p-10 text-white flex justify-between items-center">
                 <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Dispatch Authorization</h3>
                 <button onClick={() => setShowForm(false)} className="uppercase text-[10px] font-black opacity-60">Dismiss</button>
              </div>
              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">Resident Discovery</h4>
                    <div className="space-y-3">
                       <div className="flex items-center gap-2 bg-slate-100 rounded-xl border px-3">
                          <span className="text-xs">🔍</span>
                          <input type="text" placeholder="Search Resident Room..." className="w-full p-3 text-[11px] font-black uppercase outline-none bg-transparent" value={guestSearch} onChange={e => setGuestSearch(e.target.value)} />
                       </div>
                       <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-white text-black" value={formData.roomBookingId} onChange={e => {
                          const bk = bookings.find(x => x.id === e.target.value);
                          const g = guests.find(x => x.id === bk?.guestId);
                          setFormData({...formData, guestId: g?.id || '', guestName: g?.name || '', roomBookingId: bk?.id});
                       }}>
                          <option value="">Choose Resident Folio...</option>
                          {filteredGuests.map(b => <option key={b.id} value={b.id}>ROOM {rooms.find(r => r.id === b.roomId)?.number} - {guests.find(g => g.id === b.guestId)?.name}</option>)}
                       </select>
                       {!formData.roomBookingId && <Inp label="Standalone Guest Name" value={formData.guestName} onChange={(v: string) => setFormData({...formData, guestName: v})} />}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <Inp label="Driver Name" value={formData.driverName} onChange={(v: string) => setFormData({...formData, driverName: v})} />
                       <Inp label="Vehicle Plate" value={formData.vehicleNumber} onChange={(v: string) => setFormData({...formData, vehicleNumber: v})} />
                    </div>
                    <div className="p-6 bg-blue-50 border rounded-3xl space-y-4">
                        <label className="flex items-center justify-between cursor-pointer">
                           <div className="space-y-0.5"><span className="text-[10px] font-black uppercase block text-blue-900">Instant Payment Received</span><span className="text-[8px] font-bold text-blue-400 uppercase">Paid directly at desk</span></div>
                           <input type="checkbox" checked={formData.instantPaid} onChange={e => setFormData({...formData, instantPaid: e.target.checked})} className="w-6 h-6 rounded-xl" />
                        </label>
                        {formData.instantPaid && (
                          <select className="w-full border p-2 rounded-lg text-[10px] font-black" value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})}>
                            <option value="Cash">Cash</option><option value="UPI">Digital UPI</option><option value="Card">Bank Card</option>
                          </select>
                        )}
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">Fare & Routes</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <Inp label="Departure" value={formData.pickupLocation} onChange={(v: string) => setFormData({...formData, pickupLocation: v})} />
                       <Inp label="Destination" value={formData.dropLocation} onChange={(v: string) => setFormData({...formData, dropLocation: v})} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                       <Inp label="KM" type="number" value={formData.kmUsed?.toString()} onChange={(v: string) => setFormData({...formData, kmUsed: parseFloat(v)})} />
                       <Inp label="Days" type="number" value={formData.daysOfTravelling?.toString()} onChange={(v: string) => setFormData({...formData, daysOfTravelling: parseInt(v)})} />
                       <Inp label="Fare (₹)" type="number" value={formData.amount?.toString()} onChange={(v: string) => setFormData({...formData, amount: parseFloat(v)})} />
                    </div>
                    <button onClick={handleSaveTravel} disabled={isProcessing} className={`w-full ${isProcessing ? 'bg-slate-400' : 'bg-blue-900'} text-white py-6 rounded-3xl font-black uppercase text-xs shadow-xl transition-all`}>Authorize Dispatch</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const Inp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 text-black" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

export default TravelModule;
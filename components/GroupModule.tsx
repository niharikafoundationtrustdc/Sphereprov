
import React, { useState, useMemo, useEffect } from 'react';
import { GroupProfile, Room, Booking, Guest, RoomStatus, Transaction, HostelSettings, Charge, Payment } from '../types.ts';
import { INDIAN_STATES } from '../constants.tsx';
import InvoiceView from './InvoiceView.tsx';
import { db } from '../services/db.ts';

interface GroupModuleProps {
  groups: GroupProfile[];
  setGroups: (groups: GroupProfile[]) => void;
  rooms: Room[];
  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
  guests: Guest[];
  setGuests: (guests: Guest[]) => void;
  setRooms: (rooms: Room[]) => void;
  onAddTransaction: (tx: Transaction) => void;
  onGroupPayment: (groupId: string, amount: number, method: string, remarks: string) => void;
  settings: HostelSettings;
}

const GroupModule: React.FC<GroupModuleProps> = ({ groups, setGroups, rooms, bookings, setBookings, guests, setGuests, setRooms, onAddTransaction, onGroupPayment, settings }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<'PROFILES' | 'BILLING' | 'SERVICES'>('PROFILES');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupProfile | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showConsolidatedInvoice, setShowConsolidatedInvoice] = useState(false);

  // Bulk Charge States
  const [bulkChargeData, setBulkChargeData] = useState({ description: '', amount: '' });
  const [targetRoomIds, setTargetRoomIds] = useState<string[]>([]);

  // WhatsApp helper
  const shareGroupBillWhatsApp = (group: GroupProfile, balance: number, total: number) => {
    const message = `*Consolidated Bill Summary*\n*Property:* ${settings.name}\n*Group:* ${group.groupName}\n*Total Value:* ₹${total.toFixed(2)}\n*Net Balance:* ₹${balance.toFixed(2)}\n\nPlease find the detailed invoice link below or at the reception desk.\n\nThank you for choosing ${settings.name}!`;
    window.open(`https://wa.me/${group.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleApplyBulkCharge = (groupId: string) => {
    if (!bulkChargeData.description || !bulkChargeData.amount || targetRoomIds.length === 0) {
      alert("Please fill description, amount and select rooms.");
      return;
    }

    const amt = parseFloat(bulkChargeData.amount);
    const updatedBookings = bookings.map(b => {
      if (targetRoomIds.includes(b.roomId) && b.groupId === groupId) {
        const newCharge: Charge = {
          id: Math.random().toString(36).substr(2, 9),
          description: bulkChargeData.description,
          amount: amt,
          date: new Date().toISOString()
        };
        return { ...b, charges: [...(b.charges || []), newCharge] };
      }
      return b;
    });

    setBookings(updatedBookings);
    setBulkChargeData({ description: '', amount: '' });
    setTargetRoomIds([]);
    alert(`Posted charge of ₹${amt} to ${targetRoomIds.length} rooms.`);
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] min-h-full flex flex-col gap-8 pb-40">
      <div className="flex flex-col md:flex-row justify-between items-center no-print gap-6 bg-white p-8 rounded-[3rem] border shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">Group Master Console</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Single Point Billing & Multi-Room Ops</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Create New Group Reservation</button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide no-print border-b">
        <SubMenuBtn active={activeSubMenu === 'PROFILES'} label="Account Profiles" onClick={() => setActiveSubMenu('PROFILES')} />
        <SubMenuBtn active={activeSubMenu === 'BILLING'} label="Billing & WhatsApp" onClick={() => setActiveSubMenu('BILLING')} />
        <SubMenuBtn active={activeSubMenu === 'SERVICES'} label="Bulk Service Desk" onClick={() => setActiveSubMenu('SERVICES')} />
      </div>

      <div className="flex-1">
        {activeSubMenu === 'PROFILES' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {groups.map(group => (
              <div key={group.id} className="bg-white border-2 border-transparent rounded-[3rem] p-8 shadow-sm hover:shadow-xl hover:border-blue-600 transition-all cursor-pointer group" onClick={() => setSelectedGroup(group)}>
                <div className="flex justify-between items-start mb-6">
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100`}>{group.groupType || 'General'}</div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border-2 ${group.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{group.status}</span>
                </div>
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter mb-1 leading-none">{group.groupName}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">{group.headName} • {group.phone}</p>
                <div className="grid grid-cols-2 gap-6 border-t pt-6">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-gray-300 tracking-widest">Billing Logic</p>
                    <p className="text-[11px] font-black uppercase text-gray-700">{group.billingPreference}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[8px] font-black uppercase text-gray-300 tracking-widest">Inventory</p>
                    <p className="text-[11px] font-black uppercase text-blue-600">{bookings.filter(b => b.groupId === group.id).length} Folios</p>
                  </div>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="col-span-full py-40 text-center text-slate-300 font-black uppercase tracking-[0.2em] border-4 border-dashed rounded-[4rem]">No group profiles registered</div>
            )}
          </div>
        )}

        {activeSubMenu === 'BILLING' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
             {groups.map(g => {
                const gBookings = bookings.filter(b => b.groupId === g.id && b.status !== 'CANCELLED');
                let totalAmount = 0;
                let totalPaid = 0;

                gBookings.forEach(b => {
                   const start = new Date(b.checkInDate);
                   const end = new Date(b.checkOutDate);
                   const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
                   const rent = b.basePrice * nights;
                   const services = (b.charges || []).reduce((sc, c) => sc + c.amount, 0);
                   const subTotal = rent + services - (b.discount || 0);
                   const tax = (subTotal * (settings.taxRate || 0)) / 100;
                   totalAmount += (subTotal + tax);
                   totalPaid += (b.payments || []).reduce((sp, p) => sp + p.amount, 0);
                });

                const balance = totalAmount - totalPaid;

                return (
                   <div key={g.id} className="bg-white border-2 border-slate-50 rounded-[3.5rem] p-10 flex flex-col justify-between shadow-xl hover:border-blue-100 transition-all">
                      <div className="flex justify-between items-start mb-8">
                         <div>
                            <h3 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">{g.groupName}</h3>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">{gBookings.length} Active Folios</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Master Balance</p>
                            <p className={`text-3xl font-black ${balance > 0 ? 'text-red-600' : 'text-green-600'} tracking-tighter`}>₹{balance.toFixed(2)}</p>
                         </div>
                      </div>
                      <div className="flex flex-col gap-3">
                         <div className="flex gap-3">
                            <button onClick={() => { setSelectedGroup(g); setShowPaymentModal(true); }} className="flex-1 bg-green-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all">Post Receipt</button>
                            <button onClick={() => { setSelectedGroup(g); setShowConsolidatedInvoice(true); }} className="flex-1 bg-blue-900 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all">Consolidated Bill</button>
                         </div>
                         <button 
                           onClick={() => shareGroupBillWhatsApp(g, balance, totalAmount)}
                           className="w-full bg-[#25D366] text-white py-4 rounded-[1.5rem] font-black text-xs uppercase shadow-lg flex items-center justify-center gap-3 hover:brightness-95 transition-all"
                         >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            Share on WhatsApp
                         </button>
                      </div>
                   </div>
                )
             })}
          </div>
        )}

        {activeSubMenu === 'SERVICES' && (
          <div className="bg-white rounded-[3.5rem] border-2 shadow-sm p-12 space-y-10 animate-in fade-in duration-500">
             <div>
                <h2 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">Bulk Service Desk</h2>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Apply operational charges to multiple group folios simultaneously</p>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="space-y-6">
                   <div className="p-8 bg-slate-50 rounded-[2.5rem] border space-y-6">
                      <h4 className="font-black text-xs uppercase text-slate-400 border-b pb-4 tracking-widest">1. Select Group Account</h4>
                      <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-white focus:border-blue-600 outline-none" value={selectedGroup?.id || ''} onChange={e => {
                        const found = groups.find(g => g.id === e.target.value);
                        setSelectedGroup(found || null);
                        setTargetRoomIds([]);
                      }}>
                         <option value="">Choose an account...</option>
                         {groups.map(g => <option key={g.id} value={g.id}>{g.groupName}</option>)}
                      </select>
                   </div>
                   {selectedGroup && (
                     <div className="p-8 bg-blue-900 rounded-[2.5rem] text-white space-y-6 shadow-2xl">
                        <h4 className="font-black text-xs uppercase text-blue-300 border-b border-white/10 pb-4 tracking-widest">2. Post Service Detail</h4>
                        <InpWhite label="Charge Narration" value={bulkChargeData.description} onChange={v => setBulkChargeData({...bulkChargeData, description: v})} />
                        <InpWhite label="Amount Per Folio (₹)" type="number" value={bulkChargeData.amount} onChange={v => setBulkChargeData({...bulkChargeData, amount: v})} />
                        <button 
                          onClick={() => handleApplyBulkCharge(selectedGroup.id)}
                          className="w-full bg-white text-blue-900 py-6 rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                          Execute Posting for {targetRoomIds.length} Rooms
                        </button>
                     </div>
                   )}
                </div>
                
                <div className="lg:col-span-2">
                   <div className="p-8 bg-white border-2 rounded-[3rem] min-h-[450px] flex flex-col shadow-inner">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                        <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">3. TARGET SELECTION (SELECT ROOMS)</h4>
                        <div className="flex gap-4">
                           <button onClick={() => setTargetRoomIds(bookings.filter(b => b.groupId === selectedGroup?.id && b.status === 'ACTIVE').map(b => b.roomId))} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">SELECT ALL</button>
                           <button onClick={() => setTargetRoomIds([])} className="text-[10px] font-black uppercase text-gray-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 hover:bg-slate-200 transition-all">DESELECT ALL</button>
                        </div>
                      </div>
                      {!selectedGroup ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-200 uppercase font-black tracking-widest text-center">
                           <svg className="w-20 h-20 mb-6 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                           Identify a group profile to load active room inventory
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-10">
                           {bookings.filter(b => b.groupId === selectedGroup.id && b.status === 'ACTIVE').map(b => {
                              const r = rooms.find(rm => rm.id === b.roomId);
                              const isSelected = targetRoomIds.includes(b.roomId);
                              return (
                                <button 
                                  key={b.id} 
                                  onClick={() => setTargetRoomIds(prev => isSelected ? prev.filter(x => x !== b.roomId) : [...prev, b.roomId])}
                                  className={`aspect-square rounded-[2rem] border-2 transition-all font-black uppercase flex flex-col items-center justify-center gap-1.5 p-4 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-slate-50 border-white text-slate-400 hover:border-blue-200 hover:bg-white shadow-sm'}`}
                                >
                                   <span className="text-2xl leading-none tracking-tighter">{r?.number}</span>
                                   <span className={`text-[8px] tracking-widest ${isSelected ? 'opacity-80' : 'opacity-40'}`}>FOLIO {b.bookingNo.slice(-4)}</span>
                                </button>
                              );
                           })}
                           {bookings.filter(b => b.groupId === selectedGroup.id && b.status === 'ACTIVE').length === 0 && (
                             <div className="col-span-full py-20 text-center text-slate-300 uppercase font-bold italic">No active folios found for this group</div>
                           )}
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {showCreate && (
        <GroupReservationModal 
          rooms={rooms} 
          bookings={bookings}
          onClose={() => setShowCreate(false)} 
          onSave={async (groupData, selectedRooms, dates) => {
            const gid = 'GRP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            const group: GroupProfile = { ...groupData, id: gid, status: 'ACTIVE' };
            setGroups([...groups, group]);
            
            // Create guest entry for group head if doesn't exist
            const guestId = `G-${Date.now()}`;
            await db.guests.put({ 
              id: guestId, 
              name: group.groupName, 
              phone: group.phone, 
              email: group.email, 
              address: group.orgName || '',
              nationality: 'Indian'
            } as any);

            // Create individual room bookings linked to group
            const groupBookings = selectedRooms.map(r => ({
              id: `B-${Math.random().toString(36).substr(2, 6)}`,
              bookingNo: `BK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              roomId: r.id,
              guestId: guestId,
              groupId: gid,
              checkInDate: dates.start,
              checkInTime: '12:00',
              checkOutDate: dates.end,
              checkOutTime: '11:00',
              status: 'ACTIVE' as const,
              basePrice: r.price,
              discount: 0,
              charges: [],
              payments: []
            }));

            await db.bookings.bulkPut(groupBookings);
            setBookings([...bookings, ...groupBookings]);

            // Update room statuses
            const updatedRooms = rooms.map(r => {
               if (selectedRooms.some(sr => sr.id === r.id)) return { ...r, status: RoomStatus.OCCUPIED };
               return r;
            });
            await db.rooms.bulkPut(updatedRooms);
            setRooms(updatedRooms);

            setShowCreate(false);
            alert(`Group reservation for ${selectedRooms.length} rooms confirmed!`);
          }} 
        />
      )}
      
      {showConsolidatedInvoice && selectedGroup && (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col no-print-backdrop">
           <div className="bg-black p-4 flex justify-between items-center no-print shadow-2xl">
              <p className="text-white font-black uppercase text-xs tracking-widest opacity-60">Property Master • Consolidated Folio Dispatch</p>
              <div className="flex gap-4">
                 <button onClick={() => window.print()} className="bg-emerald-600 text-white px-10 py-3 rounded-[1.2rem] font-black text-xs uppercase shadow-xl hover:bg-emerald-700 transition-all">Download PDF</button>
                 <button onClick={() => setShowConsolidatedInvoice(false)} className="text-white bg-white/10 px-8 py-3 rounded-[1.2rem] font-black text-xs uppercase border border-white/20 hover:bg-white/20 transition-all">Close [X]</button>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto bg-gray-500/20 p-6 md:p-14 custom-scrollbar">
              <InvoiceView 
                settings={settings}
                guest={guests.find(g => g.phone === selectedGroup.phone) || { name: selectedGroup.groupName, address: selectedGroup.orgName || '', phone: selectedGroup.phone } as any}
                groupBookings={bookings.filter(b => b.groupId === selectedGroup.id && b.status !== 'CANCELLED').map(b => ({
                  ...b,
                  roomNumber: rooms.find(r => r.id === b.roomId)?.number || '?',
                  roomType: rooms.find(r => r.id === b.roomId)?.type || '?'
                }))}
                payments={bookings.filter(b => b.groupId === selectedGroup.id).reduce((acc, b) => [...acc, ...(b.payments || [])], [] as any[])}
              />
           </div>
        </div>
      )}

      {showPaymentModal && selectedGroup && (
        <GroupPaymentModal 
          group={selectedGroup} 
          onClose={() => setShowPaymentModal(false)} 
          onSubmit={(amt, method, remarks) => {
             onGroupPayment(selectedGroup.id, amt, method, remarks);
             setShowPaymentModal(false);
          }} 
        />
      )}
    </div>
  );
};

const GroupReservationModal = ({ onClose, onSave, rooms, bookings }: any) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<GroupProfile>>({
    groupName: '',
    groupType: 'Tour',
    headName: '',
    phone: '',
    email: '',
    billingPreference: 'Single',
    orgName: ''
  });

  const [dates, setDates] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 86400000).toISOString().split('T')[0]
  });

  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());

  const vacantRoomsForRange = useMemo(() => {
    if (!dates.start || !dates.end) return [];
    const dStart = new Date(dates.start);
    const dEnd = new Date(dates.end);

    return rooms.filter((room: Room) => {
      const overlaps = bookings.some((b: Booking) => {
        if (b.status === 'CANCELLED') return false;
        if (b.roomId !== room.id) return false;
        const bStart = new Date(b.checkInDate);
        const bEnd = new Date(b.checkOutDate);
        return (dStart < bEnd && dEnd > bStart);
      });
      return !overlaps;
    });
  }, [rooms, bookings, dates]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedRoomIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRoomIds(next);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
         <div className="bg-blue-900 p-10 text-white flex justify-between items-center flex-shrink-0">
            <div>
               <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Accept Group Booking</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mt-2">Protocol Step {step} of 2</p>
            </div>
            <button onClick={onClose} className="uppercase text-[10px] font-black opacity-60 hover:opacity-100 transition-opacity">Discard Registry</button>
         </div>

         <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            {step === 1 ? (
              <div className="space-y-10 animate-in slide-in-from-bottom-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">A. Organizer Master Data</h4>
                       <Inp label="Group Name / Title *" value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} placeholder="e.g. Reliance Corporate Retreat" />
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Point of Contact *" value={formData.headName} onChange={v => setFormData({...formData, headName: v})} placeholder="Mr. Name" />
                          <Inp label="Direct Phone *" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} placeholder="99XXXXXXX" />
                       </div>
                       <Inp label="Organization (For Billing)" value={formData.orgName} onChange={v => setFormData({...formData, orgName: v})} placeholder="LLC/Pvt Ltd Name" />
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account Preference</label>
                          <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={formData.billingPreference} onChange={e => setFormData({...formData, billingPreference: e.target.value})}>
                             <option value="Single">Consolidated Master Bill</option>
                             <option value="Split">Individual Room Invoicing</option>
                          </select>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-4">B. Deployment Schedule</h4>
                       <div className="grid grid-cols-2 gap-6">
                          <Inp label="Arrival Date" type="date" value={dates.start} onChange={v => setDates({...dates, start: v})} />
                          <Inp label="Departure Date" type="date" value={dates.end} onChange={v => setDates({...dates, end: v})} />
                       </div>
                       <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 space-y-4">
                          <p className="text-[10px] font-black uppercase text-blue-900 leading-none">Schedule Status</p>
                          <div className="flex justify-between items-end">
                             <span className="text-4xl font-black text-blue-900 tracking-tighter">
                                {Math.ceil((new Date(dates.end).getTime() - new Date(dates.start).getTime()) / 86400000)}
                             </span>
                             <span className="text-xs font-black uppercase text-blue-400 mb-1 tracking-widest">Nights Stay</span>
                          </div>
                       </div>
                    </div>
                 </div>
                 <button 
                   disabled={!formData.groupName || !formData.headName || !formData.phone}
                   onClick={() => setStep(2)}
                   className="w-full bg-blue-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-30 transition-all"
                 >
                    Next: Room Selection Node
                 </button>
              </div>
            ) : (
              <div className="space-y-10 animate-in slide-in-from-right-8">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                       <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tighter leading-none">Target Selection (Select Rooms)</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Only showing vacant units for {dates.start} — {dates.end}</p>
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setSelectedRoomIds(new Set(vacantRoomsForRange.map(r => r.id)))} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-6 py-2.5 rounded-xl border border-blue-100">SELECT ALL</button>
                       <button onClick={() => setSelectedRoomIds(new Set())} className="text-[10px] font-black uppercase text-gray-400 bg-slate-50 px-6 py-2.5 rounded-xl border border-slate-100">DESELECT ALL</button>
                    </div>
                 </div>

                 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pb-10">
                    {vacantRoomsForRange.map((r: Room) => {
                       const isSelected = selectedRoomIds.has(r.id);
                       return (
                          <button 
                            key={r.id} 
                            onClick={() => handleToggle(r.id)}
                            className={`aspect-square rounded-[1.8rem] border-2 transition-all font-black uppercase flex flex-col items-center justify-center p-4 relative ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105 z-10' : 'bg-slate-50 border-white text-slate-300 hover:border-blue-200 shadow-sm'}`}
                          >
                             {isSelected && <div className="absolute top-2 right-2 w-5 h-5 bg-white text-blue-900 rounded-full flex items-center justify-center text-[10px] animate-in zoom-in">✓</div>}
                             <span className="text-2xl leading-none">{r.number}</span>
                             <span className={`text-[7px] tracking-tighter mt-1 ${isSelected ? 'opacity-80' : 'opacity-40'}`}>{r.type.split(' ')[0]}</span>
                          </button>
                       );
                    })}
                    {vacantRoomsForRange.length === 0 && (
                       <div className="col-span-full py-20 text-center text-rose-500 uppercase font-black bg-rose-50 rounded-[3rem] border border-rose-100">No rooms available for the selected dates. Please adjust schedule.</div>
                    )}
                 </div>

                 <div className="flex gap-4 pt-6 border-t">
                    <button onClick={() => setStep(1)} className="flex-1 py-5 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-900">Back to profile</button>
                    <button 
                      disabled={selectedRoomIds.size === 0}
                      onClick={() => onSave(formData, rooms.filter(r => selectedRoomIds.has(r.id)), dates)}
                      className="flex-[2] bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all disabled:opacity-30"
                    >
                       Confirm Reservation for {selectedRoomIds.size} Units
                    </button>
                 </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

const GroupPaymentModal = ({ group, onClose, onSubmit }: any) => {
  const [amt, setAmt] = useState('');
  const [method, setMethod] = useState('Cash');
  const [remarks, setRemarks] = useState('');

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[3.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="bg-green-600 p-10 text-white text-center">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Settlement Protocol</h2>
          <p className="text-[10px] font-black text-green-100 uppercase tracking-widest mt-2">{group.groupName}</p>
        </div>
        <div className="p-12 space-y-6">
          <Inp label="Amount (₹)" type="number" value={amt} onChange={setAmt} />
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Account Ledger</label>
             <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white transition-all" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="Cash">Cash Account</option>
                <option value="UPI">Digital (UPI/Scan)</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Card">Bank Card</option>
             </select>
          </div>
          <Inp label="Settlement Remarks" value={remarks} onChange={setRemarks} placeholder="Payment details..." />
          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 text-gray-400 uppercase font-black text-[10px] tracking-widest">Discard</button>
            <button onClick={() => onSubmit(parseFloat(amt), method, remarks)} className="flex-[2] bg-green-600 text-white py-5 rounded-2xl uppercase font-black text-xs shadow-xl tracking-widest">Verify Receipt</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SubMenuBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0 ${active ? 'bg-blue-900 text-white border-blue-900 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200'}`}>{label}</button>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-all text-black shadow-inner" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const InpWhite = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 text-white">
    <label className="text-[10px] font-black uppercase opacity-60 ml-2 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 border-white/20 p-4 rounded-2xl font-black text-xs bg-white/10 text-white outline-none focus:bg-white/20 shadow-inner" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export default GroupModule;

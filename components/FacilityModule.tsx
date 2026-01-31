
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Facility, FacilityUsage, Guest, Booking, Room, Transaction } from '../types';

interface FacilityPackage {
  id: string;
  name: string;
  facilityType: 'GYM' | 'POOL' | 'LAUNDRY';
  price: number;
  validity: string;
}

interface FacilityConfig {
  id: string;
  gymMenHours: string;
  gymWomenHours: string;
  poolMenHours: string;
  poolWomenHours: string;
}

const INITIAL_PACKAGES: FacilityPackage[] = [
  { id: 'p1', name: 'GYM: Single Session', facilityType: 'GYM', price: 250, validity: '1 Day' },
  { id: 'p2', name: 'GYM: Monthly Elite', facilityType: 'GYM', price: 3500, validity: '30 Days' },
  { id: 'p3', name: 'POOL: Day Pass', facilityType: 'POOL', price: 500, validity: '1 Day' },
  { id: 'p4', name: 'POOL: Weekend Splash', facilityType: 'POOL', price: 1200, validity: '2 Days' },
  { id: 'p5', name: 'Shirt/Top (Washing)', facilityType: 'LAUNDRY', price: 35, validity: 'Per Item' },
  { id: 'p6', name: 'Trouser/Bottom (Washing)', facilityType: 'LAUNDRY', price: 45, validity: 'Per Item' },
  { id: 'p7', name: 'Shirt/Top (Ironing)', facilityType: 'LAUNDRY', price: 15, validity: 'Per Item' },
  { id: 'p8', name: 'Trouser/Bottom (Ironing)', facilityType: 'LAUNDRY', price: 20, validity: 'Per Item' },
  { id: 'p9', name: 'Suit (Dry Clean)', facilityType: 'LAUNDRY', price: 350, validity: 'Per Suit' },
  { id: 'p10', name: 'Bed Linen (Washing)', facilityType: 'LAUNDRY', price: 120, validity: 'Per Set' },
];

interface FacilityModuleProps {
  guests: Guest[];
  bookings: Booking[];
  rooms: Room[];
  settings: any;
  onUpdateBooking?: (updated: Booking) => void;
}

const FacilityModule: React.FC<FacilityModuleProps> = ({ guests, bookings, rooms, settings, onUpdateBooking }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'GYM' | 'POOL' | 'LAUNDRY' | 'PACKAGES'>('DASHBOARD');
  const [usage, setUsage] = useState<FacilityUsage[]>([]);
  const [packages, setPackages] = useState<FacilityPackage[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestType, setGuestType] = useState<'RESIDENT' | 'OUTSIDER'>('RESIDENT');
  
  const [config, setConfig] = useState<Omit<FacilityConfig, 'id'>>({
    gymMenHours: '06:00 AM - 10:00 AM | 06:00 PM - 10:00 PM',
    gymWomenHours: '10:00 AM - 01:00 PM | 03:00 PM - 06:00 PM',
    poolMenHours: '06:00 AM - 10:00 AM | 06:00 PM - 10:00 PM',
    poolWomenHours: '10:00 AM - 01:00 PM | 03:00 PM - 06:00 PM'
  });

  const [editingPkg, setEditingPkg] = useState<Partial<FacilityPackage> | null>(null);
  const [laundryCart, setLaundryCart] = useState<{pkgId: string, name: string, price: number, qty: number}[]>([]);

  const [formData, setFormData] = useState({
    bookingId: '',
    guestId: '',
    guestName: '',
    guestPhone: '',
    roomNumber: '',
    outsiderName: '',
    outsiderPhone: '',
    outsiderEmail: '',
    packageId: '',
    price: 0,
    discount: 0,
    assignToRoom: true
  });

  useEffect(() => {
    const init = async () => {
       setUsage(await db.facilityUsage.toArray());
       
       // Load config with internal ID
       const savedConfigObj = await db.settings.get('facility_config');
       if (savedConfigObj && (savedConfigObj as any).config) {
         setConfig((savedConfigObj as any).config);
       }
       
       // Load packages with internal ID
       const savedPkgsObj = await db.settings.get('facility_packages');
       if (savedPkgsObj && (savedPkgsObj as any).list) {
         setPackages((savedPkgsObj as any).list);
       } else {
         setPackages(INITIAL_PACKAGES);
         await db.settings.put({ id: 'facility_packages', list: INITIAL_PACKAGES } as any);
       }
    };
    init();
  }, []);

  const dailyStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = usage.filter(u => u.startTime.startsWith(today));
    const revenue = todayUsage.reduce((s, u) => s + u.amount, 0);
    return {
       totalEntries: todayUsage.length,
       revenue,
       activeGym: usage.filter(u => u.facilityId === 'GYM').length,
       activePool: usage.filter(u => u.facilityId === 'POOL').length,
       laundryCount: usage.filter(u => u.facilityId === 'LAUNDRY').length
    };
  }, [usage]);

  const handleUpdateConfig = async () => {
     await db.settings.put({ id: 'facility_config', config } as any);
     alert("Facility timings updated!");
  };

  const handleSavePackage = async () => {
    if (!editingPkg || !editingPkg.name || !editingPkg.price) return;
    
    let updated: FacilityPackage[];
    if (editingPkg.id) {
      updated = packages.map(p => p.id === editingPkg.id ? (editingPkg as FacilityPackage) : p);
    } else {
      const newPkg: FacilityPackage = {
        ...editingPkg as FacilityPackage,
        id: `pkg-${Date.now()}`
      };
      updated = [...packages, newPkg];
    }
    
    setPackages(updated);
    await db.settings.put({ id: 'facility_packages', list: updated } as any);
    setEditingPkg(null);
    alert("Facility service updated successfully!");
  };

  const deletePackage = async (id: string) => {
    if (!confirm("Permanently remove this service?")) return;
    const updated = packages.filter(p => p.id !== id);
    setPackages(updated);
    await db.settings.put({ id: 'facility_packages', list: updated } as any);
  };

  const filteredGuests = useMemo(() => {
    const activeCheckins = bookings.filter(b => b.status === 'ACTIVE');
    if (!guestSearch) return activeCheckins;
    const lower = guestSearch.toLowerCase();
    return activeCheckins.filter(b => {
      const guest = guests.find(g => g.id === b.guestId);
      const roomNum = rooms.find(r => r.id === b.roomId)?.number || '';
      return guest?.name.toLowerCase().includes(lower) || roomNum.includes(lower) || guest?.phone.includes(lower);
    });
  }, [bookings, guests, rooms, guestSearch]);

  const handleAuthorize = async () => {
    let finalAmount = 0;
    let description = "";

    if (activeTab === 'LAUNDRY') {
      if (laundryCart.length === 0) return alert("Pick items for laundry.");
      finalAmount = laundryCart.reduce((s, c) => s + (c.price * c.qty), 0) - formData.discount;
      description = `Laundry Services: ${laundryCart.length} items`;
    } else {
      if (!formData.packageId) return alert("Select plan.");
      const pkg = packages.find(p => p.id === formData.packageId);
      finalAmount = (pkg?.price || 0) - formData.discount;
      description = `Facility Entry: ${pkg?.name} (${activeTab})`;
    }

    if (guestType === 'RESIDENT' && !formData.guestId) return alert("Please select a resident room.");
    if (guestType === 'OUTSIDER' && !formData.outsiderName) return alert("Enter outsider name.");

    const targetGuestId = guestType === 'RESIDENT' ? formData.guestId : `OUT-${Date.now()}`;
    const targetName = guestType === 'RESIDENT' ? formData.guestName : formData.outsiderName;

    const entry: FacilityUsage = {
      id: `FAC-${Date.now()}`,
      facilityId: activeTab as any,
      guestId: targetGuestId,
      startTime: new Date().toISOString(),
      amount: finalAmount,
      isBilledToRoom: guestType === 'RESIDENT' && formData.assignToRoom,
      outsiderInfo: guestType === 'OUTSIDER' ? { name: formData.outsiderName, phone: formData.outsiderPhone, email: formData.outsiderEmail } : undefined,
      items: activeTab === 'LAUNDRY' ? laundryCart.map(c => ({ name: c.name, qty: c.qty, price: c.price })) : undefined
    };

    await db.facilityUsage.put(entry);

    if (guestType === 'RESIDENT' && formData.assignToRoom && formData.bookingId) {
      const b = bookings.find(x => x.id === formData.bookingId);
      if (b) {
        const updated = {
          ...b,
          charges: [...(b.charges || []), {
            id: `CHG-FAC-${Date.now()}`,
            description,
            amount: finalAmount,
            date: new Date().toISOString()
          }]
        };
        await db.bookings.put(updated);
        if (onUpdateBooking) onUpdateBooking(updated);
      }
    } else {
      const tx: Transaction = {
        id: `TX-FAC-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'RECEIPT',
        accountGroup: 'Direct Income',
        ledger: 'Cash Account',
        amount: finalAmount,
        entityName: targetName,
        description
      };
      await db.transactions.put(tx);
    }

    setUsage([...usage, entry]);
    alert("Authorization Granted & Billed!");
    setFormData({ bookingId: '', guestId: '', guestName: '', guestPhone: '', roomNumber: '', packageId: '', price: 0, discount: 0, assignToRoom: true, outsiderName: '', outsiderPhone: '', outsiderEmail: '' });
    setLaundryCart([]);
    setGuestSearch('');
  };

  const addToLaundryCart = (pkg: FacilityPackage) => {
    const existing = laundryCart.find(c => c.pkgId === pkg.id);
    if (existing) {
      setLaundryCart(laundryCart.map(c => c.pkgId === pkg.id ? {...c, qty: c.qty + 1} : c));
    } else {
      setLaundryCart([...laundryCart, { pkgId: pkg.id, name: pkg.name, price: pkg.price, qty: 1 }]);
    }
  };

  const removeFromLaundryCart = (id: string) => {
    setLaundryCart(laundryCart.filter(c => c.pkgId !== id));
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-[#f8fafc]">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Facility Management</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Gym, Swimming Pool, Laundry & Wellness Controls</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl no-print">
          <SubTab active={activeTab === 'DASHBOARD'} label="Overview" onClick={() => setActiveTab('DASHBOARD')} />
          <SubTab active={activeTab === 'GYM'} label="Gym Registry" onClick={() => setActiveTab('GYM')} />
          <SubTab active={activeTab === 'POOL'} label="Pool Registry" onClick={() => setActiveTab('POOL')} />
          <SubTab active={activeTab === 'LAUNDRY'} label="Laundry Services" onClick={() => setActiveTab('LAUNDRY')} />
          <SubTab active={activeTab === 'PACKAGES'} label="Master Settings" onClick={() => setActiveTab('PACKAGES')} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
        <div className="lg:col-span-3 flex flex-col gap-8 overflow-hidden">
          
          {activeTab === 'DASHBOARD' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
                <StatCard label="Today's Revenue" value={`₹${dailyStats.revenue.toFixed(2)}`} icon="💰" color="bg-green-600" />
                <StatCard label="Total Entries Today" value={dailyStats.totalEntries} icon="👥" color="bg-blue-600" />
                <StatCard label="Gym (Live)" value={dailyStats.activeGym} icon="🏋️" color="bg-indigo-600" />
                <StatCard label="Laundry (Orders)" value={dailyStats.laundryCount} icon="🧺" color="bg-orange-600" />
                
                <div className="col-span-full bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-black text-blue-900 uppercase mb-8 border-b pb-4">Live Activity Monitor</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {usage.slice(-9).reverse().map(u => (
                         <div key={u.id} className="p-6 bg-slate-50 border rounded-3xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-inner">
                               {u.facilityId === 'GYM' ? '🏋️' : u.facilityId === 'POOL' ? '🏊' : '🧺'}
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-slate-800 uppercase">{guests.find(g => g.id === u.guestId)?.name || (u as any).outsiderInfo?.name || 'Guest'}</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(u.startTime).toLocaleTimeString()}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'LAUNDRY' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-in fade-in duration-300 overflow-hidden">
                <div className="bg-white rounded-[3rem] border shadow-sm p-10 flex flex-col gap-6 overflow-hidden text-slate-900">
                   <div className="flex justify-between items-center border-b pb-4 shrink-0">
                      <h3 className="text-xl font-black text-blue-900 uppercase">Laundry Rate Chart</h3>
                      <button onClick={() => setEditingPkg({ facilityType: 'LAUNDRY', price: 0, validity: 'Per Item' })} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-black transition-all">+ Add Service</button>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
                      {packages.filter(p => p.facilityType === 'LAUNDRY').map(p => (
                         <button 
                           key={p.id} 
                           onClick={() => addToLaundryCart(p)}
                           className="p-5 border-2 border-slate-50 bg-slate-50/50 rounded-3xl text-left hover:border-orange-500 hover:bg-white transition-all group"
                         >
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{p.validity}</p>
                            <h4 className="text-[11px] font-black uppercase text-slate-800 leading-tight group-hover:text-orange-600">{p.name}</h4>
                            <p className="text-[13px] font-black text-blue-900 mt-3">₹{p.price}</p>
                         </button>
                      ))}
                   </div>
                </div>
                <div className="bg-white rounded-[3rem] border shadow-sm p-10 flex flex-col gap-6 overflow-hidden">
                   <h3 className="text-xl font-black text-blue-900 uppercase border-b pb-4 shrink-0">Order Summary</h3>
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                      {laundryCart.map(c => (
                         <div key={c.pkgId} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                               <p className="text-[10px] font-black uppercase text-slate-800">{c.name}</p>
                               <p className="text-[9px] font-bold text-orange-600">₹{c.price} × {c.qty}</p>
                            </div>
                            <div className="flex items-center gap-4">
                               <span className="text-[11px] font-black text-slate-900">₹{(c.price * c.qty).toFixed(2)}</span>
                               <button onClick={() => removeFromLaundryCart(c.pkgId)} className="text-red-300 hover:text-red-600 font-black text-lg">×</button>
                            </div>
                         </div>
                      ))}
                      {laundryCart.length === 0 && (
                         <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                            <span className="text-6xl">🧺</span>
                            <p className="text-[10px] font-black uppercase text-slate-400">Add items from the rate chart</p>
                         </div>
                      )}
                   </div>
                   <div className="pt-6 border-t border-slate-100 space-y-4">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black uppercase text-slate-400">Total Fare</span>
                         <span className="text-3xl font-black text-blue-900 tracking-tighter">₹{laundryCart.reduce((s, c) => s + (c.price * c.qty), 0).toFixed(2)}</span>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {(activeTab === 'GYM' || activeTab === 'POOL') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <TimingCard title={`${activeTab} Men's Slots`} hours={activeTab === 'GYM' ? config.gymMenHours : config.poolMenHours} color="bg-blue-600" icon="👨" />
                 <TimingCard title={`${activeTab} Women's Slots`} hours={activeTab === 'GYM' ? config.gymWomenHours : config.poolWomenHours} color="bg-rose-500" icon="👩" />
              </div>

              <div className="bg-white border rounded-[3.5rem] shadow-sm p-10 flex flex-col flex-1 overflow-hidden text-slate-900">
                 <h3 className="text-xl font-black text-blue-900 uppercase border-b pb-6 mb-8 flex justify-between items-center">
                    Active {activeTab} Residents
                    <span className="bg-blue-100 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black">{usage.filter(u => u.facilityId === activeTab).length} Live</span>
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
                    {usage.filter(u => u.facilityId === activeTab).map(u => {
                       const resGuest = guests.find(g => g.id === u.guestId);
                       const name = resGuest ? resGuest.name : (u as any).outsiderInfo?.name || 'Walk-in';
                       return (
                        <div key={u.id} className="p-6 bg-slate-50 border rounded-[2.5rem] flex flex-col justify-between group hover:border-blue-200 transition-all">
                           <div className="flex items-start gap-5">
                              <div className="w-14 h-14 bg-white border rounded-full flex items-center justify-center text-blue-900 text-xl font-black shadow-inner">{name.charAt(0)}</div>
                              <div>
                                 <h4 className="font-black text-blue-900 uppercase leading-tight truncate">{name}</h4>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">Started: {new Date(u.startTime).toLocaleTimeString()}</p>
                              </div>
                           </div>
                           <button onClick={() => db.facilityUsage.delete(u.id).then(() => setUsage(usage.filter(x => x.id !== u.id)))} className="mt-6 w-full bg-white text-red-500 py-3 rounded-2xl font-black text-[9px] uppercase border hover:bg-red-50 transition-all">End Session</button>
                        </div>
                       );
                    })}
                 </div>
              </div>
            </>
          )}

          {activeTab === 'PACKAGES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pr-2 pb-10">
               <div className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-xs font-black uppercase text-slate-400">Standard Rate Plans</h3>
                    <button onClick={() => setEditingPkg({ facilityType: 'GYM', price: 0, validity: '1 Session' })} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-black transition-all">+ Add New</button>
                  </div>
                  {packages.map(pkg => (
                     <div key={pkg.id} className="p-8 border rounded-[3rem] bg-white flex justify-between items-center hover:shadow-lg transition-all group relative text-slate-900">
                        <div>
                           <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block ${pkg.facilityType === 'GYM' ? 'bg-blue-100 text-blue-600' : pkg.facilityType === 'POOL' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>{pkg.facilityType}</span>
                           <h4 className="text-xl font-black text-slate-800 uppercase">{pkg.name}</h4>
                           <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Validity: {pkg.validity}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-2xl font-black text-blue-900">₹{pkg.price}</p>
                           <div className="flex gap-4 mt-2">
                              <button onClick={() => setEditingPkg(pkg)} className="text-[9px] font-black uppercase text-blue-500 underline">Edit</button>
                              <button onClick={() => deletePackage(pkg.id)} className="text-[9px] font-black uppercase text-red-400 underline">Delete</button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
               <div className="bg-white border rounded-[3.5rem] p-10 space-y-8 h-fit sticky top-0 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-4">Operational Slots</h3>
                  <TimeInp label="Gym Men" value={config.gymMenHours} onChange={(v: string) => setConfig({...config, gymMenHours: v})} />
                  <TimeInp label="Gym Women" value={config.gymWomenHours} onChange={(v: string) => setConfig({...config, gymWomenHours: v})} />
                  <TimeInp label="Pool Men" value={config.poolMenHours} onChange={(v: string) => setConfig({...config, poolMenHours: v})} />
                  <TimeInp label="Pool Women" value={config.poolWomenHours} onChange={(v: string) => setConfig({...config, poolWomenHours: v})} />
                  <button onClick={handleUpdateConfig} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Commit Slots</button>
               </div>
            </div>
          )}
        </div>
        
        {/* Registration Column */}
        <div className="bg-[#003d80] text-white rounded-[3.5rem] p-10 shadow-2xl flex flex-col gap-8 no-print overflow-y-auto custom-scrollbar">
           <h3 className="font-black uppercase text-sm tracking-tighter border-b border-white/10 pb-4 text-white">
              {activeTab === 'LAUNDRY' ? 'Laundry Dispatch' : 'Entry Protocol'}
           </h3>
           
           {activeTab !== 'LAUNDRY' && (
              <div className="flex bg-white/10 p-1 rounded-xl shrink-0">
                 <button onClick={() => setGuestType('RESIDENT')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${guestType === 'RESIDENT' ? 'bg-white text-blue-900 shadow-md' : 'text-blue-300 hover:text-white'}`}>Resident</button>
                 <button onClick={() => setGuestType('OUTSIDER')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${guestType === 'OUTSIDER' ? 'bg-white text-blue-900 shadow-md' : 'text-blue-300 hover:text-white'}`}>Outsider</button>
              </div>
           )}
           
           <div className="space-y-6 flex-1 pr-1">
              {(guestType === 'RESIDENT' || activeTab === 'LAUNDRY') ? (
                <div className="space-y-6">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-white/70 ml-2 tracking-widest">Find Resident Room</label>
                      <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-4 py-3 border-2 border-white/10 focus-within:border-white/30 transition-all">
                        <span className="text-sm opacity-50">🔍</span>
                        <input 
                          type="text" 
                          placeholder="Search Room / Name..." 
                          className="w-full bg-transparent text-[12px] font-black uppercase outline-none text-white placeholder:text-white/20" 
                          value={guestSearch} 
                          onChange={e => setGuestSearch(e.target.value)} 
                        />
                      </div>
                   </div>
                   
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-white/70 ml-2 tracking-widest">Select Room Number</label>
                      <select 
                        className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none focus:bg-white/10 transition-all appearance-none cursor-pointer" 
                        value={formData.bookingId} 
                        onChange={e => {
                          const b = bookings.find(x => x.id === e.target.value);
                          const g = guests.find(x => x.id === b?.guestId);
                          const r = rooms.find(rm => rm.id === b?.roomId);
                          setFormData({
                            ...formData, 
                            bookingId: e.target.value, 
                            guestId: g?.id || '', 
                            guestName: g?.name || '', 
                            guestPhone: g?.phone || '', 
                            roomNumber: r?.number || ''
                          });
                        }}
                      >
                          <option value="" className="text-slate-900">-- Choose Active Unit --</option>
                          {filteredGuests.map(b => (
                            <option key={b.id} value={b.id} className="text-slate-900">
                              ROOM {rooms.find(r => r.id === b.roomId)?.number} - {guests.find(g => g.id === b.guestId)?.name}
                            </option>
                          ))}
                      </select>
                   </div>

                   {/* Auto-Fetched Detail Card */}
                   {formData.bookingId && (
                     <div className="p-6 bg-white/10 border border-white/20 rounded-3xl animate-in slide-in-from-top-4 duration-300 shadow-inner">
                        <p className="text-[9px] font-black uppercase text-blue-300 tracking-widest mb-4">Resident Discovery Card</p>
                        <div className="space-y-3">
                           <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-white/40 uppercase">Room Number</span>
                              <span className="text-lg font-black text-white">{formData.roomNumber}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-white/40 uppercase">Guest Name</span>
                              <span className="text-[11px] font-black text-white uppercase">{formData.guestName}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-white/40 uppercase">Phone</span>
                              <span className="text-[11px] font-black text-white">{formData.guestPhone}</span>
                           </div>
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="space-y-6">
                   <SidebarInp label="Guest Name / Org" value={formData.outsiderName} onChange={(v: string) => setFormData({...formData, outsiderName: v})} placeholder="Full name..." />
                   <SidebarInp label="Direct Mobile" value={formData.outsiderPhone} onChange={(v: string) => setFormData({...formData, outsiderPhone: v})} placeholder="99XXXXXXX" />
                </div>
              )}

              {activeTab !== 'LAUNDRY' && (
                 <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-white/70 ml-2 tracking-widest">Service Plan Selection</label>
                        <select 
                          className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none focus:bg-white/10 transition-all appearance-none" 
                          value={formData.packageId} 
                          onChange={e => setFormData({...formData, packageId: e.target.value})}
                        >
                          <option value="" className="text-slate-900">Choose Service...</option>
                          {packages.filter(p => p.facilityType === (activeTab === 'DASHBOARD' || activeTab === 'PACKAGES' ? 'GYM' : activeTab)).map(pkg => (
                              <option key={pkg.id} value={pkg.id} className="text-slate-900">{pkg.name} (₹{pkg.price})</option>
                          ))}
                        </select>
                    </div>
                    <SidebarInp label="Direct Discount (₹)" type="number" value={formData.discount.toString()} onChange={(v: string) => setFormData({...formData, discount: parseFloat(v) || 0})} />
                    
                    {guestType === 'RESIDENT' && (
                       <label className="flex items-center justify-between p-5 bg-white/5 rounded-3xl cursor-pointer border-2 border-transparent hover:border-white/20 transition-all">
                          <div className="space-y-0.5">
                             <span className="text-[10px] font-black uppercase block">Post to Room Folio</span>
                             <span className="text-[8px] font-bold text-white/40 uppercase">Charges will appear on final bill</span>
                          </div>
                          <input type="checkbox" checked={formData.assignToRoom} onChange={e => setFormData({...formData, assignToRoom: e.target.checked})} className="w-6 h-6 rounded-xl accent-blue-600 border-2" />
                       </label>
                    )}
                 </div>
              )}

              {activeTab === 'LAUNDRY' && (
                 <div className="space-y-6 pt-6 border-t border-white/5">
                    <SidebarInp label="Extra Discount (₹)" type="number" value={formData.discount.toString()} onChange={(v: string) => setFormData({...formData, discount: parseFloat(v) || 0})} />
                    <div className="p-5 bg-blue-900/50 border border-blue-400/20 rounded-3xl flex items-center justify-between shadow-inner">
                       <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-blue-100 block">Resident Folio Link</span>
                          <span className="text-[8px] font-bold text-blue-300 uppercase leading-tight">Laundry orders are auto-mapped to room</span>
                       </div>
                       <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs shadow-lg">✓</div>
                    </div>
                 </div>
              )}
           </div>

           <button 
             onClick={handleAuthorize} 
             className="w-full bg-white text-blue-900 py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
           >
              {activeTab === 'LAUNDRY' ? 'Verify & Commit Order 👕' : 'Authorize & Open Entry ⚡'}
           </button>
        </div>
      </div>

      {/* Edit/Add Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter">{editingPkg.id ? 'Edit Service Plan' : 'Register New Service'}</h3>
                 <button onClick={() => setEditingPkg(null)} className="uppercase text-[10px] font-black opacity-60">Cancel</button>
              </div>
              <div className="p-10 space-y-6 text-slate-900">
                 <TimeInp label="Service / Item Name" value={editingPkg.name || ''} onChange={(v: string) => setEditingPkg({...editingPkg, name: v})} />
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Facility Type</label>
                        <select className="w-full border-2 p-3.5 rounded-2xl font-bold text-xs bg-slate-50 outline-none focus:bg-white" value={editingPkg.facilityType} onChange={e => setEditingPkg({...editingPkg, facilityType: e.target.value as any})}>
                            <option value="GYM">Gymnasium</option>
                            <option value="POOL">Swimming Pool</option>
                            <option value="LAUNDRY">Laundry Service</option>
                        </select>
                    </div>
                    <TimeInp label="Rate (₹)" type="number" value={editingPkg.price?.toString()} onChange={(v: string) => setEditingPkg({...editingPkg, price: parseFloat(v) || 0})} />
                 </div>
                 <TimeInp label="Validity / Unit" value={editingPkg.validity || ''} onChange={(v: string) => setEditingPkg({...editingPkg, validity: v})} placeholder="e.g. 1 Day, Per Item, Per Set" />
                 <button onClick={handleSavePackage} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Commit Changes</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
   <div className={`${color} p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group`}>
      <div className="absolute top-0 right-0 p-4 text-4xl opacity-20 group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-3">{label}</p>
      <p className="text-3xl font-black tracking-tighter">{value}</p>
   </div>
);

const TimingCard = ({ title, hours, color, icon }: any) => (
   <div className={`${color} p-6 rounded-[2rem] text-white flex items-center gap-5 shadow-lg`}>
      <div className="text-3xl bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10">{icon}</div>
      <div>
         <h4 className="text-[9px] font-black uppercase opacity-80 mb-1">{title}</h4>
         <p className="text-xs font-black tracking-tight">{hours}</p>
      </div>
   </div>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest whitespace-nowrap ${active ? 'bg-[#003d80] text-white shadow-xl' : 'text-slate-400 hover:text-blue-900 hover:bg-white'}`}>{label}</button>
);

const TimeInp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
   <div className="space-y-1 w-full text-left">
      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">{label}</label>
      <input type={type} className="w-full border-2 p-3.5 rounded-2xl font-bold text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black shadow-inner" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
   </div>
);

const SidebarInp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5">
     <label className="text-[10px] font-black uppercase text-white/70 ml-2 tracking-widest">{label}</label>
     <input 
        type={type} 
        className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl font-black text-xs outline-none focus:bg-white/10 focus:border-white/30 transition-all text-white placeholder:text-white/20 shadow-inner" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
     />
  </div>
);

export default FacilityModule;


import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Room, RoomStatus, Guest, Booking, HostelSettings, Transaction, GroupProfile, UserRole, Supervisor, Quotation, RoomShiftLog } from './types.ts';
import { INITIAL_ROOMS, STATUS_COLORS } from './constants.tsx';
import { db, exportDatabase } from './services/db.ts';
import { pullFromCloud, subscribeToTable, IS_CLOUD_ENABLED, checkCloudHealth } from './services/supabase.ts';
import GuestCheckin from './components/GuestCheckin.tsx';
import StayManagement from './components/StayManagement.tsx';
import Reports from './components/Reports.tsx';
import Accounting from './components/Accounting.tsx';
import Settings from './components/Settings.tsx';
import RoomActionModal from './components/RoomActionModal.tsx';
import GroupModule from './components/GroupModule.tsx';
import Login from './components/Login.tsx';
import ReservationEntry from './components/ReservationEntry.tsx';
import ReservationPipeline from './components/ReservationPipeline.tsx';
import GlobalBillArchive from './components/GlobalBillArchive.tsx';
import GuestPortal from './components/GuestPortal.tsx';
import PayrollModule from './components/PayrollModule.tsx';
import SupervisorPanel from './components/SupervisorPanel.tsx';

import BanquetModule from './components/BanquetModule.tsx';
import DiningModule from './components/DiningModule.tsx';
import FacilityModule from './components/FacilityModule.tsx';
import InventoryModule from './components/InventoryModule.tsx';
import TravelModule from './components/TravelModule.tsx';
import QuotationModule from './components/QuotationModule.tsx';

type AppTab = 'DASHBOARD' | 'BANQUET' | 'QUOTATION' | 'DINING' | 'FACILITY' | 'TRAVEL' | 'GROUP' | 'INVENTORY' | 'ACCOUNTING' | 'PAYROLL' | 'REPORTS' | 'SETTINGS' | 'GUEST_PORTAL' | 'SUPERVISOR_PANEL';

const DEFAULT_SETTINGS: HostelSettings = {
  id: 'primary',
  name: 'SHUBHKAMNA HOTEL AND RESORTS',
  address: 'Kh No. - 92/8, Nawagarh Chowk, NH-6, Kawardha Road, Bemetara, Chhattisgarh 491335',
  agents: [{ name: 'Direct', commission: 0 }],
  roomTypes: ['DELUXE ROOM', 'SUPER DELUXE ROOM', 'PREMIUM ROOM', 'SUPER PREMIUM ROOM', 'SUITE ROOM'],
  mealPlans: ['EP (Room Only)', 'CP (Breakfast)', 'MAP (Half Board)', 'AP (Full Board)'],
  mealPlanRates: [],
  floors: ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor'],
  blocks: [
    { id: 'b1', name: 'Ayodhya', prefix: 'A', color: 'emerald' },
    { id: 'b2', name: 'Mithila', prefix: 'M', color: 'lime' }
  ],
  bedTypes: ['Single Bed', 'Double Bed'],
  taxRate: 12,
  wifiPassword: 'shubhkamna@123',
  receptionPhone: '9',
  roomServicePhone: '8'
};

const App: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupProfile[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [settings, setSettings] = useState<HostelSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuestPortal, setIsGuestPortal] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('RECEPTIONIST');
  const [loggedInStaff, setLoggedInStaff] = useState<Supervisor | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('DASHBOARD');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showReservationPipeline, setShowReservationPipeline] = useState(false);
  const [showRoomActions, setShowRoomActions] = useState(false);
  const [showGlobalArchive, setShowGlobalArchive] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [isCloudLive, setIsCloudLive] = useState(false);

  const roomsWithEffectiveStatus = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (rooms || []).map(r => {
      if (r.status === RoomStatus.REPAIR) return { ...r, effectiveStatus: RoomStatus.REPAIR };
      const activeB = (bookings || []).find(b => b.roomId === r.id && b.status === 'ACTIVE');
      const resToday = (bookings || []).find(b => b.roomId === r.id && b.status === 'RESERVED' && b.checkInDate === today);
      const effectiveStatus = activeB ? RoomStatus.OCCUPIED : resToday ? RoomStatus.RESERVED : r.status;
      return { ...r, effectiveStatus };
    });
  }, [rooms, bookings]);

  const getDynamicColorClasses = (name: string) => {
    const themes = [
      'bg-indigo-700 text-white border-indigo-900 shadow-lg',
      'bg-blue-700 text-white border-blue-900 shadow-lg',
      'bg-emerald-800 text-white border-emerald-950 shadow-lg',
      'bg-rose-700 text-white border-rose-900 shadow-lg',
      'bg-teal-700 text-white border-teal-900 shadow-lg',
      'bg-cyan-800 text-white border-cyan-950 shadow-lg',
      'bg-amber-700 text-white border-amber-900 shadow-lg',
      'bg-violet-800 text-white border-violet-950 shadow-lg',
      'bg-slate-700 text-white border-slate-900 shadow-lg',
      'bg-fuchsia-700 text-white border-fuchsia-900 shadow-lg'
    ];
    let hash = 0;
    const cleanName = (name || '').trim().toUpperCase();
    for (let i = 0; i < cleanName.length; i++) {
      hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return themes[Math.abs(hash) % themes.length];
  };

  const handleUpdateSettings = async (newSettings: HostelSettings) => {
    const updated = { ...DEFAULT_SETTINGS, ...newSettings };
    await db.settings.put(updated as any);
    setSettings(updated);
  };

  const refreshLocalState = useCallback(async () => {
    setRooms(await db.rooms.toArray());
    setGuests(await db.guests.toArray());
    setBookings(await db.bookings.toArray());
    setTransactions(await db.transactions.toArray());
    setGroups(await db.groups.toArray());
    setSupervisors(await db.supervisors.toArray());
    setQuotations(await db.quotations.toArray());
    const s = await db.settings.get('primary');
    if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'guest') { setIsGuestPortal(true); }

    const init = async () => {
      try {
        if (IS_CLOUD_ENABLED) {
          const cloudOk = await checkCloudHealth();
          setIsCloudLive(cloudOk);

          const tables = ['rooms', 'guests', 'bookings', 'transactions', 'groups', 'supervisors', 'settings', 'quotations'];
          for (const table of tables) {
            const cloudData = await pullFromCloud(table);
            if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) { 
              await (db as any)[table].bulkPut(cloudData); 
            }
            // Subscribe to real-time changes
            subscribeToTable(table, () => {
              console.debug(`Remote change detected on ${table}. Refreshing...`);
              refreshLocalState();
            });
          }
        }
        const existingRooms = await db.rooms.toArray();
        if (existingRooms.length === 0) await db.rooms.bulkPut(INITIAL_ROOMS);
        await refreshLocalState();
      } catch (e) { console.error("Sync error:", e); }
      setIsLoading(false);
    };
    init();

    // Periodic cloud health check
    const healthInterval = setInterval(async () => {
      if (IS_CLOUD_ENABLED) {
        const ok = await checkCloudHealth();
        setIsCloudLive(ok);
      }
    }, 30000);

    return () => clearInterval(healthInterval);
  }, [refreshLocalState]);

  const handleLogin = (role: UserRole, supervisor?: Supervisor) => {
    setCurrentUserRole(role);
    setLoggedInStaff(supervisor || null);
    setIsLoggedIn(true);
    if (role === 'CHEF' || role === 'WAITER') setActiveTab('DINING');
    else if (role === 'ACCOUNTANT') setActiveTab('ACCOUNTING');
    else if (role === 'SUPERVISOR') setActiveTab('SUPERVISOR_PANEL');
    else setActiveTab('DASHBOARD');
  };

  const navItems = useMemo(() => {
    const allItems: { tab: AppTab, label: string }[] = [
      { tab: 'DASHBOARD', label: 'FRONT DESK' },
      { tab: 'SUPERVISOR_PANEL', label: 'HOUSEKEEPING' },
      { tab: 'DINING', label: 'DINING POS' },
      { tab: 'BANQUET', label: 'BANQUETS' },
      { tab: 'QUOTATION', label: 'QUOTATIONS' },
      { tab: 'FACILITY', label: 'FACILITIES' },
      { tab: 'TRAVEL', label: 'TRANSPORT' },
      { tab: 'GROUP', label: 'GROUPS' },
      { tab: 'INVENTORY', label: 'INVENTORY' },
      { tab: 'ACCOUNTING', label: 'ACCOUNTS' },
      { tab: 'PAYROLL', label: 'PAYROLL' },
      { tab: 'REPORTS', label: 'REPORTS' },
      { tab: 'SETTINGS', label: 'SYSTEM' },
    ];
    if (currentUserRole === 'CHEF' || currentUserRole === 'WAITER') return allItems.filter(i => i.tab === 'DINING');
    if (currentUserRole === 'ACCOUNTANT') return allItems.filter(i => ['ACCOUNTING', 'PAYROLL', 'REPORTS'].includes(i.tab));
    if (currentUserRole === 'SUPERVISOR') return allItems.filter(i => i.tab === 'SUPERVISOR_PANEL' || i.tab === 'DINING');
    return allItems;
  }, [currentUserRole]);

  const roomsByBlock = useMemo(() => {
    const filtered = statusFilter === 'ALL' ? roomsWithEffectiveStatus : roomsWithEffectiveStatus.filter(r => r.effectiveStatus === statusFilter);
    return filtered.reduce((acc, room) => {
      const blockKey = room.block || 'Ayodhya';
      if (!acc[blockKey]) acc[blockKey] = [];
      acc[blockKey].push(room);
      return acc;
    }, {} as Record<string, any[]>);
  }, [roomsWithEffectiveStatus, statusFilter]);

  const toggleRoomSelection = (roomId: string) => {
    const next = new Set(selectedRoomIds);
    if (next.has(roomId)) next.delete(roomId);
    else {
      const r = rooms.find(x => x.id === roomId);
      if (r && (r.status === RoomStatus.VACANT || r.status === RoomStatus.DIRTY)) {
        next.add(roomId);
      } else {
        alert("Only Vacant or Dirty rooms can be selected for multi-checkin.");
      }
    }
    setSelectedRoomIds(next);
  };

  const renderContent = () => {
    if (activeBookingId) {
      const b = bookings.find(x => x.id === activeBookingId);
      if (!b) { setActiveBookingId(null); return null; }
      const g = guests.find(x => x.id === b.guestId) || { id: 'unknown', name: 'Unknown Guest', phone: '' } as Guest;
      const r = rooms.find(x => x.id === b.roomId);
      if (!r) { setActiveBookingId(null); return null; }
      return <StayManagement booking={b} guest={g} room={r} allRooms={rooms} allBookings={bookings} settings={settings} 
        onUpdate={async (bu) => { await db.bookings.put(bu); refreshLocalState(); }} 
        onAddPayment={async (bid, p) => { 
          const bOrig = bookings.find(x => x.id === bid);
          if (!bOrig) return;
          const bu = { ...bOrig, payments: [...(bOrig.payments || []), p] };
          await db.bookings.put(bu);
          refreshLocalState();
        }} 
        onUpdateGuest={async (gu) => { if (gu.id) { await db.guests.put(gu); refreshLocalState(); } }}
        onShiftRoom={async (bookingId, newRoomId, reason) => {
           const b = bookings.find(x => x.id === bookingId);
           if (!b) return;
           const oldRoomId = b.roomId;
           await db.bookings.update(bookingId, { roomId: newRoomId });
           await db.rooms.update(oldRoomId, { status: RoomStatus.DIRTY });
           await db.rooms.update(newRoomId, { status: RoomStatus.OCCUPIED });
           refreshLocalState();
        }} onClose={() => setActiveBookingId(null)} />;
    }

    if (showCheckinForm) {
      const initialRoomIds = Array.from(selectedRoomIds);
      const initialRoom = selectedRoom || rooms.find(r => initialRoomIds.includes(r.id)) || rooms.find(r => r.status === RoomStatus.VACANT);
      if (!initialRoom) return null;
      return <GuestCheckin room={initialRoom} allRooms={rooms} existingGuests={guests} initialSelectedRoomIds={initialRoomIds}
        onClose={() => { setShowCheckinForm(false); setSelectedRoom(null); setSelectedRoomIds(new Set()); setIsSelectionMode(false); }} 
        onSave={async (data) => {
          const gId = data.guest.id || `G-${Date.now()}`;
          await db.guests.put({ ...data.guest, id: gId } as Guest);
          const bks = data.bookings.map(b => ({ ...b, id: `B-${Math.random().toString(36).substr(2, 5)}`, guestId: gId }));
          await db.bookings.bulkPut(bks);
          for (const b of bks) { await db.rooms.update(b.roomId, { status: RoomStatus.OCCUPIED }); }
          await refreshLocalState();
          setShowCheckinForm(false); setSelectedRoom(null); setSelectedRoomIds(new Set()); setIsSelectionMode(false);
        }} settings={settings} />;
    }

    switch (activeTab) {
      case 'SUPERVISOR_PANEL': return <SupervisorPanel staff={loggedInStaff} rooms={rooms} bookings={bookings} onUpdateRoom={async (ru) => { await db.rooms.put(ru); refreshLocalState(); }} />;
      case 'BANQUET': return <BanquetModule settings={settings} guests={guests} rooms={rooms} roomBookings={bookings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); refreshLocalState(); }} />;
      case 'QUOTATION': return <QuotationModule settings={settings} />;
      case 'DINING': return <DiningModule rooms={rooms} bookings={bookings} guests={guests} settings={settings} userRole={currentUserRole} />;
      case 'FACILITY': return <FacilityModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); refreshLocalState(); }} />;
      case 'TRAVEL': return <TravelModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); refreshLocalState(); }} />;
      case 'GROUP': return <GroupModule groups={groups} setGroups={async (gs) => { setGroups(gs); await db.groups.bulkPut(gs); }} rooms={rooms} bookings={bookings} setBookings={async (bks) => { setBookings(bks); await db.bookings.bulkPut(bks); }} guests={guests} setGuests={setGuests} setRooms={async (rs) => { setRooms(rs); await db.rooms.bulkPut(rs); }} onAddTransaction={(tx) => { db.transactions.put(tx); refreshLocalState(); }} onGroupPayment={() => {}} settings={settings} />;
      case 'INVENTORY': return <InventoryModule settings={settings} setSettings={handleUpdateSettings} />;
      case 'ACCOUNTING': return <Accounting transactions={transactions} setTransactions={async (txs) => { setTransactions(txs); await db.transactions.bulkPut(txs); refreshLocalState(); }} guests={guests} bookings={bookings} settings={settings} rooms={rooms} quotations={quotations} setQuotations={async (qs) => { setQuotations(qs); await db.quotations.bulkPut(qs); refreshLocalState(); }} />;
      case 'PAYROLL': return <PayrollModule staff={supervisors} settings={settings} onUpdateTransactions={(tx) => { db.transactions.put(tx); refreshLocalState(); }} />;
      case 'REPORTS': return <Reports bookings={bookings} guests={guests} rooms={rooms} settings={settings} transactions={transactions} shiftLogs={[]} cleaningLogs={[]} quotations={quotations} />;
      case 'SETTINGS': return <Settings settings={settings} setSettings={handleUpdateSettings} rooms={rooms} setRooms={(rs)=>setRooms(rs)} supervisors={supervisors} setSupervisors={async (sups) => { setSupervisors(sups); await db.supervisors.bulkPut(sups); refreshLocalState(); }} />;
      default:
        return (
          <div className="p-4 md:p-8 lg:p-10 pb-40 relative animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 lg:mb-14 gap-6 glass-card p-10 rounded-[3rem] shadow-2xl border-2 border-emerald-800/10">
               <div className="flex flex-col gap-1 text-center md:text-left">
                 <h1 className="text-3xl md:text-5xl font-black text-emerald-900 uppercase tracking-tighter leading-none">{settings.name}</h1>
                 <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border shadow-sm">
                       <div className={`w-2 h-2 rounded-full ${isCloudLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                       <p className="text-[10px] md:text-[12px] font-black text-lime-600 uppercase tracking-[0.4em]">{isCloudLive ? 'Live Enterprise Sync Active' : 'Offline / Syncing...'}</p>
                    </div>
                    <button 
                      onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedRoomIds(new Set()); }}
                      className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase border-2 transition-all ${isSelectionMode ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                       {isSelectionMode ? 'CANCEL SELECTION' : 'BULK MODE'}
                    </button>
                 </div>
               </div>
               <div className="flex flex-wrap gap-4 justify-center">
                  <button onClick={() => setShowReservationPipeline(true)} className="bg-white text-emerald-900 border-2 border-emerald-900 px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg hover:bg-emerald-900 hover:text-white transition-all">Reservations</button>
                  <button onClick={() => setShowReservationForm(true)} className="bg-emerald-800 text-white px-10 lg:px-14 py-4 rounded-2xl font-black text-[11px] uppercase shadow-2xl shadow-emerald-500/30 hover:scale-105 transition-all">+ RESERVATION</button>
               </div>
            </div>

            {(Object.entries(roomsByBlock) as [string, any[]][]).sort().map(([block, blockRooms]) => (
              <div key={block} className="mb-14">
                <h3 className={`text-[13px] font-black uppercase mb-8 tracking-[0.3em] flex items-center gap-4 text-emerald-900`}>
                  <span className={`w-12 h-1 bg-emerald-900 opacity-20`}></span>
                  🌿 {block} Block
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5 md:gap-8">
                  {blockRooms.sort((a,b) => a.number.localeCompare(b.number, undefined, {numeric: true})).map(room => {
                    const today = new Date().toISOString().split('T')[0];
                    const activeB = (bookings || []).find(b => b.roomId === room.id && b.status === 'ACTIVE');
                    const resToday = (bookings || []).find(b => b.roomId === room.id && b.status === 'RESERVED' && b.checkInDate === today);
                    const guestObj = (activeB || resToday) ? (guests || []).find(g => g.id === (activeB || resToday)!.guestId) : null;
                    const status = room.effectiveStatus;
                    const isSelected = selectedRoomIds.has(room.id);

                    const dynamicClasses = (guestObj && (status === RoomStatus.OCCUPIED || status === RoomStatus.RESERVED)) 
                      ? getDynamicColorClasses(guestObj.name) 
                      : (STATUS_COLORS[status] || 'bg-white border-slate-200 text-slate-800');

                    return (
                      <button key={room.id} onClick={() => {
                          if (isSelectionMode) toggleRoomSelection(room.id);
                          else if (activeB || resToday) setActiveBookingId((activeB || resToday)!.id);
                          else { setSelectedRoom(room); setShowRoomActions(true); }
                        }} 
                        className={`min-h-[190px] rounded-[2.8rem] border-4 p-6 flex flex-col items-center justify-between relative group transition-all shadow-sm ${dynamicClasses} ${isSelected ? 'border-orange-500 scale-105 shadow-2xl ring-8 ring-orange-500/10' : 'border-transparent'}`}
                      >
                        {isSelected && <div className="absolute top-4 right-4 bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black animate-bounce shadow-lg">✓</div>}
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">{room.number}</span>
                           <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{room.floor}</p>
                        </div>
                        <div className="text-center w-full">
                           <div className={`text-[10px] font-black uppercase mb-2 truncate px-2`}>{guestObj ? guestObj.name : room.type}</div>
                           <div className={`text-[8px] font-black uppercase py-1.5 px-4 rounded-full border-2 border-current inline-block bg-black/10`}>{status}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {isSelectionMode && selectedRoomIds.size > 0 && (
              <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10">
                 <button 
                   onClick={() => setShowCheckinForm(true)}
                   className="bg-blue-900 text-white px-12 py-6 rounded-[2.5rem] font-black uppercase text-sm shadow-3xl shadow-blue-500/40 hover:bg-black hover:scale-105 transition-all flex items-center gap-6"
                 >
                    <span className="bg-white/20 px-4 py-2 rounded-2xl">{selectedRoomIds.size}</span>
                    AUTHORIZE MULTI CHECK-IN
                 </button>
              </div>
            )}
          </div>
        );
    }
  };

  if (isLoading) return <div className="min-h-screen bg-white flex flex-col items-center justify-center text-emerald-900 gap-6">
    <div className="w-24 h-24 bg-emerald-600 rounded-[2rem] animate-bounce flex items-center justify-center text-3xl font-black text-white shadow-2xl">HS</div>
    <div className="space-y-2 text-center">
      <p className="font-black uppercase tracking-[0.6em] text-sm text-emerald-900">Shubhkamna Enterprise</p>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Cloud Nodes...</p>
    </div>
  </div>;

  if (!isLoggedIn && !isGuestPortal) return <Login onLogin={handleLogin} settings={settings} supervisors={supervisors} />;
  if (isGuestPortal) return <GuestPortal settings={settings} allRooms={rooms} onCheckinComplete={refreshLocalState} />;

  const handleStatClick = (filter: RoomStatus | 'ALL') => {
    setStatusFilter(filter);
    setActiveTab('DASHBOARD');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f9f4]">
      <nav className="bg-white px-4 md:px-10 flex items-center shadow-lg sticky top-0 z-50 no-print border-b-4 border-emerald-800 shrink-0 h-[80px]">
        <div className="flex items-center gap-2 h-full overflow-x-auto scrollbar-hide">
          {(navItems || []).map(item => <NavBtn key={item.tab} label={item.label} active={activeTab === item.tab} onClick={() => setActiveTab(item.tab)} />)}
        </div>
        <button onClick={() => window.location.reload()} className="ml-auto text-[11px] font-black uppercase bg-emerald-50 text-emerald-600 px-8 py-3.5 rounded-2xl transition-all">LOGOUT</button>
      </nav>
      <main className="flex-1 overflow-y-auto custom-scrollbar no-print">{renderContent()}</main>
      <footer className="bg-white border-t border-emerald-100 px-4 md:px-10 py-5 flex flex-col md:flex-row justify-between items-center z-40 no-print gap-6 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap gap-2 md:gap-4 items-center justify-center md:justify-start">
          <Stat label="TOTAL" count={(rooms || []).length} color="text-emerald-900" onClick={() => handleStatClick('ALL')} active={statusFilter === 'ALL'} />
          <Stat label="VACANT" count={roomsWithEffectiveStatus.filter(r=>r.effectiveStatus===RoomStatus.VACANT).length} color="text-emerald-600" onClick={() => handleStatClick(RoomStatus.VACANT)} active={statusFilter === RoomStatus.VACANT} />
          <Stat label="OCCUPIED" count={roomsWithEffectiveStatus.filter(r=>r.effectiveStatus===RoomStatus.OCCUPIED).length} color="text-emerald-800" onClick={() => handleStatClick(RoomStatus.OCCUPIED)} active={statusFilter === RoomStatus.OCCUPIED} />
          <Stat label="RESERVED" count={roomsWithEffectiveStatus.filter(r=>r.effectiveStatus===RoomStatus.RESERVED).length} color="text-orange-600" onClick={() => handleStatClick(RoomStatus.RESERVED)} active={statusFilter === RoomStatus.RESERVED} />
          <Stat label="DIRTY" count={roomsWithEffectiveStatus.filter(r=>r.effectiveStatus===RoomStatus.DIRTY).length} color="text-yellow-600" onClick={() => handleStatClick(RoomStatus.DIRTY)} active={statusFilter === RoomStatus.DIRTY} />
          <Stat label="REPAIR" count={roomsWithEffectiveStatus.filter(r=>r.effectiveStatus===RoomStatus.REPAIR).length} color="text-slate-500" onClick={() => handleStatClick(RoomStatus.REPAIR)} active={statusFilter === RoomStatus.REPAIR} />
        </div>
        <div className="flex items-center gap-4 shrink-0">
           <FooterBtn label="ARCHIVE" onClick={() => setShowGlobalArchive(true)} icon="📄" />
           <FooterBtn label="BACKUP" onClick={exportDatabase} icon="☁️" />
        </div>
      </footer>
      {showRoomActions && selectedRoom && <RoomActionModal room={selectedRoom} onClose={() => setShowRoomActions(false)} onCheckIn={() => { setShowRoomActions(false); setShowCheckinForm(true); }} onStatusUpdate={async (s) => { await db.rooms.update(selectedRoom.id, { status: s }); refreshLocalState(); setShowRoomActions(false); }} />}
      {showReservationPipeline && <ReservationPipeline bookings={bookings} guests={guests} rooms={rooms} onClose={() => setShowReservationPipeline(false)} onCheckIn={(b) => { setActiveBookingId(b.id); setShowReservationPipeline(false); }} onCancel={async (id) => { await db.bookings.update(id, { status: 'CANCELLED' }); refreshLocalState(); }} />}
      {showReservationForm && <ReservationEntry settings={settings} rooms={rooms} existingGuests={guests} onClose={() => setShowReservationForm(false)} onSave={async (data) => {
          const gId = data.guest.id || `G-${Date.now()}`;
          await db.guests.put({ ...data.guest, id: gId } as Guest);
          await db.bookings.bulkPut(data.bookings.map(b => ({ ...b, guestId: gId })));
          await refreshLocalState(); setShowReservationForm(false);
      }} />}
      {showGlobalArchive && <GlobalBillArchive settings={settings} guests={guests} rooms={rooms} onClose={() => setShowGlobalArchive(false)} />}
    </div>
  );
};

const NavBtn: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl transition-all font-black text-[10px] tracking-widest uppercase shrink-0 mx-1 h-[48px] flex items-center justify-center ${active ? 'bg-emerald-800 text-white shadow-xl' : 'text-slate-400 hover:text-emerald-900 hover:bg-emerald-50'}`}>{label}</button>
);

const Stat: React.FC<{ label: string, count: number, color: string, onClick: () => void, active: boolean }> = ({ label, count, color, onClick, active }) => (
  <button onClick={onClick} className={`flex items-center gap-3 md:gap-5 shrink-0 p-3 px-4 md:px-5 rounded-2xl transition-all ${active ? 'bg-emerald-50 ring-2 ring-emerald-900/10' : 'hover:bg-white'}`}>
    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">{label}</span>
    <span className={`text-xl md:text-2xl font-black ${color} tracking-tighter`}>{count}</span>
  </button>
);

const FooterBtn = ({ label, onClick, icon }: any) => (
  <button onClick={onClick} className="flex items-center gap-3 px-6 md:px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-white text-emerald-900 border-2 border-emerald-900/10 hover:border-emerald-500 shadow-sm whitespace-nowrap"><span>{icon}</span>{label}</button>
);

export default App;

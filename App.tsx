
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Room, RoomStatus, Guest, Booking, HostelSettings, Transaction, GroupProfile, UserRole, Supervisor, Quotation } from './types.ts';
import { INITIAL_ROOMS, STATUS_COLORS } from './constants.tsx';
import { db, exportDatabase } from './services/db.ts';
import { pullFromCloud, subscribeToTable } from './services/supabase.ts';
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

// --- MODULES ---
import BanquetModule from './components/BanquetModule.tsx';
import DiningModule from './components/DiningModule.tsx';
import FacilityModule from './components/FacilityModule.tsx';
import InventoryModule from './components/InventoryModule.tsx';
import TravelModule from './components/TravelModule.tsx';

const GUEST_THEMES = [
  { border: 'border-rose-500', bg: 'bg-rose-50', text: 'text-rose-900', status: 'text-rose-600 border-rose-600', name: 'text-rose-600' },
  { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-900', status: 'text-emerald-600 border-emerald-600', name: 'text-emerald-600' },
  { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-900', status: 'text-amber-600 border-orange-600', name: 'text-amber-600' },
  { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-900', status: 'text-indigo-600 border-indigo-600', name: 'text-indigo-600' },
  { border: 'border-sky-600', bg: 'bg-sky-50', text: 'text-sky-900', status: 'text-sky-600 border-sky-600', name: 'text-sky-600' },
];

const getGuestTheme = (name: string) => {
  let hash = 0;
  const safeName = name || 'Guest';
  for (let i = 0; i < safeName.length; i++) hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  return GUEST_THEMES[Math.abs(hash) % GUEST_THEMES.length];
};

type AppTab = 'DASHBOARD' | 'BANQUET' | 'DINING' | 'FACILITY' | 'TRAVEL' | 'GROUP' | 'INVENTORY' | 'ACCOUNTING' | 'PAYROLL' | 'REPORTS' | 'SETTINGS' | 'GUEST_PORTAL';

const App: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupProfile[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  
  const [settings, setSettings] = useState<HostelSettings>({
    name: 'Hotel Sphere Pro',
    address: 'Powered by Digital Communique',
    agents: [{ name: 'Direct', commission: 0 }],
    roomTypes: ['DELUXE ROOM', 'BUDGET ROOM', 'STANDARD ROOM', 'AC FAMILY ROOM'],
    mealPlans: ['EP (Room Only)', 'CP (Breakfast)', 'MAP (Half Board)', 'AP (Full Board)'],
    floors: [1, 2, 3],
    taxRate: 12,
    wifiPassword: 'hotelsphere123',
    receptionPhone: '9',
    roomServicePhone: '8'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuestPortal, setIsGuestPortal] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('RECEPTIONIST');
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

  const refreshLocalState = useCallback(async () => {
    setRooms(await db.rooms.toArray());
    setGuests(await db.guests.toArray());
    setBookings(await db.bookings.toArray());
    setTransactions(await db.transactions.toArray());
    setGroups(await db.groups.toArray());
    setSupervisors(await db.supervisors.toArray());
    setQuotations(await db.quotations.toArray());
    const s = await db.settings.get('primary');
    if (s) setSettings(s);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'guest') {
       setIsGuestPortal(true);
    }

    const init = async () => {
      try {
        setIsCloudSyncing(true);
        const tables = ['rooms', 'guests', 'bookings', 'transactions', 'groups', 'supervisors', 'settings', 'payroll'];
        for (const table of tables) {
          const cloudData = await pullFromCloud(table);
          if (cloudData.length > 0) {
            await (db as any)[table].bulkPut(cloudData);
          }
        }
        const r = await db.rooms.toArray();
        if (r.length === 0) {
          await db.rooms.bulkPut(INITIAL_ROOMS);
        }
        await refreshLocalState();
        tables.forEach(tableName => {
          subscribeToTable(tableName, async (payload) => {
            const table = (db as any)[tableName];
            if (!table) return;
            if (payload.eventType === 'DELETE') {
              await table.delete(payload.old.id);
            } else {
              await table.put(payload.new);
            }
            refreshLocalState();
          });
        });
        setIsCloudSyncing(false);
      } catch (e) { 
        console.error("Initialization error:", e);
        setIsCloudSyncing(false);
      }
      setIsLoading(false);
    };
    init();
  }, [refreshLocalState]);

  const handleLogin = (role: UserRole, supervisor?: Supervisor) => {
    setCurrentUserRole(role);
    setIsLoggedIn(true);
    if (role === 'CHEF' || role === 'WAITER') setActiveTab('DINING');
    else if (role === 'ACCOUNTANT') setActiveTab('ACCOUNTING');
    else setActiveTab('DASHBOARD');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const navItems = useMemo(() => {
    const allItems: { tab: AppTab, label: string }[] = [
      { tab: 'DASHBOARD', label: 'Front Desk' },
      { tab: 'DINING', label: 'Dining POS' },
      { tab: 'BANQUET', label: 'Banquets' },
      { tab: 'FACILITY', label: 'Facilities' },
      { tab: 'TRAVEL', label: 'Transport' },
      { tab: 'GROUP', label: 'Groups' },
      { tab: 'INVENTORY', label: 'Inventory' },
      { tab: 'ACCOUNTING', label: 'Accounts' },
      { tab: 'PAYROLL', label: 'Payroll' },
      { tab: 'REPORTS', label: 'Reports' },
      { tab: 'SETTINGS', label: 'System' },
    ];
    if (currentUserRole === 'CHEF' || currentUserRole === 'WAITER') return allItems.filter(i => i.tab === 'DINING');
    if (currentUserRole === 'ACCOUNTANT') return allItems.filter(i => ['ACCOUNTING', 'PAYROLL', 'REPORTS'].includes(i.tab));
    return allItems;
  }, [currentUserRole]);

  const roomsByFloor = useMemo(() => {
    const filtered = statusFilter === 'ALL' ? rooms : rooms.filter(r => r.status === statusFilter);
    return filtered.reduce((acc, room) => {
      const floorKey = room.floor.toString();
      if (!acc[floorKey]) acc[floorKey] = [];
      acc[floorKey].push(room);
      return acc;
    }, {} as Record<string, Room[]>);
  }, [rooms, statusFilter]);

  const toggleRoomSelection = (roomId: string) => {
    const newSet = new Set(selectedRoomIds);
    if (newSet.has(roomId)) newSet.delete(roomId);
    else newSet.add(roomId);
    setSelectedRoomIds(newSet);
  };

  const handleShiftRoom = async (bookingId: string, oldRoomId: string, newRoomId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    try {
      const updatedBooking = { ...booking, roomId: newRoomId };
      await db.bookings.put(updatedBooking);
      const updatedRooms = rooms.map(r => {
        if (r.id === oldRoomId) return { ...r, status: RoomStatus.DIRTY, currentBookingId: undefined };
        if (r.id === newRoomId) return { ...r, status: RoomStatus.OCCUPIED, currentBookingId: bookingId };
        return r;
      });
      await db.rooms.bulkPut(updatedRooms.filter(x => x.id));
      setRooms(updatedRooms);
      setBookings(bookings.map(b => b.id === bookingId ? updatedBooking : b));
    } catch (err) {
      console.error("Shift failed.", err);
    }
  };

  const handleReservationCheckIn = async (b: Booking) => {
    const now = new Date();
    const updatedBooking: Booking = { 
      ...b, 
      status: 'ACTIVE', 
      checkInDate: now.toISOString().split('T')[0],
      checkInTime: now.toTimeString().split(' ')[0].substring(0, 5)
    };
    await db.bookings.put(updatedBooking);
    const updatedRooms = rooms.map(r => r.id === b.roomId ? { ...r, status: RoomStatus.OCCUPIED, currentBookingId: b.id } : r);
    await db.rooms.bulkPut(updatedRooms.filter(x => x.id));
    setRooms(updatedRooms);
    setBookings(bookings.map(book => book.id === b.id ? updatedBooking : book));
    setShowReservationPipeline(false);
    setActiveBookingId(b.id);
  };

  const handleCancelReservation = async (id: string) => {
    await db.bookings.delete(id);
    setBookings(bookings.filter(b => b.id !== id));
  };

  const renderContent = () => {
    if (activeBookingId) {
      const b = bookings.find(x => x.id === activeBookingId);
      if (!b) { setActiveBookingId(null); return null; }
      const g = guests.find(x => x.id === b.guestId) || { id: 'unknown', name: 'Unknown Guest', phone: '', documents: {} } as Guest;
      const r = rooms.find(x => x.id === b.roomId);
      if (!r) { setActiveBookingId(null); return null; }
      return <StayManagement booking={b} guest={g} room={r} allRooms={rooms} allBookings={bookings} settings={settings} 
        onUpdate={async (bu) => { 
          if (!bu.id) return;
          await db.bookings.put(bu); 
          setBookings(bookings.map(x => x.id === bu.id ? bu : x)); 
          if (bu.status === 'COMPLETED') {
             const rs = rooms.map(rm => rm.id === bu.roomId ? { ...rm, status: RoomStatus.DIRTY, currentBookingId: undefined } : rm);
             await db.rooms.bulkPut(rs.filter(x => x.id));
             setRooms(rs);
          }
        }} 
        onAddPayment={async (bid, p) => { 
          const bOrig = bookings.find(x => x.id === bid);
          if (!bOrig) return;
          const bu = { ...bOrig, payments: [...(bOrig.payments || []), p] };
          await db.bookings.put(bu);
          setBookings(bookings.map(x => x.id === bu.id ? bu : x));
        }} 
        onUpdateGuest={async (gu) => { 
          if (!gu.id || gu.id === 'unknown') return;
          await db.guests.put(gu); 
          setGuests(guests.map(x => x.id === gu.id ? gu : x)); 
        }}
        onShiftRoom={(newRid) => handleShiftRoom(b.id, r.id, newRid)} 
        onClose={() => setActiveBookingId(null)} />;
    }

    if (showCheckinForm) {
      const initialRoomIds = Array.from(selectedRoomIds);
      const initialRoom = selectedRoom || rooms.find(r => r.id === initialRoomIds[0]) || rooms.find(r => r.status === RoomStatus.VACANT);
      if (!initialRoom) { setShowCheckinForm(false); return null; }
      return <GuestCheckin 
        room={initialRoom} 
        allRooms={rooms} 
        existingGuests={guests} 
        initialSelectedRoomIds={initialRoomIds}
        onClose={() => { setShowCheckinForm(false); setSelectedRoom(null); setSelectedRoomIds(new Set()); setIsSelectionMode(false); }} 
        onSave={async (data) => {
          const gId = data.guest.id || `G-${Date.now()}`;
          await db.guests.put({ ...data.guest, id: gId } as Guest);
          const bks = data.bookings.map(b => ({ ...b, id: `B-${Math.random().toString(36).substr(2, 5)}`, guestId: gId }));
          await db.bookings.bulkPut(bks.filter(x => x.id));
          const updatedRooms = rooms.map(r => {
            const b = bks.find(bk => bk.roomId === r.id);
            return b ? { ...r, status: RoomStatus.OCCUPIED, currentBookingId: b.id } : r;
          });
          await db.rooms.bulkPut(updatedRooms.filter(x => x.id));
          await refreshLocalState();
          setShowCheckinForm(false);
          setSelectedRoom(null);
          setSelectedRoomIds(new Set());
          setIsSelectionMode(false);
        }} settings={settings} />;
    }

    switch (activeTab) {
      case 'BANQUET': return <BanquetModule settings={settings} guests={guests} rooms={rooms} roomBookings={bookings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); setBookings(bookings.map(b => b.id === bu.id ? bu : b)); }} />;
      case 'DINING': return <DiningModule rooms={rooms} bookings={bookings} guests={guests} settings={settings} userRole={currentUserRole} onUpdateBooking={async (bu) => { await db.bookings.put(bu); setBookings(bookings.map(b => b.id === bu.id ? bu : b)); }} />;
      case 'FACILITY': return <FacilityModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); setBookings(bookings.map(b => b.id === bu.id ? bu : b)); }} />;
      case 'TRAVEL': return <TravelModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} onUpdateBooking={async (bu) => { await db.bookings.put(bu); setBookings(bookings.map(b => b.id === bu.id ? bu : b)); }} />;
      case 'GROUP': return <GroupModule groups={groups} setGroups={async (gs) => { setGroups(gs); await db.groups.bulkPut(gs.filter(x => x.id)); }} rooms={rooms} bookings={bookings} setBookings={async (bks) => { setBookings(bks); await db.bookings.bulkPut(bks.filter(x => x.id)); }} guests={guests} setGuests={setGuests} setRooms={async (rs) => { setRooms(rs); await db.rooms.bulkPut(rs.filter(x => x.id)); }} onAddTransaction={(tx) => { setTransactions([...transactions, tx]); db.transactions.put(tx); }} onGroupPayment={() => {}} settings={settings} />;
      case 'INVENTORY': return <InventoryModule settings={settings} />;
      case 'ACCOUNTING': return <Accounting transactions={transactions} setTransactions={async (txs) => { setTransactions(txs); await db.transactions.bulkPut(txs.filter(x => x.id)); }} guests={guests} bookings={bookings} quotations={quotations} setQuotations={async (qs) => { setQuotations(qs); await db.quotations.bulkPut(qs.filter(x => x.id)); }} settings={settings} rooms={rooms} />;
      case 'PAYROLL': return <PayrollModule staff={supervisors} settings={settings} onUpdateTransactions={(tx) => { setTransactions([...transactions, tx]); db.transactions.put(tx); }} />;
      case 'REPORTS': return <Reports bookings={bookings} guests={guests} rooms={rooms} settings={settings} transactions={transactions} shiftLogs={[]} cleaningLogs={[]} quotations={quotations} />;
      case 'SETTINGS': return <Settings settings={settings} setSettings={async (s)=>{await db.settings.put({...s, id:'primary'}); setSettings(s);}} rooms={rooms} setRooms={async (rs)=>{setRooms(rs); await db.rooms.bulkPut(rs.filter(x => x.id));}} supervisors={supervisors} setSupervisors={async (sups) => { setSupervisors(sups); await db.supervisors.bulkPut(sups.filter(x => x.id)); }} />;
      default:
        return (
          <div className="p-4 md:p-8 lg:p-10 pb-40 relative animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 lg:mb-14 gap-6 glass-card p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl shadow-orange-100/50 border border-white">
               <div className="flex flex-col gap-1 text-center md:text-left">
                 <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Property Dashboard</h1>
                 <p className="text-[9px] md:text-[11px] font-bold text-orange-500 uppercase tracking-[0.4em] ml-1">Terminal Master Hub</p>
               </div>
               <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto">
                  <button onClick={toggleFullscreen} className="hidden md:flex bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold text-[10px] uppercase shadow-xl hover:bg-orange-600 transition-all items-center gap-3 border border-white/10 group">
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    FULLSCREEN
                  </button>
                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    <button onClick={() => setShowReservationPipeline(true)} className="flex-1 bg-white text-orange-600 border-2 border-orange-50 px-6 lg:px-8 py-4 rounded-2xl font-black text-[10px] md:text-[11px] uppercase shadow-lg hover:border-orange-200 transition-all">Reservations</button>
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedRoomIds(new Set()); }} className={`flex-1 px-6 lg:px-8 py-4 rounded-2xl font-black text-[10px] md:text-[11px] uppercase shadow-lg transition-all border-2 ${isSelectionMode ? 'bg-orange-500 border-orange-500 text-white animate-pulse shadow-orange-200' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                      {isSelectionMode ? 'EXIT MULTI' : 'MULTI CHECK-IN'}
                    </button>
                    <button onClick={() => setShowReservationForm(true)} className="flex-[1.5] bg-orange-600 text-white px-8 lg:px-12 py-4 rounded-2xl font-black text-[10px] md:text-[11px] uppercase shadow-2xl shadow-orange-200 hover:bg-slate-900 hover:-translate-y-0.5 transition-all">+ RESERVATION</button>
                  </div>
               </div>
            </div>

            {(Object.entries(roomsByFloor) as [string, Room[]][]).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([floor, floorRooms]) => (
              <div key={floor} className="mb-14">
                <h3 className="text-[10px] md:text-[12px] font-extrabold uppercase text-slate-400 mb-8 tracking-[0.3em] flex items-center gap-4">
                  <span className="w-12 h-1 bg-orange-600 rounded-full"></span>
                  Level {floor} Grid
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                  {floorRooms.map(room => {
                    const today = new Date().toISOString().split('T')[0];
                    const activeB = bookings.find(b => b.roomId === room.id && b.status === 'ACTIVE');
                    const reservedToday = bookings.find(b => b.roomId === room.id && b.status === 'RESERVED' && b.checkInDate === today);
                    const guestObj = (activeB || reservedToday) ? guests.find(g => g.id === (activeB || reservedToday)!.guestId) : null;
                    const effectiveStatus = activeB ? RoomStatus.OCCUPIED : reservedToday ? RoomStatus.RESERVED : room.status;
                    const theme = guestObj ? getGuestTheme(guestObj.name) : null;
                    const isSelected = selectedRoomIds.has(room.id);

                    return (
                      <button 
                        key={room.id} 
                        onClick={() => {
                          if (isSelectionMode) {
                            if (effectiveStatus === RoomStatus.VACANT || effectiveStatus === RoomStatus.DIRTY) toggleRoomSelection(room.id);
                            else alert("Only vacant or laundry units can be selected for multi check-in.");
                          } else {
                            if (activeB || reservedToday) setActiveBookingId((activeB || reservedToday)!.id);
                            else { setSelectedRoom(room); setShowRoomActions(true); }
                          }
                        }} 
                        className={`min-h-[150px] md:min-h-[170px] border-2 rounded-[2.5rem] md:rounded-[3rem] p-5 md:p-7 flex flex-col items-center justify-between transition-all shadow-md relative group ${isSelected ? 'border-orange-600 ring-[10px] ring-orange-50 scale-105 z-10 bg-orange-50' : theme ? `${theme.bg} ${theme.border} ${theme.text}` : STATUS_COLORS[effectiveStatus]} hover:shadow-2xl hover:-translate-y-1`}
                      >
                        {isSelected && <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-600 text-white rounded-2xl flex items-center justify-center text-xs font-black shadow-xl animate-in zoom-in border-4 border-white">✓</div>}
                        <span className="text-3xl md:text-4xl font-extrabold tracking-tighter uppercase leading-none">{room.number}</span>
                        <div className="text-center w-full">
                           <div className={`text-[8px] md:text-[9px] font-black uppercase mb-1.5 opacity-60 truncate ${theme ? theme.status.split(' ')[0] : ''}`}>
                             {guestObj ? guestObj.name : room.type}
                           </div>
                           <div className={`text-[7px] md:text-[8px] font-black uppercase py-1.5 px-4 md:px-6 rounded-full border-2 border-current inline-block ${theme ? theme.status : ''}`}>{effectiveStatus}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-6">
    <div className="w-20 h-20 bg-orange-600 rounded-[2.5rem] animate-bounce flex items-center justify-center text-3xl font-black shadow-[0_0_80px_rgba(249,115,22,0.4)]">HS</div>
    <div className="space-y-2 text-center">
      <p className="font-black uppercase tracking-[0.6em] text-xs text-orange-400">Sphere Engine</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Initializing Global Node...</p>
    </div>
  </div>;

  if (isGuestPortal) return <GuestPortal settings={settings} allRooms={rooms} onCheckinComplete={() => {
    refreshLocalState();
  }} />;

  if (!isLoggedIn) return <Login onLogin={handleLogin} settings={settings} supervisors={supervisors} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 transition-all duration-500 overflow-hidden">
      <nav className="bg-[#1a0f00] text-white px-4 md:px-10 py-0 flex items-center shadow-2xl sticky top-0 z-50 no-print border-b border-white/5 shrink-0 overflow-hidden h-[72px]">
        <div className="flex items-center gap-8 h-full">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 items-center h-full custom-scrollbar">
            {navItems.map(item => (
              <NavBtn key={item.tab} label={item.label} active={activeTab === item.tab} onClick={() => setActiveTab(item.tab)} />
            ))}
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4 shrink-0 ml-auto">
           <div className="flex items-center gap-3 px-5 py-2.5 bg-white/5 rounded-2xl border border-white/10">
              <div className={`w-2.5 h-2.5 rounded-full ${isCloudSyncing ? 'bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
              <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">{isCloudSyncing ? 'Syncing...' : 'Encrypted'}</span>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="text-[10px] font-black uppercase bg-rose-600 hover:bg-rose-500 text-white px-8 py-3.5 rounded-2xl shadow-xl transition-all">EXIT</button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar no-print bg-[#f8fafc]">{renderContent()}</main>

      <footer className="bg-white border-t border-slate-100 px-4 md:px-10 py-4 md:py-6 flex flex-col md:flex-row justify-between items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] no-print shrink-0 gap-6">
        <div className="flex gap-6 md:gap-10 items-center overflow-x-auto scrollbar-hide w-full md:w-auto">
          <Stat label="Global" count={rooms.length} color="text-slate-400" onClick={() => setStatusFilter('ALL')} active={statusFilter === 'ALL'} />
          <Stat label="Ready" count={rooms.filter(r=>r.status===RoomStatus.VACANT).length} color="text-emerald-500" onClick={() => setStatusFilter(RoomStatus.VACANT)} active={statusFilter === RoomStatus.VACANT} />
          <Stat label="In-Use" count={rooms.filter(r=>r.status===RoomStatus.OCCUPIED).length} color="text-orange-600" onClick={() => setStatusFilter(RoomStatus.OCCUPIED)} active={statusFilter === RoomStatus.OCCUPIED} />
          <Stat label="Laundry" count={rooms.filter(r=>r.status===RoomStatus.DIRTY).length} color="text-rose-500" onClick={() => setStatusFilter(RoomStatus.DIRTY)} active={statusFilter === RoomStatus.DIRTY} />
          <Stat label="Repair" count={rooms.filter(r=>r.status===RoomStatus.REPAIR).length} color="text-[#5c2d0a]" onClick={() => setStatusFilter(RoomStatus.REPAIR)} active={statusFilter === RoomStatus.REPAIR} />
          <Stat label="Maint" count={rooms.filter(r=>r.status===RoomStatus.MANAGEMENT).length} color="text-violet-600" onClick={() => setStatusFilter(RoomStatus.MANAGEMENT)} active={statusFilter === RoomStatus.MANAGEMENT} />
          <div className="h-8 w-px bg-slate-100 mx-2 shrink-0"></div>
          <FooterBtn label="Bill Archive" onClick={() => setShowGlobalArchive(true)} icon="📄" />
          <FooterBtn label="Share WhatsApp" onClick={() => { 
            // Simple logic: open global archive to search guest to share
            setShowGlobalArchive(true);
            alert("Open any record in the archive to share via WhatsApp.");
          }} icon="💬" />
          <FooterBtn label="Print Out" onClick={() => {
            setShowGlobalArchive(true);
            alert("Open any record in the archive to generate a print-out.");
          }} icon="🖨️" />
          <FooterBtn label="Cloud Sync" onClick={exportDatabase} icon="☁️" />
        </div>
      </footer>

      {showRoomActions && selectedRoom && (
        <RoomActionModal room={selectedRoom} onClose={() => setShowRoomActions(false)} onCheckIn={() => { setShowRoomActions(false); setShowCheckinForm(true); }} 
          onStatusUpdate={async (s) => {
            if (!selectedRoom.id) return;
            const rs = rooms.map(r => r.id === selectedRoom.id ? { ...r, status: s } : r);
            await db.rooms.put({ ...selectedRoom, status: s });
            setRooms(rs);
            setShowRoomActions(false);
          }} />
      )}
      {showReservationForm && (
        <ReservationEntry 
          onClose={() => setShowReservationForm(false)} 
          existingGuests={guests} 
          rooms={rooms.filter(r => r.status === RoomStatus.VACANT)} 
          onSave={async (data) => {
            const gId = data.guest.id || `G-${Date.now()}`;
            await db.guests.put({ ...data.guest, id: gId } as Guest);
            const bks = data.bookings.map(b => ({ ...b, id: `B-${Math.random().toString(36).substr(2, 5)}`, guestId: gId }));
            await db.bookings.bulkPut(bks.filter(x => x.id));
            await refreshLocalState();
            setShowReservationPipeline(true);
            setShowReservationForm(false);
          }} 
          settings={settings} 
        />
      )}
      {showReservationPipeline && (
        <ReservationPipeline 
          bookings={bookings}
          guests={guests}
          rooms={rooms}
          onClose={() => setShowReservationPipeline(false)}
          onCheckIn={handleReservationCheckIn}
          onCancel={handleCancelReservation}
        />
      )}
      {showGlobalArchive && <GlobalBillArchive onClose={() => setShowGlobalArchive(false)} settings={settings} guests={guests} rooms={rooms} />}
    </div>
  );
};

const NavBtn: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`px-6 py-2 rounded-full transition-all font-black text-[10px] tracking-tight uppercase shrink-0 mx-1 border-2 h-[44px] flex items-center justify-center ${
      active 
        ? 'bg-[#e67e00] text-white border-[#e67e00] shadow-lg' 
        : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
    }`}
  >
    {label}
  </button>
);

const Stat: React.FC<{ label: string, count: number, color: string, onClick: () => void, active: boolean }> = ({ label, count, color, onClick, active }) => (
  <button onClick={onClick} className={`flex items-center gap-4 shrink-0 p-2 md:p-3 rounded-2xl transition-all ${active ? 'bg-orange-50/50 ring-2 ring-orange-100' : 'hover:bg-slate-50'}`}>
    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
    <span className={`text-2xl md:text-3xl font-black ${color} tracking-tighter`}>{count}</span>
  </button>
);

const FooterBtn = ({ label, onClick, icon }: any) => (
  <button onClick={onClick} className="flex items-center gap-3 px-5 md:px-7 py-3 rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest transition-all bg-slate-50 text-slate-600 hover:bg-orange-600 hover:text-white border border-slate-200 shadow-sm shrink-0">
    <span className="text-lg">{icon}</span>{label}
  </button>
);

export default App;


import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Room, RoomStatus, Guest, Booking, HostelSettings, Transaction, GroupProfile, UserRole, Supervisor, Quotation } from './types.ts';
import { INITIAL_ROOMS } from './constants.tsx';
import { db, exportDatabase } from './services/db.ts';
import { pullFromCloud, subscribeToTable, IS_CLOUD_ENABLED } from './services/supabase.ts';
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

// --- MODULES ---
import BanquetModule from './components/BanquetModule.tsx';
import DiningModule from './components/DiningModule.tsx';
import FacilityModule from './components/FacilityModule.tsx';
import InventoryModule from './components/InventoryModule.tsx';
import TravelModule from './components/TravelModule.tsx';

type AppTab = 'DASHBOARD' | 'BANQUET' | 'DINING' | 'FACILITY' | 'TRAVEL' | 'GROUP' | 'INVENTORY' | 'ACCOUNTING' | 'PAYROLL' | 'REPORTS' | 'SETTINGS' | 'GUEST_PORTAL' | 'SUPERVISOR_PANEL';

const App: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupProfile[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  
  const [settings, setSettings] = useState<HostelSettings>({
    id: 'primary',
    name: 'Shubhkamna Hotel And Resort',
    address: 'Ayodhya',
    agents: [{ name: 'Direct', commission: 0 }],
    roomTypes: ['DELUXE ROOM', 'SUPER DELUXE ROOM', 'PREMIUM ROOM', 'SUPER PREMIUM ROOM', 'SUITE ROOM'],
    mealPlans: ['EP (Room Only)', 'CP (Breakfast)', 'MAP (Half Board)', 'AP (Full Board)'],
    floors: ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor'],
    blocks: [
      { id: 'b1', name: 'Ayodhya', prefix: 'A', color: 'blue' },
      { id: 'b2', name: 'Mithila', prefix: 'M', color: 'orange' }
    ],
    bedTypes: ['Single Bed', 'Double Bed'],
    taxRate: 5,
    wifiPassword: 'hotelsphere123',
    receptionPhone: '9',
    roomServicePhone: '8'
  });

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
    if (params.get('portal') === 'guest') { setIsGuestPortal(true); }

    const init = async () => {
      try {
        const tables = ['rooms', 'guests', 'bookings', 'transactions', 'groups', 'supervisors', 'settings'];
        if (IS_CLOUD_ENABLED) {
          for (const table of tables) {
            const cloudData = await pullFromCloud(table);
            if (cloudData.length > 0) { await (db as any)[table].bulkPut(cloudData); }
          }
        }
        
        const existingRooms = await db.rooms.toArray();
        if (existingRooms.length === 0) {
          await db.rooms.bulkPut(INITIAL_ROOMS);
        }
        
        await refreshLocalState();
        
        if (IS_CLOUD_ENABLED) {
          tables.forEach(tableName => {
            subscribeToTable(tableName, async (payload) => {
              const table = (db as any)[tableName];
              if (!table) return;
              if (payload.eventType === 'DELETE') { await table.delete(payload.old.id); } 
              else { await table.put(payload.new); }
              refreshLocalState();
            });
          });
        }
      } catch (e) { console.error("Initialization error:", e); }
      setIsLoading(false);
    };
    init();
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
    const filtered = statusFilter === 'ALL' ? rooms : rooms.filter(r => r.status === statusFilter);
    return filtered.reduce((acc, room) => {
      const blockKey = room.block || 'Main';
      if (!acc[blockKey]) acc[blockKey] = [];
      acc[blockKey].push(room);
      return acc;
    }, {} as Record<string, Room[]>);
  }, [rooms, statusFilter]);

  const toggleRoomSelection = (roomId: string) => {
    const newSet = new Set(selectedRoomIds);
    if (newSet.has(roomId)) newSet.delete(roomId);
    else newSet.add(roomId);
    setSelectedRoomIds(newSet);
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
          await db.bookings.put(bu); 
          setBookings(bookings.map(x => x.id === bu.id ? bu : x)); 
          if (bu.status === 'COMPLETED') {
             const rs = rooms.map(rm => rm.id === bu.roomId ? { ...rm, status: RoomStatus.DIRTY, currentBookingId: undefined } : rm);
             await db.rooms.bulkPut(rs);
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
        onShiftRoom={(newRid) => {}} onClose={() => setActiveBookingId(null)} />;
    }

    if (showCheckinForm) {
      const initialRoomIds = Array.from(selectedRoomIds);
      const initialRoom = selectedRoom || rooms.find(r => r.id === initialRoomIds[0]) || rooms.find(r => r.status === RoomStatus.VACANT);
      if (!initialRoom) { setShowCheckinForm(false); return null; }
      return <GuestCheckin room={initialRoom} allRooms={rooms} existingGuests={guests} initialSelectedRoomIds={initialRoomIds}
        onClose={() => { setShowCheckinForm(false); setSelectedRoom(null); setSelectedRoomIds(new Set()); setIsSelectionMode(false); }} 
        onSave={async (data) => {
          const gId = data.guest.id || `G-${Date.now()}`;
          await db.guests.put({ ...data.guest, id: gId } as Guest);
          const bks = data.bookings.map(b => ({ ...b, id: `B-${Math.random().toString(36).substr(2, 5)}`, guestId: gId }));
          await db.bookings.bulkPut(bks);
          const updatedRooms = rooms.map(r => {
            const b = bks.find(bk => bk.roomId === r.id);
            return b ? { ...r, status: RoomStatus.OCCUPIED, currentBookingId: b.id } : r;
          });
          await db.rooms.bulkPut(updatedRooms);
          await refreshLocalState();
          setShowCheckinForm(false);
          setSelectedRoom(null);
          setSelectedRoomIds(new Set());
          setIsSelectionMode(false);
        }} settings={settings} />;
    }

    switch (activeTab) {
      case 'SUPERVISOR_PANEL': return <SupervisorPanel staff={loggedInStaff} rooms={rooms} bookings={bookings} onUpdateRoom={async (ru) => { await db.rooms.put(ru); setRooms(rooms.map(r => r.id === ru.id ? ru : r)); }} />;
      case 'BANQUET': return <BanquetModule settings={settings} guests={guests} rooms={rooms} roomBookings={bookings} />;
      case 'DINING': return <DiningModule rooms={rooms} bookings={bookings} guests={guests} settings={settings} userRole={currentUserRole} />;
      case 'FACILITY': return <FacilityModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} />;
      case 'TRAVEL': return <TravelModule guests={guests} bookings={bookings} rooms={rooms} settings={settings} />;
      case 'GROUP': return <GroupModule groups={groups} setGroups={async (gs) => { setGroups(gs); await db.groups.bulkPut(gs); }} rooms={rooms} bookings={bookings} setBookings={async (bks) => { setBookings(bks); await db.bookings.bulkPut(bks); }} guests={guests} setGuests={setGuests} setRooms={async (rs) => { setRooms(rs); await db.rooms.bulkPut(rs); }} onAddTransaction={(tx) => { setTransactions([...transactions, tx]); db.transactions.put(tx); }} onGroupPayment={() => {}} settings={settings} />;
      case 'INVENTORY': return <InventoryModule settings={settings} />;
      case 'ACCOUNTING': return <Accounting transactions={transactions} setTransactions={async (txs) => { setTransactions(txs); await db.transactions.bulkPut(txs); }} guests={guests} bookings={bookings} settings={settings} rooms={rooms} quotations={quotations} setQuotations={async (qs) => { setQuotations(qs); await db.quotations.bulkPut(qs); }} />;
      case 'PAYROLL': return <PayrollModule staff={supervisors} settings={settings} onUpdateTransactions={(tx) => { setTransactions([...transactions, tx]); db.transactions.put(tx); }} />;
      case 'REPORTS': return <Reports bookings={bookings} guests={guests} rooms={rooms} settings={settings} transactions={transactions} shiftLogs={[]} cleaningLogs={[]} quotations={quotations} />;
      case 'SETTINGS': return <Settings settings={settings} setSettings={async (s)=>{await db.settings.put(s); setSettings(s);}} rooms={rooms} setRooms={(rs)=>setRooms(rs)} supervisors={supervisors} setSupervisors={async (sups) => { setSupervisors(sups); await db.supervisors.bulkPut(sups); }} />;
      default:
        return (
          <div className="p-4 md:p-8 lg:p-10 pb-40 relative animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 lg:mb-14 gap-6 glass-card p-10 rounded-[3rem] shadow-2xl border-2 border-blue-900/10">
               <div className="flex flex-col gap-1 text-center md:text-left">
                 <h1 className="text-3xl md:text-5xl font-black text-blue-900 uppercase tracking-tighter leading-none">{settings.name}</h1>
                 <p className="text-[10px] md:text-[12px] font-black text-orange-500 uppercase tracking-[0.4em] ml-1">Property Hub Console</p>
               </div>
               <div className="flex flex-wrap gap-4 justify-center">
                  <button onClick={() => setShowReservationPipeline(true)} className="bg-white text-blue-900 border-2 border-blue-900 px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg hover:bg-blue-900 hover:text-white transition-all">Reservations</button>
                  <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedRoomIds(new Set()); }} className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg transition-all border-2 ${isSelectionMode ? 'bg-orange-600 border-orange-600 text-white animate-pulse' : 'bg-white border-blue-900 text-blue-900 hover:bg-slate-50'}`}>
                    {isSelectionMode ? 'EXIT MULTI' : 'MULTI CHECK-IN'}
                  </button>
                  <button onClick={() => setShowReservationForm(true)} className="bg-orange-600 text-white px-10 lg:px-14 py-4 rounded-2xl font-black text-[11px] uppercase shadow-2xl shadow-orange-500/30 hover:scale-105 transition-all">+ RESERVATION</button>
               </div>
            </div>

            {Object.entries(roomsByBlock).sort().map(([block, blockRooms]) => {
              const isAyodhya = block === 'Ayodhya';
              const themeColor = isAyodhya ? 'text-blue-900' : 'text-orange-600';
              let blockIcon = isAyodhya ? '🔱' : '🚩';

              return (
                <div key={block} className="mb-14">
                  <h3 className={`text-[13px] font-black uppercase mb-8 tracking-[0.3em] flex items-center gap-4 ${themeColor}/60`}>
                    <span className={`w-12 h-1 ${isAyodhya ? 'bg-blue-900' : 'bg-orange-500'} opacity-20`}></span>
                    {blockIcon} {block} Block
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5 md:gap-8">
                    {blockRooms.sort((a,b) => a.number.localeCompare(b.number, undefined, {numeric: true})).map(room => {
                      const today = new Date().toISOString().split('T')[0];
                      const activeB = bookings.find(b => b.roomId === room.id && b.status === 'ACTIVE');
                      const resToday = bookings.find(b => b.roomId === room.id && b.status === 'RESERVED' && b.checkInDate === today);
                      const guestObj = (activeB || resToday) ? guests.find(g => g.id === (activeB || resToday)!.guestId) : null;
                      const status = activeB ? RoomStatus.OCCUPIED : resToday ? RoomStatus.RESERVED : room.status;
                      const isSelected = selectedRoomIds.has(room.id);

                      const statusColors: any = {
                        [RoomStatus.VACANT]: isAyodhya ? 'border-blue-900/20 text-blue-900' : 'border-orange-500/20 text-orange-600',
                        [RoomStatus.OCCUPIED]: isAyodhya ? 'bg-blue-600 border-blue-900 text-white shadow-[0_10px_30px_rgba(30,64,175,0.2)]' : 'bg-orange-600 border-orange-700 text-white shadow-[0_10px_30px_rgba(234,88,12,0.2)]',
                        [RoomStatus.RESERVED]: 'bg-slate-50 border-slate-700 text-slate-900',
                        [RoomStatus.DIRTY]: 'bg-rose-100 border-rose-500 text-rose-900',
                        [RoomStatus.REPAIR]: 'bg-slate-200 border-slate-400 text-slate-500',
                      };

                      return (
                        <button key={room.id} onClick={() => {
                            if (isSelectionMode) {
                              if (status === RoomStatus.VACANT || status === RoomStatus.DIRTY) toggleRoomSelection(room.id);
                              else alert("Only vacant units can be selected.");
                            } else {
                              if (activeB || resToday) setActiveBookingId((activeB || resToday)!.id);
                              else { setSelectedRoom(room); setShowRoomActions(true); }
                            }
                          }} 
                          className={`min-h-[190px] blue-orange-card rounded-[2.8rem] p-6 flex flex-col items-center justify-between relative group ${isSelected ? 'ring-8 ring-orange-500/30 scale-105 z-10' : statusColors[status]}`}
                          style={!isSelected && status === RoomStatus.VACANT ? { borderColor: isAyodhya ? '#1e40af33' : '#ea580c33' } : {}}
                        >
                          {isSelected && <div className="absolute -top-3 -right-3 w-10 h-10 bg-orange-600 text-white rounded-2xl flex items-center justify-center text-xs font-black shadow-xl border-4 border-white">✓</div>}
                          
                          <div className="flex flex-col items-center gap-1">
                             <span className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">{room.number}</span>
                             <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{room.bedType}</p>
                          </div>

                          <div className="text-center w-full">
                             <div className={`text-[10px] font-black uppercase mb-2 truncate px-2`}>
                               {guestObj ? guestObj.name : room.type}
                             </div>
                             <div className={`text-[8px] font-black uppercase py-1.5 px-4 rounded-full border-2 border-current inline-block bg-white/10`}>
                               {status}
                             </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  if (isLoading) return <div className="min-h-screen bg-white flex flex-col items-center justify-center text-blue-900 gap-6">
    <div className="w-24 h-24 bg-orange-600 rounded-[2rem] animate-bounce flex items-center justify-center text-3xl font-black text-white shadow-2xl">HS</div>
    <div className="space-y-2 text-center">
      <p className="font-black uppercase tracking-[0.6em] text-sm text-blue-900">Sphere Engine</p>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Synchronizing Records...</p>
    </div>
  </div>;

  if (!isLoggedIn && !isGuestPortal) return <Login onLogin={handleLogin} settings={settings} supervisors={supervisors} />;
  if (isGuestPortal) return <GuestPortal settings={settings} allRooms={rooms} onCheckinComplete={refreshLocalState} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 transition-all duration-500 wallpaper-bg" style={settings.wallpaper ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${settings.wallpaper})` } : {}}>
      <nav className="bg-white px-4 md:px-10 flex items-center shadow-lg sticky top-0 z-50 no-print border-b-4 border-blue-900 shrink-0 h-[80px]">
        <div className="flex items-center gap-2 h-full overflow-x-auto scrollbar-hide">
          {navItems.map(item => (
            <NavBtn key={item.tab} label={item.label} active={activeTab === item.tab} onClick={() => setActiveTab(item.tab)} />
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-4 ml-auto shrink-0">
           <button onClick={() => setIsLoggedIn(false)} className="text-[11px] font-black uppercase bg-orange-600 text-white px-8 py-3.5 rounded-2xl transition-all shadow-lg hover:bg-black">EXIT PORTAL</button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar no-print">{renderContent()}</main>

      <footer className="bg-white border-t border-slate-200 px-4 md:px-10 py-5 flex flex-col md:flex-row justify-between items-center z-40 no-print gap-6 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex gap-4 md:gap-8 items-center overflow-x-auto scrollbar-hide">
          <Stat label="TOTAL" count={rooms.length} color="text-blue-900" onClick={() => setStatusFilter('ALL')} active={statusFilter === 'ALL'} />
          <Stat label="VACANT" count={rooms.filter(r=>r.status===RoomStatus.VACANT).length} color="text-emerald-600" onClick={() => setStatusFilter(RoomStatus.VACANT)} active={statusFilter === RoomStatus.VACANT} />
          <Stat label="OCCUPIED" count={rooms.filter(r=>r.status===RoomStatus.OCCUPIED).length} color="text-orange-600" onClick={() => setStatusFilter(RoomStatus.OCCUPIED)} active={statusFilter === RoomStatus.OCCUPIED} />
          <Stat label="DIRTY" count={rooms.filter(r=>r.status===RoomStatus.DIRTY).length} color="text-rose-600" onClick={() => setStatusFilter(RoomStatus.DIRTY)} active={statusFilter === RoomStatus.DIRTY} />
          <Stat label="REPAIR" count={rooms.filter(r=>r.status===RoomStatus.REPAIR).length} color="text-slate-500" onClick={() => setStatusFilter(RoomStatus.REPAIR)} active={statusFilter === RoomStatus.REPAIR} />
        </div>
        
        {/* Connection Status Badge */}
        <div className={`px-4 py-2 rounded-xl flex items-center gap-3 border-2 shrink-0 ${IS_CLOUD_ENABLED ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-rose-50 border-rose-500 text-rose-700'}`}>
           <div className={`w-2 h-2 rounded-full ${IS_CLOUD_ENABLED ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
           <span className="text-[10px] font-black uppercase tracking-widest">{IS_CLOUD_ENABLED ? 'Cloud Online' : 'Local Only'}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
           <FooterBtn label="ARCHIVE" onClick={() => setShowGlobalArchive(true)} icon="📄" />
           <FooterBtn label="BACKUP" onClick={exportDatabase} icon="☁️" />
        </div>
      </footer>

      {showRoomActions && selectedRoom && (
        <RoomActionModal room={selectedRoom} onClose={() => setShowRoomActions(false)} onCheckIn={() => { setShowRoomActions(false); setShowCheckinForm(true); }} 
          onStatusUpdate={async (s) => {
            const updated = { ...selectedRoom, status: s };
            await db.rooms.put(updated);
            setRooms(rooms.map(r => r.id === selectedRoom.id ? updated : r));
            setShowRoomActions(false);
          }} />
      )}
      
      {showReservationPipeline && <ReservationPipeline bookings={bookings} guests={guests} rooms={rooms} onClose={() => setShowReservationPipeline(false)} onCheckIn={(b) => { setActiveBookingId(b.id); setShowReservationPipeline(false); }} onCancel={async (id) => { await db.bookings.update(id, { status: 'CANCELLED' }); refreshLocalState(); }} />}
      {showReservationForm && <ReservationEntry settings={settings} rooms={rooms} existingGuests={guests} onClose={() => setShowReservationForm(false)} onSave={async (data) => {
          const gId = data.guest.id || `G-${Date.now()}`;
          await db.guests.put({ ...data.guest, id: gId } as Guest);
          await db.bookings.bulkPut(data.bookings.map(b => ({ ...b, guestId: gId })));
          await refreshLocalState();
          setShowReservationForm(false);
      }} />}
      {showGlobalArchive && <GlobalBillArchive settings={settings} guests={guests} rooms={rooms} onClose={() => setShowGlobalArchive(false)} />}
    </div>
  );
};

const NavBtn: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl transition-all font-black text-[10px] tracking-widest uppercase shrink-0 mx-1 h-[48px] flex items-center justify-center ${active ? 'bg-blue-900 text-white shadow-xl' : 'text-slate-400 hover:text-blue-900 hover:bg-slate-50'}`}>{label}</button>
);

const Stat: React.FC<{ label: string, count: number, color: string, onClick: () => void, active: boolean }> = ({ label, count, color, onClick, active }) => (
  <button onClick={onClick} className={`flex items-center gap-4 md:gap-5 shrink-0 p-3 px-4 md:px-6 rounded-2xl transition-all ${active ? 'bg-blue-50 ring-2 ring-blue-900/10' : 'hover:bg-slate-50'}`}>
    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
    <span className={`text-2xl md:text-3xl font-black ${color} tracking-tighter`}>{count}</span>
  </button>
);

const FooterBtn = ({ label, onClick, icon }: any) => (
  <button onClick={onClick} className="flex items-center gap-3 px-6 md:px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-white text-blue-900 border-2 border-blue-900/10 hover:border-orange-500 shadow-sm whitespace-nowrap">
    <span>{icon}</span>{label}
  </button>
);

export default App;

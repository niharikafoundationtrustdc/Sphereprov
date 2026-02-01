
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { RestaurantOutlet, MenuItem, DiningTable, KOT, Room, Booking, DietaryType, Transaction, UserRole, Charge, Guest, DiningBill } from '../types';

interface DiningModuleProps {
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  settings: any;
  userRole: UserRole;
  onUpdateBooking?: (updated: Booking) => void;
}

const CATEGORIES = [
  "MOCKTAILS", "SOUPS", "PAPAD AND SALAD", "RAITA", "BREAK FAST", "PIZZA & SANDWICHS", 
  "CHINESE RICE & NOODLES", "TANDOOR STARTER", "INDIAN MAIN COURSE", "RICE AND BIRYANI", 
  "TANDOORI ROTI", "SWEETS", "PASTA", "CHINESE STARTER"
];

const DiningModule: React.FC<DiningModuleProps> = ({ rooms, bookings, guests, settings, userRole, onUpdateBooking }) => {
  const getInitialTab = () => (userRole === 'CHEF' || userRole === 'WAITER') ? 'KITCHEN' : 'POS';
  const [activeTab, setActiveTab] = useState<'POS' | 'KITCHEN' | 'MENU' | 'TABLES' | 'OUTLETS'>(getInitialTab());
  const [outlets, setOutlets] = useState<RestaurantOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<RestaurantOutlet | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allKots, setAllKots] = useState<KOT[]>([]);
  
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ name: '', category: 'INDIAN MAIN COURSE', subcategory: '', price: 0, dietaryType: 'VEG', isAvailable: true });
  const [posCategory, setPosCategory] = useState('All');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [billToRoomId, setBillToRoomId] = useState('');
  const [showSettlement, setShowSettlement] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');

  // Editing state for prices
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      // 1. Initialize Outlets
      let o = await db.restaurants.toArray();
      if (o.length === 0) {
        const mainOutlet: RestaurantOutlet = { id: 'rest-main', name: `Main Restaurant`, type: 'FineDine' };
        const poolOutlet: RestaurantOutlet = { id: 'rest-pool', name: `Poolside Restaurant`, type: 'Casual' };
        await db.restaurants.bulkPut([mainOutlet, poolOutlet]);
        o = [mainOutlet, poolOutlet];
      }
      setOutlets(o);
      if (o.length > 0) setSelectedOutlet(o[0]);

      // 2. Initialize Tables (Independent check to ensure they are created)
      let t = await db.diningTables.toArray();
      if (t.length === 0) {
        const rTables = Array.from({ length: 11 }, (_, i) => ({
          id: `t-r${i + 1}`,
          number: `R${i + 1}`,
          outletId: 'rest-main',
          status: 'VACANT' as const
        }));
        const pTables = Array.from({ length: 10 }, (_, i) => ({
          id: `t-p${i + 1}`,
          number: `P${i + 1}`,
          outletId: 'rest-pool',
          status: 'VACANT' as const
        }));
        await db.diningTables.bulkPut([...rTables, ...pTables]);
      }

      // 3. Initialize Menu
      let m = await db.menuItems.toArray();
      if (m.length === 0) {
        // ... (existing menuSeed data logic) ...
        const menuSeed: Partial<MenuItem>[] = [
          { name: "MINERAL WATER", category: "MOCKTAILS", price: 30 },
          { name: "TEA", category: "MOCKTAILS", price: 30 },
          { name: "COFFEE", category: "MOCKTAILS", price: 40 },
          { name: "INDIAN THALI", category: "INDIAN MAIN COURSE", price: 250 },
          { name: "VEG BIRYANI", category: "RICE AND BIRYANI", price: 180 }
        ];
        const formatted = menuSeed.map(item => ({
          ...item,
          id: `mi-${Math.random().toString(36).substr(2, 9)}`,
          outletId: 'rest-main',
          isAvailable: true,
          dietaryType: 'VEG' as DietaryType,
          subcategory: ''
        })) as MenuItem[];
        await db.menuItems.bulkPut(formatted);
        m = formatted;
      }
      setMenu(m);
      setAllKots(await db.kots.toArray());
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      db.diningTables.where('outletId').equals(selectedOutlet.id).toArray().then(setTables);
    }
  }, [selectedOutlet, activeTab]);

  const updateKOTStatus = async (kotId: string, status: KOT['status']) => {
    const kot = allKots.find(k => k.id === kotId);
    if (!kot) return;
    
    const updated = { ...kot, status };
    await db.kots.put(updated);
    setAllKots(allKots.map(k => k.id === kotId ? updated : k));

    if (status === 'SERVED' && kot.bookingId) {
       const booking = await db.bookings.get(kot.bookingId);
       if (booking) {
          const subtotal = kot.items.reduce((s, it) => {
             const m = menu.find(mi => mi.id === it.menuItemId);
             return s + ((m?.price || 0) * it.quantity);
          }, 0);
          const tax = (subtotal * (settings.taxRate || 0)) / 100;
          const total = subtotal + tax;

          const charge: Charge = {
             id: `CHG-RSERV-${Date.now()}`,
             description: `Room Service: Order #${kot.id.slice(-4)}`,
             amount: total,
             date: new Date().toISOString()
          };
          
          const updatedBooking = { ...booking, charges: [...(booking.charges || []), charge] };
          await db.bookings.put(updatedBooking);
          if (onUpdateBooking) onUpdateBooking(updatedBooking);
          
          await db.kots.delete(kot.id);
          setAllKots(prev => prev.filter(k => k.id !== kot.id));
       }
    }
  };

  const handleUpdatePrice = async (id: string) => {
    const price = parseFloat(tempPrice);
    if (isNaN(price)) return alert("Invalid Price");
    const item = menu.find(m => m.id === id);
    if (!item) return;
    const updated = { ...item, price };
    await db.menuItems.put(updated);
    setMenu(menu.map(m => m.id === id ? updated : m));
    setEditingPriceId(null);
  };

  const tableSubtotal = useMemo(() => {
    if (!selectedTable) return 0;
    const servedTableKots = allKots.filter(k => k.tableId === selectedTable.id);
    return servedTableKots.reduce((total, kot) => {
      return total + kot.items.reduce((kSum, it) => {
        const m = menu.find(mi => mi.id === it.menuItemId);
        return kSum + ((m?.price || 0) * it.quantity);
      }, 0);
    }, 0);
  }, [allKots, selectedTable, menu]);

  const handleSendKOT = async () => {
    if (!selectedTable || cart.length === 0) return;
    
    const newKot: KOT = {
      id: `KOT-${Date.now()}`,
      tableId: selectedTable.id,
      outletId: selectedOutlet!.id,
      waiterId: 'STF-MAIN',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, notes: '' })),
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    await db.kots.put(newKot);
    setAllKots([...allKots, newKot]);
    
    // Update table status
    const updatedTable = { ...selectedTable, status: 'OCCUPIED' as const };
    await db.diningTables.put(updatedTable);
    setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
    setSelectedTable(updatedTable);
    
    setCart([]);
    alert("KOT Sent to Kitchen.");
  };

  const filteredMenu = menu.filter(m => m.outletId === selectedOutlet?.id && m.isAvailable && (posCategory === 'All' || m.category === posCategory));

  const activeResidents = useMemo(() => {
    const active = bookings.filter(b => b.status === 'ACTIVE');
    if (!roomSearch) return active;
    const lower = roomSearch.toLowerCase();
    return active.filter(b => {
      const r = rooms.find(room => room.id === b.roomId);
      return r?.number.toLowerCase().includes(lower);
    });
  }, [bookings, rooms, roomSearch]);

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f1f5f9]">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6 w-full md:w-auto">
           <div className="w-16 h-16 bg-[#001a33] text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl shrink-0">🍴</div>
           <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter leading-none truncate">{selectedOutlet?.name || 'Restaurant Master'}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                 {outlets.map(o => (
                    <button key={o.id} onClick={() => { setSelectedOutlet(o); setSelectedTable(null); }} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${selectedOutlet?.id === o.id ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-orange-100'}`}>{o.name}</button>
                 ))}
              </div>
           </div>
        </div>
        
        <div className="flex gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-100 no-print overflow-x-auto scrollbar-hide max-w-full shrink-0">
           <TabBtn active={activeTab === 'POS'} label="POS Registry" onClick={() => setActiveTab('POS')} />
           <TabBtn active={activeTab === 'KITCHEN'} label="Kitchen KDS" onClick={() => setActiveTab('KITCHEN')} />
           <TabBtn active={activeTab === 'MENU'} label="Menu Master" onClick={() => setActiveTab('MENU')} />
           <TabBtn active={activeTab === 'TABLES'} label="Tables Grid" onClick={() => setActiveTab('TABLES')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden animate-in fade-in duration-300">
            <div className="lg:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-sm border flex flex-col gap-6">
               <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest border-b pb-4">Table Selection</h3>
               <div className="grid grid-cols-3 gap-3 overflow-y-auto custom-scrollbar pr-2">
                  {tables.map(t => (
                    <button key={t.id} onClick={() => setSelectedTable(t)} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${selectedTable?.id === t.id ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : t.status === 'OCCUPIED' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      <span className="text-xl font-black">{t.number}</span>
                      <span className="text-[7px] font-black uppercase opacity-60">{t.status}</span>
                    </button>
                  ))}
               </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-[2.5rem] p-8 shadow-sm border flex flex-col gap-6 overflow-hidden">
               <div className="flex gap-2 overflow-x-auto scrollbar-hide shrink-0 pb-2 border-b">
                  <CatBtn active={posCategory === 'All'} label="Master Menu" onClick={() => setPosCategory('All')} />
                  {CATEGORIES.map(c => <CatBtn key={c} active={posCategory === c} label={c} onClick={() => setPosCategory(c)} />)}
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-6">
                  {filteredMenu.map(item => (
                    <button key={item.id} onClick={() => {
                        const exist = cart.find(c => c.item.id === item.id);
                        if (exist) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                        else setCart([...cart, {item, qty: 1}]);
                      }} className="p-5 border-2 border-slate-50 bg-slate-50/50 rounded-3xl text-left hover:border-orange-700 hover:bg-white transition-all group">
                      <div className="flex justify-between items-start mb-3">
                         <div className={`w-3 h-3 border-2 p-0.5 flex items-center justify-center ${item.dietaryType === 'VEG' ? 'border-green-600' : 'border-red-600'}`}>
                            <div className={`w-full h-full rounded-full ${item.dietaryType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                         </div>
                         <span className="text-[10px] font-black text-orange-700">₹{item.price}</span>
                      </div>
                      <p className="text-[11px] font-black uppercase text-slate-800 leading-tight group-hover:text-orange-900">{item.name}</p>
                    </button>
                  ))}
               </div>
            </div>

            <div className="lg:col-span-3 bg-[#111] rounded-[2.5rem] p-8 shadow-2xl flex flex-col overflow-hidden text-white">
               <div className="border-b border-white/10 pb-6 mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="font-black text-[10px] uppercase text-orange-400 tracking-widest mb-1">Active Check</h3>
                    <p className="text-2xl font-black tracking-tighter uppercase">{selectedTable ? `Table ${selectedTable.number}` : 'Standby'}</p>
                  </div>
                  {selectedTable?.status === 'OCCUPIED' && (
                    <button onClick={() => setShowSettlement(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Settlement</button>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2">
                  {cart.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase truncate text-white">{c.item.name}</p>
                          <p className="text-[9px] font-bold text-orange-400 mt-1">₹{c.item.price} × {c.qty}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: Math.max(0, x.qty-1)} : x).filter(x => x.qty > 0))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">-</button>
                          <span className="text-[10px] font-black">{c.qty}</span>
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: x.qty+1} : x))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">+</button>
                       </div>
                    </div>
                  ))}
                  {cart.length === 0 && tableSubtotal === 0 && (
                     <div className="py-20 text-center opacity-20 italic">No items selected</div>
                  )}
               </div>

               <div className="border-t border-white/10 pt-6 space-y-4">
                  <div className="flex justify-between items-end">
                     <span className="text-[10px] font-black text-orange-400 uppercase">Current Subtotal</span>
                     <span className="text-3xl font-black text-white tracking-tighter">₹{(tableSubtotal + cart.reduce((s, c) => s + (c.item.price * c.qty), 0)).toFixed(2)}</span>
                  </div>
                  <button 
                    disabled={!selectedTable || cart.length === 0} 
                    onClick={handleSendKOT} 
                    className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl disabled:opacity-20 hover:bg-orange-700 transition-all"
                  >
                    Send KOT Dispatch
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'TABLES' && (
          <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
             <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Dining Table Blueprint</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management of dining units</p>
                </div>
                <div className="flex gap-4">
                   <button onClick={async () => {
                     const num = prompt("Enter Table Number:");
                     if(num) {
                       const nt: DiningTable = { id: `t-${Date.now()}`, number: num, outletId: selectedOutlet!.id, status: 'VACANT' };
                       await db.diningTables.put(nt);
                       setTables([...tables, nt]);
                     }
                   }} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Add Table</button>
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                {tables.map(t => (
                  <div key={t.id} className="bg-white border-2 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 group hover:border-orange-500 transition-all relative">
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">{t.number}</span>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border-2 ${t.status === 'VACANT' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{t.status}</span>
                    <button 
                      onClick={async () => { if(confirm(`Delete table ${t.number}?`)) { await db.diningTables.delete(t.id); setTables(tables.filter(x => x.id !== t.id)); } }}
                      className="absolute top-2 right-2 text-red-300 hover:text-red-500 font-black text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                    >
                       ×
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'KITCHEN' && (
          <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300 overflow-hidden">
             <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Kitchen KDS</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kitchen Display System Terminal</p>
                </div>
                <button onClick={async () => setAllKots(await db.kots.toArray())} className="text-[10px] font-black uppercase text-blue-600">Refresh Data</button>
             </div>
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pb-10">
                {allKots.filter(k => k.status !== 'SERVED').map(kot => (
                  <div key={kot.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col group">
                     <div className={`p-6 text-white flex justify-between items-center ${kot.status === 'PENDING' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                        <div>
                           <p className="text-[10px] font-black uppercase opacity-60">Table / Unit</p>
                           <h4 className="text-2xl font-black tracking-tighter uppercase">{kot.tableId.includes('ROOM-') ? kot.tableId.replace('ROOM-', 'Room ') : `Table ${tables.find(t => t.id === kot.tableId)?.number || '?'}`}</h4>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-black/10 px-3 py-1 rounded-full">{new Date(kot.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                     </div>
                     <div className="p-8 space-y-4 flex-1">
                        {kot.items.map((it, idx) => (
                           <div key={idx} className="flex justify-between items-start border-b border-slate-50 pb-3">
                              <div className="flex-1">
                                 <p className="text-[13px] font-black text-slate-800 uppercase leading-none">{menu.find(m => m.id === it.menuItemId)?.name || 'Unknown'}</p>
                                 {it.notes && <p className="text-[8px] text-orange-600 font-bold mt-1 uppercase italic">{it.notes}</p>}
                              </div>
                              <span className="bg-slate-900 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs">x{it.quantity}</span>
                           </div>
                        ))}
                     </div>
                     <div className="p-6 pt-0">
                        {kot.status === 'PENDING' ? (
                          <button onClick={() => updateKOTStatus(kot.id, 'PREPARING')} className="w-full bg-[#111] text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all">Mark Preparing 🍳</button>
                        ) : (
                          <button onClick={() => updateKOTStatus(kot.id, 'SERVED')} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-emerald-700 transition-all">Mark Served ✔️</button>
                        )}
                     </div>
                  </div>
                ))}
                {allKots.filter(k => k.status !== 'SERVED').length === 0 && (
                   <div className="col-span-full py-40 text-center opacity-10 font-black uppercase text-4xl tracking-widest italic">Clear Screen • No Pending Orders</div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'MENU' && (
           <div className="h-full flex flex-col gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase">Menu Catalog</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Click price to edit inline</p>
                 </div>
                 <button onClick={() => setShowAddItem(true)} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ New Item</button>
              </div>
              <div className="bg-white border rounded-[3rem] overflow-hidden flex-1 shadow-sm overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-[#111] text-white font-black uppercase text-[10px]">
                       <tr><th className="p-6">Item</th><th className="p-6">Group</th><th className="p-6 text-right">Price (Click to Edit)</th><th className="p-6 text-center">Action</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold uppercase text-xs">
                       {menu.filter(m => m.outletId === selectedOutlet?.id).map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                             <td className="p-6 font-black text-slate-900">{item.name}</td>
                             <td className="p-6 text-slate-400">{item.category}</td>
                             <td className="p-6 text-right">
                                {editingPriceId === item.id ? (
                                   <div className="flex justify-end gap-2">
                                      <input 
                                        autoFocus
                                        className="w-20 border-2 border-orange-500 rounded p-1 text-right outline-none" 
                                        value={tempPrice} 
                                        onChange={e => setTempPrice(e.target.value)} 
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleUpdatePrice(item.id);
                                          if (e.key === 'Escape') setEditingPriceId(null);
                                        }}
                                      />
                                      <button onClick={() => handleUpdatePrice(item.id)} className="text-green-600">✓</button>
                                   </div>
                                ) : (
                                   <button 
                                     onClick={() => { setEditingPriceId(item.id); setTempPrice(item.price.toString()); }}
                                     className="font-black text-base text-orange-600 hover:scale-110 transition-transform"
                                   >
                                      ₹{item.price.toFixed(2)}
                                   </button>
                                )}
                             </td>
                             <td className="p-6 text-center">
                                <button onClick={async () => { if(confirm("Delete item?")) { await db.menuItems.delete(item.id); setMenu(menu.filter(m => m.id !== item.id)); } }} className="text-red-300 hover:text-red-600 font-black text-xs">Remove</button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>

      {/* SETTLEMENT MODAL */}
      {showSettlement && selectedTable && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-emerald-600 p-10 text-white text-center">
                 <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Bill Settlement</h2>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Table {selectedTable.number} • ₹{(tableSubtotal + (tableSubtotal * (settings.taxRate || 0))/100).toFixed(2)}</p>
              </div>
              <div className="p-10 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Cash', 'UPI', 'Mark to Room'].map(mode => (
                          <button key={mode} onClick={() => setSettlementMode(mode)} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>{mode}</button>
                       ))}
                    </div>
                 </div>
                 {settlementMode === 'Mark to Room' && (
                    <div className="space-y-4 animate-in slide-in-from-top-4">
                       <input type="text" placeholder="Find Resident Room..." className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:border-emerald-600 text-slate-900" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                       <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-2xl p-2 space-y-1">
                          {activeResidents.map(b => (
                             <button key={b.id} onClick={() => setBillToRoomId(b.id)} className={`w-full text-left p-3 rounded-xl flex justify-between items-center transition-all ${billToRoomId === b.id ? 'bg-emerald-50 border-emerald-200 border-2 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                <span className="font-black">Room {rooms.find(r => r.id === b.roomId)?.number}</span>
                                <span className="text-[9px] font-bold uppercase">{guests.find(g => g.id === b.guestId)?.name}</span>
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
                 <div className="flex gap-4">
                    <button onClick={() => setShowSettlement(false)} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px]">Back</button>
                    {/* Fixed missing handleSettleBill click */}
                    <button onClick={() => {
                        const confirmSettle = async () => {
                          const servedTableKots = allKots.filter(k => k.tableId === selectedTable.id);
                          const billItems = servedTableKots.reduce((acc, kot) => {
                            kot.items.forEach(it => {
                              const m = menu.find(mi => mi.id === it.menuItemId);
                              if (m) acc.push({ ...it, name: m.name, price: m.price });
                            });
                            return acc;
                          }, [] as any[]);

                          const taxAmount = (tableSubtotal * (settings.taxRate || 0)) / 100;
                          const grandTotal = tableSubtotal + taxAmount;

                          let targetResident: Booking | undefined;
                          if (settlementMode === 'Mark to Room') {
                            if (!billToRoomId) return alert("Select room folio.");
                            targetResident = bookings.find(x => x.id === billToRoomId);
                            if (targetResident) {
                              const charge: Charge = { id: `CHG-DIN-${Date.now()}`, description: `Dining Bill: Table ${selectedTable.number}`, amount: grandTotal, date: new Date().toISOString() };
                              const updatedBooking = { ...targetResident, charges: [...(targetResident.charges || []), charge] };
                              await db.bookings.put(updatedBooking);
                              if (onUpdateBooking) onUpdateBooking(updatedBooking);
                            }
                          } else {
                            const tx: Transaction = { id: `TX-DIN-${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'RECEIPT', accountGroup: 'Direct Income', ledger: `${settlementMode} Account`, amount: grandTotal, entityName: 'Dining Walk-in', description: `Table ${selectedTable.number} bill` };
                            await db.transactions.put(tx);
                          }

                          await db.diningBills.put({ id: `DIN-BILL-${Date.now()}`, billNo: `DIN-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), outletId: selectedOutlet!.id, tableNumber: selectedTable.number, items: billItems, subTotal: tableSubtotal, taxAmount, grandTotal, paymentMode: settlementMode, guestName: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.name || 'Resident') : 'Walk-in', guestPhone: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.phone || '') : '', roomBookingId: targetResident?.id });

                          for (const kot of servedTableKots) { await db.kots.delete(kot.id); }
                          setAllKots(allKots.filter(k => !servedTableKots.find(sk => sk.id === k.id)));
                          const updatedTable = { ...selectedTable, status: 'VACANT' as const };
                          await db.diningTables.put(updatedTable);
                          setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
                          setSelectedTable(null);
                          setShowSettlement(false);
                          alert("Bill Closed.");
                        };
                        confirmSettle();
                    }} className="flex-[2] bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl tracking-widest">Verify & Close Bill ✅</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showAddItem && (
         <div className="fixed inset-0 z-[250] bg-slate-900/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl">
               <div className="bg-orange-600 p-8 text-white font-black uppercase text-xs tracking-widest text-center">Register New Menu Item</div>
               <div className="p-10 space-y-6">
                  <MenuInp label="Item Description" value={newItem.name || ''} onChange={v => setNewItem({...newItem, name: v})} />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                        <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                           {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                     <MenuInp label="Rate (₹)" type="number" value={newItem.price?.toString() || ''} onChange={v => setNewItem({...newItem, price: parseFloat(v) || 0})} />
                  </div>
                  <button onClick={async () => {
                     if(!newItem.name || !newItem.price) return alert("Fill data");
                     const ni = { ...newItem, id: `mi-${Date.now()}`, outletId: selectedOutlet!.id, isAvailable: true } as MenuItem;
                     await db.menuItems.put(ni);
                     setMenu([...menu, ni]);
                     setShowAddItem(false);
                     setNewItem({ name: '', category: 'INDIAN MAIN COURSE', subcategory: '', price: 0, dietaryType: 'VEG', isAvailable: true });
                  }} className="w-full bg-[#111] text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Authorize Record</button>
               </div>
               <button onClick={() => setShowAddItem(false)} className="w-full py-4 text-slate-300 font-black uppercase text-[10px]">Discard</button>
            </div>
         </div>
      )}
    </div>
  );
};

const MenuInp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-orange-600 transition-all text-slate-900 shadow-inner" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-white text-orange-600 shadow-md border-2 border-orange-50' : 'text-slate-400 hover:text-orange-900'}`}>{label}</button>
);

const CatBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0 ${active ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{label}</button>
);

export default DiningModule;

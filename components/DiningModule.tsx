
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
  "Mocktails", 
  "Soup", 
  "Papad and Salad", 
  "Raita", 
  "Breakfast", 
  "Pizza and Sandwiches", 
  "Chinese Rice and Noodles", 
  "Tandoori Starter", 
  "Indian Main Course", 
  "Rice and Biryani", 
  "Tandoori Roti", 
  "Sweets", 
  "Pasta", 
  "Chinese Starter"
];

const DIETARY_TYPES: DietaryType[] = ['VEG', 'NON-VEG', 'EGG'];

const DiningModule: React.FC<DiningModuleProps> = ({ rooms, bookings, guests, settings, userRole, onUpdateBooking }) => {
  const getInitialTab = () => {
    if (userRole === 'CHEF') return 'KITCHEN';
    return 'POS';
  };

  const [activeTab, setActiveTab] = useState<'POS' | 'KITCHEN' | 'MENU' | 'TABLES' | 'OUTLETS'>(getInitialTab());
  const [outlets, setOutlets] = useState<RestaurantOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<RestaurantOutlet | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allKots, setAllKots] = useState<KOT[]>([]);
  
  // Forms States
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [newOutlet, setNewOutlet] = useState<Partial<RestaurantOutlet>>({ name: '', type: 'FineDine' });
  
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ 
    name: '', category: 'Indian Main Course', subcategory: '', price: 0, dietaryType: 'VEG', isAvailable: true 
  });

  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNo, setNewTableNo] = useState('');

  // POS States
  const [posCategory, setPosCategory] = useState('All');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [billToRoomId, setBillToRoomId] = useState('');
  const [showSettlement, setShowSettlement] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      let o = await db.restaurants.toArray();
      if (o.length === 0) {
        const defaultOutlet: RestaurantOutlet = { id: 'rest-001', name: `Main Restaurant`, type: 'FineDine' };
        await db.restaurants.put(defaultOutlet);
        o = [defaultOutlet];
      }
      setOutlets(o);
      if (o.length > 0) setSelectedOutlet(o[0]);
      
      setMenu(await db.menuItems.toArray());
      setAllKots(await db.kots.toArray());
      
      if (o.length > 0) {
        const t = await db.diningTables.where('outletId').equals(o[0].id).toArray();
        setTables(t);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      db.diningTables.where('outletId').equals(selectedOutlet.id).toArray().then(setTables);
    }
  }, [selectedOutlet, activeTab]);

  const servedTableKots = useMemo(() => {
    if (!selectedTable) return [];
    return allKots.filter(k => k.tableId === selectedTable.id);
  }, [allKots, selectedTable]);

  const tableSubtotal = useMemo(() => {
    return servedTableKots.reduce((total, kot) => {
      return total + kot.items.reduce((kSum, it) => {
        const m = menu.find(mi => mi.id === it.menuItemId);
        return kSum + ((m?.price || 0) * it.quantity);
      }, 0);
    }, 0);
  }, [servedTableKots, menu]);

  const activeResidents = useMemo(() => {
    const active = bookings.filter(b => b.status === 'ACTIVE');
    if (!roomSearch) return active;
    const lower = roomSearch.toLowerCase();
    return active.filter(b => {
      const r = rooms.find(room => room.id === b.roomId);
      return r?.number.toLowerCase().includes(lower);
    });
  }, [bookings, rooms, roomSearch]);

  const handlePlaceOrder = async () => {
    if (!selectedTable || cart.length === 0) return;
    const kot: KOT = {
      id: `KOT-${Date.now()}`,
      tableId: selectedTable.id,
      outletId: selectedOutlet!.id,
      waiterId: 'SYSTEM',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty })),
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      paymentMethod: settlementMode
    };
    await db.kots.put(kot);
    const updatedTable = { ...selectedTable, status: 'OCCUPIED' as const };
    await db.diningTables.put(updatedTable);
    setAllKots([...allKots, kot]);
    setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
    setSelectedTable(updatedTable);
    setCart([]);
    alert("KOT Dispatched to Kitchen!");
  };

  const handleSettleBill = async () => {
    if (!selectedTable || tableSubtotal <= 0) return;

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
      if (!billToRoomId) return alert("Please select a resident room to mark the bill.");
      targetResident = bookings.find(x => x.id === billToRoomId);
      if (targetResident) {
        const charge: Charge = { 
          id: `CHG-DIN-${Date.now()}`, 
          description: `Dining Bill: Table ${selectedTable.number} (${selectedOutlet?.name})`, 
          amount: grandTotal, 
          date: new Date().toISOString() 
        };
        const updatedBooking = { ...targetResident, charges: [...(targetResident.charges || []), charge] };
        await db.bookings.put(updatedBooking);
        if (onUpdateBooking) onUpdateBooking(updatedBooking);
      }
    } else {
      const tx: Transaction = {
        id: `TX-DIN-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'RECEIPT',
        accountGroup: 'Direct Income',
        ledger: `${settlementMode} Account`,
        amount: grandTotal,
        entityName: 'Dining Walk-in',
        description: `Restaurant Bill: Table ${selectedTable.number} (${selectedOutlet?.name}) settled via ${settlementMode}`
      };
      await db.transactions.put(tx);
    }

    const persistentBill: DiningBill = {
      id: `DIN-BILL-${Date.now()}`,
      billNo: `DIN-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      outletId: selectedOutlet!.id,
      tableNumber: selectedTable.number,
      items: billItems,
      subTotal: tableSubtotal,
      taxAmount,
      grandTotal,
      paymentMode: settlementMode,
      guestName: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.name || 'Resident') : 'Walk-in Guest',
      guestPhone: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.phone || '') : '',
      roomBookingId: targetResident?.id
    };
    await db.diningBills.put(persistentBill);

    for (const kot of servedTableKots) { await db.kots.delete(kot.id); }
    setAllKots(allKots.filter(k => !servedTableKots.find(sk => sk.id === k.id)));
    const updatedTable = { ...selectedTable, status: 'VACANT' as const };
    await db.diningTables.put(updatedTable);
    setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
    setSelectedTable(null);
    setShowSettlement(false);
    setBillToRoomId('');
    setRoomSearch('');
    alert(`Bill of ₹${grandTotal.toFixed(2)} finalized.`);
  };

  const handleSaveOutlet = async () => {
    if (!newOutlet.name) return;
    const outlet: RestaurantOutlet = { ...newOutlet, id: `OUT-${Date.now()}` } as RestaurantOutlet;
    await db.restaurants.put(outlet);
    setOutlets([...outlets, outlet]);
    setSelectedOutlet(outlet);
    setShowAddOutlet(false);
    setNewOutlet({ name: '', type: 'FineDine' });
  };

  const deleteOutlet = async (id: string) => {
    if (!confirm("Permanently delete this restaurant outlet?")) return;
    await db.restaurants.delete(id);
    const updated = outlets.filter(o => o.id !== id);
    setOutlets(updated);
    if (selectedOutlet?.id === id) setSelectedOutlet(updated[0] || null);
  };

  const handleSaveItem = async () => {
    if (!newItem.name || !selectedOutlet) return;
    const item: MenuItem = { ...newItem, id: `ITM-${Date.now()}`, outletId: selectedOutlet.id } as MenuItem;
    await db.menuItems.put(item);
    setMenu([...menu, item]);
    setShowAddItem(false);
    setNewItem({ name: '', category: 'Indian Main Course', subcategory: '', price: 0, dietaryType: 'VEG', isAvailable: true });
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    await db.menuItems.delete(id);
    setMenu(menu.filter(m => m.id !== id));
  };

  const handleSaveTable = async () => {
    if (!newTableNo || !selectedOutlet) return;
    const table: DiningTable = { id: `TBL-${Date.now()}`, number: newTableNo, outletId: selectedOutlet.id, status: 'VACANT' };
    await db.diningTables.put(table);
    setTables([...tables, table]);
    setShowAddTable(false);
    setNewTableNo('');
  };

  const deleteTable = async (id: string) => {
    if (!confirm("Remove this table?")) return;
    await db.diningTables.delete(id);
    setTables(tables.filter(t => t.id !== id));
  };

  const updateKOTStatus = async (kotId: string, status: KOT['status']) => {
    const kot = allKots.find(k => k.id === kotId);
    if (kot) {
      const updated = { ...kot, status };
      await db.kots.put(updated);
      setAllKots(allKots.map(k => k.id === kotId ? updated : k));
    }
  };

  const filteredMenu = menu.filter(m => {
    const outletMatch = m.outletId === selectedOutlet?.id && m.isAvailable;
    const catMatch = posCategory === 'All' || m.category === posCategory;
    return outletMatch && catMatch;
  });

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f1f5f9]">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6 w-full md:w-auto">
           <div className="w-16 h-16 bg-[#001a33] text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl shrink-0">🍽️</div>
           <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter leading-none truncate">{selectedOutlet?.name || 'Loading...'}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                 {outlets.map(o => (
                    <button key={o.id} onClick={() => { setSelectedOutlet(o); setSelectedTable(null); }} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${selectedOutlet?.id === o.id ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-100'}`}>{o.name}</button>
                 ))}
                 <button onClick={() => setShowAddOutlet(true)} className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-900 text-white shadow-lg">+ New Outlet</button>
              </div>
           </div>
        </div>
        
        <div className="flex gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-100 no-print overflow-x-auto scrollbar-hide max-w-full shrink-0">
           <TabBtn active={activeTab === 'POS'} label="Ordering POS" onClick={() => setActiveTab('POS')} />
           <TabBtn active={activeTab === 'KITCHEN'} label="Kitchen KDS" onClick={() => setActiveTab('KITCHEN')} />
           <TabBtn active={activeTab === 'MENU'} label="Menu Manager" onClick={() => setActiveTab('MENU')} />
           <TabBtn active={activeTab === 'TABLES'} label="Table Registry" onClick={() => setActiveTab('TABLES')} />
           <TabBtn active={activeTab === 'OUTLETS'} label="Outlet Master" onClick={() => setActiveTab('OUTLETS')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden animate-in fade-in duration-300">
            <div className="lg:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-sm border flex flex-col gap-6">
               <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest border-b pb-4">Station Selection</h3>
               <div className="grid grid-cols-3 gap-3 overflow-y-auto custom-scrollbar pr-2">
                  {tables.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setSelectedTable(t)}
                      className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${selectedTable?.id === t.id ? 'bg-blue-700 border-blue-700 text-white shadow-xl scale-105' : t.status === 'OCCUPIED' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
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
                    <button 
                      key={item.id} 
                      onClick={() => {
                        const exist = cart.find(c => c.item.id === item.id);
                        if (exist) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                        else setCart([...cart, {item, qty: 1}]);
                      }}
                      className="p-5 border-2 border-slate-50 bg-slate-50/50 rounded-3xl text-left hover:border-blue-700 hover:bg-white transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-3">
                         <div className={`w-3 h-3 border-2 p-0.5 flex items-center justify-center ${item.dietaryType === 'VEG' ? 'border-green-600' : 'border-red-600'}`}>
                            <div className={`w-full h-full rounded-full ${item.dietaryType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                         </div>
                         <span className="text-[10px] font-black text-blue-700">₹{item.price}</span>
                      </div>
                      <p className="text-[11px] font-black uppercase text-slate-800 leading-tight group-hover:text-blue-900 pr-4">{item.name}</p>
                    </button>
                  ))}
               </div>
            </div>

            <div className="lg:col-span-3 bg-[#001a33] rounded-[2.5rem] p-8 shadow-2xl flex flex-col overflow-hidden text-white">
               <div className="border-b border-white/10 pb-6 mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="font-black text-[10px] uppercase text-blue-400 tracking-widest mb-1">Active Check</h3>
                    <p className="text-2xl font-black tracking-tighter uppercase">{selectedTable ? `Table ${selectedTable.number}` : 'Standby'}</p>
                  </div>
                  {selectedTable?.status === 'OCCUPIED' && (
                    <button onClick={() => setShowSettlement(true)} className="bg-green-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Finalize Bill</button>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2">
                  {cart.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase truncate text-white">{c.item.name}</p>
                          <p className="text-[9px] font-bold text-blue-400 mt-1">₹{c.item.price} × {c.qty}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: Math.max(0, x.qty-1)} : x).filter(x => x.qty > 0))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">-</button>
                          <span className="text-[10px] font-black">{c.qty}</span>
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: x.qty+1} : x))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">+</button>
                       </div>
                    </div>
                  ))}
                  {selectedTable?.status === 'OCCUPIED' && servedTableKots.length > 0 && (
                    <div className="pt-6 border-t border-white/10">
                      <p className="text-[9px] font-black text-orange-400 uppercase mb-4">Posted KOTs</p>
                      {servedTableKots.map(kot => (
                        <div key={kot.id} className="p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                          {kot.items.map((it, i) => (
                            <div key={i} className="flex justify-between text-[10px] font-black">
                              <span className="opacity-80">{menu.find(m => m.id === it.menuItemId)?.name}</span>
                              <span className="text-blue-400">x{it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
               </div>

               <div className="border-t border-white/10 pt-6 space-y-4">
                  <div className="flex justify-between items-end">
                     <span className="text-[10px] font-black text-blue-400 uppercase">Subtotal</span>
                     <span className="text-3xl font-black text-white tracking-tighter">₹{(tableSubtotal + cart.reduce((s, c) => s + (c.item.price * c.qty), 0)).toFixed(2)}</span>
                  </div>
                  <button 
                    disabled={!selectedTable || cart.length === 0}
                    onClick={handlePlaceOrder}
                    className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl disabled:opacity-20 hover:bg-blue-700 transition-all"
                  >
                    Authorize KOT Dispatch
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'KITCHEN' && (
          <div className="bg-[#001a33] h-full rounded-[3.5rem] p-10 flex flex-col gap-8 overflow-hidden shadow-2xl">
             <div className="flex justify-between items-center border-b border-white/10 pb-6">
                <h2 className="text-white text-3xl font-black uppercase tracking-tighter">Kitchen KDS</h2>
                <div className="flex gap-6">
                   <KDSStat label="Queued" count={allKots.filter(k => k.status === 'PENDING').length} color="bg-red-500" />
                   <KDSStat label="Prep" count={allKots.filter(k => k.status === 'PREPARING').length} color="bg-orange-500" />
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar flex-1">
                {allKots.filter(k => k.status !== 'SERVED' && k.outletId === selectedOutlet?.id).map(kot => (
                   <div key={kot.id} className="bg-white rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative">
                      <div className={`absolute left-0 top-0 h-full w-2 ${kot.status === 'PENDING' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                      <div className="flex justify-between items-start">
                         <h4 className="text-2xl font-black text-slate-900">TBL {tables.find(t => t.id === kot.tableId)?.number}</h4>
                         <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${kot.status === 'PENDING' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{kot.status}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                         {kot.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2">
                               <span className="text-xs font-black uppercase text-slate-700">{menu.find(m => m.id === it.menuItemId)?.name}</span>
                               <span className="bg-slate-900 text-white px-2 py-1 rounded-lg font-black text-xs">x{it.quantity}</span>
                            </div>
                         ))}
                      </div>
                      {kot.status === 'PENDING' ? (
                        <button onClick={() => updateKOTStatus(kot.id, 'PREPARING')} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Start Preparation</button>
                      ) : (
                        <button onClick={() => updateKOTStatus(kot.id, 'SERVED')} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Mark Served</button>
                      )}
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'MENU' && (
           <div className="h-full flex flex-col gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 flex justify-between items-center shadow-sm">
                 <div>
                    <h2 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter">Outlet Menu Library</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Add or Update items for {selectedOutlet?.name}</p>
                 </div>
                 <button onClick={() => setShowAddItem(true)} className="bg-blue-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add Item</button>
              </div>
              <div className="bg-white border-2 border-slate-50 rounded-[3rem] overflow-hidden flex-1 shadow-sm overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-[#001a33] text-white font-black uppercase text-[10px] sticky top-0">
                       <tr>
                          <th className="p-6">Item Name</th>
                          <th className="p-6">Category</th>
                          <th className="p-6">Dietary</th>
                          <th className="p-6 text-right">Price (₹)</th>
                          <th className="p-6 text-center">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y font-bold uppercase text-xs">
                       {menu.filter(m => m.outletId === selectedOutlet?.id).map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-900">
                             <td className="p-6 font-black text-blue-900 text-sm tracking-tight">{item.name}</td>
                             <td className="p-6 text-slate-400 font-black">{item.category}</td>
                             <td className="p-6">
                                <span className={`px-4 py-1 rounded-lg text-[9px] font-black border uppercase ${item.dietaryType === 'VEG' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{item.dietaryType}</span>
                             </td>
                             <td className="p-6 text-right font-black text-base">₹{item.price.toFixed(2)}</td>
                             <td className="p-6 text-center">
                                <button onClick={() => deleteMenuItem(item.id)} className="text-red-300 hover:text-red-600 font-black text-xs uppercase">Delete</button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'TABLES' && (
           <div className="h-full flex flex-col gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 flex justify-between items-center shadow-sm">
                 <div>
                    <h2 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter">Table Registry</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage physical seating for {selectedOutlet?.name}</p>
                 </div>
                 <button onClick={() => setShowAddTable(true)} className="bg-blue-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Register Table</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {tables.map(t => (
                    <div key={t.id} className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] shadow-sm flex flex-col items-center justify-between group hover:border-blue-600 transition-all text-slate-900">
                       <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-900 mb-4">{t.number}</div>
                       <button onClick={() => deleteTable(t.id)} className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'OUTLETS' && (
           <div className="h-full flex flex-col gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 flex justify-between items-center shadow-sm">
                 <div>
                    <h2 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter">Outlet Master Control</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global restaurant and bar configuration</p>
                 </div>
                 <button onClick={() => setShowAddOutlet(true)} className="bg-blue-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ New Outlet</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {outlets.map(o => (
                    <div key={o.id} className="bg-white border-2 border-slate-50 p-10 rounded-[3rem] shadow-sm flex flex-col justify-between group hover:border-blue-600 transition-all text-slate-900">
                       <div className="flex justify-between items-start mb-6">
                          <div className="w-16 h-16 bg-blue-900 rounded-2xl flex items-center justify-center text-white text-3xl font-black">{o.name.charAt(0)}</div>
                          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">{o.type}</span>
                       </div>
                       <h3 className="text-xl font-black uppercase text-blue-900 mb-2">{o.name}</h3>
                       <button onClick={() => deleteOutlet(o.id)} className="text-red-400 font-black uppercase text-[9px] hover:underline">Deactivate Outlet</button>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {showAddOutlet && (
         <DiningModal title="Register New Outlet" onClose={() => setShowAddOutlet(false)}>
            <div className="space-y-6">
               <Inp label="Outlet Name" value={newOutlet.name} onChange={v => setNewOutlet({...newOutlet, name: v})} placeholder="e.g. Roof Top Cafe" />
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dining Classification</label>
                  <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none" value={newOutlet.type} onChange={e => setNewOutlet({...newOutlet, type: e.target.value as any})}>
                     <option value="FineDine">Premium Fine Dine</option>
                     <option value="Cafe">Casual Cafe</option>
                     <option value="Bar">Liquor Bar</option>
                     <option value="Buffet">Buffet Hall</option>
                  </select>
               </div>
               <button onClick={handleSaveOutlet} className="w-full bg-[#001a33] text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl tracking-widest">Initialize Outlet</button>
            </div>
         </DiningModal>
      )}

      {showAddItem && (
         <DiningModal title="Add Menu Item" onClose={() => setShowAddItem(false)}>
            <div className="space-y-6">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               <Inp label="Item Name" value={newItem.name} onChange={v => setNewItem({...newItem, name: v})} />
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dietary Type</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none" value={newItem.dietaryType} onChange={e => setNewItem({...newItem, dietaryType: e.target.value as DietaryType})}>
                       {DIETARY_TYPES.map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}
                    </select>
                  </div>
                  <Inp label="Unit Price (₹)" type="number" value={newItem.price?.toString()} onChange={v => setNewItem({...newItem, price: parseFloat(v)})} />
               </div>
               <button onClick={handleSaveItem} className="w-full bg-blue-700 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl">Publish to Menu</button>
            </div>
         </DiningModal>
      )}

      {showAddTable && (
         <DiningModal title="Add Dining Table" onClose={() => setShowAddTable(false)}>
            <div className="space-y-6">
               <Inp label="Table Identification / No" value={newTableNo} onChange={setNewTableNo} placeholder="e.g. T-10, VIP-1" />
               <button onClick={handleSaveTable} className="w-full bg-[#001a33] text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl">Register Table</button>
            </div>
         </DiningModal>
      )}

      {showSettlement && selectedTable && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-green-600 p-8 text-white text-center">
                   <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Checkout Station {selectedTable.number}</h3>
                </div>
                <div className="p-10 space-y-8">
                   <div className="flex justify-between items-end border-b-2 border-slate-50 pb-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Total Payable</span>
                      <span className="text-4xl font-black text-blue-900 tracking-tighter leading-none">₹{tableSubtotal.toFixed(2)}</span>
                   </div>

                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Payment Method</label>
                         <div className="grid grid-cols-2 gap-2">
                            {(['Cash', 'UPI', 'Card', 'Mark to Room']).map(mode => (
                               <button 
                                 key={mode}
                                 onClick={() => setSettlementMode(mode)}
                                 className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-blue-700 border-blue-700 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                               >
                                 {mode}
                               </button>
                            ))}
                         </div>
                      </div>

                      {settlementMode === 'Mark to Room' && (
                         <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <input 
                              type="text" 
                              placeholder="Search Room Number..." 
                              className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:border-blue-600"
                              value={roomSearch}
                              onChange={e => setRoomSearch(e.target.value)}
                            />
                            <div className="max-h-40 overflow-y-auto custom-scrollbar border rounded-2xl p-2 space-y-1">
                               {activeResidents.map(b => (
                                 <button 
                                   key={b.id} 
                                   onClick={() => setBillToRoomId(b.id)}
                                   className={`w-full text-left p-3 rounded-xl flex justify-between items-center transition-all ${billToRoomId === b.id ? 'bg-blue-50 border-blue-200 border-2' : 'hover:bg-slate-50 border-2 border-transparent'}`}
                                 >
                                    <div>
                                       <span className="font-black text-blue-900 text-sm">Room {rooms.find(r => r.id === b.roomId)?.number}</span>
                                       <span className="ml-3 text-[10px] font-bold text-slate-400 uppercase">{guests.find(g => g.id === b.guestId)?.name}</span>
                                    </div>
                                    {billToRoomId === b.id && <span className="text-blue-600 font-black text-xs">✓ SELECTED</span>}
                                 </button>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>

                   <div className="flex gap-4 pt-4">
                      <button onClick={() => setShowSettlement(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Back</button>
                      <button onClick={handleSettleBill} className="flex-[2] bg-green-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Verify & Close Account</button>
                   </div>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

const DiningModal = ({ title, children, onClose }: any) => (
   <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
         <div className="bg-[#001a33] p-8 text-white flex justify-between items-center">
            <h3 className="text-xl font-black uppercase tracking-tighter">{title}</h3>
            <button onClick={onClose} className="uppercase text-[10px] font-black opacity-60">Close</button>
         </div>
         <div className="p-10">{children}</div>
      </div>
   </div>
);

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-white text-blue-900 shadow-md border-2 border-blue-50' : 'text-slate-400 hover:text-blue-900'}`}>{label}</button>
);

const CatBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0 ${active ? 'bg-[#001a33] text-white border-[#001a33] shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{label}</button>
);

const KDSStat = ({ label, count, color }: any) => (
  <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${color}`}></div>
    <span className="text-white text-[11px] font-black uppercase tracking-tight">{label}: {count}</span>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default DiningModule;

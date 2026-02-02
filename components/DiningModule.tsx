import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { subscribeToTable } from '../services/supabase';
import { RestaurantOutlet, MenuItem, DiningTable, KOT, Room, Booking, DietaryType, Transaction, UserRole, Charge, Guest, DiningBill, Payment } from '../types';

interface DiningModuleProps {
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  settings: any;
  userRole: UserRole;
}

const CATEGORIES = ["ALL", "MOCKTAILS", "SOUPS", "PAPAD AND SALAD", "RAITA", "BREAKFAST", "PIZZA & SANDWICH", "CHINESE RICE & NOODLES", "TANDOOR STARTER", "INDIAN MAIN COURSE", "RICE & BIRYANI", "TANDOORI ROTI", "SWEETS", "PASTA", "CHINESE STARTER"];

const DiningModule: React.FC<DiningModuleProps> = ({ rooms, bookings, guests, settings, userRole }) => {
  const [activeTab, setActiveTab] = useState<'POS' | 'KITCHEN' | 'MENU' | 'TABLES' | 'OUTLETS'>('POS');
  const [outlets, setOutlets] = useState<RestaurantOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<RestaurantOutlet | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allKots, setAllKots] = useState<KOT[]>([]);
  
  const [editingMenuItem, setEditingMenuItem] = useState<Partial<MenuItem> | null>(null);
  const [editingTable, setEditingTable] = useState<Partial<DiningTable> | null>(null);
  const [editingOutlet, setEditingOutlet] = useState<Partial<RestaurantOutlet> | null>(null);

  const [posCategory, setPosCategory] = useState('ALL');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);

  // Settle States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementMode, setSettlementMode] = useState<'Cash' | 'UPI' | 'Card' | 'Mark to Room'>('Cash');
  const [targetRoomBookingId, setTargetRoomBookingId] = useState('');

  const refreshData = async () => {
    const o = await db.restaurants.toArray();
    setOutlets(o || []);
    if (!selectedOutlet && o.length > 0) setSelectedOutlet(o[0]);

    const t = await db.diningTables.toArray();
    setTables(t || []);

    const m = await db.menuItems.toArray();
    setMenu(m || []);
    setAllKots(await db.kots.toArray() || []);
  };

  useEffect(() => {
    refreshData();
    const sub = subscribeToTable('kots', () => refreshData());
    const sub2 = subscribeToTable('menuItems', () => refreshData());
    const sub3 = subscribeToTable('diningTables', () => refreshData());
    return () => {
      sub.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    };
  }, [selectedOutlet]);

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem?.name || !editingMenuItem?.price || !selectedOutlet) return;
    const item: MenuItem = { 
      ...editingMenuItem, 
      id: editingMenuItem.id || `mi-${Date.now()}`, 
      outletId: selectedOutlet.id, 
      isAvailable: true,
      category: editingMenuItem.category || 'MOCKTAILS',
      dietaryType: editingMenuItem.dietaryType || 'VEG'
    } as MenuItem;
    await db.menuItems.put(item);
    setEditingMenuItem(null);
    refreshData();
  };

  const handleSaveTable = async () => {
    if (!editingTable?.number || !selectedOutlet) return;
    const table: DiningTable = { 
      ...editingTable, 
      id: editingTable.id || `t-${Date.now()}`, 
      outletId: selectedOutlet.id, 
      status: editingTable.status || 'VACANT' 
    } as DiningTable;
    await db.diningTables.put(table);
    setEditingTable(null);
    refreshData();
  };

  const handleSaveOutlet = async () => {
    if (!editingOutlet?.name) return;
    const outlet: RestaurantOutlet = { 
      ...editingOutlet, 
      id: editingOutlet.id || `rest-${Date.now()}`,
      type: editingOutlet.type || 'FineDine'
    } as RestaurantOutlet;
    await db.restaurants.put(outlet);
    setEditingOutlet(null);
    refreshData();
  };

  const handleGenerateKOT = async () => {
    if (!selectedTable || cart.length === 0) return alert("Select table and add items.");
    
    const kot: KOT = {
      id: `KOT-${Date.now()}`,
      tableId: selectedTable.id,
      outletId: selectedOutlet!.id,
      waiterId: userRole,
      items: cart.map(c => ({ menuItemId: c.item.id, name: c.item.name, quantity: c.qty, price: c.item.price })),
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    
    await db.kots.put(kot);
    await db.diningTables.update(selectedTable.id, { status: 'OCCUPIED' });
    setCart([]);
    setSelectedTable(null);
    refreshData();
    alert("KOT Generated and sent to Kitchen.");
  };

  const tableTotal = useMemo(() => {
    if (!selectedTable) return 0;
    const kots = allKots.filter(k => k.tableId === selectedTable.id && k.status !== 'SERVED');
    const cartTotal = cart.reduce((s, c) => s + (c.item.price * c.qty), 0);
    const pendingTotal = kots.reduce((s, k) => s + k.items.reduce((sk: number, it: any) => sk + (it.price * it.quantity), 0), 0);
    return cartTotal + pendingTotal;
  }, [selectedTable, allKots, cart]);

  const handleSettleTable = async () => {
    if (!selectedTable) return;
    const total = tableTotal;
    if (total === 0) return alert("Nothing to settle.");

    const charge: Charge = {
      id: `CHG-DIN-${Date.now()}`,
      description: `Dining: ${selectedOutlet?.name} (Table ${selectedTable.number})`,
      amount: total,
      date: new Date().toISOString()
    };

    if (targetRoomBookingId) {
      const roomB = bookings.find(x => x.id === targetRoomBookingId);
      if (roomB) {
        let updatedPayments = roomB.payments || [];
        if (settlementMode !== 'Mark to Room') {
          const payment: Payment = {
            id: `PAY-DIN-${Date.now()}`,
            amount: total,
            date: new Date().toISOString(),
            method: settlementMode,
            remarks: `Settle at ${selectedOutlet?.name}`
          };
          updatedPayments = [...updatedPayments, payment];
        }

        const updatedBooking = { 
          ...roomB, 
          charges: [...(roomB.charges || []), charge],
          payments: updatedPayments 
        };
        await db.bookings.put(updatedBooking);
      }
    }

    const tx: Transaction = {
      id: `TX-DIN-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'RECEIPT',
      accountGroup: 'Direct Income',
      ledger: settlementMode === 'Mark to Room' ? 'Room Folio Ledger' : `${settlementMode} Account`,
      amount: total,
      entityName: targetRoomBookingId ? `Resident Room Folio` : `Dining Walk-in`,
      description: `Restaurant Bill: Table ${selectedTable.number}`
    };
    await db.transactions.put(tx);

    const tableKots = allKots.filter(k => k.tableId === selectedTable.id);
    for (const k of tableKots) {
      await db.kots.update(k.id, { status: 'SERVED' });
    }

    await db.diningTables.update(selectedTable.id, { status: 'VACANT' });
    setShowSettleModal(false);
    setSelectedTable(null);
    setCart([]);
    setTargetRoomBookingId('');
    refreshData();
    alert("Dining Bill Settled. Folio Synced.");
  };

  const activeResidents = useMemo(() => {
    return bookings.filter(b => b.status === 'ACTIVE');
  }, [bookings]);

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-slate-50 animate-in fade-in duration-700 overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border shrink-0">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">Dining Terminal</h2>
          <div className="mt-2 relative">
            <select 
              className="bg-white text-slate-900 p-3 rounded-2xl text-sm font-black uppercase outline-none border-2 border-slate-200 shadow-sm appearance-none pr-10 min-w-[200px]"
              value={selectedOutlet?.id || ''}
              onChange={(e) => setSelectedOutlet(outlets.find(o => o.id === e.target.value) || null)}
            >
              {(outlets || []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              {outlets.length === 0 && <option value="">No Outlets Configured</option>}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0 bg-slate-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('POS')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'POS' ? 'bg-white text-blue-900 shadow-lg scale-105' : 'text-slate-400'}`}>POS Terminal</button>
          <button onClick={() => setActiveTab('KITCHEN')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'KITCHEN' ? 'bg-orange-600 text-white shadow-lg scale-105' : 'text-slate-400'}`}>Kitchen (KDS)</button>
          {['MANAGER', 'ADMIN', 'SUPERADMIN', 'RECEPTIONIST'].includes(userRole) && (
            <>
              <button onClick={() => setActiveTab('MENU')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase ${activeTab === 'MENU' ? 'bg-white text-blue-900 shadow-lg' : 'text-slate-400'}`}>Menu</button>
              <button onClick={() => setActiveTab('TABLES')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase ${activeTab === 'TABLES' ? 'bg-white text-blue-900 shadow-lg' : 'text-slate-400'}`}>Layout</button>
              <button onClick={() => setActiveTab('OUTLETS')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase ${activeTab === 'OUTLETS' ? 'bg-white text-blue-900 shadow-lg' : 'text-slate-400'}`}>Outlets</button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-[500px]">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setPosCategory(cat)} className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase whitespace-nowrap border-2 shadow-sm transition-all ${posCategory === cat ? 'bg-orange-600 border-orange-600 text-white scale-105' : 'bg-white border-white text-slate-400 hover:border-orange-200'}`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar flex-1 pb-10">
                {menu.filter(item => (item.outletId === selectedOutlet?.id && (posCategory === 'ALL' || item.category === posCategory))).map(item => (
                  <button key={item.id} onClick={() => {
                    const ex = cart.find(c => c.item.id === item.id);
                    if(ex) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                    else setCart([...cart, {item, qty: 1}]);
                  }} className="bg-white p-6 rounded-[2.5rem] border-2 border-transparent hover:border-orange-500 shadow-sm transition-all group flex flex-col justify-between text-left h-44 relative">
                    <div className="absolute top-4 right-4">
                       <div className={`w-3 h-3 rounded-sm border ${item.dietaryType === 'VEG' ? 'bg-green-500 border-green-700' : 'bg-red-500 border-red-700'}`}></div>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{item.category}</p>
                      <h4 className="text-[13px] font-black text-slate-800 uppercase leading-tight group-hover:text-orange-600">{item.name}</h4>
                    </div>
                    <p className="text-xl font-black text-blue-900 mt-2">₹{item.price}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-[3rem] border-2 shadow-2xl p-8 flex flex-col border-white">
              <h3 className="font-black text-slate-900 uppercase text-sm border-b pb-6 mb-8 flex justify-between items-center">
                 <span>Current Folio</span>
                 {selectedTable?.status === 'OCCUPIED' && <span className="text-[10px] bg-orange-100 text-orange-600 px-3 py-1 rounded-full">ACTIVE</span>}
              </h3>
              
              <div className="space-y-4 mb-8 relative">
                <select 
                  className="w-full border-2 border-slate-100 bg-white p-4 rounded-2xl font-black text-sm text-slate-900 outline-none focus:border-orange-600 transition-all appearance-none cursor-pointer" 
                  value={selectedTable?.id || ''} 
                  onChange={e => {
                    const t = tables.find(t => t.id === e.target.value);
                    setSelectedTable(t || null);
                    setCart([]);
                  }}
                >
                  <option value="">-- Choose Table --</option>
                  {(tables || []).filter(t => t.outletId === selectedOutlet?.id).map(t => (
                    <option key={t.id} value={t.id} className={`font-black uppercase py-4 ${t.status === 'OCCUPIED' ? 'text-orange-600' : 'text-slate-900'}`}>
                      {t.number} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {(cart || []).map(c => (
                  <div key={c.item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-right-2">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{c.item.name}</p>
                      <p className="text-[10px] font-bold text-orange-600">₹{c.item.price} × {c.qty}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCart(cart.map(i => i.item.id === c.item.id ? {...i, qty: Math.max(0, i.qty-1)} : i).filter(i => i.qty > 0))} className="w-8 h-8 rounded-xl bg-white border-2 flex items-center justify-center font-black text-lg hover:bg-orange-50 transition-all">-</button>
                      <span className="text-xs font-black w-4 text-center">{c.qty}</span>
                      <button onClick={() => setCart(cart.map(i => i.item.id === c.item.id ? {...i, qty: i.qty+1} : i))} className="w-8 h-8 rounded-xl bg-white border-2 flex items-center justify-center font-black text-lg hover:bg-orange-50 transition-all">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-slate-100 mt-8 space-y-4">
                <div className="flex justify-between text-xl font-black text-slate-900 uppercase tracking-tighter">
                  <span>Bill Amount</span>
                  <span className="text-orange-600">₹{tableTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex gap-3">
                  <button onClick={handleGenerateKOT} disabled={cart.length === 0} className="flex-[2] bg-slate-900 text-white py-5 rounded-[1.8rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all disabled:opacity-30">Send KOT</button>
                  {selectedTable?.status === 'OCCUPIED' && (
                    <button onClick={() => setShowSettleModal(true)} className="flex-[1.5] bg-orange-600 text-white py-5 rounded-[1.8rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all">Settle Bill</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'MENU' && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 h-full animate-in fade-in">
              <div className="md:col-span-1 bg-white p-8 rounded-[3rem] border space-y-6 h-fit">
                 <h3 className="text-lg font-black uppercase text-blue-900">Add Item</h3>
                 <MenuInp label="Item Name" value={editingMenuItem?.name || ''} onChange={(v:any) => setEditingMenuItem({...editingMenuItem, name: v})} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                    <select className="w-full border-2 p-3 rounded-2xl font-bold bg-white text-slate-900" value={editingMenuItem?.category || 'MOCKTAILS'} onChange={e => setEditingMenuItem({...editingMenuItem, category: e.target.value})}>
                       {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <MenuInp label="Price" type="number" value={editingMenuItem?.price?.toString() || ''} onChange={(v:any) => setEditingMenuItem({...editingMenuItem, price: parseFloat(v)})} />
                 <button onClick={handleSaveMenuItem} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-md">Save Item</button>
              </div>
              <div className="md:col-span-3 overflow-y-auto custom-scrollbar h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                 {menu.filter(m => m.outletId === selectedOutlet?.id).map(m => (
                    <div key={m.id} className="bg-white p-6 rounded-3xl border flex justify-between items-center group shadow-sm">
                       <div><p className="text-[10px] font-black text-orange-600">{m.category}</p><h4 className="font-black text-slate-800 uppercase">{m.name}</h4><p className="text-blue-900 font-black">₹{m.price}</p></div>
                       <button onClick={async () => { await db.menuItems.delete(m.id); refreshData(); }} className="text-red-300 group-hover:text-red-600 font-bold">×</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'TABLES' && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 h-full animate-in fade-in">
              <div className="md:col-span-1 bg-white p-8 rounded-[3rem] border space-y-6 h-fit">
                 <h3 className="text-lg font-black uppercase text-blue-900">Add Table</h3>
                 <MenuInp label="Table ID / Name" value={editingTable?.number || ''} onChange={(v:any) => setEditingTable({...editingTable, number: v})} />
                 <button onClick={handleSaveTable} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-md">Register Table</button>
              </div>
              <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6 h-fit pb-20">
                 {tables.filter(t => t.outletId === selectedOutlet?.id).map(t => (
                    <div key={t.id} className="bg-white border-2 p-8 rounded-[2.5rem] text-center relative group shadow-sm">
                       <h4 className="text-2xl font-black text-blue-900">{t.number}</h4>
                       <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{t.status}</p>
                       <button onClick={async () => { await db.diningTables.delete(t.id); refreshData(); }} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-black opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'OUTLETS' && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 h-full animate-in fade-in">
              <div className="md:col-span-1 bg-white p-8 rounded-[3rem] border space-y-6 h-fit">
                 <h3 className="text-lg font-black uppercase text-blue-900">Add Outlet</h3>
                 <MenuInp label="Outlet Name" value={editingOutlet?.name || ''} onChange={(v:any) => setEditingOutlet({...editingOutlet, name: v})} />
                 <button onClick={handleSaveOutlet} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-md">Create Outlet</button>
              </div>
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 h-fit pb-20">
                 {outlets.map(o => (
                    <div key={o.id} className="bg-white border-2 p-10 rounded-[3rem] flex justify-between items-center group shadow-sm">
                       <div><h4 className="text-xl font-black text-blue-900 uppercase">{o.name}</h4><p className="text-[10px] font-bold text-slate-400 mt-2">{tables.filter(t => t.outletId === o.id).length} Managed Tables</p></div>
                       <button onClick={async () => { await db.restaurants.delete(o.id); refreshData(); }} className="text-red-300 group-hover:text-red-600 font-black text-lg">×</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'KITCHEN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar h-full pb-20">
            {(allKots || []).filter(k => k.status !== 'SERVED' && k.outletId === selectedOutlet?.id).map(kot => (
              <div key={kot.id} className="bg-white border-4 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Table {(tables || []).find(t => t.id === kot.tableId)?.number || kot.tableId}</h4>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${kot.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>{kot.status}</span>
                  </div>
                  <div className="space-y-3 mb-8">
                    {(kot.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between font-bold text-[13px] text-slate-600 uppercase border-b border-dashed pb-2">
                        <span>{it.name || menu.find(m => m.id === it.menuItemId)?.name}</span>
                        <span className="text-orange-600 font-black">x{it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6 border-t flex gap-2">
                  {kot.status === 'PENDING' ? (
                    <button onClick={() => db.kots.update(kot.id, { status: 'PREPARING' }).then(refreshData)} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg">Start Cooking</button>
                  ) : (
                    <button onClick={() => db.kots.update(kot.id, { status: 'SERVED' }).then(refreshData)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg">Mark Served</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettleModal && selectedTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-orange-600 p-10 text-white text-center">
                 <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Table Settle Protocol</h2>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Table: {selectedTable.number} • Net Bill: ₹{tableTotal.toFixed(2)}</p>
              </div>
              
              <div className="p-12 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Identify Resident Room (Recommended)</label>
                    <select className="w-full border-2 border-slate-100 bg-white p-4 rounded-2xl font-black text-xs text-slate-900 outline-none" value={targetRoomBookingId} onChange={e => setTargetRoomBookingId(e.target.value)}>
                       <option value="">-- NO ROOM (WALK-IN) --</option>
                       {activeResidents.map(b => (
                          <option key={b.id} value={b.id}>ROOM {rooms.find(r => r.id === b.roomId)?.number} - {guests.find(g => g.id === b.guestId)?.name}</option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Select Payment Node</label>
                    <div className="grid grid-cols-2 gap-3">
                       {(['Cash', 'UPI', 'Card', 'Mark to Room'] as const).map(mode => (
                          <button key={mode} onClick={() => setSettlementMode(mode)} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${settlementMode === mode ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white'}`}>{mode}</button>
                       ))}
                    </div>
                 </div>
                 <div className="pt-8 border-t flex gap-4">
                    <button onClick={() => setShowSettleModal(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs">Cancel</button>
                    <button onClick={handleSettleTable} className="flex-[3] bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-[1.02] transition-all">Authorize Settlement</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const MenuInp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input type={type} className="w-full border-2 p-3 rounded-2xl font-black text-xs outline-none focus:border-blue-600 bg-white text-slate-900 shadow-sm" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

export default DiningModule;
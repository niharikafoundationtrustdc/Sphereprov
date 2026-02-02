
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { subscribeToTable } from '../services/supabase';
import { RestaurantOutlet, MenuItem, DiningTable, KOT, Room, Booking, DietaryType, Transaction, UserRole, Charge, Guest, DiningBill } from '../types';

interface DiningModuleProps {
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  settings: any;
  userRole: UserRole;
}

const CATEGORIES = ["ALL", "MOCKTAILS", "SOUPS", "SNACKS", "BREAKFAST", "MAIN COURSE", "RICE & BIRYANI", "SWEETS", "PASTA"];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);

  const refreshData = async () => {
    const o = await db.restaurants.toArray();
    setOutlets(o);
    if (!selectedOutlet && o.length > 0) setSelectedOutlet(o[0]);
    setTables(await db.diningTables.toArray());
    setMenu(await db.menuItems.toArray());
    setAllKots(await db.kots.toArray());
  };

  useEffect(() => {
    refreshData();
    const sub = subscribeToTable('kots', () => refreshData());
    return () => sub.unsubscribe();
  }, []);

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem?.name || !editingMenuItem?.price || !selectedOutlet) return;
    const item: MenuItem = { ...editingMenuItem, id: editingMenuItem.id || `mi-${Date.now()}`, outletId: selectedOutlet.id, isAvailable: true } as MenuItem;
    await db.menuItems.put(item);
    setEditingMenuItem(null);
    refreshData();
  };

  const handleSaveTable = async () => {
    if (!editingTable?.number || !selectedOutlet) return;
    const table: DiningTable = { ...editingTable, id: editingTable.id || `t-${Date.now()}`, outletId: selectedOutlet.id, status: 'VACANT' } as DiningTable;
    await db.diningTables.put(table);
    setEditingTable(null);
    refreshData();
  };

  const handleDeleteMenuItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Remove item?")) return;
    await db.menuItems.delete(id);
    refreshData();
  };

  const handleGenerateKOT = async () => {
    if (!selectedTable || cart.length === 0 || !selectedOutlet) return;
    const kot: KOT = {
      id: `KOT-${Date.now()}`,
      tableId: selectedTable.id,
      outletId: selectedOutlet.id,
      waiterId: userRole || 'STF',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, notes: '' })),
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    await db.kots.put(kot);
    await db.diningTables.update(selectedTable.id, { status: 'OCCUPIED' });
    setCart([]);
    alert("KOT Sent to Kitchen!");
    refreshData();
  };

  const filteredMenu = useMemo(() => {
    return menu.filter(m => 
      m.outletId === selectedOutlet?.id && 
      m.isAvailable && 
      (posCategory === 'ALL' || m.category === posCategory) &&
      (m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [menu, selectedOutlet, posCategory, searchQuery]);

  const filteredTables = useMemo(() => {
    return tables.filter(t => t.outletId === selectedOutlet?.id);
  }, [tables, selectedOutlet]);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Light Header */}
      <div className="bg-white p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-200">🍽️</div>
           <div>
             <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Dining Registry</h1>
             <div className="flex items-center gap-3 mt-1">
                <select 
                  className="bg-slate-50 text-[10px] font-black uppercase border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500"
                  value={selectedOutlet?.id || ''}
                  onChange={(e) => setSelectedOutlet(outlets.find(o => o.id === e.target.value) || null)}
                >
                   {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button onClick={() => setActiveTab('OUTLETS')} className="text-[10px] font-black text-blue-600 uppercase underline">Venues</button>
             </div>
           </div>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
           <TabBtn active={activeTab === 'POS'} label="Ordering" onClick={() => setActiveTab('POS')} />
           <TabBtn active={activeTab === 'KITCHEN'} label="KDS Display" onClick={() => setActiveTab('KITCHEN')} />
           <TabBtn active={activeTab === 'MENU'} label="Products" onClick={() => setActiveTab('MENU')} />
           <TabBtn active={activeTab === 'TABLES'} label="Tables" onClick={() => setActiveTab('TABLES')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
            {/* Table Sidebar: Light */}
            <div className="lg:col-span-2 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-hidden">
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest shrink-0">Table Selection</h3>
               <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
                  {filteredTables.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setSelectedTable(t)} 
                      className={`aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                        selectedTable?.id === t.id 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105 z-10' 
                          : t.status === 'OCCUPIED' 
                            ? 'bg-orange-50 border-orange-500 text-orange-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-xl font-black uppercase">{t.number}</span>
                      <span className="text-[7px] font-black uppercase opacity-60">{t.status}</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* Menu Center: Light */}
            <div className="lg:col-span-7 p-8 flex flex-col gap-8 overflow-hidden bg-slate-50">
               <div className="flex flex-col gap-4 shrink-0">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 border-b border-slate-200">
                    {CATEGORIES.map(c => <CatBtn key={c} active={posCategory === c} label={c} onClick={() => setPosCategory(c)} />)}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search menu items..." 
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar flex-1 pb-10">
                  {filteredMenu.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        const exist = cart.find(c => c.item.id === item.id);
                        if (exist) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                        else setCart([...cart, {item, qty: 1}]);
                      }} 
                      className="p-5 bg-white border border-slate-100 rounded-[1.8rem] text-left hover:border-blue-500 hover:shadow-lg transition-all group h-fit"
                    >
                      <div className="flex justify-between items-start mb-3">
                         <div className={`w-2.5 h-2.5 rounded-full ${item.dietaryType === 'VEG' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                         <span className="text-xs font-black text-slate-900">₹{item.price}</span>
                      </div>
                      <p className="text-[11px] font-bold uppercase text-slate-700 leading-tight group-hover:text-blue-600 transition-colors">{item.name}</p>
                      <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-2">{item.category}</p>
                    </button>
                  ))}
               </div>
            </div>

            {/* Right Cart: Light */}
            <div className="lg:col-span-3 bg-white p-8 flex flex-col overflow-hidden border-l border-slate-200">
               <div className="border-b border-slate-100 pb-6 mb-6">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-[0.2em] mb-2">Order Detail</h3>
                  <p className="text-3xl font-black tracking-tighter text-slate-900">
                    {selectedTable ? `Table ${selectedTable.number}` : 'Select Table' }
                  </p>
               </div>

               <div className="flex-1 overflow-y-auto space-y-3 mb-6 custom-scrollbar pr-1">
                  {cart.length > 0 ? cart.map((c, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
                       <div className="flex-1 pr-4">
                          <p className="text-[11px] font-black uppercase text-slate-800 leading-none">{c.item.name}</p>
                          <p className="text-[10px] font-bold text-orange-600 mt-1">₹{c.item.price * c.qty}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: Math.max(0, x.qty-1)} : x).filter(x => x.qty > 0))} className="w-7 h-7 bg-white border rounded-lg flex items-center justify-center font-black shadow-sm text-slate-400">−</button>
                          <span className="text-[12px] font-black w-4 text-center">{c.qty}</span>
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: x.qty+1} : x))} className="w-7 h-7 bg-white border rounded-lg flex items-center justify-center font-black shadow-sm text-slate-400">+</button>
                       </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-200 uppercase font-black tracking-widest text-[9px] gap-3">
                       <span className="text-4xl grayscale opacity-20">🛒</span>
                       Empty Cart
                    </div>
                  )}
               </div>

               <div className="border-t border-slate-100 pt-6 space-y-6">
                  <div className="flex justify-between items-end">
                     <span className="text-[10px] font-black text-slate-400 uppercase">Sub-Total</span>
                     <span className="text-3xl font-black text-slate-900">
                       ₹{cart.reduce((s, c) => s + (c.item.price * c.qty), 0).toFixed(0)}
                     </span>
                  </div>
                  <button 
                    disabled={!selectedTable || cart.length === 0} 
                    onClick={handleGenerateKOT} 
                    className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl disabled:bg-slate-200 hover:bg-slate-900 transition-all"
                  >
                    Authorize KOT 🚀
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Product Management: Light */}
        {activeTab === 'MENU' && (
           <div className="p-10 flex flex-col gap-8 h-full bg-slate-50 animate-in fade-in overflow-hidden">
              <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-200 shrink-0">
                 <div>
                    <h2 className="text-2xl font-black uppercase text-slate-900">Inventory Registry</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Master Price List Management</p>
                 </div>
                 <button onClick={() => setEditingMenuItem({ name: '', price: 0, category: CATEGORIES[1], dietaryType: 'VEG' })} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Add Product</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                    {menu.filter(m => m.outletId === selectedOutlet?.id).map(item => (
                       <div key={item.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-4">
                             <span className={`w-3 h-3 rounded-full ${item.dietaryType === 'VEG' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                             <span className="text-xs font-black text-blue-600">₹{item.price}</span>
                          </div>
                          <h4 className="text-[13px] font-black text-slate-800 uppercase leading-tight truncate">{item.name}</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">{item.category}</p>
                          <div className="mt-6 flex gap-2">
                             <button onClick={() => setEditingMenuItem(item)} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-50 hover:text-blue-600 transition-all">Edit</button>
                             <button onClick={(e) => handleDeleteMenuItem(e, item.id)} className="px-3 text-red-400 hover:text-red-600 font-bold">×</button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Light Modals */}
      {editingMenuItem && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-3xl border border-slate-200 animate-in zoom-in">
              <div className="bg-slate-50 p-8 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Manage Item</h3>
                 <button onClick={() => setEditingMenuItem(null)} className="text-slate-400 text-xl font-black">×</button>
              </div>
              <div className="p-8 space-y-6">
                 <Inp label="Item Name" value={editingMenuItem.name || ''} onChange={v => setEditingMenuItem({...editingMenuItem, name: v})} />
                 <div className="grid grid-cols-2 gap-4">
                    <Inp label="Price (₹)" type="number" value={editingMenuItem.price?.toString() || ''} onChange={v => setEditingMenuItem({...editingMenuItem, price: parseFloat(v) || 0})} />
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type</label>
                       <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold text-xs outline-none" value={editingMenuItem.dietaryType} onChange={e => setEditingMenuItem({...editingMenuItem, dietaryType: e.target.value as any})}>
                          <option value="VEG">VEG</option>
                          <option value="NON-VEG">NON-VEG</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                   <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold text-xs outline-none" value={editingMenuItem.category} onChange={e => setEditingMenuItem({...editingMenuItem, category: e.target.value})}>
                       {CATEGORIES.filter(c=>c!=='ALL').map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
                 <button onClick={handleSaveMenuItem} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl">Commit Registry</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${active ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-900'}`}>{label}</button>
);

const CatBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border transition-all whitespace-nowrap ${active ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>{label}</button>
);

const Inp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold text-sm text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

export default DiningModule;

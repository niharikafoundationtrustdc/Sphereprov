
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { InventoryItem, Vendor, StockReceipt, HostelSettings, MealPlanConfig } from '../types';

interface InventoryModuleProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
}

const InventoryModule: React.FC<InventoryModuleProps> = ({ settings, setSettings }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [activeTab, setActiveTab] = useState<'STOCK' | 'VENDORS' | 'PURCHASE' | 'MEALS'>('STOCK');
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: '', category: 'Housekeeping', unit: 'Unit', currentStock: 0, minStockLevel: 5 });
  const [newVendor, setNewVendor] = useState<Partial<Vendor>>({ name: '', contact: '', gstin: '', category: 'General' });
  const [newReceipt, setNewReceipt] = useState<Partial<StockReceipt>>({
    date: new Date().toISOString().split('T')[0], itemId: '', vendorId: '', quantity: 0, unitPrice: 0, totalAmount: 0, paymentMade: 0, paymentMode: 'Cash', billNumber: ''
  });

  const [newMealName, setNewMealName] = useState('');
  const [newMealRate, setNewMealRate] = useState('');

  useEffect(() => {
    const init = async () => {
      setItems(await db.inventory.toArray());
      setVendors(await db.vendors.toArray());
      setReceipts(await db.stockReceipts.toArray());
    };
    init();
  }, []);

  const handleSaveItem = async () => {
    if (!newItem.name) return;
    const itm: InventoryItem = { 
      ...newItem, 
      id: `ITM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, 
      currentStock: newItem.currentStock || 0,
      minStockLevel: newItem.minStockLevel || 0,
      lastPurchasePrice: 0
    } as InventoryItem;
    await db.inventory.put(itm);
    setItems([...items, itm]);
    setShowAddItem(false);
    setNewItem({ name: '', category: 'Housekeeping', unit: 'Unit', currentStock: 0, minStockLevel: 5 });
  };

  const handleSaveVendor = async () => {
    if (!newVendor.name || !newVendor.contact) return;
    const v: Vendor = { ...newVendor, id: `VND-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` } as Vendor;
    await db.vendors.put(v);
    setVendors([...vendors, v]);
    setShowAddVendor(false);
    setNewVendor({ name: '', contact: '', gstin: '', category: 'General' });
  };

  const handleSaveReceipt = async () => {
    if (!newReceipt.itemId || !newReceipt.vendorId || !newReceipt.quantity) return;
    const r: StockReceipt = {
      ...newReceipt,
      id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      totalAmount: (newReceipt.quantity || 0) * (newReceipt.unitPrice || 0)
    } as StockReceipt;
    await db.stockReceipts.put(r);
    
    const item = items.find(i => i.id === r.itemId);
    if (item) {
      const updatedItem = { ...item, currentStock: (item.currentStock || 0) + r.quantity, lastPurchasePrice: r.unitPrice };
      await db.inventory.put(updatedItem);
      setItems(items.map(i => i.id === item.id ? updatedItem : i));
    }

    setReceipts([...receipts, r]);
    setShowReceiptForm(false);
    setNewReceipt({ date: new Date().toISOString().split('T')[0], itemId: '', vendorId: '', quantity: 0, unitPrice: 0, totalAmount: 0, paymentMade: 0, paymentMode: 'Cash', billNumber: '' });
    alert("Stock Receipt Logged Successfully.");
  };

  const addMealPlan = () => {
    if (!newMealName || !newMealRate) return;
    const current = settings.mealPlanRates || [];
    const updated = [...current, { name: newMealName, rate: parseFloat(newMealRate) || 0 }];
    setSettings({ ...settings, mealPlanRates: updated });
    setNewMealName('');
    setNewMealRate('');
  };

  const removeMealPlan = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${name}?`)) return;
    const current = settings.mealPlanRates || [];
    setSettings({ ...settings, mealPlanRates: current.filter(p => p.name !== name) });
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-[#f8fafc] animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Inventory Console</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Raw Materials, Suppliers & Service Packages</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide max-w-full">
          <SubTab active={activeTab === 'STOCK'} label="Stock Status" onClick={() => setActiveTab('STOCK')} />
          <SubTab active={activeTab === 'PURCHASE'} label="Receipts" onClick={() => setActiveTab('PURCHASE')} />
          <SubTab active={activeTab === 'VENDORS'} label="Suppliers" onClick={() => setActiveTab('VENDORS')} />
          <SubTab active={activeTab === 'MEALS'} label="Meal Plans" onClick={() => setActiveTab('MEALS')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'STOCK' && (
          <div className="bg-white border-2 rounded-[3.5rem] shadow-sm overflow-hidden flex flex-col h-full">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Master Item Catalog</p>
                <div className="flex gap-3">
                   <button onClick={() => setShowAddItem(true)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-600 transition-all">+ New Master Item</button>
                </div>
             </div>
             <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left text-xs border-collapse">
                   <thead className="bg-slate-900 text-white font-black uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-6">Item Description</th>
                        <th className="p-6">Group / Category</th>
                        <th className="p-6 text-center">Unit</th>
                        <th className="p-6 text-right">Stock</th>
                        <th className="p-6 text-right">Min</th>
                        <th className="p-6 text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 font-bold uppercase text-slate-700 bg-white">
                      {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                           <td className="p-6 text-lg font-black text-blue-900 tracking-tight">{item.name}</td>
                           <td className="p-6"><span className="bg-slate-100 px-4 py-1 rounded-xl text-[9px] font-black">{item.category}</span></td>
                           <td className="p-6 text-center opacity-40">{item.unit}</td>
                           <td className="p-6 text-right font-black text-xl">{item.currentStock}</td>
                           <td className="p-6 text-right opacity-30 italic">{item.minStockLevel}</td>
                           <td className="p-6 text-center">
                              {item.currentStock <= item.minStockLevel ? (
                                <span className="bg-red-50 text-red-600 px-6 py-2 rounded-full text-[10px] font-black animate-pulse">REORDER</span>
                              ) : (
                                <span className="bg-green-50 text-green-600 px-6 py-2 rounded-full text-[10px] font-black">OK</span>
                              )}
                           </td>
                        </tr>
                      ))}
                      {items.length === 0 && <tr><td colSpan={6} className="p-40 text-center text-slate-200 italic font-black uppercase tracking-widest">No inventory items recorded</td></tr>}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'MEALS' && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full animate-in fade-in">
              <div className="lg:col-span-1 bg-white border-2 border-slate-100 rounded-[3rem] p-10 shadow-sm space-y-6 h-fit">
                 <h3 className="font-black text-blue-900 uppercase text-xs border-b pb-4 tracking-widest">Enroll Meal Plan</h3>
                 <Inp label="Plan Title (e.g. CP)" value={newMealName} onChange={setNewMealName} placeholder="Package Code" />
                 <Inp label="Daily Rate / Plate (₹)" type="number" value={newMealRate} onChange={setNewMealRate} placeholder="0.00" />
                 <button onClick={addMealPlan} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Add to Catalog</button>
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {(settings.mealPlanRates || []).map(p => (
                    <div key={p.name} className="bg-white border-2 border-slate-50 p-10 rounded-[3rem] shadow-sm flex flex-col justify-between hover:border-blue-600 transition-all group relative">
                       <div>
                          <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tighter leading-none">{p.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active Service Package</p>
                       </div>
                       <div className="mt-12 flex justify-between items-end border-t border-slate-50 pt-6">
                          <div>
                             <p className="text-[8px] font-black uppercase text-slate-300">Unit Price</p>
                             <p className="text-3xl font-black text-blue-600 tracking-tighter">₹{p.rate}</p>
                          </div>
                          <button onClick={(e) => removeMealPlan(e, p.name)} className="text-red-400 font-black uppercase text-[10px] hover:text-red-600">Delete</button>
                       </div>
                    </div>
                 ))}
                 {(settings.mealPlanRates || []).length === 0 && (
                    <div className="col-span-full py-40 text-center text-slate-200 uppercase font-black tracking-[0.3em] border-4 border-dashed rounded-[4rem]">No meal plans defined in inventory</div>
                 )}
              </div>
           </div>
        )}

        {activeTab === 'VENDORS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto custom-scrollbar h-full pb-20">
             {vendors.map(v => (
               <div key={v.id} className="bg-white border-2 border-slate-50 rounded-[3rem] p-10 shadow-sm space-y-6 hover:shadow-xl transition-all group">
                  <div className="flex justify-between items-start">
                     <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-4xl font-black text-blue-900">{v.name.charAt(0)}</div>
                     <span className="bg-slate-50 px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-400">{v.category}</span>
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter leading-none">{v.name}</h3>
                     <p className="text-[12px] font-bold text-slate-400 mt-2">{v.contact}</p>
                  </div>
                  <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
                     <p className="text-[11px] font-black text-blue-500">{v.gstin || 'NO GST'}</p>
                     <button onClick={async () => { if(confirm("Delete vendor?")) { await db.vendors.delete(v.id); setVendors(vendors.filter(x => x.id !== v.id)); } }} className="text-red-400 font-bold text-lg hover:text-red-600">×</button>
                  </div>
               </div>
             ))}
             <button onClick={() => setShowAddVendor(true)} className="border-4 border-dashed border-slate-200 rounded-[3rem] bg-white flex flex-col items-center justify-center gap-4 text-slate-300 hover:text-blue-600 hover:border-blue-600 transition-all p-10 min-h-[300px] shadow-sm">
                <span className="text-6xl font-black">+</span>
                <span className="font-black uppercase tracking-widest text-[10px]">Add Supplier</span>
             </button>
          </div>
        )}

        {activeTab === 'PURCHASE' && (
          <div className="bg-white border-2 rounded-[3.5rem] shadow-sm overflow-hidden flex flex-col h-full">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Voucher Trail</p>
                <button onClick={() => setShowReceiptForm(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-900 transition-all">+ Post Receipt</button>
             </div>
             <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left text-xs border-collapse">
                   <thead className="bg-slate-900 text-white font-black uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-6">Date</th>
                        <th className="p-6">Supplier</th>
                        <th className="p-6">Item Detail</th>
                        <th className="p-6 text-right">Net Value</th>
                        <th className="p-6 text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 font-bold uppercase text-slate-700 bg-white">
                      {receipts.map(r => (
                        <tr key={r.id}>
                           <td className="p-6 text-slate-400">{r.date}</td>
                           <td className="p-6 font-black">{vendors.find(v => v.id === r.vendorId)?.name || 'Unknown'}</td>
                           <td className="p-6">
                              <p className="text-blue-900">{items.find(i => i.id === r.itemId)?.name || 'N/A'}</p>
                              <p className="text-[9px] opacity-40">Qty: {r.quantity} @ ₹{r.unitPrice}</p>
                           </td>
                           <td className="p-6 text-right font-black text-lg">₹{r.totalAmount}</td>
                           <td className="p-6 text-center">
                              {r.paymentMade >= r.totalAmount ? <span className="text-green-600">PAID</span> : <span className="text-red-500">PENDING</span>}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {showAddItem && (
         <InventoryModal title="New Asset Creation" onClose={() => setShowAddItem(false)}>
            <div className="grid grid-cols-1 gap-6">
               <Inp label="Item Description" value={newItem.name} onChange={v => setNewItem({...newItem, name: v})} />
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                     <select className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                        <option value="Housekeeping">Housekeeping</option>
                        <option value="Linen">Linen</option>
                        <option value="F&B">Food & Bev</option>
                     </select>
                  </div>
                  <Inp label="Unit (e.g. KG, PCS)" value={newItem.unit} onChange={v => setNewItem({...newItem, unit: v})} />
               </div>
               <button onClick={handleSaveItem} className="w-full bg-blue-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Authorize Record</button>
            </div>
         </InventoryModal>
      )}

      {showAddVendor && (
         <InventoryModal title="Vendor Onboarding" onClose={() => setShowAddVendor(false)}>
            <div className="grid grid-cols-1 gap-6">
               <Inp label="Supplier Trade Name" value={newVendor.name} onChange={v => setNewVendor({...newVendor, name: v})} />
               <Inp label="Contact Information" value={newVendor.contact} onChange={v => setNewVendor({...newVendor, contact: v})} />
               <Inp label="Tax ID (GSTIN)" value={newVendor.gstin} onChange={v => setNewVendor({...newVendor, gstin: v})} />
               <button onClick={handleSaveVendor} className="w-full bg-blue-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Register Account</button>
            </div>
         </InventoryModal>
      )}

      {showReceiptForm && (
         <InventoryModal title="Post Procurement" onClose={() => setShowReceiptForm(false)}>
            <div className="grid grid-cols-1 gap-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Inventory Node</label>
                  <select className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm" value={newReceipt.itemId} onChange={e => setNewReceipt({...newReceipt, itemId: e.target.value})}>
                     <option value="">Select Item...</option>
                     {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Supplier Account</label>
                  <select className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm" value={newReceipt.vendorId} onChange={e => setNewReceipt({...newReceipt, vendorId: e.target.value})}>
                     <option value="">Select Vendor...</option>
                     {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <Inp label="Quantity" type="number" value={newReceipt.quantity?.toString()} onChange={v => setNewReceipt({...newReceipt, quantity: parseFloat(v)})} />
                  <Inp label="Unit Rate (₹)" type="number" value={newReceipt.unitPrice?.toString()} onChange={v => setNewReceipt({...newReceipt, unitPrice: parseFloat(v)})} />
               </div>
               <button onClick={handleSaveReceipt} className="w-full bg-blue-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Commit Vouchers</button>
            </div>
         </InventoryModal>
      )}
    </div>
  );
};

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-10 py-3.5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest whitespace-nowrap ${active ? 'bg-blue-900 text-white shadow-xl' : 'text-slate-400 hover:bg-white hover:text-blue-900'}`}>{label}</button>
);

const InventoryModal = ({ title, children, onClose }: any) => (
   <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
         <div className="bg-blue-900 p-8 text-white flex justify-between items-center flex-shrink-0">
            <h3 className="text-xl font-black uppercase tracking-tighter">{title}</h3>
            <button onClick={onClose} className="uppercase text-[10px] font-black opacity-60 hover:opacity-100 transition-opacity">Close</button>
         </div>
         <div className="p-10">{children}</div>
      </div>
   </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl font-black text-[12px] text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm placeholder:text-slate-300" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default InventoryModule;

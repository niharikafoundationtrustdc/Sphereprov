
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { subscribeToTable } from '../services/supabase';
import { Quotation, QuotationItem, HostelSettings } from '../types';

interface QuotationModuleProps {
  settings: HostelSettings;
}

const QuotationModule: React.FC<QuotationModuleProps> = ({ settings }) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'ARCHIVE'>('BUILDER');
  const [showPrint, setShowPrint] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  const [formData, setFormData] = useState<Partial<Quotation>>({
    date: new Date().toISOString().split('T')[0],
    guestName: '',
    guestPhone: '',
    guestAddress: '',
    type: 'WEDDING',
    items: [],
    taxRate: settings.taxRate || 12,
    discount: 0,
    remarks: '',
    validityDays: 15
  });

  const refreshData = async () => {
    setQuotations(await db.quotations.toArray());
  };

  useEffect(() => {
    refreshData();
    const sub = subscribeToTable('quotations', refreshData);
    return () => sub.unsubscribe();
  }, []);

  const totals = useMemo(() => {
    const subtotal = (formData.items || []).reduce((acc, item) => acc + item.amount, 0);
    const taxable = subtotal - (formData.discount || 0);
    const tax = (taxable * (formData.taxRate || 0)) / 100;
    return { subtotal, taxable, tax, grandTotal: taxable + tax };
  }, [formData.items, formData.taxRate, formData.discount]);

  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: `ITEM-${Date.now()}`,
      description: '',
      qty: 1,
      rate: 0,
      amount: 0
    };
    setFormData({ ...formData, items: [...(formData.items || []), newItem] });
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
    const nextItems = (formData.items || []).map(it => {
      if (it.id === id) {
        const updated = { ...it, [field]: value };
        if (field === 'qty' || field === 'rate') {
          updated.amount = updated.qty * updated.rate;
        }
        return updated;
      }
      return it;
    });
    setFormData({ ...formData, items: nextItems });
  };

  const applyTemplate = (type: 'WEDDING' | 'CORPORATE') => {
    const templates = {
      WEDDING: [
        { description: 'Banquet Hall Venue Rental (Grand Ballroom)', qty: 1, rate: 25000 },
        { description: 'Wedding Stage Decoration (Floral & Lighting)', qty: 1, rate: 15000 },
        { description: 'Catering: Wedding Buffet (Premium)', qty: 100, rate: 850 },
        { description: 'Audio-Visual Sound System Setup', qty: 1, rate: 5000 }
      ],
      CORPORATE: [
        { description: 'Meeting Hall Rental (Full Day)', qty: 1, rate: 12000 },
        { description: 'Conference AV System + Projector', qty: 1, rate: 3500 },
        { description: 'High Tea (Tea/Coffee + Snacks)', qty: 50, rate: 250 },
        { description: 'Working Lunch Buffet', qty: 50, rate: 450 }
      ]
    };

    const items = templates[type].map(it => ({ ...it, id: `ITM-${Math.random().toString(36).substr(2, 5)}`, amount: it.qty * it.rate }));
    setFormData({ ...formData, type, items });
  };

  const handleSave = async () => {
    if (!formData.guestName || !formData.items?.length) return alert("Please enter Guest Name and add items.");
    
    const quote: Quotation = {
      ...formData,
      id: formData.id || `QUO-${Date.now()}`,
      totalAmount: totals.grandTotal
    } as Quotation;

    await db.quotations.put(quote);
    alert("Quotation saved successfully.");
    setActiveTab('ARCHIVE');
    refreshData();
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-slate-50 animate-in fade-in duration-700 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-white shrink-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Quotation Master</h2>
          <p className="text-[9px] md:text-[11px] font-bold text-blue-600 uppercase tracking-[0.4em] mt-2">Proposal & Contract Preparation Node</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-100 mt-4 md:mt-0 no-print">
           <TabBtn active={activeTab === 'BUILDER'} label="Proposal Builder" onClick={() => setActiveTab('BUILDER')} />
           <TabBtn active={activeTab === 'ARCHIVE'} label="Saved Proposals" onClick={() => setActiveTab('ARCHIVE')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'BUILDER' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
             {/* LEFT: FORM BUILDER */}
             <div className="bg-white border-2 rounded-[3.5rem] shadow-2xl p-10 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <section className="space-y-6">
                   <h4 className="text-[11px] font-black uppercase text-slate-400 border-b pb-4 tracking-widest">1. Client Discovery</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Inp label="Target Client / Guest" value={formData.guestName} onChange={v => setFormData({...formData, guestName: v})} placeholder="Legal Name / Company" />
                      <Inp label="Contact Phone" value={formData.guestPhone} onChange={v => setFormData({...formData, guestPhone: v})} placeholder="99XXXXXXX" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Event Genre</label>
                        <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:bg-white transition-all shadow-inner text-slate-900" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                           <option value="WEDDING">💍 Wedding / Marriage</option>
                           <option value="CORPORATE">🏢 Corporate Conference</option>
                           <option value="OTHER">🎭 Other Social Event</option>
                        </select>
                      </div>
                      <Inp label="Quote Validity (Days)" type="number" value={formData.validityDays?.toString()} onChange={v => setFormData({...formData, validityDays: parseInt(v) || 15})} />
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => applyTemplate('WEDDING')} className="flex-1 bg-rose-50 text-rose-600 border border-rose-100 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white transition-all">Load Wedding Preset</button>
                      <button onClick={() => applyTemplate('CORPORATE')} className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-600 hover:text-white transition-all">Load Corporate Preset</button>
                   </div>
                </section>

                <section className="space-y-6 flex-1">
                   <div className="flex justify-between items-center border-b pb-4">
                      <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">2. Detailed Deliverables</h4>
                      <button onClick={handleAddItem} className="bg-blue-900 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">+ Add Line Item</button>
                   </div>
                   <div className="space-y-3">
                      {(formData.items || []).map((it, idx) => (
                        <div key={it.id} className="flex gap-2 items-end animate-in slide-in-from-left-2 duration-300">
                           <div className="flex-1">
                              <label className="text-[8px] font-black uppercase text-slate-300 ml-1">Service Description</label>
                              <input className="w-full border-2 p-3 rounded-xl font-bold text-[11px] outline-none bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-300" value={it.description} onChange={e => updateItem(it.id, 'description', e.target.value)} placeholder="e.g. Stage Decor" />
                           </div>
                           <div className="w-16">
                              <label className="text-[8px] font-black uppercase text-slate-300 ml-1">Qty</label>
                              <input type="number" className="w-full border-2 p-3 rounded-xl font-black text-[11px] outline-none text-center bg-slate-50 focus:bg-white text-slate-900" value={it.qty} onChange={e => updateItem(it.id, 'qty', parseFloat(e.target.value) || 0)} />
                           </div>
                           <div className="w-24">
                              <label className="text-[8px] font-black uppercase text-slate-300 ml-1">Rate (₹)</label>
                              <input type="number" className="w-full border-2 p-3 rounded-xl font-black text-[11px] outline-none bg-slate-50 focus:bg-white text-slate-900" value={it.rate} onChange={e => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)} />
                           </div>
                           <button onClick={() => setFormData({...formData, items: formData.items?.filter(x => x.id !== it.id)})} className="bg-rose-50 text-rose-300 p-3 rounded-xl hover:text-rose-600">×</button>
                        </div>
                      ))}
                      {formData.items?.length === 0 && <div className="py-10 text-center opacity-20 italic font-black uppercase tracking-widest border-2 border-dashed rounded-3xl text-slate-400">No deliverables listed</div>}
                   </div>
                </section>

                <section className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-2xl">
                   <div className="grid grid-cols-2 gap-8">
                      <Inp label="Applied Discount (₹)" type="number" value={formData.discount?.toString()} onChange={v => setFormData({...formData, discount: parseFloat(v) || 0})} inputClassName="!bg-white/10 !text-white !border-white/20" />
                      <Inp label="Tax Rate (%)" type="number" value={formData.taxRate?.toString()} onChange={v => setFormData({...formData, taxRate: parseFloat(v) || 0})} inputClassName="!bg-white/10 !text-white !border-white/20" />
                   </div>
                   <div className="flex justify-between items-end border-t border-white/10 pt-6">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Project Valuation</p>
                         <p className="text-4xl font-black tracking-tighter leading-none mt-2">₹{totals.grandTotal.toFixed(0)}</p>
                      </div>
                      <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Commit Proposal ✅</button>
                   </div>
                </section>
             </div>

             {/* RIGHT: PREVIEW */}
             <div className="hidden lg:flex bg-slate-200/50 rounded-[3.5rem] border-4 border-dashed border-slate-300 p-8 flex-col items-center justify-center relative overflow-hidden">
                <div className="scale-75 origin-top shadow-3xl bg-white w-[210mm] min-h-[297mm] p-16 animate-in zoom-in-95 duration-500 rounded-sm">
                   <QuotationDocument quote={formData as Quotation} settings={settings} totals={totals} />
                </div>
                <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] pointer-events-none flex items-center justify-center">
                   <p className="text-slate-400 font-black uppercase text-4xl -rotate-12 opacity-10">DRAFT PROPOSAL</p>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'ARCHIVE' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar h-full pb-20">
              {quotations.map(q => (
                 <div key={q.id} className="bg-white border rounded-[3rem] p-8 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all group border-white">
                    <div>
                       <div className="flex justify-between items-start mb-6">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${q.type === 'WEDDING' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{q.type}</span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">#{q.id.slice(-6)}</span>
                       </div>
                       <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{q.guestName}</h3>
                       <p className="text-[11px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{q.guestPhone} • {q.date}</p>
                       <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-end">
                          <div>
                             <p className="text-[8px] font-black uppercase text-slate-300">Quote Value</p>
                             <p className="text-2xl font-black text-blue-900 tracking-tighter leading-none mt-1">₹{q.totalAmount.toFixed(0)}</p>
                          </div>
                          <button onClick={() => { setSelectedQuotation(q); setShowPrint(true); }} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg">View & Print</button>
                       </div>
                    </div>
                    <button onClick={async () => { if(confirm("Wipe Proposal?")) { await db.quotations.delete(q.id); refreshData(); }}} className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full font-black opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">×</button>
                 </div>
              ))}
              {quotations.length === 0 && (
                <div className="col-span-full py-60 text-center opacity-20 italic font-black uppercase tracking-[0.4em] border-4 border-dashed rounded-[4rem] text-slate-900">No Proposals in history</div>
              )}
           </div>
        )}
      </div>

      {showPrint && selectedQuotation && (
        <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col no-print-backdrop animate-in fade-in">
           <div className="bg-black p-6 flex justify-between items-center no-print border-b border-white/10 shadow-2xl">
              <div className="flex gap-4">
                 <button onClick={() => window.print()} className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">Print Proposal 🖨️</button>
                 <button onClick={() => setShowPrint(false)} className="text-white px-8 py-3 border border-white/20 rounded-2xl font-black text-xs uppercase hover:bg-white/10 transition-all">Close Viewer</button>
              </div>
              <p className="text-white font-black uppercase text-xs tracking-widest opacity-40">Property Authority • Quote Dispatch System</p>
           </div>
           <div className="flex-1 overflow-y-auto bg-gray-500/20 p-10 flex justify-center custom-scrollbar">
              <div className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-3xl invoice-sheet rounded-sm">
                 <QuotationDocument quote={selectedQuotation} settings={settings} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const QuotationDocument = ({ quote, settings, totals: passedTotals }: { quote: Quotation, settings: HostelSettings, totals?: any }) => {
  const finalTotals = passedTotals || {
    subtotal: (quote.items || []).reduce((acc, item) => acc + item.amount, 0),
    tax: (( (quote.items || []).reduce((acc, item) => acc + item.amount, 0) - (quote.discount || 0) ) * (quote.taxRate || 0)) / 100,
    grandTotal: quote.totalAmount || 0
  };

  return (
    <div className="text-slate-900 font-sans uppercase font-bold text-[11px] leading-relaxed">
       <div className="flex justify-between items-start border-b-8 border-blue-900 pb-10 mb-10">
          <div className="flex items-center gap-8">
             {settings.logo && <div className="w-24 h-24 bg-white border p-2 flex items-center justify-center rounded-2xl shadow-sm"><img src={settings.logo} className="max-h-full max-w-full object-contain" /></div>}
             <div>
                <h1 className="text-4xl font-black tracking-tighter leading-none text-blue-900">{settings.name}</h1>
                <p className="text-[10px] font-bold text-slate-400 mt-3 max-w-sm lowercase">{settings.address}</p>
                <p className="text-[10px] font-black text-blue-800 mt-1">GST: {settings.gstNumber || 'N/A'}</p>
             </div>
          </div>
          <div className="text-right">
             <div className="bg-blue-900 text-white px-8 py-3 rounded-2xl inline-block mb-4 shadow-xl"><h2 className="text-lg font-black tracking-widest leading-none">PRO-FORMA QUOTATION</h2></div>
             <p className="text-[10px] text-slate-400 font-black">Date: {quote.date}</p>
             <p className="text-[10px] text-slate-400 font-black">Ref: {quote.id?.slice(-8) || 'DRAFT'}</p>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-20 mb-12 bg-slate-50 p-10 rounded-[3rem] border border-slate-200">
          <div className="space-y-4">
             <p className="text-[10px] font-black text-blue-900 border-b pb-2 tracking-widest">Prepared For:</p>
             <h3 className="text-2xl font-black tracking-tighter text-slate-900">{quote.guestName}</h3>
             <p className="text-[11px] text-slate-500">{quote.guestPhone}</p>
             <p className="text-[11px] text-slate-500 lowercase leading-relaxed">{quote.guestAddress || 'Address Not Recorded'}</p>
          </div>
          <div className="space-y-4 text-right">
             <p className="text-[10px] font-black text-blue-900 border-b pb-2 tracking-widest">Proposal Details:</p>
             <p className="text-[11px] font-black text-slate-600">Event Class: <span className="text-blue-900">{quote.type}</span></p>
             <p className="text-[11px] font-black text-slate-600">Validity: <span className="text-blue-900">{quote.validityDays} Days from Issue</span></p>
          </div>
       </div>

       <div className="border border-slate-200 rounded-[2.5rem] overflow-hidden mb-12 shadow-sm">
          <table className="w-full text-left border-collapse">
             <thead className="bg-blue-900 text-white text-[10px] font-black tracking-widest uppercase">
                <tr><th className="p-6">Modular Deliverable / Service Detail</th><th className="p-6 text-center">Qty</th><th className="p-6 text-right">Unit Rate (₹)</th><th className="p-6 text-right">Net Value (₹)</th></tr>
             </thead>
             <tbody className="divide-y font-black text-slate-800">
                {(quote.items || []).map((it, i) => (
                  <tr key={i} className="h-20">
                     <td className="p-6 text-[12px] text-blue-950">{it.description}</td>
                     <td className="p-6 text-center opacity-40">{it.qty}</td>
                     <td className="p-6 text-right">₹{it.rate.toFixed(2)}</td>
                     <td className="p-6 text-right">₹{it.amount.toFixed(2)}</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>

       <div className="grid grid-cols-2 gap-20 mb-12">
          <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200">
             <h4 className="text-[9px] font-black text-blue-900 mb-4 tracking-[0.4em]">TERMS & PROTOCOLS</h4>
             <ul className="text-[8px] space-y-2 text-slate-500 lowercase leading-relaxed">
                <li>• 50% advance required for authorization of event date.</li>
                <li>• taxes applicable as per government of india norms.</li>
                <li>• final pax count to be confirmed 48 hours in advance.</li>
                <li>• quote valid strictly for {quote.validityDays} calendar days.</li>
             </ul>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between text-[11px] font-black opacity-40"><span>Sub-total Value</span><span>₹{finalTotals.subtotal.toFixed(2)}</span></div>
             {quote.discount > 0 && <div className="flex justify-between text-[11px] font-black text-orange-600"><span>Proposal Discount</span><span>- ₹{quote.discount.toFixed(2)}</span></div>}
             <div className="flex justify-between text-[11px] font-black opacity-40"><span>Applied Tax (@{quote.taxRate}%)</span><span>₹{finalTotals.tax.toFixed(2)}</span></div>
             <div className="h-px bg-slate-200 my-4"></div>
             <div className="bg-blue-900 text-white p-8 rounded-[2.5rem] flex justify-between items-center shadow-xl">
                <div><p className="text-[9px] font-black opacity-60 tracking-[0.4em] mb-1">FINAL QUOTED PRICE</p><h4 className="text-4xl font-black tracking-tighter leading-none">₹{finalTotals.grandTotal.toFixed(0)}</h4></div>
                <div className="text-right opacity-30 text-5xl">📑</div>
             </div>
          </div>
       </div>

       <div className="mt-32 grid grid-cols-2 gap-40 text-center">
          <div className="border-t-2 border-slate-200 pt-6"><p className="text-[9px] font-black text-slate-400">ACCEPTED BY CLIENT (SIGN/STAMP)</p></div>
          <div className="border-t-2 border-slate-200 pt-6">
             {settings.signature && <img src={settings.signature} className="h-10 mx-auto mix-blend-multiply mb-2" />}
             <p className="text-[9px] font-black text-blue-900">AUTHORIZING SIGNATORY • {settings.name}</p>
          </div>
       </div>
    </div>
  );
};

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-10 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shrink-0 ${active ? 'bg-blue-900 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-blue-900 hover:bg-white'}`}>{label}</button>
);

const Inp = ({ label, value, onChange, type = "text", placeholder = "", className = "", inputClassName = "" }: any) => (
  <div className={`space-y-1.5 w-full text-left ${className}`}>
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input 
      type={type} 
      className={`w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-blue-900 transition-all shadow-inner text-slate-900 placeholder:text-slate-300 ${inputClassName}`} 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
    />
  </div>
);

export default QuotationModule;

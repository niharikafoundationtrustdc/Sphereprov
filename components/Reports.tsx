import React, { useState, useMemo } from 'react';
import { Booking, Guest, Room, Transaction, RoomShiftLog, CleaningLog, Quotation } from '../types.ts';

interface ReportsProps {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  transactions: Transaction[];
  shiftLogs: RoomShiftLog[];
  cleaningLogs: CleaningLog[];
  quotations: Quotation[];
  settings: any;
}

type ReportType = 'OCCUPANCY_CHART' | 'POLICE_REPORT' | 'CHECK_IN_REPORT' | 'CHECK_OUT_REPORT' | 'COLLECTION' | 'PROFIT_LOSS' | 'BALANCE_SHEET' | 'SUMMARY';

const Reports: React.FC<ReportsProps> = ({ bookings, guests, rooms, transactions, settings }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('OCCUPANCY_CHART');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const financialData = useMemo(() => {
    const rangeTx = (transactions || []).filter(t => t.date >= startDate && t.date <= endDate);
    
    const income = rangeTx.filter(t => t.type === 'RECEIPT' && (
      t.accountGroup.toUpperCase().includes('INCOME') || 
      t.accountGroup.toUpperCase().includes('OPERATING') ||
      t.accountGroup.toUpperCase().includes('REVENUE')
    )).reduce((s, t) => s + t.amount, 0);

    const expense = rangeTx.filter(t => t.type === 'PAYMENT' && (
      t.accountGroup.toUpperCase().includes('EXPENSE') || 
      t.accountGroup.toUpperCase().includes('PURCHASE')
    )).reduce((s, t) => s + t.amount, 0);
    
    const allTx = (transactions || []).filter(t => t.date <= endDate);
    
    const assets = allTx.filter(t => (
      t.accountGroup.toUpperCase().includes('ASSET') || 
      t.ledger.toUpperCase().includes('CASH') || 
      t.ledger.toUpperCase().includes('BANK')
    )).reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);

    const liabilities = allTx.filter(t => (
      t.accountGroup.toUpperCase().includes('CAPITAL') || 
      t.accountGroup.toUpperCase().includes('LIABILITY')
    )).reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);

    return { income, expense, profit: income - expense, assets, liabilities };
  }, [transactions, startDate, endDate]);

  const renderHeader = (title: string) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-[6px] border-emerald-900 pb-4 mb-8 no-print gap-4">
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-emerald-900 uppercase tracking-tighter leading-none">{title}</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Financial Node: {settings.name}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => window.print()} className="bg-emerald-800 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">Print Analysis</button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-white min-h-full flex flex-col animate-in fade-in duration-500 pb-40">
      <div className="flex gap-1 mb-8 overflow-x-auto pb-4 no-print scrollbar-hide border-b">
        {(['OCCUPANCY_CHART', 'POLICE_REPORT', 'CHECK_IN_REPORT', 'CHECK_OUT_REPORT', 'COLLECTION', 'PROFIT_LOSS', 'BALANCE_SHEET', 'SUMMARY'] as ReportType[]).map(r => (
           <button key={r} onClick={() => setActiveReport(r)} className={`px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0 ${activeReport === r ? 'bg-emerald-900 text-white border-emerald-900 shadow-lg' : 'bg-white text-slate-400 border-white hover:bg-emerald-50'}`}>{r.replace(/_/g, ' ')}</button>
        ))}
      </div>
      
      <div className="mb-10 p-6 bg-slate-50 rounded-[3rem] border border-slate-200 flex flex-wrap items-center gap-6 no-print">
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase text-emerald-900">Period Start</label>
            <input type="date" className="border-2 p-3 rounded-xl font-black text-[12px] bg-white outline-none focus:border-emerald-600" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase text-emerald-900">Period End</label>
            <input type="date" className="border-2 p-3 rounded-xl font-black text-[12px] bg-white outline-none focus:border-emerald-600" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
      </div>

      <div className="report-content flex-1">
        {activeReport === 'COLLECTION' && (
          <div className="space-y-6">
            {renderHeader(`Finance Collection Index`)}
            <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl bg-white">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-emerald-800 text-white uppercase font-black tracking-widest">
                  <tr><th className="p-6 text-left">Posting Date</th><th className="p-6 text-left">Entity / Source</th><th className="p-6 text-left">Account</th><th className="p-6 text-right">Amount (INR)</th></tr>
                </thead>
                <tbody className="divide-y text-black uppercase font-bold">
                  {(transactions || []).filter(t => t.type === 'RECEIPT' && t.date >= startDate && t.date <= endDate).map(t => (
                    <tr key={t.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="p-6 text-slate-400">{t.date}</td>
                      <td className="p-6 text-slate-900">{t.entityName || 'Direct Node'}</td>
                      <td className="p-6 text-emerald-900">{t.ledger}</td>
                      <td className="p-6 text-right font-black text-emerald-700 text-base">₹{t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'POLICE_REPORT' && (
           <div className="space-y-6">
              {renderHeader("Police Record / C-Form Log")}
              <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden bg-white">
                 <table className="w-full text-[10px] border-collapse uppercase font-bold">
                    <thead className="bg-slate-900 text-white font-black">
                       <tr><th className="p-4">Name</th><th className="p-4">Mobile</th><th className="p-4">ID Type</th><th className="p-4">ID Number</th><th className="p-4">Arrival</th><th className="p-4">Purpose</th></tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                       {bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).map(b => {
                          const g = guests.find(guest => guest.id === b.guestId);
                          return (
                             <tr key={b.id}>
                                <td className="p-4">{g?.name}</td>
                                <td className="p-4">{g?.phone}</td>
                                <td className="p-4">{g?.idType}</td>
                                <td className="p-4">{g?.idNumber}</td>
                                <td className="p-4">{b.checkInDate}</td>
                                <td className="p-4">{b.purpose}</td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeReport === 'CHECK_IN_REPORT' && (
           <div className="space-y-6">
              {renderHeader("Daily Arrivals Registry")}
              <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden bg-white">
                 <table className="w-full text-[10px] border-collapse uppercase font-bold">
                    <thead className="bg-emerald-800 text-white font-black">
                       <tr><th className="p-4">Bill No</th><th className="p-4">Room</th><th className="p-4">Guest</th><th className="p-4">Time</th><th className="p-4">Base Rate</th></tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                       {bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).map(b => {
                          const g = guests.find(guest => guest.id === b.guestId);
                          const r = rooms.find(rm => rm.id === b.roomId);
                          return (
                             <tr key={b.id}>
                                <td className="p-4">{b.bookingNo}</td>
                                <td className="p-4">{r?.number}</td>
                                <td className="p-4">{g?.name}</td>
                                <td className="p-4">{b.checkInTime}</td>
                                <td className="p-4">₹{b.basePrice}</td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeReport === 'CHECK_OUT_REPORT' && (
           <div className="space-y-6">
              {renderHeader("Daily Departure Log")}
              <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden bg-white">
                 <table className="w-full text-[10px] border-collapse uppercase font-bold">
                    <thead className="bg-rose-800 text-white font-black">
                       <tr><th className="p-4">Bill No</th><th className="p-4">Room</th><th className="p-4">Guest</th><th className="p-4">Out Date</th><th className="p-4">Out Time</th><th className="p-4">Status</th></tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                       {bookings.filter(b => b.checkOutDate >= startDate && b.checkOutDate <= endDate).map(b => {
                          const g = guests.find(guest => guest.id === b.guestId);
                          const r = rooms.find(rm => rm.id === b.roomId);
                          return (
                             <tr key={b.id}>
                                <td className="p-4">{b.bookingNo}</td>
                                <td className="p-4">{r?.number}</td>
                                <td className="p-4">{g?.name}</td>
                                <td className="p-4">{b.checkOutDate}</td>
                                <td className="p-4">{b.checkOutTime}</td>
                                <td className="p-4">{b.status}</td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeReport === 'PROFIT_LOSS' && (
          <div className="max-w-4xl mx-auto space-y-10">
             {renderHeader("Profit & Loss Analysis")}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-white border-2 rounded-[3rem] p-10 shadow-sm">
                  <h3 className="text-xl font-black text-emerald-700 border-b pb-4 uppercase mb-6">Revenue</h3>
                  <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                    <span>Operating Income</span>
                    <span className="text-emerald-600 font-black">₹{financialData.income.toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-white border-2 rounded-[3rem] p-10 shadow-sm">
                  <h3 className="text-xl font-black text-red-600 border-b pb-4 uppercase mb-6">Expenses</h3>
                  <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                    <span>Direct Payouts</span>
                    <span className="text-red-500 font-black">₹{financialData.expense.toFixed(2)}</span>
                  </div>
                </div>
             </div>
             <div className="bg-emerald-900 p-12 rounded-[4rem] text-white flex justify-between items-center shadow-2xl">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-300 tracking-widest mb-1">Net Performance</p>
                  <h4 className="text-5xl font-black tracking-tighter">₹{financialData.profit.toFixed(2)}</h4>
                </div>
                <span className={`px-8 py-2 rounded-full font-black uppercase text-xs ${financialData.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  {financialData.profit >= 0 ? 'Surplus' : 'Deficit'}
                </span>
             </div>
          </div>
        )}

        {activeReport === 'BALANCE_SHEET' && (
          <div className="max-w-5xl mx-auto space-y-10">
             {renderHeader("Enterprise Balance Sheet")}
             <div className="grid grid-cols-2 gap-0 border-4 border-emerald-900 rounded-[3rem] overflow-hidden bg-white shadow-2xl">
                <div className="p-10 border-r-2 border-slate-200 space-y-8">
                  <h3 className="text-2xl font-black text-emerald-900 uppercase tracking-tight border-b-4 pb-4">Liabilities</h3>
                  <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                    <span>Owner's Equity & Liab.</span>
                    <span className="font-black text-slate-900">₹{financialData.liabilities.toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-10 space-y-8">
                  <h3 className="text-2xl font-black text-emerald-900 uppercase tracking-tight border-b-4 pb-4">Assets</h3>
                  <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                    <span>Cash & Liquid Property</span>
                    <span className="font-black text-emerald-700">₹{financialData.assets.toFixed(2)}</span>
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeReport === 'SUMMARY' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-emerald-600 p-10 rounded-[4rem] text-white shadow-xl">
              <p className="text-[11px] font-black uppercase opacity-60 mb-4 tracking-widest">Net Inflow</p>
              <p className="text-4xl font-black tracking-tighter">₹{financialData.income.toFixed(2)}</p>
            </div>
            <div className="bg-blue-600 p-10 rounded-[4rem] text-white shadow-xl">
              <p className="text-[11px] font-black uppercase opacity-60 mb-4 tracking-widest">Total Arrivals</p>
              <p className="text-4xl font-black tracking-tighter">{bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).length}</p>
            </div>
            <div className="bg-orange-500 p-10 rounded-[4rem] text-white shadow-xl">
              <p className="text-[11px] font-black uppercase opacity-60 mb-4 tracking-widest">Net Outcome</p>
              <p className="text-4xl font-black tracking-tighter">₹{financialData.profit.toFixed(0)}</p>
            </div>
          </div>
        )}

        {activeReport === 'OCCUPANCY_CHART' && (
          <div className="space-y-8 animate-in fade-in">
             {renderHeader("Inventory Occupancy Visualization")}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <OccupancyBox label="Vacant Ready" count={rooms.filter(r => r.status === 'VACANT').length} color="text-emerald-600" bg="bg-emerald-50" />
                <OccupancyBox label="Occupied" count={rooms.filter(r => r.status === 'OCCUPIED').length} color="text-blue-600" bg="bg-blue-50" />
                <OccupancyBox label="In Laundry" count={rooms.filter(r => r.status === 'DIRTY').length} color="text-yellow-600" bg="bg-yellow-50" />
                <OccupancyBox label="Under Repair" count={rooms.filter(r => r.status === 'REPAIR').length} color="text-red-600" bg="bg-red-50" />
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OccupancyBox = ({ label, count, color, bg }: any) => (
  <div className={`${bg} p-8 rounded-[2.5rem] border border-white shadow-inner text-center`}>
     <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{label}</p>
     <p className={`text-4xl font-black ${color} tracking-tighter`}>{count}</p>
  </div>
);

export default Reports;
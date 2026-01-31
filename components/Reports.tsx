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

type ReportType = 
  | 'OCCUPANCY_CHART' 
  | 'POLICE_REPORT' 
  | 'GUEST_REGISTER' 
  | 'CHECK_IN_REPORT' 
  | 'CHECK_OUT_REPORT' 
  | 'COLLECTION' 
  | 'PROFIT_LOSS' 
  | 'BALANCE_SHEET' 
  | 'SUMMARY';

const Reports: React.FC<ReportsProps> = ({ bookings, guests, rooms, transactions, settings }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('OCCUPANCY_CHART');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [selectedCategory, setSelectedCategory] = useState('All');

  const dateRange = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  const filteredRooms = useMemo(() => {
    if (selectedCategory === 'All') return rooms;
    return rooms.filter(r => r.type === selectedCategory);
  }, [rooms, selectedCategory]);

  const financialData = useMemo(() => {
    const filteredTx = transactions.filter(t => t.date >= startDate && t.date <= endDate);
    const income = filteredTx.filter(t => t.type === 'RECEIPT' && t.accountGroup.toLowerCase().includes('income')).reduce((s, t) => s + t.amount, 0);
    const expense = filteredTx.filter(t => t.type === 'PAYMENT' && t.accountGroup.toLowerCase().includes('expense')).reduce((s, t) => s + t.amount, 0);
    
    const cumulativeTx = transactions.filter(t => t.date <= endDate);
    const assets = cumulativeTx.filter(t => t.accountGroup.includes('Asset') || t.ledger.toLowerCase().includes('cash') || t.ledger.toLowerCase().includes('bank'))
      .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
    const liabilities = cumulativeTx.filter(t => t.accountGroup === 'Capital' || t.accountGroup === 'Current Liability').reduce((s, t) => s + t.amount, 0);

    return { income, expense, profit: income - expense, assets, liabilities };
  }, [transactions, startDate, endDate]);

  const downloadCSV = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDocStatus = (g: Guest) => {
    const docs = [];
    if (g.documents?.photo) docs.push('PHOTO');
    if (g.documents?.aadharFront || g.documents?.passportFront) docs.push('ID');
    return docs.length > 0 ? docs.join('|') : 'MISSING';
  };

  const exportToExcel = () => {
    let content = "";
    let filename = `${activeReport}_${startDate}_to_${endDate}.csv`;

    switch (activeReport) {
      case 'POLICE_REPORT':
        content = "S.No,Guest Name,Nationality,Doc Type,ID Number,Arrived From,Proceeding To,Address,Arrival Date\n";
        bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).forEach((b, i) => {
          const g = guests.find(guest => guest.id === b.guestId);
          content += `${i+1},"${g?.name || ''}","${g?.nationality || 'Indian'}","${g?.idType || 'Aadhar'}","${g?.idNumber || ''}","${g?.arrivalFrom || ''}","${g?.nextDestination || ''}","${g?.address?.replace(/"/g, '""') || ''}","${b.checkInDate}"\n`;
        });
        break;
      case 'CHECK_IN_REPORT':
        content = "S.No,Unit,Guest Name,Phone,Nationality,Check-In Date,Check-In Time,Docs Status\n";
        bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).forEach((b, i) => {
          const g = guests.find(guest => guest.id === b.guestId);
          const r = rooms.find(rm => rm.id === b.roomId);
          content += `${i+1},"${r?.number}","${g?.name}","${g?.phone}","${g?.nationality}","${b.checkInDate}","${b.checkInTime}","${g ? getDocStatus(g) : 'N/A'}"\n`;
        });
        break;
      case 'CHECK_OUT_REPORT':
        content = "S.No,Unit,Guest Name,Phone,Nationality,Check-Out Date,Check-Out Time,Status\n";
        bookings.filter(b => b.checkOutDate >= startDate && b.checkOutDate <= endDate && b.status === 'COMPLETED').forEach((b, i) => {
          const g = guests.find(guest => guest.id === b.guestId);
          const r = rooms.find(rm => rm.id === b.roomId);
          content += `${i+1},"${r?.number}","${g?.name}","${g?.phone}","${g?.nationality}","${b.checkOutDate}","${b.checkOutTime}","COMPLETED"\n`;
        });
        break;
      case 'GUEST_REGISTER':
        content = "S.No,Room,Guest Name,Phone,Nationality,Docs Status,Check-In,Check-Out\n";
        bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).forEach((b, i) => {
          const g = guests.find(guest => guest.id === b.guestId);
          const r = rooms.find(rm => rm.id === b.roomId);
          content += `${i+1},"${r?.number}","${g?.name}","${g?.phone}","${g?.nationality}","${g ? getDocStatus(g) : 'N/A'}","${b.checkInDate}","${b.checkOutDate}"\n`;
        });
        break;
      case 'PROFIT_LOSS':
        content = "Particulars,Amount (INR)\n";
        content += `Total Revenue,${financialData.income}\n`;
        content += `Total Expense,${financialData.expense}\n`;
        content += `Net Profit/Loss,${financialData.profit}\n`;
        break;
      case 'BALANCE_SHEET':
        content = "Category,Balance (INR)\n";
        content += `Total Assets,${financialData.assets}\n`;
        content += `Total Liabilities,${financialData.liabilities}\n`;
        break;
      case 'OCCUPANCY_CHART':
        content = "Room No,Category," + dateRange.map(d => d.toLocaleDateString('en-GB')).join(",") + "\n";
        filteredRooms.forEach(room => {
          content += `${room.number},${room.type}`;
          dateRange.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const booking = bookings.find(b => 
              b.roomId === room.id && b.status !== 'CANCELLED' && dateStr >= b.checkInDate && dateStr < b.checkOutDate
            );
            const guest = booking ? guests.find(g => g.id === booking.guestId) : null;
            content += `,${booking ? (guest?.name || 'Occupied') : 'Available'}`;
          });
          content += "\n";
        });
        break;
      case 'COLLECTION':
        content = "Date,Entity,Mode,Amount\n";
        transactions.filter(t => t.type === 'RECEIPT' && t.date >= startDate && t.date <= endDate).forEach(t => {
          content += `${t.date},"${t.entityName || ''}","${t.ledger}",${t.amount}\n`;
        });
        break;
      default:
        content = "Generic Data Export";
    }
    downloadCSV(filename, content);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderHeader = (title: string) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-[6px] border-blue-900 pb-4 mb-8 no-print gap-4">
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-blue-900 uppercase tracking-tighter leading-none">{title}</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">{settings.name} Intelligence Desk</p>
      </div>
      <div className="flex flex-wrap gap-3 w-full md:w-auto">
        <div className="text-left md:text-right mr-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</p>
          <p className="text-[11px] font-black text-blue-900">{startDate} — {endDate}</p>
        </div>
        <button onClick={exportToExcel} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">Download Excel</button>
        <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">Download PDF</button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-white min-h-full flex flex-col animate-in fade-in duration-500 pb-40">
      <div className="flex gap-1 mb-8 overflow-x-auto pb-4 no-print scrollbar-hide border-b">
        {(['OCCUPANCY_CHART', 'POLICE_REPORT', 'CHECK_IN_REPORT', 'CHECK_OUT_REPORT', 'GUEST_REGISTER', 'COLLECTION', 'PROFIT_LOSS', 'BALANCE_SHEET', 'SUMMARY'] as ReportType[]).map(r => (
           <Tab key={r} active={activeReport === r} label={r.replace(/_/g, ' ')} onClick={() => setActiveReport(r)} />
        ))}
      </div>

      <div className="mb-10 p-6 bg-slate-50 rounded-3xl md:rounded-[3rem] border border-slate-200 flex flex-wrap items-center gap-6 no-print">
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase text-blue-900 tracking-tighter">Start</label>
            <input type="date" className="bg-white border-2 border-slate-200 p-3 rounded-xl font-black text-[12px] outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase text-blue-900 tracking-tighter">End</label>
            <input type="date" className="bg-white border-2 border-slate-200 p-3 rounded-xl font-black text-[12px] outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase text-blue-900 tracking-tighter">Category</label>
            <select className="border-2 border-slate-200 p-3 rounded-xl font-black text-[12px] bg-white outline-none min-w-[150px]" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
               <option value="All">All Rooms</option>
               {settings.roomTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="bg-blue-900 text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase shadow-lg ml-auto">Sync Report</button>
      </div>

      <div className="report-content flex-1">
        {activeReport === 'POLICE_REPORT' && (
          <div className="space-y-4">
             {renderHeader("Mandatory Form-C Police Register")}
             <div className="border rounded-[2.5rem] overflow-x-auto bg-white shadow-sm overflow-hidden">
                <table className="w-full text-[10px] text-left border-collapse min-w-[1500px]">
                   <thead className="bg-slate-900 text-white font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-4">S.No</th>
                        <th className="p-4">Guest Name</th>
                        <th className="p-4">Nationality</th>
                        <th className="p-4">ID Type</th>
                        <th className="p-4">ID Details</th>
                        <th className="p-4">Arrival Date</th>
                        <th className="p-4">Address</th>
                        <th className="p-4">From</th>
                        <th className="p-4">To</th>
                        <th className="p-4">Docs</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase text-gray-700">
                      {bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).map((b, i) => {
                         const g = guests.find(guest => guest.id === b.guestId);
                         return (
                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                               <td className="p-4">{i+1}</td>
                               <td className="p-4 font-black text-blue-900">{g?.name}</td>
                               <td className="p-4">{g?.nationality || 'Indian'}</td>
                               <td className="p-4">{g?.idType || 'Aadhar'}</td>
                               <td className="p-4">{g?.idNumber}</td>
                               <td className="p-4">{b.checkInDate}</td>
                               <td className="p-4 max-w-xs truncate">{g?.address}</td>
                               <td className="p-4">{g?.arrivalFrom || 'Direct'}</td>
                               <td className="p-4">{g?.nextDestination || 'Unknown'}</td>
                               <td className="p-4 font-black text-[8px]">{g ? getDocStatus(g) : '-'}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeReport === 'CHECK_IN_REPORT' && (
          <div className="space-y-4">
             {renderHeader("Detailed Check-In Registry")}
             <div className="border rounded-[2.5rem] overflow-x-auto bg-white shadow-sm overflow-hidden">
                <table className="w-full text-[10px] text-left border-collapse min-w-[1300px]">
                   <thead className="bg-blue-600 text-white font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-4">Unit</th>
                        <th className="p-4">Guest Name</th>
                        <th className="p-4">Phone</th>
                        <th className="p-4">Nationality</th>
                        <th className="p-4">Check-In</th>
                        <th className="p-4">Time</th>
                        <th className="p-4">Docs Status</th>
                        <th className="p-4">Reference</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase text-gray-700">
                      {bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).map((b) => {
                         const g = guests.find(guest => guest.id === b.guestId);
                         const r = rooms.find(rm => rm.id === b.roomId);
                         const docStat = g ? getDocStatus(g) : 'MISSING';
                         return (
                            <tr key={b.id} className="hover:bg-blue-50/20 transition-colors">
                               <td className="p-4 font-black text-blue-600">#{r?.number}</td>
                               <td className="p-4">{g?.name}</td>
                               <td className="p-4">{g?.phone}</td>
                               <td className="p-4">{g?.nationality}</td>
                               <td className="p-4">{b.checkInDate}</td>
                               <td className="p-4">{b.checkInTime}</td>
                               <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${docStat === 'MISSING' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{docStat}</span>
                               </td>
                               <td className="p-4 text-slate-400">#{b.bookingNo.slice(-6)}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeReport === 'CHECK_OUT_REPORT' && (
          <div className="space-y-4">
             {renderHeader("Detailed Check-Out Register")}
             <div className="border rounded-[2.5rem] overflow-x-auto bg-white shadow-sm overflow-hidden">
                <table className="w-full text-[10px] text-left border-collapse min-w-[1300px]">
                   <thead className="bg-red-600 text-white font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-4">Unit</th>
                        <th className="p-4">Guest Name</th>
                        <th className="p-4">Phone</th>
                        <th className="p-4">Nationality</th>
                        <th className="p-4">Check-Out</th>
                        <th className="p-4">Time</th>
                        <th className="p-4">Total Paid</th>
                        <th className="p-4">Bill Ref</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase text-gray-700">
                      {bookings.filter(b => b.checkOutDate >= startDate && b.checkOutDate <= endDate && b.status === 'COMPLETED').map((b) => {
                         const g = guests.find(guest => guest.id === b.guestId);
                         const r = rooms.find(rm => rm.id === b.roomId);
                         const paidAmt = (b.payments || []).reduce((s, p) => s + p.amount, 0);
                         return (
                            <tr key={b.id} className="hover:bg-red-50/20 transition-colors">
                               <td className="p-4 font-black text-red-600">#{r?.number}</td>
                               <td className="p-4">{g?.name}</td>
                               <td className="p-4">{g?.phone}</td>
                               <td className="p-4">{g?.nationality}</td>
                               <td className="p-4">{b.checkOutDate}</td>
                               <td className="p-4">{b.checkOutTime}</td>
                               <td className="p-4 font-black">₹{paidAmt.toFixed(2)}</td>
                               <td className="p-4 text-slate-400">#{b.bookingNo.slice(-6)}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeReport === 'PROFIT_LOSS' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-8">
             {renderHeader("Profit & Loss Analysis")}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-white border-2 rounded-[3rem] p-10 space-y-8 shadow-sm">
                   <h3 className="text-xl font-black text-green-700 border-b pb-4 uppercase">Operational Revenue</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm font-bold uppercase text-slate-500">
                         <span>Direct Receipts</span>
                         <span className="text-green-600">₹{financialData.income.toFixed(2)}</span>
                      </div>
                      <div className="pt-6 border-t flex justify-between items-center text-lg font-black text-green-900">
                         <span>TOTAL INCOME</span>
                         <span>₹{financialData.income.toFixed(2)}</span>
                      </div>
                   </div>
                </div>
                <div className="bg-white border-2 rounded-[3rem] p-10 space-y-8 shadow-sm">
                   <h3 className="text-xl font-black text-red-600 border-b pb-4 uppercase">Direct Expenses</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm font-bold uppercase text-slate-500">
                         <span>Vendor Payments</span>
                         <span className="text-red-500">₹{financialData.expense.toFixed(2)}</span>
                      </div>
                      <div className="pt-6 border-t flex justify-between items-center text-lg font-black text-red-900">
                         <span>TOTAL EXPENSE</span>
                         <span>₹{financialData.expense.toFixed(2)}</span>
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-blue-900 p-12 rounded-[4rem] text-white flex justify-between items-center shadow-2xl">
                <div>
                   <p className="text-xs font-black uppercase text-blue-300 tracking-widest mb-1">Net Performance Result</p>
                   <h4 className="text-4xl md:text-5xl font-black tracking-tighter">₹{financialData.profit.toFixed(2)}</h4>
                </div>
                <div className="text-right">
                   <span className={`px-6 py-2 rounded-full font-black uppercase text-xs ${financialData.profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                      {financialData.profit >= 0 ? 'Net Surplus' : 'Net Deficit'}
                   </span>
                </div>
             </div>
          </div>
        )}

        {activeReport === 'BALANCE_SHEET' && (
          <div className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-8">
             {renderHeader("Global Financial Balance Sheet")}
             <div className="grid grid-cols-2 gap-0 border-4 border-slate-900 rounded-[3rem] overflow-hidden shadow-2xl bg-white">
                <div className="p-10 border-r-2 border-slate-200 space-y-8">
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight border-b-4 border-slate-100 pb-4">Liabilities</h3>
                   <div className="space-y-4 min-h-[300px]">
                      <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                         <span>Capital Account</span>
                         <span className="font-black">₹{financialData.liabilities.toFixed(2)}</span>
                      </div>
                   </div>
                   <div className="pt-6 border-t-4 border-slate-900 flex justify-between text-xl font-black text-slate-900">
                      <span>TOTAL EQUITY/LIAB.</span>
                      <span>₹{financialData.liabilities.toFixed(2)}</span>
                   </div>
                </div>
                <div className="p-10 space-y-8">
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight border-b-4 border-slate-100 pb-4">Assets</h3>
                   <div className="space-y-4 min-h-[300px]">
                      <div className="flex justify-between text-sm font-bold uppercase text-slate-500">
                         <span>Cash & Property</span>
                         <span className="font-black">₹{financialData.assets.toFixed(2)}</span>
                      </div>
                   </div>
                   <div className="pt-6 border-t-4 border-slate-900 flex justify-between text-xl font-black text-slate-900">
                      <span>TOTAL ASSETS</span>
                      <span>₹{financialData.assets.toFixed(2)}</span>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeReport === 'OCCUPANCY_CHART' && (
          <div className="h-full flex flex-col space-y-4">
            {renderHeader("Real-time Inventory Forecast")}
            <div className="flex-1 border-2 border-slate-100 rounded-[3rem] overflow-auto custom-scrollbar shadow-inner bg-white">
               <table className="w-full border-collapse table-fixed min-w-[1600px]">
                  <thead className="sticky top-0 z-20">
                     <tr className="bg-blue-900 text-white text-[10px] font-black uppercase">
                        <th className="p-6 w-40 bg-blue-900 sticky left-0 z-30 border-r border-blue-800 shadow-xl">Unit ID</th>
                        {dateRange.map((date, idx) => {
                          const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                          return (
                            <th key={idx} className={`p-4 text-center border-r border-blue-800 ${isToday ? 'bg-blue-600' : 'bg-blue-900'}`}>
                               <div className="tracking-tighter">{date.getDate()}/{date.getMonth()+1}</div>
                               <div className="opacity-50 text-[8px] mt-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            </th>
                          );
                        })}
                     </tr>
                  </thead>
                  <tbody className="text-[11px] font-bold text-gray-700 uppercase">
                     {filteredRooms.map(room => (
                        <tr key={room.id} className="border-b border-slate-50 hover:bg-slate-50 h-20">
                           <td className="p-4 bg-slate-50 sticky left-0 z-10 border-r shadow-sm font-black text-center leading-tight">
                              <div className="text-blue-900 text-sm tracking-tighter">{room.number}</div>
                              <div className="text-[8px] opacity-40 mt-1">{room.type.slice(0, 8)}</div>
                           </td>
                           {dateRange.map((date, idx) => {
                             const dateStr = date.toISOString().split('T')[0];
                             const b = bookings.find(b => b.roomId === room.id && b.status !== 'CANCELLED' && dateStr >= b.checkInDate && dateStr < b.checkOutDate);
                             const g = b ? guests.find(g => g.id === b.guestId) : null;
                             
                             return (
                               <td key={idx} className="border-r border-slate-50 p-1 relative">
                                  {b ? (
                                    <div className={`absolute inset-0 m-1.5 rounded-xl flex flex-col items-center justify-center text-[8px] font-black leading-tight truncate px-1 shadow-sm border-l-4 ${b.status === 'RESERVED' ? 'bg-orange-50 border-orange-500 text-orange-900' : 'bg-blue-50 border-blue-500 text-blue-900'}`}>
                                       <span>{g?.name || 'OCCUPIED'}</span>
                                       {g && (
                                         <div className="flex gap-1 mt-1">
                                            {g.documents?.photo ? <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Photo Uploaded"></div> : <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Photo Missing"></div>}
                                            {g.documents?.aadharFront || g.documents?.passportFront ? <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="ID Uploaded"></div> : <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="ID Missing"></div>}
                                         </div>
                                       )}
                                    </div>
                                  ) : null}
                               </td>
                             );
                           })}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeReport === 'GUEST_REGISTER' && (
          <div className="space-y-6">
            {renderHeader(`Daily Guest Movement Index`)}
            <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl bg-white">
              <table className="w-full text-[10px] md:text-[11px] border-collapse min-w-[1200px]">
                <thead className="bg-blue-900 text-white uppercase font-black tracking-widest">
                  <tr>
                    <th className="p-6 text-left">Unit</th>
                    <th className="p-6 text-left">Guest / Billing Entity</th>
                    <th className="p-6 text-left">Nationality</th>
                    <th className="p-6 text-left">Docs Status</th>
                    <th className="p-6 text-left">Check-In</th>
                    <th className="p-6 text-left">Check-Out</th>
                    <th className="p-6 text-right">Bill Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-black uppercase font-bold">
                  {bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).map(b => {
                    const g = guests.find(guest => guest.id === b.guestId);
                    const r = rooms.find(rm => rm.id === b.roomId);
                    const docStatus = g ? getDocStatus(g) : 'N/A';
                    return (
                      <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-6 text-blue-900 font-black">#{r?.number}</td>
                        <td className="p-6">
                           <div>{g?.name}</div>
                           <div className="text-[8px] opacity-40">{g?.phone}</div>
                        </td>
                        <td className="p-6">{g?.nationality || 'Indian'}</td>
                        <td className="p-6">
                           <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${docStatus !== 'MISSING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {docStatus}
                           </span>
                        </td>
                        <td className="p-6 text-slate-400">{b.checkInDate}</td>
                        <td className="p-6 text-slate-400">{b.checkOutDate}</td>
                        <td className="p-6 text-right font-black text-slate-300">#{b.bookingNo.slice(-6)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'COLLECTION' && (
          <div className="space-y-6">
            {renderHeader(`Finance Collection Index`)}
            <div className="border-2 border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl bg-white">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-green-700 text-white uppercase font-black tracking-widest">
                  <tr><th className="p-6 text-left">Posting Date</th><th className="p-6 text-left">Entity / Source</th><th className="p-6 text-left">Account</th><th className="p-6 text-right">Amount (INR)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-black uppercase font-bold">
                  {transactions.filter(t => t.type === 'RECEIPT' && t.date >= startDate && t.date <= endDate).map(t => (
                    <tr key={t.id} className="hover:bg-green-50/30 transition-colors">
                      <td className="p-6 text-slate-400">{t.date}</td>
                      <td className="p-6 text-slate-900">{t.entityName || 'General Reception'}</td>
                      <td className="p-6 text-blue-900">{t.ledger}</td>
                      <td className="p-6 text-right font-black text-green-700 text-base">₹{t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'SUMMARY' && (
          <div className="space-y-12">
            {renderHeader(`Property Performance Index`)}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <SummaryCard label="Total Inflow" value={`₹${financialData.income.toFixed(2)}`} color="bg-green-600" />
              <SummaryCard label="Net Check-Ins" value={bookings.filter(b => b.checkInDate >= startDate && b.checkInDate <= endDate).length} color="bg-blue-600" />
              <SummaryCard label="Completed Stays" value={bookings.filter(b => b.checkOutDate >= startDate && b.checkOutDate <= endDate && b.status === 'COMPLETED').length} color="bg-orange-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Tab: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-6 md:px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0 ${active ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-slate-400 border-white hover:border-blue-100'}`}>{label}</button>
);

const SummaryCard = ({ label, value, color }: any) => (
  <div className={`${color} p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group`}>
    <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.3em] mb-4">{label}</p>
    <p className="text-4xl md:text-5xl font-black tracking-tighter">{value}</p>
    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
  </div>
);

export default Reports;
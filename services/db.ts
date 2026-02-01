
import { Dexie, type Table } from 'dexie';
import { 
  Room, Guest, Booking, Transaction, RoomShiftLog, CleaningLog, Quotation, HostelSettings, GroupProfile, Supervisor,
  BanquetHall, EventBooking, RestaurantOutlet, MenuItem, DiningTable, KOT, InventoryItem, Vendor, FacilityUsage, TravelBooking, StockReceipt, DiningBill, CateringItem, PayrollRecord, LeaveRequest
} from '../types';
import { pushToCloud, removeFromCloud } from './supabase';

export class HotelSphereDB extends Dexie {
  rooms!: Table<Room>;
  guests!: Table<Guest>;
  bookings!: Table<Booking>;
  transactions!: Table<Transaction>;
  shiftLogs!: Table<RoomShiftLog>;
  cleaningLogs!: Table<CleaningLog>;
  quotations!: Table<Quotation>;
  settings!: Table<HostelSettings & { id: string }>;
  groups!: Table<GroupProfile>;
  supervisors!: Table<Supervisor>;
  payroll!: Table<PayrollRecord>;
  leaveRequests!: Table<LeaveRequest>;
  
  banquetHalls!: Table<BanquetHall>;
  eventBookings!: Table<EventBooking>;
  cateringMenu!: Table<CateringItem>;
  restaurants!: Table<RestaurantOutlet>;
  menuItems!: Table<MenuItem>;
  diningTables!: Table<DiningTable>;
  kots!: Table<KOT>;
  diningBills!: Table<DiningBill>;
  inventory!: Table<InventoryItem>;
  vendors!: Table<Vendor>;
  facilityUsage!: Table<FacilityUsage>;
  travelBookings!: Table<TravelBooking>;
  stockReceipts!: Table<StockReceipt>;

  constructor() {
    super('HotelSphereDB');
    this.version(9).stores({
      rooms: 'id, number, status, type',
      guests: 'id, name, phone, email',
      bookings: 'id, bookingNo, roomId, guestId, status, checkInDate, checkOutDate, groupId',
      transactions: 'id, date, type, ledger, accountGroup',
      shiftLogs: 'id, date, bookingId',
      cleaningLogs: 'id, date, roomId',
      quotations: 'id, date, guestName',
      settings: 'id',
      groups: 'id, groupName, headName, status',
      supervisors: 'id, loginId, name, status',
      payroll: 'id, staffId, month',
      leaveRequests: 'id, staffId, status',
      banquetHalls: 'id, name',
      eventBookings: 'id, date, hallId, guestId, status',
      cateringMenu: 'id, name, category',
      restaurants: 'id, name',
      menuItems: 'id, name, outletId, category',
      diningTables: 'id, number, outletId, status',
      kots: 'id, tableId, outletId, status',
      diningBills: 'id, billNo, date, guestPhone, roomBookingId',
      inventory: 'id, name, category',
      vendors: 'id, name, category',
      facilityUsage: 'id, facilityId, guestId',
      travelBookings: 'id, guestId, status, date',
      stockReceipts: 'id, date, itemId, vendorId'
    });

    const tablesToSync = [
      'rooms', 'guests', 'bookings', 'transactions', 'groups', 'supervisors', 'payroll', 'leaveRequests',
      'banquetHalls', 'eventBookings', 'cateringMenu', 'restaurants', 
      'menuItems', 'diningTables', 'kots', 'diningBills', 'inventory', 
      'vendors', 'facilityUsage', 'travelBookings', 'stockReceipts', 'settings'
    ];

    tablesToSync.forEach(tableName => {
      const table = (this as any)[tableName];
      if (!table) return;

      table.hook('creating', (primKey: any, obj: any) => {
        if (!obj.id && !primKey) return undefined;
        setTimeout(() => pushToCloud(tableName, obj), 100);
      });

      table.hook('updating', (mods: any, primKey: any, obj: any) => {
        const merged = { ...obj, ...mods };
        if (!merged.id) return undefined;
        setTimeout(() => pushToCloud(tableName, merged), 100);
      });

      table.hook('deleting', (primKey: any) => {
        setTimeout(() => removeFromCloud(tableName, primKey), 100);
      });
    });
  }
}

export const db = new HotelSphereDB();

export async function exportDatabase() {
  const tables = ['rooms', 'guests', 'bookings', 'transactions', 'settings', 'groups', 'supervisors', 'payroll', 'leaveRequests', 'banquetHalls', 'eventBookings', 'cateringMenu', 'restaurants', 'menuItems', 'diningTables', 'kots', 'diningBills', 'inventory', 'vendors', 'facilityUsage', 'travelBookings', 'stockReceipts'];
  const data: any = {};
  for (const t of tables) {
    data[t] = await (db as any)[t].toArray();
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hotelsphere_pro_full_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

export async function importDatabase(jsonFile: File) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const tables = Object.keys(data);
        await (db as any).transaction('rw', tables.map(t => (db as any)[t]), async () => {
          for (const t of tables) {
            if ((db as any)[t]) {
              await (db as any)[t].clear();
              await (db as any)[t].bulkPut(data[t].filter((item: any) => item.id));
            }
          }
        });
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(jsonFile);
  });
}

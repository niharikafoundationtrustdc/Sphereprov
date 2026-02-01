
import { RoomStatus, Room } from './types';

export const STATUS_COLORS: Record<RoomStatus, string> = {
  [RoomStatus.VACANT]: 'bg-white border-slate-200 text-slate-900 shadow-sm',
  [RoomStatus.OCCUPIED]: 'bg-indigo-50/50 border-indigo-500 text-indigo-900 shadow-sm',
  [RoomStatus.RESERVED]: 'bg-orange-50/50 border-orange-400 text-orange-900 shadow-sm',
  [RoomStatus.DIRTY]: 'bg-rose-50/50 border-rose-400 text-rose-900 shadow-sm',
  [RoomStatus.REPAIR]: 'bg-slate-100 border-slate-400 text-slate-500 shadow-sm', 
  [RoomStatus.MANAGEMENT]: 'bg-violet-50 border-violet-400 text-violet-900 shadow-sm',
  [RoomStatus.STAFF_BLOCK]: 'bg-slate-800 border-slate-900 text-white shadow-sm',
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", 
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi"
];

const generateAyodhyaRooms = (): Room[] => {
  const rooms: Room[] = [];
  const block = 'Ayodhya';
  
  const deluxe = [
    '101','102','103','104','105','106',
    '211','212','214','215','216',
    '311','312','314','315','316','317','318','319','320',
    '321','322','323','324','325','326','327','328','329','330','331','332'
  ];
  const premium = ['202','204','205','206','207','208','302','304','305','306','307','308'];
  const superPremium = ['203','210','303','310'];
  const suite = ['201','209','301','309'];

  const add = (nums: string[], type: string, price: number) => {
    nums.forEach(n => {
      rooms.push({
        id: `A-${n}`,
        number: n,
        floor: `${n[0]}st Floor`,
        type: type,
        price: price,
        status: RoomStatus.VACANT,
        block: block,
        bedType: 'Double Bed'
      });
    });
  };

  add(deluxe, 'DELUXE ROOM', 2200);
  add(premium, 'PREMIUM ROOM', 2700);
  add(superPremium, 'SUPER PREMIUM ROOM', 3200);
  add(suite, 'SUITE ROOM', 3600);

  return rooms;
};

const generateMithilaRooms = (): Room[] => {
  const rooms: Room[] = [];
  const block = 'Mithila';

  const deluxe = ['201','202','203','204','301','302','303','304','401','402','403','404'];
  const premium = ['101','102','205','305','405'];
  const superDeluxe = ['306','307','308','309','310','311','406','407','408','409','410','411'];

  const add = (nums: string[], type: string, price: number) => {
    nums.forEach(n => {
      rooms.push({
        id: `M-${n}`,
        number: n,
        floor: `${n[0]}st Floor`,
        type: type,
        price: price,
        status: RoomStatus.VACANT,
        block: block,
        bedType: 'Double Bed'
      });
    });
  };

  add(deluxe, 'DELUXE ROOM', 2200);
  add(premium, 'PREMIUM ROOM', 2700);
  add(superDeluxe, 'SUPER DELUXE ROOM', 2400);

  return rooms;
};

export const INITIAL_ROOMS: Room[] = [
  ...generateAyodhyaRooms(),
  ...generateMithilaRooms()
];

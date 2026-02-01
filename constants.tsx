
import { RoomStatus, Room } from './types';

export const STATUS_COLORS: Record<RoomStatus, string> = {
  [RoomStatus.VACANT]: 'bg-white border-slate-200 text-slate-900 shadow-sm',
  [RoomStatus.OCCUPIED]: 'bg-indigo-50/50 border-indigo-500 text-indigo-900 shadow-sm',
  [RoomStatus.RESERVED]: 'bg-orange-50/50 border-orange-400 text-orange-900 shadow-sm',
  [RoomStatus.DIRTY]: 'bg-rose-50/50 border-rose-400 text-rose-900 shadow-sm',
  [RoomStatus.REPAIR]: 'bg-[#5c2d0a]/10 border-[#5c2d0a] text-[#5c2d0a] shadow-sm', 
  [RoomStatus.MANAGEMENT]: 'bg-violet-50 border-violet-400 text-violet-900 shadow-sm',
  [RoomStatus.STAFF_BLOCK]: 'bg-slate-800 border-slate-900 text-white shadow-sm',
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", 
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const generateBlockRooms = (prefix: string, blockName: string): Room[] => {
  const rooms: Room[] = [];

  const deluxeNumbers = [
    '101','102','103','104','105','106', 
    '211','212','214','215','216',
    '311','312','314','315','316','317','318','319','320', 
    '321','322','323','324','325','326','327','328','329','330','331','332'
  ];
  const premiumNumbers = ['202','204','205','206','207','208','302','304','305','306','307','308'];
  const superPremiumNumbers = ['203','210','303','310'];
  const suiteNumbers = ['201','209','301','309'];

  const add = (nums: string[], type: string, price: number) => {
    nums.forEach(n => {
      rooms.push({
        id: `${prefix}${n}`,
        number: `${prefix}${n}`,
        floor: n[0],
        type: type,
        price: price,
        status: RoomStatus.VACANT,
        block: blockName,
        bedType: 'Double Bed' // Defaulting initial rooms to Double Bed as per standard resort profile
      });
    });
  };

  add(deluxeNumbers, 'DELUXE ROOM', 2900);
  add(premiumNumbers, 'PREMIUM ROOM', 3500);
  add(superPremiumNumbers, 'SUPER PREMIUM ROOM', 4500);
  add(suiteNumbers, 'SUITE ROOM', 6500);

  return rooms;
};

export const INITIAL_ROOMS: Room[] = [
  ...generateBlockRooms('A', 'Ayodhya'),
  ...generateBlockRooms('M', 'Mithila')
];

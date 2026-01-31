
export enum RoomStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DIRTY = 'DIRTY',
  REPAIR = 'REPAIR',
  MANAGEMENT = 'MANAGEMENT',
  STAFF_BLOCK = 'STAFF_BLOCK'
}

export enum RoomType {
  DELUXE = 'DELUXE ROOM',
  BUDGET = 'BUDGET ROOM',
  STANDARD = 'STANDARD ROOM',
  AC_FAMILY = 'AC FAMILY ROOM',
  SUITE = 'SUITE'
}

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'SUPERVISOR' | 'WAITER' | 'CHEF' | 'STOREKEEPER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password?: string;
}

export interface Supervisor {
  id: string;
  name: string;
  loginId: string;
  password?: string;
  role: UserRole;
  assignedRoomIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
  lastActive?: string;
  baseSalary?: number;
  phone?: string;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  month: string; // e.g., "2023-10"
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'PENDING' | 'PAID';
  paymentDate?: string;
  paymentMethod?: string;
}

export interface Occupant {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  idFront?: string;
  idBack?: string;
}

export interface Guest {
  id: string;
  name: string; 
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  nationality: string;
  idType: 'Aadhar' | 'Passport' | 'PAN' | 'VoterId' | 'License' | 'Other';
  idNumber: string;
  adults: number;
  children: number;
  kids: number;
  others: number;
  documents: any;
  arrivalFrom?: string;
  nextDestination?: string;
  purposeOfVisit?: string;
  remarks?: string;
  surName?: string;
  givenName?: string;
  dob?: string;
  country?: string;
  gender?: 'Male' | 'Female' | 'Other';
  passportNo?: string;
  passportPlaceOfIssue?: string;
  passportDateOfIssue?: string;
  passportDateOfExpiry?: string;
  visaNo?: string;
  visaType?: string;
  visaPlaceOfIssue?: string;
  visaDateOfIssue?: string;
  visaDateOfExpiry?: string;
}

export interface BanquetHall {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  type: 'HALL' | 'LAWN';
}

export type EventType = 'Corporate' | 'Marriage' | 'Ceremony' | 'Birthday' | 'Social' | 'Other';

export interface CateringIngredient {
  name: string;
  qtyPerPlate: number;
  unit: string;
}

export interface CateringItem {
  id: string;
  name: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Beverage';
  pricePerPlate: number;
  prepInstructions?: string;
  ingredients?: CateringIngredient[];
}

export interface EventCatering {
  items: { itemId: string; name: string; qty: number; price: number }[];
  plateCount: number;
  totalCateringCharge: number;
}

export interface EventBooking {
  id: string;
  hallId: string;
  guestName: string;
  guestPhone: string;
  eventName: string;
  eventType: EventType;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  advancePaid: number;
  discount: number;
  paymentMode: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | 'COMPLETED' | 'SETTLED';
  catering?: EventCatering;
  guestCount: number;
  decorationCharge: number;
  lightingCharge: number;
  musicCharge: number;
  otherCharges: number;
}

export interface RestaurantOutlet {
  id: string;
  name: string;
  type: 'FineDine' | 'Cafe' | 'Bar' | 'Buffet';
}

export type DietaryType = 'VEG' | 'NON-VEG' | 'EGG';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  outletId: string;
  isAvailable: boolean;
  ingredients?: string;
  dietaryType: DietaryType;
  isVegan: boolean;
  containsMilk: boolean;
}

export interface DiningTable {
  id: string;
  number: string;
  outletId: string;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED';
}

export interface KOTItem {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface KOT {
  id: string;
  tableId: string;
  outletId: string;
  waiterId: string;
  items: KOTItem[];
  status: 'PENDING' | 'PREPARING' | 'SERVED';
  timestamp: string;
  bookingId?: string;
  paymentMethod?: string;
}

export interface DiningBill {
  id: string;
  billNo: string;
  date: string;
  outletId: string;
  tableNumber: string;
  items: (KOTItem & { name: string, price: number })[];
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: string;
  guestName: string;
  guestPhone: string;
  roomBookingId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  lastPurchasePrice: number;
}

export interface StockReceipt {
  id: string;
  itemId: string;
  vendorId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMade: number;
  paymentMode: string;
  date: string;
  billNumber: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  gstin?: string;
  category: string;
}

export interface Facility {
  id: string;
  name: string;
  pricePerHour: number;
}

export interface FacilityUsage {
  id: string;
  facilityId: 'GYM' | 'POOL' | 'LAUNDRY';
  guestId: string;
  startTime: string;
  endTime?: string;
  amount: number;
  isBilledToRoom: boolean;
  outsiderInfo?: {
    name: string;
    phone: string;
    email: string;
  };
  items?: { name: string, qty: number, price: number }[];
}

export interface TravelBooking {
  id: string;
  guestId: string;
  guestName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  pickupLocation: string;
  dropLocation: string;
  date: string;
  time: string;
  kmUsed: number;
  daysOfTravelling: number;
  amount: number;
  status: 'BOOKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  roomBookingId?: string;
}

export interface Booking {
  id: string;
  bookingNo: string;
  roomId: string;
  guestId: string;
  groupId?: string; 
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'RESERVED';
  charges: Charge[];
  payments: Payment[];
  basePrice: number;
  discount: number;
  mealPlan?: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  block?: string;
  type: string;
  bedType?: 'Single' | 'Double';
  price: number;
  status: RoomStatus;
  currentBookingId?: string;
}

export interface Charge {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  remarks: string;
}

export type TransactionType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';

export type AccountGroupName = 
  | 'Capital' 
  | 'Fixed Asset' 
  | 'Current Asset' 
  | 'Direct Expense' 
  | 'Indirect Expense' 
  | 'Direct Income' 
  | 'Indirect Income' 
  | 'Current Liability' 
  | 'Operating';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  accountGroup: AccountGroupName;
  ledger: string;
  amount: number;
  entityName?: string;
  description: string;
  referenceId?: string;
}

export interface AgentConfig {
  name: string;
  commission: number;
}

export interface HostelSettings {
  name: string;
  address: string;
  agents: AgentConfig[];
  roomTypes: string[];
  mealPlans?: string[];
  blocks?: string[];
  floors?: number[];
  gstNumber?: string;
  taxRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  hsnCode?: string;
  upiId?: string;
  adminPassword?: string;
  receptionistPassword?: string;
  accountantPassword?: string;
  supervisorPassword?: string;
  logo?: string;
  signature?: string;
  wifiPassword?: string;
  receptionPhone?: string;
  roomServicePhone?: string;
  restaurantMenuLink?: string;
}

export interface GroupProfile {
  id: string;
  groupName: string;
  phone: string;
  email: string;
  headName: string;
  status: string;
  billingPreference: string;
  groupType?: string;
  orgName?: string;
}

export interface RoomShiftLog { id: string; }
export interface CleaningLog { id: string; }
export interface Quotation { id: string; }

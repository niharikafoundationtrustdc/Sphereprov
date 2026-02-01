
-- HOTEL SPHERE PRO: COMPREHENSIVE MASTER DATABASE SETUP
-- VERSION: 5.3.0
-- TARGET: SUPABASE POSTGRESQL

-- 1. PROPERTY BLUEPRINT
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    floor TEXT NOT NULL DEFAULT '1',
    block TEXT DEFAULT 'Main',
    type TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'VACANT',
    "currentBookingId" TEXT,
    "bedType" TEXT DEFAULT 'Double Bed'
);

CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    nationality TEXT DEFAULT 'Indian',
    "idType" TEXT DEFAULT 'Aadhar',
    "idNumber" TEXT,
    adults INT DEFAULT 1,
    children INT DEFAULT 0,
    kids INT DEFAULT 0,
    others INT DEFAULT 0,
    documents JSONB DEFAULT '{}'::jsonb,
    "arrivalFrom" TEXT,
    "nextDestination" TEXT,
    "purposeOfVisit" TEXT,
    remarks TEXT,
    "surName" TEXT,
    "givenName" TEXT,
    dob TEXT,
    country TEXT,
    gender TEXT,
    "passportNo" TEXT,
    "passportPlaceOfIssue" TEXT,
    "passportDateOfIssue" TEXT,
    "passportDateOfExpiry" TEXT,
    "visaNo" TEXT,
    "visaType" TEXT,
    "visaPlaceOfIssue" TEXT,
    "visaDateOfIssue" TEXT,
    "visaDateOfExpiry" TEXT
);

-- 2. OPERATIONAL FLOW
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    "bookingNo" TEXT NOT NULL,
    "roomId" TEXT NOT NULL REFERENCES rooms(id),
    "guestId" TEXT NOT NULL REFERENCES guests(id),
    "groupId" TEXT,
    "checkInDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "checkInTime" TIME NOT NULL DEFAULT CURRENT_TIME,
    "checkOutDate" DATE NOT NULL,
    "checkOutTime" TIME DEFAULT '11:00',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    charges JSONB DEFAULT '[]'::jsonb,
    payments JSONB DEFAULT '[]'::jsonb,
    "basePrice" NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    "mealPlan" TEXT DEFAULT 'EP (Room Only)',
    "secondaryGuest" JSONB,
    purpose TEXT
);

-- 3. HUMAN RESOURCES & PAYROLL
CREATE TABLE IF NOT EXISTS supervisors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "loginId" TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT 'admin',
    role TEXT DEFAULT 'RECEPTIONIST',
    "assignedRoomIds" JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'ACTIVE',
    photo TEXT,
    phone TEXT,
    "basicPay" NUMERIC DEFAULT 0,
    hra NUMERIC DEFAULT 0,
    "vehicleAllowance" NUMERIC DEFAULT 0,
    "otherAllowances" NUMERIC DEFAULT 0,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "uanNumber" TEXT
);

CREATE TABLE IF NOT EXISTS payroll (
    id TEXT PRIMARY KEY,
    "staffId" TEXT REFERENCES supervisors(id),
    month TEXT NOT NULL,
    "daysInMonth" INT DEFAULT 30,
    "workedDays" NUMERIC DEFAULT 30,
    "lopDays" NUMERIC DEFAULT 0,
    "basicPay" NUMERIC DEFAULT 0,
    hra NUMERIC DEFAULT 0,
    "vehicleAllowance" NUMERIC DEFAULT 0,
    "otherAllowances" NUMERIC DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    "grossEarnings" NUMERIC DEFAULT 0,
    "epfEmployee" NUMERIC DEFAULT 0,
    "esiEmployee" NUMERIC DEFAULT 0,
    tds NUMERIC DEFAULT 0,
    "loanRecovery" NUMERIC DEFAULT 0,
    "otherDeductions" NUMERIC DEFAULT 0,
    "totalDeductions" NUMERIC DEFAULT 0,
    "epfEmployer" NUMERIC DEFAULT 0,
    "esiEmployer" NUMERIC DEFAULT 0,
    "netSalary" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP WITH TIME ZONE,
    "paymentMethod" TEXT
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    "staffId" TEXT REFERENCES supervisors(id),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    type TEXT DEFAULT 'CL',
    reason TEXT,
    status TEXT DEFAULT 'PENDING'
);

-- 4. FINANCIAL LEDGERS
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL,
    "accountGroup" TEXT NOT NULL,
    ledger TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    "entityName" TEXT,
    description TEXT,
    "referenceId" TEXT
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    "groupName" TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    "headName" TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    "billingPreference" TEXT DEFAULT 'Single',
    "groupType" TEXT,
    "orgName" TEXT,
    documents JSONB DEFAULT '{}'::jsonb
);

-- 5. BANQUETS & CATERING
CREATE TABLE IF NOT EXISTS banquet_halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INT DEFAULT 100,
    "basePrice" NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'HALL'
);

CREATE TABLE IF NOT EXISTS event_bookings (
    id TEXT PRIMARY KEY,
    "hallId" TEXT REFERENCES banquet_halls(id),
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT,
    date DATE NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "totalAmount" NUMERIC DEFAULT 0,
    "advancePaid" NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    "paymentMode" TEXT DEFAULT 'Cash',
    status TEXT DEFAULT 'TENTATIVE',
    catering JSONB,
    "guestCount" INT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS catering_menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    "pricePerPlate" NUMERIC DEFAULT 0,
    ingredients JSONB DEFAULT '[]'::jsonb
);

-- 6. DINING POS
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'FineDine'
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    "outletId" TEXT REFERENCES restaurants(id),
    "isAvailable" BOOLEAN DEFAULT TRUE,
    "dietaryType" TEXT DEFAULT 'VEG'
);

CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    "outletId" TEXT REFERENCES restaurants(id),
    status TEXT DEFAULT 'VACANT'
);

CREATE TABLE IF NOT EXISTS kots (
    id TEXT PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "waiterId" TEXT,
    items JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT
);

CREATE TABLE IF NOT EXISTS dining_bills (
    id TEXT PRIMARY KEY,
    "billNo" TEXT NOT NULL UNIQUE,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "outletId" TEXT,
    "tableNumber" TEXT,
    items JSONB,
    "subTotal" NUMERIC,
    "taxAmount" NUMERIC,
    "grandTotal" NUMERIC,
    "paymentMode" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "roomBookingId" TEXT
);

-- 7. INVENTORY & LOGISTICS
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Housekeeping',
    unit TEXT DEFAULT 'Unit',
    "currentStock" NUMERIC DEFAULT 0,
    "minStockLevel" NUMERIC DEFAULT 5,
    "lastPurchasePrice" NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    gstin TEXT,
    category TEXT
);

CREATE TABLE IF NOT EXISTS stock_receipts (
    id TEXT PRIMARY KEY,
    date DATE DEFAULT CURRENT_DATE,
    "itemId" TEXT REFERENCES inventory(id),
    "vendorId" TEXT REFERENCES vendors(id),
    quantity NUMERIC DEFAULT 0,
    "unitPrice" NUMERIC DEFAULT 0,
    "totalAmount" NUMERIC DEFAULT 0,
    "paymentMade" NUMERIC DEFAULT 0,
    "paymentMode" TEXT,
    "billNumber" TEXT
);

-- 8. FACILITIES & FLEET
CREATE TABLE IF NOT EXISTS facility_usage (
    id TEXT PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "startTime" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP WITH TIME ZONE,
    amount NUMERIC DEFAULT 0,
    "isBilledToRoom" BOOLEAN DEFAULT TRUE,
    "outsiderInfo" JSONB,
    items JSONB
);

CREATE TABLE IF NOT EXISTS travel_bookings (
    id TEXT PRIMARY KEY,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL,
    "vehicleType" TEXT DEFAULT 'Sedan',
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "pickupLocation" TEXT,
    "dropLocation" TEXT,
    date DATE DEFAULT CURRENT_DATE,
    time TIME DEFAULT CURRENT_TIME,
    "kmUsed" NUMERIC DEFAULT 0,
    "daysOfTravelling" INT DEFAULT 1,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'BOOKED',
    "roomBookingId" TEXT
);

-- 9. SYSTEM CONFIG
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    name TEXT NOT NULL DEFAULT 'Hotel Sphere Pro',
    address TEXT,
    agents JSONB DEFAULT '[]'::jsonb,
    "roomTypes" JSONB DEFAULT '[]'::jsonb,
    "mealPlans" JSONB DEFAULT '[]'::jsonb,
    floors JSONB DEFAULT '[]'::jsonb,
    blocks JSONB DEFAULT '[]'::jsonb,
    "taxRate" NUMERIC DEFAULT 12,
    "gstNumber" TEXT,
    "upiId" TEXT,
    logo TEXT,
    signature TEXT,
    wallpaper TEXT,
    "hsnCode" TEXT DEFAULT '9963',
    "adminPassword" TEXT DEFAULT 'admin',
    "receptionistPassword" TEXT DEFAULT 'admin',
    "accountantPassword" TEXT DEFAULT 'admin',
    "supervisorPassword" TEXT DEFAULT 'admin',
    "cgstRate" NUMERIC,
    "sgstRate" NUMERIC,
    "igstRate" NUMERIC,
    "epfRateEmployee" NUMERIC DEFAULT 12,
    "epfRateEmployer" NUMERIC DEFAULT 12,
    "esiRateEmployee" NUMERIC DEFAULT 0.75,
    "esiRateEmployer" NUMERIC DEFAULT 3.25
);

-- 10. REFRESH & SEED
INSERT INTO settings (id, name) VALUES ('primary', 'Hotel Sphere Pro') ON CONFLICT (id) DO NOTHING;
NOTIFY pgrst, 'reload schema';

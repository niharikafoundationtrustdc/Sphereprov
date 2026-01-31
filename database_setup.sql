-- HOTEL SPHERE PRO: MASTER DATABASE INITIALIZATION (FIXED)
-- TARGET: SUPABASE POSTGRESQL SQL EDITOR
-- VERSION: 5.2.0

-- 1. CORE OPERATIONAL TABLES
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    floor INT NOT NULL DEFAULT 1,
    block TEXT DEFAULT 'Main',
    type TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'VACANT',
    "currentBookingId" TEXT
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
    "mealPlan" TEXT DEFAULT 'EP (Room Only)'
);

-- 2. FINANCIALS & GROUP MODULE
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
    "orgName" TEXT
);

-- 3. STAFF & ADMINISTRATION
CREATE TABLE IF NOT EXISTS supervisors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "loginId" TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT 'admin'
);

-- Ensure columns exist for older supervisor table versions
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'SUPERVISOR';
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS "assignedRoomIds" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    name TEXT NOT NULL DEFAULT 'Hotel Sphere Pro',
    address TEXT,
    agents JSONB DEFAULT '[]'::jsonb,
    "roomTypes" JSONB DEFAULT '["DELUXE ROOM", "BUDGET ROOM", "STANDARD ROOM", "AC FAMILY ROOM", "SUITE"]'::jsonb,
    blocks JSONB DEFAULT '["Main Block", "Block A", "Block B"]'::jsonb,
    "gstNumber" TEXT,
    "taxRate" NUMERIC DEFAULT 12,
    "cgstRate" NUMERIC DEFAULT 6,
    "sgstRate" NUMERIC DEFAULT 6,
    "igstRate" NUMERIC DEFAULT 12,
    "hsnCode" TEXT DEFAULT '9963',
    "upiId" TEXT,
    "logo" TEXT,
    "signature" TEXT,
    "wifiPassword" TEXT DEFAULT 'welcome123',
    "receptionPhone" TEXT DEFAULT '9',
    "roomServicePhone" TEXT DEFAULT '8',
    "restaurantMenuLink" TEXT
);

-- 4. BANQUETS & EVENTS
CREATE TABLE IF NOT EXISTS banquet_halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 100,
    "basePrice" NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'HALL'
);

CREATE TABLE IF NOT EXISTS event_bookings (
    id TEXT PRIMARY KEY,
    "hallId" TEXT NOT NULL REFERENCES banquet_halls(id),
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT DEFAULT 'Corporate',
    date DATE NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "totalAmount" NUMERIC DEFAULT 0,
    "advancePaid" NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    "paymentMode" TEXT DEFAULT 'Cash',
    status TEXT DEFAULT 'TENTATIVE',
    catering JSONB DEFAULT '{}'::jsonb,
    "guestCount" INT NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS catering_menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    "pricePerPlate" NUMERIC NOT NULL DEFAULT 0,
    "prepInstructions" TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb
);

-- 5. RESTAURANT & POS
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'FineDine'
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    "outletId" TEXT NOT NULL REFERENCES restaurants(id),
    "isAvailable" BOOLEAN DEFAULT TRUE,
    ingredients TEXT,
    "dietaryType" TEXT DEFAULT 'VEG',
    "isVegan" BOOLEAN DEFAULT FALSE,
    "containsMilk" BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    "outletId" TEXT NOT NULL REFERENCES restaurants(id),
    status TEXT DEFAULT 'VACANT'
);

CREATE TABLE IF NOT EXISTS kots (
    id TEXT PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL REFERENCES restaurants(id),
    "waiterId" TEXT,
    items JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT,
    "paymentMethod" TEXT
);

CREATE TABLE IF NOT EXISTS dining_bills (
    id TEXT PRIMARY KEY,
    "billNo" TEXT NOT NULL UNIQUE,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "outletId" TEXT NOT NULL REFERENCES restaurants(id),
    "tableNumber" TEXT NOT NULL,
    items JSONB NOT NULL,
    "subTotal" NUMERIC NOT NULL DEFAULT 0,
    "taxAmount" NUMERIC NOT NULL DEFAULT 0,
    "grandTotal" NUMERIC NOT NULL DEFAULT 0,
    "paymentMode" TEXT NOT NULL DEFAULT 'Cash',
    "guestName" TEXT,
    "guestPhone" TEXT,
    "roomBookingId" TEXT
);

-- 6. INVENTORY & VENDORS
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Housekeeping',
    unit TEXT NOT NULL DEFAULT 'Unit',
    "currentStock" NUMERIC DEFAULT 0,
    "minStockLevel" NUMERIC DEFAULT 5,
    "lastPurchasePrice" NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    gstin TEXT,
    category TEXT DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS stock_receipts (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    "itemId" TEXT NOT NULL REFERENCES inventory(id),
    "vendorId" TEXT NOT NULL REFERENCES vendors(id),
    quantity NUMERIC NOT NULL DEFAULT 0,
    "unitPrice" NUMERIC NOT NULL DEFAULT 0,
    "totalAmount" NUMERIC NOT NULL DEFAULT 0,
    "paymentMade" NUMERIC DEFAULT 0,
    "paymentMode" TEXT DEFAULT 'Cash',
    "billNumber" TEXT
);

-- 7. FACILITIES & TRAVEL
CREATE TABLE IF NOT EXISTS facility_usage (
    id TEXT PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "startTime" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP WITH TIME ZONE,
    amount NUMERIC DEFAULT 0,
    "isBilledToRoom" BOOLEAN DEFAULT TRUE,
    "outsiderInfo" JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS travel_bookings (
    id TEXT PRIMARY KEY,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL,
    "vehicleType" TEXT DEFAULT 'Sedan',
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "pickupLocation" TEXT DEFAULT 'Property Lobby',
    "dropLocation" TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME NOT NULL DEFAULT CURRENT_TIME,
    "kmUsed" NUMERIC DEFAULT 0,
    "daysOfTravelling" INT DEFAULT 1,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'BOOKED',
    "roomBookingId" TEXT
);

-- 8. INITIAL DATA SEEDING
INSERT INTO settings (id, name, address, "taxRate") 
VALUES ('primary', 'Hotel Sphere Pro', 'Digital Communique Head Office', 12)
ON CONFLICT (id) DO NOTHING;

-- Using COALESCE to safely handle potential nulls during migration inserts
INSERT INTO supervisors (id, name, "loginId", password, role)
VALUES ('s-master', 'Master Administrator', 'superadmin', 'admin', 'SUPERADMIN')
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    name = EXCLUDED.name;

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings("guestId");
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings("roomId");
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_kots_table ON kots("tableId");
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);

-- 10. REFRESH SCHEMA FOR POSTGREST
NOTIFY pgrst, 'reload schema';
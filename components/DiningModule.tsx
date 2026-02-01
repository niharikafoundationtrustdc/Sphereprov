
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { RestaurantOutlet, MenuItem, DiningTable, KOT, Room, Booking, DietaryType, Transaction, UserRole, Charge, Guest, DiningBill } from '../types';

interface DiningModuleProps {
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  settings: any;
  userRole: UserRole;
  onUpdateBooking?: (updated: Booking) => void;
}

const CATEGORIES = [
  "MOCKTAILS", "SOUPS", "PAPAD AND SALAD", "RAITA", "BREAK FAST", "PIZZA & SANDWICHS", 
  "CHINESE RICE & NOODLES", "TANDOOR STARTER", "INDIAN MAIN COURSE", "RICE AND BIRYANI", 
  "TANDOORI ROTI", "SWEETS", "PASTA", "CHINESE STARTER"
];

const DiningModule: React.FC<DiningModuleProps> = ({ rooms, bookings, guests, settings, userRole, onUpdateBooking }) => {
  const getInitialTab = () => (userRole === 'CHEF' || userRole === 'WAITER') ? 'KITCHEN' : 'POS';
  const [activeTab, setActiveTab] = useState<'POS' | 'KITCHEN' | 'MENU' | 'TABLES' | 'OUTLETS'>(getInitialTab());
  const [outlets, setOutlets] = useState<RestaurantOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<RestaurantOutlet | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allKots, setAllKots] = useState<KOT[]>([]);
  
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ name: '', category: 'INDIAN MAIN COURSE', subcategory: '', price: 0, dietaryType: 'VEG', isAvailable: true });
  const [posCategory, setPosCategory] = useState('All');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [billToRoomId, setBillToRoomId] = useState('');
  const [showSettlement, setShowSettlement] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');

  // Editing state for prices
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      let o = await db.restaurants.toArray();
      if (o.length === 0) {
        const mainOutlet: RestaurantOutlet = { id: 'rest-main', name: `Main Restaurant`, type: 'FineDine' };
        const poolOutlet: RestaurantOutlet = { id: 'rest-pool', name: `Poolside Restaurant`, type: 'Casual' };
        await db.restaurants.bulkPut([mainOutlet, poolOutlet]);
        o = [mainOutlet, poolOutlet];

        // Seed Tables
        const rTables = Array.from({ length: 11 }, (_, i) => ({
          id: `t-r${i + 1}`,
          number: `R${i + 1}`,
          outletId: 'rest-main',
          status: 'VACANT' as const
        }));
        const pTables = Array.from({ length: 10 }, (_, i) => ({
          id: `t-p${i + 1}`,
          number: `P${i + 1}`,
          outletId: 'rest-pool',
          status: 'VACANT' as const
        }));
        await db.diningTables.bulkPut([...rTables, ...pTables]);
      }
      setOutlets(o);
      if (o.length > 0) setSelectedOutlet(o[0]);

      let m = await db.menuItems.toArray();
      if (m.length === 0) {
        const menuSeed: Partial<MenuItem>[] = [
          // MOCKTAILS
          { name: "MINERAL WATER", category: "MOCKTAILS", price: 30 },
          { name: "TEA", category: "MOCKTAILS", price: 30 },
          { name: "GREEN TEA", category: "MOCKTAILS", price: 40 },
          { name: "COFFEE", category: "MOCKTAILS", price: 40 },
          { name: "ICE TEA", category: "MOCKTAILS", price: 99 },
          { name: "HOT MILK", category: "MOCKTAILS", price: 50 },
          { name: "FRESH LINE SODA & WATER", category: "MOCKTAILS", price: 69 },
          { name: "LASSI (SWEET OR SALTY)", category: "MOCKTAILS", price: 89 },
          { name: "COLD DRINK", category: "MOCKTAILS", price: 30 },
          { name: "MASALA COLD DRINKS", category: "MOCKTAILS", price: 49 },
          { name: "COLD COFFEE", category: "MOCKTAILS", price: 129 },
          { name: "COLD COFFEE WITH ICE CREAM", category: "MOCKTAILS", price: 159 },
          { name: "CENDRELLA", category: "MOCKTAILS", price: 139 },
          { name: "VARJIN MOHITO", category: "MOCKTAILS", price: 149 },
          { name: "BLUE LOOGAN", category: "MOCKTAILS", price: 149 },
          { name: "ORANGE BLOSOM", category: "MOCKTAILS", price: 149 },
          { name: "FRUIT PUNCH", category: "MOCKTAILS", price: 159 },
          { name: "SPECIAL SHAKE", category: "MOCKTAILS", price: 159 },
          // SOUPS
          { name: "CREAM OF TOMATO", category: "SOUPS", price: 129 },
          { name: "CREAM OF MASHROOM", category: "SOUPS", price: 129 },
          { name: "HOT SOUR SOUP", category: "SOUPS", price: 129 },
          { name: "MANCHOW SOUP", category: "SOUPS", price: 129 },
          { name: "SWEET CORN SOUP", category: "SOUPS", price: 129 },
          { name: "VEG TIKKA SOUP", category: "SOUPS", price: 129 },
          { name: "MAI-TAI SOUP", category: "SOUPS", price: 129 },
          { name: "CLEAR SOUP", category: "SOUPS", price: 129 },
          { name: "LEMAN CORIANDER SOUP", category: "SOUPS", price: 129 },
          // PAPAD AND SALAD
          { name: "Roast papad", category: "PAPAD AND SALAD", price: 29 },
          { name: "Fry papad", category: "PAPAD AND SALAD", price: 39 },
          { name: "Masal papad", category: "PAPAD AND SALAD", price: 59 },
          { name: "Shubhkamna Sp papad", category: "PAPAD AND SALAD", price: 69 },
          { name: "Onion Salad", category: "PAPAD AND SALAD", price: 49 },
          { name: "Green Salad", category: "PAPAD AND SALAD", price: 79 },
          { name: "Rasian Salad", category: "PAPAD AND SALAD", price: 99 },
          { name: "Toast Salad", category: "PAPAD AND SALAD", price: 89 },
          { name: "Papadi Chant Salad", category: "PAPAD AND SALAD", price: 110 },
          { name: "Kachumber Salad", category: "PAPAD AND SALAD", price: 89 },
          { name: "Curd Salad", category: "PAPAD AND SALAD", price: 110 },
          { name: "Shubhkamna SP Salad", category: "PAPAD AND SALAD", price: 110 },
          // RAITA
          { name: "Veg Raita", category: "RAITA", price: 119 },
          { name: "Boondi Raita", category: "RAITA", price: 149 },
          { name: "Pine Apple", category: "RAITA", price: 149 },
          { name: "Mint Raita", category: "RAITA", price: 119 },
          { name: "Plain Curd", category: "RAITA", price: 70 },
          // BREAK FAST
          { name: "Dosa (plain/masala)", category: "BREAK FAST", price: 79 },
          { name: "Mysur Dosa", category: "BREAK FAST", price: 110 },
          { name: "Rava Dosa", category: "BREAK FAST", price: 129 },
          { name: "Masala cut piece dosa", category: "BREAK FAST", price: 109 },
          { name: "Uttapam (onion / tomato mix)", category: "BREAK FAST", price: 119 },
          { name: "Idaly Sanbhar (3pc)", category: "BREAK FAST", price: 59 },
          { name: "Wada Sambar (2pc)", category: "BREAK FAST", price: 69 },
          { name: "Paneer masala dosa", category: "BREAK FAST", price: 139 },
          { name: "Cheese masala dosa", category: "BREAK FAST", price: 139 },
          { name: "Butter masala dosa", category: "BREAK FAST", price: 109 },
          { name: "Aloo / Gobhi / paneer paratha", category: "BREAK FAST", price: 89 },
          { name: "Poori bhaji (4pc)", category: "BREAK FAST", price: 109 },
          { name: "Chole bhature", category: "BREAK FAST", price: 139 },
          { name: "Extra bhatura", category: "BREAK FAST", price: 59 },
          { name: "French fries", category: "BREAK FAST", price: 129 },
          { name: "Peri Peri Fry", category: "BREAK FAST", price: 149 },
          { name: "Veg Pakoda", category: "BREAK FAST", price: 129 },
          { name: "Onion Lachha paratha", category: "BREAK FAST", price: 129 },
          { name: "Paneer pakoda", category: "BREAK FAST", price: 149 },
          { name: "Chana Roast", category: "BREAK FAST", price: 149 },
          { name: "Veg Cuttlet", category: "BREAK FAST", price: 129 },
          // PIZZA & SANDWICHS
          { name: "Margrita pizza", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "Forsizen pizza", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "Cheese corn pizza", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "Paneer tikka pizza", category: "PIZZA & SANDWICHS", price: 239 },
          { name: "Raisan sandwich", category: "PIZZA & SANDWICHS", price: 129 },
          { name: "Mumbai masala sandwich", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "Veg grild sandwich", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "Chocolet sandwich", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "Veg sandwich", category: "PIZZA & SANDWICHS", price: 99 },
          { name: "Paneer 65 (Manchurian, Schezawan, garlic)", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "Dragan paneer", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "Nouny chilly pototo", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "Shubhkamna sp. paneer", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "Paneer cranchi veg", category: "PIZZA & SANDWICHS", price: 259 },
          // CHINESE RICE & NOODLES
          { name: "Veg noodles", category: "CHINESE RICE & NOODLES", price: 199 },
          { name: "Veg hakka noodles", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "Schezawan noodles", category: "CHINESE RICE & NOODLES", price: 239 },
          { name: "Veg Triple Schezawan", category: "CHINESE RICE & NOODLES", price: 259 },
          { name: "Singapuri noodles", category: "CHINESE RICE & NOODLES", price: 249 },
          { name: "Chilli garlic noodles", category: "CHINESE RICE & NOODLES", price: 229 },
          { name: "Veg fried rice", category: "CHINESE RICE & NOODLES", price: 209 },
          { name: "Schezawan fried rice", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "Chilli garlic fried rice", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "Paneer fried rice", category: "CHINESE RICE & NOODLES", price: 249 },
          { name: "Macican fried rice", category: "CHINESE RICE & NOODLES", price: 239 },
          // TANDOOR STARTER
          { name: "Hara bhara kabab", category: "TANDOOR STARTER", price: 229 },
          { name: "Methi corn kabab", category: "TANDOOR STARTER", price: 229 },
          { name: "Khasta kabab", category: "TANDOOR STARTER", price: 229 },
          { name: "Veg Sheekh kabab", category: "TANDOOR STARTER", price: 239 },
          { name: "Burshi kabab", category: "TANDOOR STARTER", price: 239 },
          { name: "Dahi kabab", category: "TANDOOR STARTER", price: 239 },
          { name: "Tandoor soya chap", category: "TANDOOR STARTER", price: 269 },
          { name: "Mashroom Tikka", category: "TANDOOR STARTER", price: 249 },
          { name: "Paneer Tikka", category: "TANDOOR STARTER", price: 259 },
          { name: "Paneer Malai Tikka", category: "TANDOOR STARTER", price: 279 },
          { name: "Paneer Pahadi Tikka", category: "TANDOOR STARTER", price: 259 },
          { name: "Paneer Banjara Tikka", category: "TANDOOR STARTER", price: 259 },
          { name: "Paneer Sikh kabab", category: "TANDOOR STARTER", price: 279 },
          { name: "Paneer Achari Tikka", category: "TANDOOR STARTER", price: 259 },
          { name: "Veg Tandoori plater", category: "TANDOOR STARTER", price: 599 },
          // INDIAN MAIN COURSE
          { name: "Bhindi masala", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "Aloo Jeera", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "Kadi Pakoda", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "Tomato chatani", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "Sev tomato", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Mix Veg", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Aloo gobhi matar", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Veg kadai", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Began bharta", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Veg kolhapuri", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Veg keema kasturi", category: "INDIAN MAIN COURSE", price: 229 },
          { name: "Veg patiala", category: "INDIAN MAIN COURSE", price: 249 },
          { name: "Veg kofta", category: "INDIAN MAIN COURSE", price: 249 },
          { name: "Nav Ratan korma", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "Chana masala", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "Dum Aloo punjabi", category: "INDIAN MAIN COURSE", price: 239 },
          { name: "Veg Angara", category: "INDIAN MAIN COURSE", price: 269 },
          { name: "Corn palak", category: "INDIAN MAIN COURSE", price: 139 },
          { name: "Lasuni palak", category: "INDIAN MAIN COURSE", price: 139 },
          { name: "Baby corn mashroom M/S", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "Mashroom Masala", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "kaju curry", category: "INDIAN MAIN COURSE", price: 289 },
          { name: "Kaju masala", category: "INDIAN MAIN COURSE", price: 289 },
          { name: "Paneer Butter masala", category: "INDIAN MAIN COURSE", price: 279 },
          { name: "paneer tikka masala", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "paneer masala", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "palak paneer", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "paneer punjab", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "matter paneer", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "paneer bhurji", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "Shahi paneer", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "Paneer Angara", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "Malai kofta", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "Paneer kadai", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "Shubhkamna special paneer", category: "INDIAN MAIN COURSE", price: 349 },
          { name: "Dal fry", category: "INDIAN MAIN COURSE", price: 159 },
          { name: "Dal Tadka", category: "INDIAN MAIN COURSE", price: 179 },
          { name: "Dal Makhani", category: "INDIAN MAIN COURSE", price: 229 },
          { name: "Dal Dhaba", category: "INDIAN MAIN COURSE", price: 179 },
          { name: "Dal kolhapuri", category: "INDIAN MAIN COURSE", price: 189 },
          // RICE AND BIRYANI
          { name: "Steam Rice", category: "RICE AND BIRYANI", price: 119 },
          { name: "Jeera Rice", category: "RICE AND BIRYANI", price: 149 },
          { name: "leman Rice", category: "RICE AND BIRYANI", price: 169 },
          { name: "Veg Pulao", category: "RICE AND BIRYANI", price: 199 },
          { name: "Peas Pulao", category: "RICE AND BIRYANI", price: 199 },
          { name: "Onion Tomato Rice", category: "RICE AND BIRYANI", price: 159 },
          { name: "Paneer Pulao", category: "RICE AND BIRYANI", price: 229 },
          { name: "Kashmiri Pulao", category: "RICE AND BIRYANI", price: 229 },
          { name: "Veg Biryani", category: "RICE AND BIRYANI", price: 219 },
          { name: "Veg Dum Biryani", category: "RICE AND BIRYANI", price: 239 },
          { name: "Veg Hydrabadi Biryani", category: "RICE AND BIRYANI", price: 239 },
          { name: "Paneer Tikka Biryani", category: "RICE AND BIRYANI", price: 269 },
          { name: "Paneer Biryani", category: "RICE AND BIRYANI", price: 259 },
          { name: "Dal khichadi", category: "RICE AND BIRYANI", price: 199 },
          { name: "Masala khichadi", category: "RICE AND BIRYANI", price: 229 },
          { name: "Curd Rice", category: "RICE AND BIRYANI", price: 199 },
          // TANDOORI ROTI
          { name: "Tandoori Roti", category: "TANDOORI ROTI", price: 20 },
          { name: "Tandoori butter roti", category: "TANDOORI ROTI", price: 30 },
          { name: "Plain Naan", category: "TANDOORI ROTI", price: 49 },
          { name: "Butter Naan", category: "TANDOORI ROTI", price: 59 },
          { name: "Garlic Naan", category: "TANDOORI ROTI", price: 89 },
          { name: "Kashmiri Naan", category: "TANDOORI ROTI", price: 119 },
          { name: "Misi Roti", category: "TANDOORI ROTI", price: 69 },
          { name: "Garlic Roti", category: "TANDOORI ROTI", price: 49 },
          { name: "Lachha paratha", category: "TANDOORI ROTI", price: 79 },
          { name: "kulcha Plain", category: "TANDOORI ROTI", price: 49 },
          { name: "Masala kulcha", category: "TANDOORI ROTI", price: 89 },
          { name: "Roti Basket", category: "TANDOORI ROTI", price: 349 },
          // SWEETS
          { name: "Ice Cream (Vanilla, Strawberry, Chocolate)", category: "SWEETS", price: 79 },
          { name: "Hot Gulab jamun", category: "SWEETS", price: 59 },
          { name: "Mawa Wati", category: "SWEETS", price: 69 },
          { name: "Mung dal halwa", category: "SWEETS", price: 89 },
          { name: "Gajar Halwa", category: "SWEETS", price: 89 },
          { name: "Cheese Chilli Toast", category: "SWEETS", price: 139 },
          { name: "Bread Butter Toast", category: "SWEETS", price: 49 },
          { name: "Veg Cheese Grill S/W", category: "SWEETS", price: 129 },
          { name: "Cheese Corn S/W", category: "SWEETS", price: 139 },
          // PASTA
          { name: "Alfredo Souce (White)", category: "PASTA", price: 189 },
          { name: "Arabiata Souce (Red)", category: "PASTA", price: 199 },
          { name: "Mama Rosa Souce (Pink)", category: "PASTA", price: 199 },
          { name: "Shubhkamna Special Pasta", category: "PASTA", price: 219 },
          { name: "Cheese Corn Ball", category: "PASTA", price: 229 },
          { name: "Cheese Boll", category: "PASTA", price: 229 },
          { name: "Cheese Corn Roll", category: "PASTA", price: 229 },
          { name: "Cheese Cigar Roll", category: "PASTA", price: 239 },
          { name: "Nachhos With Creamy Cheese Souce", category: "PASTA", price: 249 },
          // CHINESE STARTER
          { name: "Crispy Veg", category: "CHINESE STARTER", price: 219 },
          { name: "Crispy Corn", category: "CHINESE STARTER", price: 219 },
          { name: "Veg Manchurian", category: "CHINESE STARTER", price: 219 },
          { name: "Veg Spring Roll", category: "CHINESE STARTER", price: 229 },
          { name: "Sanghai Roll", category: "CHINESE STARTER", price: 239 },
          { name: "Chinese Bhel", category: "CHINESE STARTER", price: 219 },
          { name: "Veg lolypop", category: "CHINESE STARTER", price: 239 },
          { name: "Schezwan Coliflower", category: "CHINESE STARTER", price: 219 },
          { name: "Paneer Chilli", category: "CHINESE STARTER", price: 249 },
          { name: "Mashroom Chilli (Chana Gobhi)", category: "CHINESE STARTER", price: 249 },
          { name: "Shahi Petro", category: "CHINESE STARTER", price: 249 },
          { name: "Paneer Masitik", category: "CHINESE STARTER", price: 259 },
          { name: "Paneer Sate", category: "CHINESE STARTER", price: 259 },
        ];

        const formatted = menuSeed.map(item => ({
          ...item,
          id: `mi-${Math.random().toString(36).substr(2, 9)}`,
          outletId: 'rest-main',
          isAvailable: true,
          dietaryType: 'VEG' as DietaryType,
          subcategory: ''
        })) as MenuItem[];

        await db.menuItems.bulkPut(formatted);
        m = formatted;
      }
      setMenu(m);
      setAllKots(await db.kots.toArray());
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      db.diningTables.where('outletId').equals(selectedOutlet.id).toArray().then(setTables);
    }
  }, [selectedOutlet, activeTab]);

  const updateKOTStatus = async (kotId: string, status: KOT['status']) => {
    const kot = allKots.find(k => k.id === kotId);
    if (!kot) return;
    
    const updated = { ...kot, status };
    await db.kots.put(updated);
    setAllKots(allKots.map(k => k.id === kotId ? updated : k));

    if (status === 'SERVED' && kot.bookingId) {
       const booking = await db.bookings.get(kot.bookingId);
       if (booking) {
          const subtotal = kot.items.reduce((s, it) => {
             const m = menu.find(mi => mi.id === it.menuItemId);
             return s + ((m?.price || 0) * it.quantity);
          }, 0);
          const tax = (subtotal * (settings.taxRate || 0)) / 100;
          const total = subtotal + tax;

          const charge: Charge = {
             id: `CHG-RSERV-${Date.now()}`,
             description: `Room Service: Order #${kot.id.slice(-4)}`,
             amount: total,
             date: new Date().toISOString()
          };
          
          const updatedBooking = { ...booking, charges: [...(booking.charges || []), charge] };
          await db.bookings.put(updatedBooking);
          if (onUpdateBooking) onUpdateBooking(updatedBooking);
          
          await db.kots.delete(kot.id);
          setAllKots(prev => prev.filter(k => k.id !== kot.id));
       }
    }
  };

  const handleUpdatePrice = async (id: string) => {
    const price = parseFloat(tempPrice);
    if (isNaN(price)) return alert("Invalid Price");
    
    const item = menu.find(m => m.id === id);
    if (!item) return;

    const updated = { ...item, price };
    await db.menuItems.put(updated);
    setMenu(menu.map(m => m.id === id ? updated : m));
    setEditingPriceId(null);
  };

  const tableSubtotal = useMemo(() => {
    if (!selectedTable) return 0;
    const servedTableKots = allKots.filter(k => k.tableId === selectedTable.id);
    return servedTableKots.reduce((total, kot) => {
      return total + kot.items.reduce((kSum, it) => {
        const m = menu.find(mi => mi.id === it.menuItemId);
        return kSum + ((m?.price || 0) * it.quantity);
      }, 0);
    }, 0);
  }, [allKots, selectedTable, menu]);

  const handleSettleBill = async () => {
    if (!selectedTable || tableSubtotal <= 0) return;
    const servedTableKots = allKots.filter(k => k.tableId === selectedTable.id);
    const billItems = servedTableKots.reduce((acc, kot) => {
      kot.items.forEach(it => {
        const m = menu.find(mi => mi.id === it.menuItemId);
        if (m) acc.push({ ...it, name: m.name, price: m.price });
      });
      return acc;
    }, [] as any[]);

    const taxAmount = (tableSubtotal * (settings.taxRate || 0)) / 100;
    const grandTotal = tableSubtotal + taxAmount;

    let targetResident: Booking | undefined;
    if (settlementMode === 'Mark to Room') {
      if (!billToRoomId) return alert("Select room folio.");
      targetResident = bookings.find(x => x.id === billToRoomId);
      if (targetResident) {
        const charge: Charge = { id: `CHG-DIN-${Date.now()}`, description: `Dining Bill: Table ${selectedTable.number}`, amount: grandTotal, date: new Date().toISOString() };
        const updatedBooking = { ...targetResident, charges: [...(targetResident.charges || []), charge] };
        await db.bookings.put(updatedBooking);
        if (onUpdateBooking) onUpdateBooking(updatedBooking);
      }
    } else {
      const tx: Transaction = { id: `TX-DIN-${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'RECEIPT', accountGroup: 'Direct Income', ledger: `${settlementMode} Account`, amount: grandTotal, entityName: 'Dining Walk-in', description: `Table ${selectedTable.number} bill` };
      await db.transactions.put(tx);
    }

    await db.diningBills.put({ id: `DIN-BILL-${Date.now()}`, billNo: `DIN-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), outletId: selectedOutlet!.id, tableNumber: selectedTable.number, items: billItems, subTotal: tableSubtotal, taxAmount, grandTotal, paymentMode: settlementMode, guestName: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.name || 'Resident') : 'Walk-in', guestPhone: targetResident ? (guests.find(g => g.id === targetResident?.guestId)?.phone || '') : '', roomBookingId: targetResident?.id });

    for (const kot of servedTableKots) { await db.kots.delete(kot.id); }
    setAllKots(allKots.filter(k => !servedTableKots.find(sk => sk.id === k.id)));
    const updatedTable = { ...selectedTable, status: 'VACANT' as const };
    await db.diningTables.put(updatedTable);
    setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
    setSelectedTable(null);
    setShowSettlement(false);
    alert("Bill Closed.");
  };

  const filteredMenu = menu.filter(m => m.outletId === selectedOutlet?.id && m.isAvailable && (posCategory === 'All' || m.category === posCategory));

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f1f5f9]">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6 w-full md:w-auto">
           <div className="w-16 h-16 bg-[#001a33] text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl shrink-0">🍴</div>
           <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-[#001a33] uppercase tracking-tighter leading-none truncate">{selectedOutlet?.name || 'Restaurant Master'}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                 {outlets.map(o => (
                    <button key={o.id} onClick={() => { setSelectedOutlet(o); setSelectedTable(null); }} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${selectedOutlet?.id === o.id ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-orange-100'}`}>{o.name}</button>
                 ))}
                 <button onClick={() => setShowAddOutlet(true)} className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-900 text-white">+ New Outlet</button>
              </div>
           </div>
        </div>
        
        <div className="flex gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-100 no-print overflow-x-auto scrollbar-hide max-w-full shrink-0">
           <TabBtn active={activeTab === 'POS'} label="POS Registry" onClick={() => setActiveTab('POS')} />
           <TabBtn active={activeTab === 'KITCHEN'} label="Kitchen KDS" onClick={() => setActiveTab('KITCHEN')} />
           <TabBtn active={activeTab === 'MENU'} label="Menu Master" onClick={() => setActiveTab('MENU')} />
           <TabBtn active={activeTab === 'TABLES'} label="Tables" onClick={() => setActiveTab('TABLES')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden animate-in fade-in duration-300">
            <div className="lg:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-sm border flex flex-col gap-6">
               <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest border-b pb-4">Table Selection</h3>
               <div className="grid grid-cols-3 gap-3 overflow-y-auto custom-scrollbar pr-2">
                  {tables.map(t => (
                    <button key={t.id} onClick={() => setSelectedTable(t)} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${selectedTable?.id === t.id ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : t.status === 'OCCUPIED' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      <span className="text-xl font-black">{t.number}</span>
                      <span className="text-[7px] font-black uppercase opacity-60">{t.status}</span>
                    </button>
                  ))}
               </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-[2.5rem] p-8 shadow-sm border flex flex-col gap-6 overflow-hidden">
               <div className="flex gap-2 overflow-x-auto scrollbar-hide shrink-0 pb-2 border-b">
                  <CatBtn active={posCategory === 'All'} label="Master Menu" onClick={() => setPosCategory('All')} />
                  {CATEGORIES.map(c => <CatBtn key={c} active={posCategory === c} label={c} onClick={() => setPosCategory(c)} />)}
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-6">
                  {filteredMenu.map(item => (
                    <button key={item.id} onClick={() => {
                        const exist = cart.find(c => c.item.id === item.id);
                        if (exist) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                        else setCart([...cart, {item, qty: 1}]);
                      }} className="p-5 border-2 border-slate-50 bg-slate-50/50 rounded-3xl text-left hover:border-orange-700 hover:bg-white transition-all group">
                      <div className="flex justify-between items-start mb-3">
                         <div className={`w-3 h-3 border-2 p-0.5 flex items-center justify-center ${item.dietaryType === 'VEG' ? 'border-green-600' : 'border-red-600'}`}>
                            <div className={`w-full h-full rounded-full ${item.dietaryType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                         </div>
                         <span className="text-[10px] font-black text-orange-700">₹{item.price}</span>
                      </div>
                      <p className="text-[11px] font-black uppercase text-slate-800 leading-tight group-hover:text-orange-900">{item.name}</p>
                    </button>
                  ))}
               </div>
            </div>

            <div className="lg:col-span-3 bg-[#111] rounded-[2.5rem] p-8 shadow-2xl flex flex-col overflow-hidden text-white">
               <div className="border-b border-white/10 pb-6 mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="font-black text-[10px] uppercase text-orange-400 tracking-widest mb-1">Active Check</h3>
                    <p className="text-2xl font-black tracking-tighter uppercase">{selectedTable ? `Table ${selectedTable.number}` : 'Standby'}</p>
                  </div>
                  {selectedTable?.status === 'OCCUPIED' && (
                    <button onClick={() => setShowSettlement(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Checkout</button>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2">
                  {cart.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase truncate text-white">{c.item.name}</p>
                          <p className="text-[9px] font-bold text-orange-400 mt-1">₹{c.item.price} × {c.qty}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: Math.max(0, x.qty-1)} : x).filter(x => x.qty > 0))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">-</button>
                          <span className="text-[10px] font-black">{c.qty}</span>
                          <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: x.qty+1} : x))} className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center font-black">+</button>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="border-t border-white/10 pt-6 space-y-4">
                  <div className="flex justify-between items-end">
                     <span className="text-[10px] font-black text-orange-400 uppercase">Subtotal</span>
                     <span className="text-3xl font-black text-white tracking-tighter">₹{(tableSubtotal + cart.reduce((s, c) => s + (c.item.price * c.qty), 0)).toFixed(2)}</span>
                  </div>
                  <button disabled={!selectedTable || cart.length === 0} onClick={() => alert("Sending KOT...")} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl disabled:opacity-20 hover:bg-orange-700 transition-all">Send KOT Dispatch</button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'MENU' && (
           <div className="h-full flex flex-col gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase">Menu Catalog</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Click price to edit inline</p>
                 </div>
                 <button onClick={() => setShowAddItem(true)} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">+ New Item</button>
              </div>
              <div className="bg-white border rounded-[3rem] overflow-hidden flex-1 shadow-sm overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-[#111] text-white font-black uppercase text-[10px]">
                       <tr><th className="p-6">Item</th><th className="p-6">Group</th><th className="p-6 text-right">Price (Click to Edit)</th><th className="p-6 text-center">Action</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold uppercase text-xs">
                       {menu.filter(m => m.outletId === selectedOutlet?.id).map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                             <td className="p-6 font-black text-slate-900">{item.name}</td>
                             <td className="p-6 text-slate-400">{item.category}</td>
                             <td className="p-6 text-right">
                                {editingPriceId === item.id ? (
                                   <div className="flex justify-end gap-2">
                                      <input 
                                        autoFocus
                                        className="w-20 border-2 border-orange-500 rounded p-1 text-right outline-none" 
                                        value={tempPrice} 
                                        onChange={e => setTempPrice(e.target.value)} 
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleUpdatePrice(item.id);
                                          if (e.key === 'Escape') setEditingPriceId(null);
                                        }}
                                      />
                                      <button onClick={() => handleUpdatePrice(item.id)} className="text-green-600">✓</button>
                                   </div>
                                ) : (
                                   <button 
                                     onClick={() => { setEditingPriceId(item.id); setTempPrice(item.price.toString()); }}
                                     className="font-black text-base text-orange-600 hover:scale-110 transition-transform"
                                   >
                                      ₹{item.price.toFixed(2)}
                                   </button>
                                )}
                             </td>
                             <td className="p-6 text-center">
                                <button onClick={async () => { if(confirm("Delete item?")) { await db.menuItems.delete(item.id); setMenu(menu.filter(m => m.id !== item.id)); } }} className="text-red-300 hover:text-red-600 font-black text-xs">Remove</button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-white text-orange-600 shadow-md border-2 border-orange-50' : 'text-slate-400 hover:text-orange-900'}`}>{label}</button>
);

const CatBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0 ${active ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{label}</button>
);

export default DiningModule;

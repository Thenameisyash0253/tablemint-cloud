import { useEffect, useMemo, useState } from "react";
import {
  Armchair, ArrowDownToLine, Banknote, Bell, Check, ChefHat, ChevronDown,
  CircleDollarSign, Clock3, Coffee, CookingPot, FileText, LayoutGrid,
  Minus, Plus, Printer, QrCode, Receipt, Search, ShoppingBag, Smartphone,
  Sparkles, Utensils, Wallet, X
} from "lucide-react";

const MENU = [
  { id: "m1", name: "Masala Dosa", category: "South Indian", price: 100, veg: true },
  { id: "m2", name: "Idli Sambar", category: "South Indian", price: 70, veg: true },
  { id: "m3", name: "Paneer Tikka", category: "Starters", price: 220, veg: true },
  { id: "m4", name: "Veg Manchurian", category: "Starters", price: 180, veg: true },
  { id: "m5", name: "Veg Thali", category: "Main Course", price: 180, veg: true },
  { id: "m6", name: "Paneer Butter Masala", category: "Main Course", price: 240, veg: true },
  { id: "m7", name: "Jeera Rice", category: "Main Course", price: 130, veg: true },
  { id: "m8", name: "Cold Coffee", category: "Beverages", price: 120, veg: true },
  { id: "m9", name: "Masala Chai", category: "Beverages", price: 20, veg: true },
  { id: "m10", name: "Gulab Jamun", category: "Desserts", price: 60, veg: true },
];
const CATEGORIES = ["All", ...new Set(MENU.map((m) => m.category))];
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function freshTables() {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    guests: [],
    openedAt: null,
  }));
}
function makeGuest(tableId, guestNo) {
  return {
    id: `${tableId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    name: `Customer ${String.fromCharCode(64 + guestNo)}`,
    items: [],
    status: "Open",
    createdAt: new Date().toISOString(),
    paid: false,
    paymentMethod: null,
  };
}
function loadInitial() {
  try {
    const saved = localStorage.getItem("tablemint-phase1");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tables?.length === 16) return parsed;
    }
  } catch {}
  return { tables: freshTables(), parcelOrders: [], nextParcel: 1 };
}

export default function App() {
  const [data, setData] = useState(loadInitial);
  const [serverReady, setServerReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Connecting to local server…");
  const [selectedTable, setSelectedTable] = useState(1);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [view, setView] = useState("tables");
  const [category, setCategory] = useState("All");
  const [menuSearch, setMenuSearch] = useState("");
  const [guestName, setGuestName] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showParcelForm, setShowParcelForm] = useState(false);
  const [parcelName, setParcelName] = useState("");
  const [parcelPhone, setParcelPhone] = useState("");
  const [activeParcel, setActiveParcel] = useState(null);
  const [toast, setToast] = useState("");
  const [paymentChoice, setPaymentChoice] = useState("Cash");

  useEffect(() => {
    let active = true;
    fetch("/api/data")
      .then((response) => { if (!response.ok) throw new Error("API unavailable"); return response.json(); })
      .then((saved) => {
        if (!active) return;
        if (saved.tables?.length === 16) setData(saved);
        setSyncStatus("Connected · local server");
        setServerReady(true);
      })
      .catch(() => {
        if (!active) return;
        setSyncStatus("Local browser mode · server unavailable");
        setServerReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!serverReady) return;
    localStorage.setItem("tablemint-phase1", JSON.stringify(data));
    const controller = new AbortController();
    fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal,
    }).then((response) => {
      if (!response.ok) throw new Error("save failed");
      setSyncStatus("Saved · local server");
    }).catch(() => {
      if (!controller.signal.aborted) setSyncStatus("Saved in this browser · server sync unavailable");
    });
    return () => controller.abort();
  }, [data, serverReady]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const table = data.tables.find((t) => t.id === selectedTable) || data.tables[0];
  const guest = table.guests.find((g) => g.id === selectedGuest) || null;
  const parcel = data.parcelOrders.find((p) => p.id === activeParcel) || null;

  const filteredMenu = useMemo(() => MENU.filter((item) => {
    const categoryMatch = category === "All" || item.category === category;
    const searchMatch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    return categoryMatch && searchMatch;
  }), [category, menuSearch]);

  const openTable = (id) => {
    setSelectedTable(id);
    setSelectedGuest(null);
    setActiveParcel(null);
    setView("table-detail");
  };

  const addGuest = () => {
    const current = data.tables.find((t) => t.id === selectedTable);
    if (current.guests.length >= 6) {
      setToast("A table can have up to 6 separate customer bills.");
      return;
    }
    const nextGuest = makeGuest(selectedTable, current.guests.length + 1);
    if (guestName.trim()) nextGuest.name = guestName.trim();
    setData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => t.id === selectedTable
        ? { ...t, openedAt: t.openedAt || new Date().toISOString(), guests: [...t.guests, nextGuest] }
        : t),
    }));
    setSelectedGuest(nextGuest.id);
    setGuestName("");
    setShowGuestForm(false);
    setView("order");
  };

  const addItem = (item, target = "guest") => {
    if (target === "parcel" && parcel) {
      setData((prev) => ({ ...prev, parcelOrders: prev.parcelOrders.map((p) => p.id !== parcel.id ? p : {
        ...p, items: addOrIncrement(p.items, item)
      }) }));
      setToast(`${item.name} added to parcel order`);
      return;
    }
    if (!guest) {
      setToast("Select a customer tab before adding items.");
      return;
    }
    setData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => t.id !== selectedTable ? t : ({
        ...t,
        guests: t.guests.map((g) => g.id !== guest.id ? g : ({ ...g, items: addOrIncrement(g.items, item), status: "Order added" }))
      }))
    }));
    setToast(`${item.name} added to ${guest.name}`);
  };

  const changeQty = (itemId, delta, target = "guest") => {
    const updateItems = (items) => items
      .map((it) => it.id === itemId ? { ...it, qty: it.qty + delta } : it)
      .filter((it) => it.qty > 0);
    if (target === "parcel" && parcel) {
      setData((prev) => ({ ...prev, parcelOrders: prev.parcelOrders.map((p) => p.id !== parcel.id ? p : { ...p, items: updateItems(p.items) }) }));
      return;
    }
    if (!guest) return;
    setData((prev) => ({ ...prev, tables: prev.tables.map((t) => t.id !== selectedTable ? t : {
      ...t, guests: t.guests.map((g) => g.id !== guest.id ? g : { ...g, items: updateItems(g.items) })
    }) }));
  };

  const createParcel = () => {
    const p = {
      id: `P-${data.nextParcel}`,
      name: parcelName.trim() || `Parcel ${data.nextParcel}`,
      phone: parcelPhone.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      paid: false,
      paymentMethod: null,
    };
    setData((prev) => ({ ...prev, parcelOrders: [p, ...prev.parcelOrders], nextParcel: prev.nextParcel + 1 }));
    setActiveParcel(p.id);
    setParcelName("");
    setParcelPhone("");
    setShowParcelForm(false);
    setView("parcel-order");
  };

  const totalOf = (items) => items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const activeItems = view === "parcel-order" ? (parcel?.items || []) : (guest?.items || []);
  const activeTotal = totalOf(activeItems);
  const allOpenBills = data.tables.reduce((sum, t) => sum + t.guests.filter((g) => !g.paid).reduce((s, g) => s + totalOf(g.items), 0), 0)
    + data.parcelOrders.filter((p) => !p.paid).reduce((s, p) => s + totalOf(p.items), 0);
  const occupiedTables = data.tables.filter((t) => t.guests.some((g) => !g.paid)).length;
  const orderCount = data.tables.reduce((s, t) => s + t.guests.filter((g) => !g.paid && g.items.length > 0).length, 0)
    + data.parcelOrders.filter((p) => !p.paid && p.items.length > 0).length;

  const printBill = (bill, title, type) => {
    if (!bill || !bill.items.length) {
      setToast("Add at least one item before printing a bill.");
      return;
    }
    const lines = bill.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.qty * it.price)}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=420,height=650");
    if (!win) {
      setToast("Allow pop-ups to print the bill.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
      body{font:12px Arial,sans-serif;width:72mm;margin:5mm auto;color:#111}h2{text-align:center;margin:0 0 5px}
      p{margin:4px 0}hr{border:0;border-top:1px dashed #333;margin:8px 0}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:4px 1px;border-bottom:1px dotted #bbb}
      .total{text-align:right;font-weight:bold;font-size:14px;margin-top:10px}@media print{body{width:auto;margin:0}}
    </style></head><body><h2>TABLEMINT HOTEL</h2><p style="text-align:center">Sample bill · Phase 1 demo</p><hr/>
    <p><b>${escapeHtml(title)}</b></p><p>Type: ${escapeHtml(type)}</p><p>Date: ${new Date().toLocaleString("en-IN")}</p><hr/>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
    <p class="total">Total: ${money(totalOf(bill.items))}</p><hr/><p style="text-align:center">Thank you! Visit again.</p>
    <script>window.onload=()=>{window.print();};<\/script></body></html>`);
    win.document.close();
  };

  const printKOT = (bill, title, type) => {
    if (!bill || !bill.items?.length) {
      setToast("Add at least one item before printing a KOT.");
      return;
    }
    const kotNo = `KOT-${Date.now().toString().slice(-6)}`;
    const rows = bill.items.map((it) => `<div class="item"><span>${escapeHtml(it.name)}</span><strong>× ${it.qty}</strong></div>`).join("");
    const win = window.open("", "_blank", "width=380,height=650");
    if (!win) {
      setToast("Allow pop-ups to print the KOT.");
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${kotNo}</title><style>
      @page{size:58mm auto;margin:3mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;width:52mm;margin:0 auto;color:#111}
      h1{text-align:center;font-size:20px;margin:0 0 4px}.tag{text-align:center;font-weight:bold;font-size:17px;border-top:2px dashed #111;border-bottom:2px dashed #111;padding:5px 0;margin:6px 0}
      p{margin:4px 0;font-size:12px}.item{display:flex;justify-content:space-between;gap:8px;font-size:15px;padding:7px 0;border-bottom:1px dotted #777}.item span{overflow-wrap:anywhere}.item strong{white-space:nowrap}
      .foot{text-align:center;font-size:11px;margin-top:10px;border-top:2px dashed #111;padding-top:7px}@media print{body{width:auto}}
    </style></head><body><h1>TABLEMINT HOTEL</h1><div class="tag">KITCHEN ORDER TICKET</div>
    <p><b>${kotNo}</b></p><p><b>Order:</b> ${escapeHtml(title)}</p><p><b>Type:</b> ${escapeHtml(type)}</p><p><b>Time:</b> ${new Date().toLocaleString("en-IN")}</p><div style="border-top:1px solid #111;margin-top:7px"></div>
    ${rows}<div class="foot">KITCHEN COPY · PLEASE PREPARE</div><script>window.onload=()=>{window.focus();window.print();};<\/script></body></html>`);
    win.document.close();
    setToast(`KOT ${kotNo} opened for printing.`);
  };

  const payBill = (billId, type) => {
    if (type === "parcel") {
      setData((prev) => ({ ...prev, parcelOrders: prev.parcelOrders.map((p) => p.id !== billId ? p : { ...p, paid: true, paymentMethod: paymentChoice }) }));
      setToast(`Parcel bill marked paid via ${paymentChoice}.`);
      setView("parcel");
    } else {
      setData((prev) => ({ ...prev, tables: prev.tables.map((t) => t.id !== selectedTable ? t : {
        ...t, guests: t.guests.map((g) => g.id !== billId ? g : { ...g, paid: true, paymentMethod: paymentChoice, status: "Paid" }),
      }) }));
      setToast(`Bill marked paid via ${paymentChoice}.`);
      setSelectedGuest(null);
      setView("table-detail");
    }
  };

  const startNewGuest = () => {
    if (table.guests.length >= 6) {
      setToast("This table already has 6 customer tabs.");
      return;
    }
    setShowGuestForm(true);
  };

  return (
    <div className="app-shell" title={syncStatus}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Utensils size={20}/></div><div><b>TableMint</b><span>HOTEL OPERATIONS</span></div></div>
        <div className="side-label">WORKSPACE</div>
        <button className={`nav-item ${view.startsWith("table") || view === "order" || view === "bill" ? "active" : ""}`} onClick={() => setView("tables")}><LayoutGrid size={18}/> Tables <span className="nav-count">16</span></button>
        <button className={`nav-item ${view === "parcel" || view === "parcel-order" ? "active" : ""}`} onClick={() => setView("parcel")}><ShoppingBag size={18}/> Parcel orders</button>
        <button className={`nav-item ${view === "menu" ? "active" : ""}`} onClick={() => setView("menu")}><Utensils size={18}/> Menu items</button>
        <a className="nav-item qr-nav-link" href="/qr"><QrCode size={18}/> QR ordering setup</a>
        <div className="side-bottom">
          <div className="local-card"><span className="online-dot"></span><div><b>Local demo mode</b><small>Saved in this browser</small></div></div>
          <div className="user-chip"><div className="avatar">A</div><div><b>Admin</b><small>Hotel manager</small></div><ChevronDown size={16}/></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb"><span>Hotel</span><span className="slash">/</span><b>{pageTitle(view, selectedTable, guest, parcel)}</b></div>
          <div className="top-actions"><span className="status-pill"><span className="online-dot"></span> Local mode</span><button className="icon-button" aria-label="Notifications" onClick={() => setToast("You're all caught up.")}><Bell size={18}/></button><div className="avatar">A</div></div>
        </header>

        <section className="content">
          {view === "tables" && <>
            <div className="page-heading"><div><div className="eyebrow">SERVICE OVERVIEW</div><h1>Tables & orders</h1><p>Manage your floor, customer tabs and live orders.</p></div><button className="primary-button" onClick={() => { setShowParcelForm(true); }}><Plus size={17}/> New parcel order</button></div>
            <div className="stats-grid">
              <Stat icon={<LayoutGrid size={19}/>} label="Total tables" value="16" hint="All tables configured" tone="purple"/>
              <Stat icon={<Armchair size={19}/>} label="Occupied tables" value={occupiedTables} hint={`${16 - occupiedTables} tables available`} tone="orange"/>
              <Stat icon={<CookingPot size={19}/>} label="Open orders" value={orderCount} hint="Unpaid customer tabs" tone="blue"/>
              <Stat icon={<CircleDollarSign size={19}/>} label="Open bill value" value={money(allOpenBills)} hint="Unpaid items total" tone="green"/>
            </div>
            <div className="section-row"><div><h2>Floor plan</h2><p>Select a table to manage customer tabs.</p></div><div className="legend"><span><i className="legend-dot free"></i> Available</span><span><i className="legend-dot busy"></i> Occupied</span></div></div>
            <div className="tables-grid">
              {data.tables.map((t) => {
                const unpaid = t.guests.filter((g) => !g.paid);
                const sum = unpaid.reduce((s, g) => s + totalOf(g.items), 0);
                const occupied = unpaid.length > 0;
                return <button className={`table-card ${occupied ? "occupied" : ""}`} key={t.id} onClick={() => openTable(t.id)}>
                  <div className="table-card-top"><span className={`table-state ${occupied ? "busy" : ""}`}>{occupied ? "Occupied" : "Available"}</span><span className="table-more">•••</span></div>
                  <div className="table-illustration"><div className="seat seat-a"></div><div className="seat seat-b"></div><div className="seat seat-c"></div><div className="seat seat-d"></div><div className="table-center"><Armchair size={21}/></div></div>
                  <div className="table-card-bottom"><div><b>Table {String(t.id).padStart(2, "0")}</b><span>{unpaid.length}/6 customer tabs</span></div><strong>{money(sum)}</strong></div>
                </button>;
              })}
            </div>
          </>}

          {view === "table-detail" && <div className="page-heading"><div><div className="eyebrow">TABLE MANAGEMENT</div><h1>Table {String(selectedTable).padStart(2, "0")}</h1><p>Up to six independent customer bills at one table.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setView("tables")}>Back to tables</button><button className="primary-button" onClick={startNewGuest} disabled={table.guests.length >= 6}><Plus size={17}/> Add customer</button></div></div>}
          {view === "table-detail" && <div className="guest-layout">
            <div className="panel guest-panel"><div className="panel-heading"><div><h2>Customer tabs</h2><p>Each tab has its own order and bill.</p></div><span className="soft-count">{table.guests.length} / 6</span></div>
              {table.guests.length === 0 ? <EmptyState icon={<Armchair size={25}/>} title="No customers yet" body="Add the first customer to start a separate bill." action="Add customer" onClick={startNewGuest}/> :
                <div className="guest-list">{table.guests.map((g, idx) => <button key={g.id} className={`guest-row ${selectedGuest === g.id ? "selected" : ""} ${g.paid ? "paid-row" : ""}`} onClick={() => { setSelectedGuest(g.id); setView("order"); }}>
                  <div className="guest-avatar">{g.name.trim().charAt(0).toUpperCase() || idx + 1}</div><div className="guest-info"><b>{g.name}</b><span>{g.items.reduce((s, it) => s + it.qty, 0)} items · {g.paid ? `Paid via ${g.paymentMethod}` : g.status}</span></div><div className="guest-total">{money(totalOf(g.items))}<span>{g.paid ? "Paid" : "Open bill"}</span></div><ChevronDown size={16} className="guest-chevron"/>
                </button>)}</div>}
              {showGuestForm && <form className="inline-form" onSubmit={(e) => { e.preventDefault(); addGuest(); }}><label>Customer name <span>(optional)</span></label><input autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={`Customer ${String.fromCharCode(65 + table.guests.length)}`}/><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowGuestForm(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16}/> Create tab</button></div></form>}
            </div>
            <div className="panel side-summary"><div className="panel-heading"><div><h2>Table summary</h2><p>Current session</p></div><Armchair size={19} className="muted-icon"/></div><div className="summary-number">{table.guests.filter((g) => !g.paid).length}<span>active customer tabs</span></div><div className="summary-line"><span>Unpaid bills</span><b>{money(table.guests.filter((g) => !g.paid).reduce((s, g) => s + totalOf(g.items), 0))}</b></div><div className="summary-line"><span>Paid bills</span><b>{money(table.guests.filter((g) => g.paid).reduce((s, g) => s + totalOf(g.items), 0))}</b></div><button className="secondary-button full-width" onClick={() => { setView("order"); if (!selectedGuest && table.guests.find((g) => !g.paid)) setSelectedGuest(table.guests.find((g) => !g.paid).id); }} disabled={!table.guests.some((g) => !g.paid)}>Open active order</button></div>
          </div>}

          {view === "order" && <div className="order-page">
            <div className="page-heading compact-heading"><div><div className="eyebrow">ORDER ENTRY</div><h1>{guest?.name || "Select a customer"}</h1><p>Table {String(selectedTable).padStart(2, "0")} · Independent customer bill</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setView("table-detail")}>Customer tabs</button><button className="secondary-button" onClick={() => setView("tables")}>All tables</button></div></div>
            {!guest ? <div className="panel"><EmptyState icon={<Receipt size={25}/>} title="Choose a customer tab" body="Go to table details and create or select a customer first." action="Go to table" onClick={() => setView("table-detail")}/></div> : <>
              <div className="order-layout">
                <div className="panel menu-panel"><div className="panel-heading"><div><h2>Menu</h2><p>Tap an item to add it to the selected bill.</p></div><span className="menu-count">{filteredMenu.length} items</span></div>
                  <div className="search-box"><Search size={17}/><input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items..."/>{menuSearch && <button onClick={() => setMenuSearch("")}><X size={15}/></button>}</div>
                  <div className="category-tabs">{CATEGORIES.map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
                  <div className="menu-items-grid">{filteredMenu.map((item) => <div className="menu-item" key={item.id}><div className="food-icon">{item.category === "Beverages" ? <Coffee size={21}/> : item.category === "Desserts" ? <Sparkles size={21}/> : <Utensils size={21}/>}</div><div className="food-details"><b>{item.name}</b><span><i className="veg-mark"></i>{item.category}</span><strong>{money(item.price)}</strong></div><button className="add-item-button" onClick={() => addItem(item)} aria-label={`Add ${item.name}`}><Plus size={17}/></button></div>)}</div>
                </div>
                <div className="panel bill-panel"><div className="panel-heading"><div><h2>Current bill</h2><p>{guest.name} · Table {selectedTable}</p></div><span className={`bill-status ${guest.paid ? "paid" : ""}`}>{guest.paid ? "Paid" : "Open"}</span></div>
                  <div className="bill-items">{guest.items.length === 0 ? <div className="empty-bill"><ShoppingBag size={24}/><b>Your order is empty</b><span>Add items from the menu.</span></div> : guest.items.map((item) => <div className="bill-item" key={item.id}><div className="bill-item-main"><b>{item.name}</b><span>{money(item.price)} each</span></div><div className="qty-control"><button onClick={() => changeQty(item.id, -1)} disabled={guest.paid}><Minus size={13}/></button><span>{item.qty}</span><button onClick={() => changeQty(item.id, 1)} disabled={guest.paid}><Plus size={13}/></button></div><b className="line-total">{money(item.price * item.qty)}</b></div>)}</div>
                  <div className="bill-math"><div><span>Subtotal</span><b>{money(activeTotal)}</b></div><div><span>Tax</span><b>{money(0)}</b></div><div className="grand-total"><span>Total</span><strong>{money(activeTotal)}</strong></div><small>Tax is set to ₹0 in this demo. Configure applicable taxes before real use.</small></div>
                  <div className="payment-choice"><label>Payment method</label><div className="payment-options"><button className={paymentChoice === "Cash" ? "chosen" : ""} onClick={() => setPaymentChoice("Cash")}><Banknote size={16}/> Cash</button><button className={paymentChoice === "UPI" ? "chosen" : ""} onClick={() => setPaymentChoice("UPI")}><Smartphone size={16}/> UPI</button></div></div>
                  <div className="bill-actions"><button className="secondary-button" onClick={() => printKOT(guest, `${guest.name} · Table ${selectedTable}`, "Dine-in")} disabled={!guest.items.length}><ChefHat size={16}/> Print KOT</button><button className="secondary-button" onClick={() => printBill(guest, `${guest.name} · Table ${selectedTable}`, "Dine-in")}><Printer size={16}/> Print bill</button>{guest.paid ? <button className="primary-button" disabled><Check size={16}/> Paid</button> : <button className="primary-button" onClick={() => payBill(guest.id, "guest")} disabled={!guest.items.length}><Wallet size={16}/> Mark paid</button>}</div>
                  <div className="demo-note"><Printer size={15}/> KOT Phase 3: browser print dialog. Select the Epson printer and 58mm/80mm paper as supported.</div>
                </div>
              </div>
            </>}
          </div>}

          {view === "parcel" && <><div className="page-heading"><div><div className="eyebrow">TAKEAWAY</div><h1>Parcel orders</h1><p>Create and manage takeaway bills separately from dine-in tables.</p></div><button className="primary-button" onClick={() => setShowParcelForm(true)}><Plus size={17}/> New parcel order</button></div>
            <div className="panel parcel-panel"><div className="panel-heading"><div><h2>Recent parcel orders</h2><p>Orders created on this device.</p></div><ShoppingBag size={19} className="muted-icon"/></div>
              {data.parcelOrders.length === 0 ? <EmptyState icon={<ShoppingBag size={25}/>} title="No parcel orders yet" body="Create a parcel order to start a separate takeaway bill." action="New parcel order" onClick={() => setShowParcelForm(true)}/> :
                <div className="parcel-list">{data.parcelOrders.map((p) => <div className="parcel-row" key={p.id}><div className="parcel-icon"><ShoppingBag size={19}/></div><div className="parcel-info"><b>{p.name} <span className="parcel-id">{p.id}</span></b><span>{p.phone || "No phone number"} · {p.items.reduce((s, it) => s + it.qty, 0)} items</span></div><div className="parcel-amount"><b>{money(totalOf(p.items))}</b><span className={p.paid ? "paid-text" : "open-text"}>{p.paid ? `Paid · ${p.paymentMethod}` : "Unpaid"}</span></div><button className="secondary-button small-button" onClick={() => { setActiveParcel(p.id); setView("parcel-order"); }}>Open order</button></div>)}</div>}
            </div>
          </>}

          {view === "parcel-order" && <div className="order-page"><div className="page-heading compact-heading"><div><div className="eyebrow">TAKEAWAY ORDER</div><h1>{parcel?.name || "Parcel order"}</h1><p>{parcel?.id} · Parcel / takeaway</p></div><button className="secondary-button" onClick={() => setView("parcel")}>Back to parcel orders</button></div>
            {!parcel ? <div className="panel"><EmptyState icon={<ShoppingBag size={25}/>} title="Parcel order not found" body="Create a parcel order first." action="Parcel orders" onClick={() => setView("parcel")}/></div> : <div className="order-layout parcel-order-layout">
              <div className="panel menu-panel"><div className="panel-heading"><div><h2>Menu</h2><p>Add items to this parcel order.</p></div></div><div className="search-box"><Search size={17}/><input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items..."/></div><div className="category-tabs">{CATEGORIES.map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="menu-items-grid">{filteredMenu.map((item) => <div className="menu-item" key={item.id}><div className="food-icon"><Utensils size={21}/></div><div className="food-details"><b>{item.name}</b><span>{item.category}</span><strong>{money(item.price)}</strong></div><button className="add-item-button" disabled={parcel.paid} onClick={() => addItem(item, "parcel")}><Plus size={17}/></button></div>)}</div></div>
              <div className="panel bill-panel"><div className="panel-heading"><div><h2>Parcel bill</h2><p>{parcel.name}</p></div><span className={`bill-status ${parcel.paid ? "paid" : ""}`}>{parcel.paid ? "Paid" : "Open"}</span></div><div className="bill-items">{parcel.items.length === 0 ? <div className="empty-bill"><ShoppingBag size={24}/><b>No items yet</b><span>Add items from the menu.</span></div> : parcel.items.map((item) => <div className="bill-item" key={item.id}><div className="bill-item-main"><b>{item.name}</b><span>{money(item.price)} each</span></div><div className="qty-control"><button disabled={parcel.paid} onClick={() => changeQty(item.id, -1, "parcel")}><Minus size={13}/></button><span>{item.qty}</span><button disabled={parcel.paid} onClick={() => changeQty(item.id, 1, "parcel")}><Plus size={13}/></button></div><b className="line-total">{money(item.price * item.qty)}</b></div>)}</div><div className="bill-math"><div><span>Subtotal</span><b>{money(totalOf(parcel.items))}</b></div><div><span>Tax</span><b>{money(0)}</b></div><div className="grand-total"><span>Total</span><strong>{money(totalOf(parcel.items))}</strong></div><small>Tax is set to ₹0 in this demo.</small></div><div className="payment-choice"><label>Payment method</label><div className="payment-options"><button className={paymentChoice === "Cash" ? "chosen" : ""} onClick={() => setPaymentChoice("Cash")}><Banknote size={16}/> Cash</button><button className={paymentChoice === "UPI" ? "chosen" : ""} onClick={() => setPaymentChoice("UPI")}><Smartphone size={16}/> UPI</button></div></div><div className="bill-actions"><button className="secondary-button" onClick={() => printKOT(parcel, `${parcel.name} · ${parcel.id}`, "Parcel / Takeaway")} disabled={!parcel.items.length}><ChefHat size={16}/> Print KOT</button><button className="secondary-button" onClick={() => printBill(parcel, `${parcel.name} · ${parcel.id}`, "Parcel")}><Printer size={16}/> Print bill</button>{parcel.paid ? <button className="primary-button" disabled><Check size={16}/> Paid</button> : <button className="primary-button" disabled={!parcel.items.length} onClick={() => payBill(parcel.id, "parcel")}><Wallet size={16}/> Mark paid</button>}</div><div className="demo-note"><Printer size={15}/> Phase 3 KOT preview uses the browser print dialog; choose your Epson printer.</div></div>
            </div>}
          </div>}

          {view === "menu" && <><div className="page-heading"><div><div className="eyebrow">CATALOGUE</div><h1>Menu items</h1><p>Sample menu and prices for the Phase 1 demo.</p></div><span className="soft-count">{MENU.length} sample items</span></div><div className="panel"><div className="search-box"><Search size={17}/><input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items..."/></div><div className="category-tabs">{CATEGORIES.map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="menu-items-grid menu-library">{filteredMenu.map((item) => <div className="menu-item" key={item.id}><div className="food-icon"><Utensils size={21}/></div><div className="food-details"><b>{item.name}</b><span>{item.category}</span><strong>{money(item.price)}</strong></div></div>)}</div></div></>}
        </section>
      </main>

      {showParcelForm && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowParcelForm(false); }}><form className="modal" onSubmit={(e) => { e.preventDefault(); createParcel(); }}><div className="modal-top"><div><div className="eyebrow">TAKEAWAY</div><h2>New parcel order</h2><p>Create a separate bill without a table.</p></div><button type="button" className="icon-button" onClick={() => setShowParcelForm(false)}><X size={18}/></button></div><label>Customer name <span>(optional)</span></label><input value={parcelName} onChange={(e) => setParcelName(e.target.value)} placeholder="e.g. Rahul Patil"/><label>Phone number <span>(optional)</span></label><input value={parcelPhone} onChange={(e) => setParcelPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10}/><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowParcelForm(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16}/> Create parcel order</button></div></form></div>}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function addOrIncrement(items, item) {
  const existing = items.find((it) => it.id === item.id);
  return existing ? items.map((it) => it.id === item.id ? { ...it, qty: it.qty + 1 } : it) : [...items, { ...item, qty: 1 }];
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function pageTitle(view, tableId, guest, parcel) {
  if (view === "tables") return "Tables & orders";
  if (view === "table-detail") return `Table ${String(tableId).padStart(2, "0")}`;
  if (view === "order") return guest?.name || "Order entry";
  if (view === "parcel") return "Parcel orders";
  if (view === "parcel-order") return parcel?.name || "Parcel order";
  return "Menu items";
}
function Stat({ icon, label, value, hint, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}
function EmptyState({ icon, title, body, action, onClick }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p>{action && <button className="primary-button" onClick={onClick}><Plus size={16}/>{action}</button>}</div>;
}
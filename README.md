# TableMint Hotel Billing — Phase 5 (SQLite database + network foundation)

Phase 5 continues from Phase 4 and keeps the 16-table manager dashboard, customer tabs, parcel flow, KOT print dialog, and QR mobile ordering. The API now stores the current hotel state in a local SQLite database file (`server/data/tablemint.sqlite`) using SQL.js, and migrates existing `server/data/hotel-data.json` data on first startup if the SQLite database does not exist. A JSON backup export endpoint is available at `/api/backup`.

## Run on Windows
1. Extract the ZIP.
2. In VS Code, open the **inner `hotel-billing-phase5` folder** containing `package.json`.
3. In the terminal run:
   ```powershell
   npm install
   npm run dev -- --host 0.0.0.0
   ```
4. Open `http://localhost:5173` on the billing computer.
5. The server prints `TableMint API running at http://localhost:4000 (SQLite storage)`.

## Test Phase 5
- Check `http://localhost:4000/api/health`; it should report `storage: SQLite`.
- Use the dashboard and place a test QR order from a phone on the same Wi-Fi.
- Refresh the dashboard and verify the order is present.
- Stop the server with Ctrl+C, restart it, and verify data remains.
- Download a JSON backup from `http://localhost:4000/api/backup`.
- The database file is stored at `server/data/tablemint.sqlite`.

## Important limitations
- SQLite provides persistent local database storage on this billing computer; this is not yet automatic cloud synchronization or internet-wide hosting.
- Same-Wi-Fi access depends on the computer's current IPv4 address, firewall, and router settings. Keep the dev server running while testing.
- Do not expose this development server directly to the public internet. Before real restaurant use, add staff authentication, role permissions, audit logs, robust transaction/conflict handling, database backup scheduling, and secure cloud deployment.
- The current UI still uses browser state for manager edits. Refresh the dashboard after QR orders arrive and before making staff edits to reduce the chance of stale data overwriting newer changes.
- Demo menu prices should be replaced with the restaurant's actual menu. UPI is only a payment-method label; no payment is processed.

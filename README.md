# ⚡ ChargeNet - EV Charging Station Management System

ChargeNet is a real-time EV Charging Station Management and Reservation platform. It provides electric vehicle drivers with interactive tools to discover, compare, and book charging ports, while supplying network operators with a comprehensive administration dashboard to manage stations, bookings, and users.

---

## 🚀 Key Features

### 👤 Driver Portal
*   **Real-time Station Price Comparison Graph**: Dynamic Chart.js bar chart on the dashboard displaying unit pricing ($ / kWh) across all charging hubs, updated in real time.
*   **Interactive Station Search & Filters**: Search by name or city, with precise filtering by Charger Type (AC/DC), port status (Available, Busy, Maintenance), or City.
*   **Smart Numeric Sorting**: Sort stations dynamically by Latest created, Power output (kW), or Price per kWh (with free stations correctly sorted as $0.00).
*   **Slot Reservations**: Conflicting-slot checks on ports to reserve future charging sessions. Booking confirmations redirect drivers straight to their Booking lists.
*   **Immediate Live Charging**: Start an immediate session on any open port. Set optional limits (cost or time) and watch real-time simulated stats.
*   **Session History**: A persistent archive showing previous active sessions, completed sessions, and rejected bookings.
*   **Mobile-First Design**: Seamless layout transition featuring a slide-out hamburger navigation drawer and blurred overlays on viewports `< 768px`.
*   **Branded Footer**: Premium, minimal site footer on the dashboard providing essential links (Privacy Policy, Terms of Service, Support, Contact).

---

### 👑 Admin Control Panel
*   **Live Analytics & Metrics**: Total stations, active count, occupied ports, and estimated total revenue are updated dynamically.
*   **Station Management**: Add new hubs (supporting file uploads for images), update details (total ports, rate per kWh, amenities), or delete stations.
*   **Amenities/Facilities Tags**: Assign WiFi, Cafe, Parking, Security, or Restrooms tag options to stations.
*   **Booking Approvals & Operations**: Monitor incoming bookings, approve/reject reservations, and manually start/stop charging sessions to release ports.
*   **User Management**: Live list of registered members showing a header badge with the total user count. Admins can delete standard users, immediately revoking active sessions.

---

## 🛠️ Technology Stack
*   **Frontend**: HTML5, Vanilla JavaScript (ES6+), FontAwesome Icons, Chart.js.
*   **Backend**: Node.js, Express.js.
*   **Database & Auth**: Supabase (PostgreSQL database with Realtime API) & Supabase Auth.
*   **Design & Theme**: High-end Dark Theme with custom glassmorphic styling, neon glows, and interactive hover micro-animations.


---

## ⚙️ Project Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) installed.

### 2. Installation
Clone this repository and install the backend dependencies:
```bash
npm install
```

### 3. Environment Variables (`.env`)
Create a `.env` file in the root folder with the following variables:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_here
ADMIN_EMAIL=admin@chargenet.com
ADMIN_PASSWORD=admin_secure_password

# Supabase Credentials
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

### 4. Seed Admin Account
To seed the initial administrator credentials into Supabase, run:
```bash
npm run seed-admin
```

### 5. Running the Application
To run the server in development mode with nodemon:
```bash
npm run dev
```
To run the server in production mode:
```bash
npm start
```
The server will bind to `http://localhost:5000`.

---

## 📂 Project Directory Structure
```text
├── client/                      # Frontend assets & scripts
│   ├── css/                     # Vanilla CSS stylesheets
│   ├── js/                      # Page-specific controllers
│   ├── assets/                  # Images & media files
│   ├── dashboard.html           # Driver main dashboard
│   ├── station.html             # Find Stations view
│   ├── station-details.html     # Charging spec & booking portal
│   ├── bookings.html            # Confirmed reservations list
│   ├── session.html             # Live charging stats page
│   ├── history.html             # Archived session listings
│   ├── admin.html               # Administration portal
│   └── index.html               # Login page
├── server/                      # Express backend source
│   ├── config/                  # Supabase integration config
│   ├── controllers/             # Auth controllers
│   ├── routes/                  # API routing definitions
│   └── server.js                # Express app entry point
└── package.json                 # Dependency configurations
```

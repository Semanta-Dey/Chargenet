/**
 * ChargeNet User Station Details & Booking Handler
 */

const BookingApp = {
    user: null,
    stationId: null,
    station: null,
    occupiedPorts: [],
    bookings: [],
    selectedPortNumber: null,

    async init() {
        // Enforce authentication
        this.user = await Auth.checkAuth('user', '/index.html');
        if (!this.user) return;

        // Display user name
        const greetingEl = document.getElementById('userNameDisplay');
        if (greetingEl) {
            greetingEl.textContent = `Hello, ${this.user.name || 'Driver'}`;
        }

        // Get station ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.stationId = urlParams.get('id');
        if (!this.stationId) {
            window.location.href = '/dashboard.html';
            return;
        }

        // Setup real-time listener for station details
        this.setupStationListener();
        this.bindEvents();
    },

    bindEvents() {
        // Logout Button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }

        // Modal triggers
        const cancelBtn = document.getElementById('cancelBookingBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeBookingModal());
        const closeBtn = document.getElementById('closeBookingModalBtn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeBookingModal());

        // Booking confirmation
        const confirmBtn = document.getElementById('confirmBookingBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.confirmBooking());

        // Live charging modal triggers
        const cancelLiveBtn = document.getElementById('cancelLiveChargeBtn');
        if (cancelLiveBtn) cancelLiveBtn.addEventListener('click', () => this.closeLiveChargeModal());
        const closeLiveBtn = document.getElementById('closeLiveChargeModalBtn');
        if (closeLiveBtn) closeLiveBtn.addEventListener('click', () => this.closeLiveChargeModal());
        const confirmLiveBtn = document.getElementById('confirmLiveChargeBtn');
        if (confirmLiveBtn) confirmLiveBtn.addEventListener('click', () => this.confirmLiveCharge());
    },

    setupStationListener() {
        // Listen to station details
        db.collection('stations').doc(this.stationId).onSnapshot((doc) => {
            if (!doc.exists) {
                this.toast('Station not found or has been deleted.', 'error');
                setTimeout(() => window.location.href = '/dashboard.html', 2000);
                return;
            }

            this.station = { id: doc.id, ...doc.data() };
            this.checkAndRender();
        }, (error) => {
            console.error('Error loading station details:', error);
            this.toast('Failed to load station information.', 'error');
        });

        // Fetch active bookings for occupancy checks (bypasses RLS)
        const fetchBookings = async () => {
            try {
                const res = await fetch(`/api/admin/stations/${this.stationId}/bookings`);
                if (!res.ok) throw new Error('Failed to fetch bookings');
                const data = await res.json();
                this.bookings = data.bookings;
                this.checkAndRender();
            } catch (error) {
                console.error('Error loading bookings for occupancy:', error);
            }
        };

        fetchBookings();
        // Poll every 5 seconds to keep it updated
        this.bookingsInterval = setInterval(fetchBookings, 5000);

        // Clean up interval when window is unloaded
        window.addEventListener('beforeunload', () => {
            if (this.bookingsInterval) {
                clearInterval(this.bookingsInterval);
            }
        });
    },

    checkAndRender() {
        if (this.station) {
            const occupied = new Set(this.station.occupiedPorts || []);
            
            if (this.bookings) {
                const now = new Date();
                this.bookings.forEach(b => {
                    const port = parseInt(b.portNumber);
                    if (!port) return;

                    if (b.status === 'charging') {
                        occupied.add(port);
                    } else if (b.status === 'approved') {
                        const start = new Date(b.date + 'T' + b.time);
                        const dur = parseInt(b.durationHours) || 1;
                        const end = new Date(start.getTime() + dur * 60 * 60 * 1000);
                        
                        if (now >= start && now <= end) {
                            occupied.add(port);
                        }
                    }
                });
            }

            this.occupiedPorts = Array.from(occupied);
            this.renderStationDetails();
        }
    },

    renderStationDetails() {
        const s = this.station;

        // Set text values
        document.getElementById('stationDetailName').textContent = s.stationName;
        document.getElementById('stationDetailAddress').textContent = `${s.address}, ${s.city}`;
        document.getElementById('detailChargerType').textContent = `${s.chargerType} Charger`;
        document.getElementById('detailMaxPower').textContent = `${s.powerKW} kW`;
        
        const rateText = s.freeCharging ? 'Free' : `$${s.pricePerKwh || 0.45} / kWh`;
        document.getElementById('detailPriceRate').textContent = rateText;

        // Render facilities
        const facilitiesSection = document.getElementById('detailFacilitiesSection');
        const facilitiesContainer = document.getElementById('detailFacilitiesContainer');
        
        if (facilitiesSection && facilitiesContainer) {
            const facilities = s.facilities || [];
            if (facilities.length > 0) {
                const icons = {
                    Parking: 'fa-square-parking',
                    Restroom: 'fa-restroom',
                    WiFi: 'fa-wifi',
                    Cafe: 'fa-mug-hot',
                    Security: 'fa-shield-halved'
                };
                
                facilitiesContainer.innerHTML = facilities.map(f => {
                    const icon = icons[f] || 'fa-star';
                    return `
                        <span class="facility-badge" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; color: var(--primary-color);">
                            <i class="fa-solid ${icon}"></i>
                            ${f}
                        </span>
                    `;
                }).join('');
                facilitiesSection.style.display = 'block';
            } else {
                facilitiesSection.style.display = 'none';
            }
        }

        // Available ports banner
        const isStationOpen = s.status === 'Available' || s.status === 'Active';
        const banner = document.getElementById('stationPortsBanner');
        const computedAvailable = Math.max(0, parseInt(s.totalPorts) - (this.occupiedPorts || []).length);
        banner.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 0.5rem; margin-right: 5px; color: ${isStationOpen ? 'var(--success)' : 'var(--warning)'};"></i> ${computedAvailable} of ${s.totalPorts} Ports Available`;

        // Dynamic Total Ports Label
        const totalPortsLabel = document.getElementById('detailTotalPortsLabel');
        if (totalPortsLabel) {
            totalPortsLabel.textContent = `${s.totalPorts || 0} Total Ports`;
        }

        // Hero image
        const img = document.getElementById('stationHeroImg');
        if (s.imageUrl) {
            img.src = s.imageUrl;
        } else {
            img.src = './assets/images/station_hub_1776618964384.png';
        }

        // Render port list
        const container = document.getElementById('portListContainer');
        const total = parseInt(s.totalPorts) || 1;
        
        let html = '';
        for (let i = 1; i <= total; i++) {
            const isPortOccupied = this.occupiedPorts.includes(i);
            const isPortAvailable = isStationOpen && !isPortOccupied;
            const statusText = isPortAvailable ? 'Available' : 'Occupied';
            const statusClass = isPortAvailable ? 'available' : 'occupied';
            const iconClass = isPortAvailable ? 'active' : '';
            const icon = isPortAvailable ? 'fa-bolt-lightning' : 'fa-plug-circle-bolt';

            html += `
                <div class="port-item">
                    <div class="port-left">
                        <div class="port-icon ${iconClass}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="port-details">
                            <h4>Port ${i} - ${s.connectorType}</h4>
                            <p>Up to ${s.powerKW} kW output</p>
                        </div>
                    </div>
                    <div class="port-actions">
                        <span class="port-status-text ${statusClass}">${statusText}</span>
                        ${isPortAvailable ? `
                            <button class="btn btn-book" onclick="BookingApp.openBookingModal(${i})">Book Slot</button>
                            <button class="btn btn-start" onclick="BookingApp.startChargingImmediate('${s.chargerType}', ${i})">Start Charge</button>
                        ` : `
                            <button class="btn btn-disabled" disabled>Book Slot</button>
                            <button class="btn btn-disabled" disabled>Start Charge</button>
                        `}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    },

    // ============ BOOKING MODAL ACTIONS ============
    openBookingModal(portNumber) {
        this.selectedPortNumber = portNumber;
        const modal = document.getElementById('bookingModal');
        if (modal) {
            // Set default date to today (using local time instead of UTC to avoid date shifting)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;
            document.getElementById('bookingDate').value = today;

            // Set default time to now
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            document.getElementById('bookingTime').value = timeStr;

            // Pre-select charger type if possible
            document.getElementById('bookingChargerType').value = this.station.chargerType || 'AC';

            modal.classList.add('active');
        }
    },

    closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        if (modal) modal.classList.remove('active');
    },

    async confirmBooking() {
        const date = document.getElementById('bookingDate').value;
        const time = document.getElementById('bookingTime').value;
        const chargerType = document.getElementById('bookingChargerType').value;
        const durationHours = parseInt(document.getElementById('bookingDuration').value) || 1;

        if (!date || !time) {
            this.toast('Please select date and time.', 'error');
            return;
        }

        const btn = document.getElementById('confirmBookingBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

        try {
            // Overlap check
            const startNew = new Date(date + 'T' + time);
            const endNew = new Date(startNew.getTime() + durationHours * 60 * 60 * 1000);

            // Check if booking is in the past
            if (startNew < new Date()) {
                alert('You cannot book a slot in the past. Please select a valid future date and time.');
                btn.disabled = false;
                btn.innerHTML = 'Confirm Booking';
                return;
            }

            // Fetch all bookings for this station from the Express API (bypassing RLS)
            const response = await fetch(`/api/admin/stations/${this.station.id}/bookings`);
            if (!response.ok) {
                throw new Error('Failed to check existing bookings.');
            }
            const { bookings } = await response.json();

            let hasOverlap = false;
            bookings.forEach(b => {
                // Client-side filtering to prevent index requirements
                if (parseInt(b.portNumber) !== this.selectedPortNumber) return;
                if (!['approved', 'charging'].includes(b.status)) return;

                const startExist = new Date(b.date + 'T' + b.time);
                let endExist;
                if (b.status === 'charging') {
                    const chargeStart = new Date(b.createdAt || startExist);
                    endExist = new Date(Math.max(new Date().getTime(), chargeStart.getTime() + 2 * 60 * 60 * 1000));
                } else {
                    const dur = parseInt(b.durationHours) || 1;
                    endExist = new Date(startExist.getTime() + dur * 60 * 60 * 1000);
                }

                if (startNew < endExist && startExist < endNew) {
                    hasOverlap = true;
                }
            });

            if (hasOverlap) {
                alert('This port is already booked or occupied for the selected time range.');
                btn.disabled = false;
                btn.innerHTML = 'Confirm Booking';
                return;
            }

            const newBooking = {
                userId: this.user.uid,
                userEmail: this.user.email,
                userName: this.user.name || 'EV Driver',
                stationId: this.station.id,
                stationName: this.station.stationName,
                date,
                time,
                chargerType,
                durationHours,
                portNumber: this.selectedPortNumber,
                status: 'approved',
                createdAt: new Date().toISOString()
            };

            await db.collection('bookings').add(newBooking);

            this.toast('Booking confirmed successfully! Redirecting...', 'success');
            this.closeBookingModal();
            setTimeout(() => {
                window.location.href = 'bookings.html';
            }, 1000);
        } catch (e) {
            console.error('Confirm booking error:', e);
            this.toast('Failed to create booking.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Confirm Booking';
        }
    },    // ============ IMMEDIATE CHARGING ============
    pendingImmediateCharge: null,

    async startChargingImmediate(chargerType, portNumber) {
        this.pendingImmediateCharge = { chargerType, portNumber };
        this.openLiveChargeModal();
    },

    openLiveChargeModal() {
        document.getElementById('chargeDurationLimit').value = '';
        document.getElementById('chargeCostLimit').value = '';
        document.getElementById('liveChargeModal').classList.add('active');
    },

    closeLiveChargeModal() {
        document.getElementById('liveChargeModal').classList.remove('active');
        this.pendingImmediateCharge = null;
    },

    async confirmLiveCharge() {
        if (!this.pendingImmediateCharge) return;
        const { chargerType, portNumber } = this.pendingImmediateCharge;
        
        const durationLimit = document.getElementById('chargeDurationLimit').value;
        const costLimit = document.getElementById('chargeCostLimit').value;

        const confirmLiveBtn = document.getElementById('confirmLiveChargeBtn');
        confirmLiveBtn.disabled = true;
        confirmLiveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';

        try {
            const stationRef = db.collection('stations').doc(this.station.id);
            let newBookingId = '';

            // Run a transaction to ensure port decrement is thread-safe
            await db.runTransaction(async (transaction) => {
                const sDoc = await transaction.get(stationRef);
                if (!sDoc.exists) throw new Error("Station not found!");
                
                const available = parseInt(sDoc.data().availablePorts) || 0;
                if (available <= 0) throw new Error("Sorry, no available ports left!");

                const occupiedPorts = sDoc.data().occupiedPorts || [];
                if (!occupiedPorts.includes(portNumber)) {
                    occupiedPorts.push(portNumber);
                }

                // Decrement ports and update occupied list
                transaction.update(stationRef, { 
                    availablePorts: available - 1,
                    occupiedPorts: occupiedPorts
                });

                // Create a booking record
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                const bookingRef = db.collection('bookings').doc();
                newBookingId = bookingRef.id;

                const bookingData = {
                    userId: this.user.uid,
                    userEmail: this.user.email,
                    userName: this.user.name || 'EV Driver',
                    stationId: this.station.id,
                    stationName: this.station.stationName,
                    date: today,
                    time: timeStr,
                    chargerType: chargerType,
                    portNumber: portNumber,
                    status: 'charging',
                    createdAt: now.toISOString()
                };

                if (durationLimit) {
                    bookingData.durationLimitMinutes = parseFloat(durationLimit);
                }
                if (costLimit) {
                    bookingData.costLimitUSD = parseFloat(costLimit);
                }

                transaction.set(bookingRef, bookingData);
            });

            this.toast('Charging started successfully! Port is now occupied.', 'success');
            this.closeLiveChargeModal();
            setTimeout(() => {
                window.location.href = `session.html?bookingId=${newBookingId}`;
            }, 1000);

        } catch (e) {
            console.error(e);
            this.toast(e.message || 'Failed to start session.', 'error');
        } finally {
            confirmLiveBtn.disabled = false;
            confirmLiveBtn.innerHTML = 'Start Session';
        }
    },
    // ============ UI UTILS ============
    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            toast.style.transform = 'translateX(100px)'; 
            setTimeout(() => toast.remove(), 300); 
        }, 3500);
    }
};

// Initialize details page
document.addEventListener('DOMContentLoaded', () => BookingApp.init());

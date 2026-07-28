/**
 * ChargeNet User Sessions and Charging Simulator
 */

const SessionApp = {
    user: null,
    bookingId: null,
    booking: null,
    station: null,
    simInterval: null,

    async init() {
        // Enforce authentication
        this.user = await Auth.checkAuth('user', '/index.html');
        if (!this.user) return;

        // Display user name
        const greetingEl = document.getElementById('userNameDisplay');
        if (greetingEl) {
            greetingEl.textContent = `Hello, ${this.user.name || 'Driver'}`;
        }

        // Check for bookingId parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.bookingId = urlParams.get('bookingId');

        if (this.bookingId) {
            this.setupSessionListener();
        } else {
            // Check if there is an active session running
            this.checkForActiveSession();
        }

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

        // Stop charging button
        const stopBtn = document.getElementById('stopChargingBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (this.bookingId && this.booking) {
                    this.stopChargingSession();
                }
            });
        }

        // Pay button
        const payBtn = document.getElementById('payBtn');
        if (payBtn) {
            payBtn.addEventListener('click', async () => {
                payBtn.disabled = true;
                payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
                try {
                    await db.collection('bookings').doc(this.bookingId).update({
                        paid: true,
                        updatedAt: new Date().toISOString()
                    });
                    this.toast('Payment processed successfully!', 'success');
                    
                    // Manually update local state and re-render instantly to avoid depending on Realtime listener
                    this.booking.paid = true;
                    this.renderReceipt();
                } catch (e) {
                    console.error('Payment error:', e);
                    this.toast('Payment failed. Please try again.', 'error');
                    payBtn.disabled = false;
                    payBtn.innerHTML = 'Pay Online';
                }
            });
        }
    },

    async checkForActiveSession() {
        try {
            // Search if there is a booking with status = 'charging' for this user
            const snapshot = await db.collection('bookings')
                .where('userId', '==', this.user.uid)
                .where('status', '==', 'charging')
                .limit(1)
                .get();

            if (!snapshot.empty) {
                // Redirect to self with bookingId
                const activeBookingId = snapshot.docs[0].id;
                window.location.href = `session.html?bookingId=${activeBookingId}`;
            } else {
                const noActiveCard = document.getElementById('noActiveSessionCard');
                if (noActiveCard) noActiveCard.style.display = 'block';
            }
        } catch (e) {
            console.error('Check active session error:', e);
            const noActiveCard = document.getElementById('noActiveSessionCard');
            if (noActiveCard) noActiveCard.style.display = 'block';
        }
    },

    setupSessionListener() {
        db.collection('bookings').doc(this.bookingId).onSnapshot(async (doc) => {
            if (!doc.exists) {
                this.toast('Session record not found.', 'error');
                setTimeout(() => window.location.href = 'dashboard.html', 2000);
                return;
            }

            this.booking = { id: doc.id, ...doc.data() };

            // Fetch corresponding station to get pricing rate
            try {
                const sDoc = await db.collection('stations').doc(this.booking.stationId).get();
                if (sDoc.exists) {
                    this.station = sDoc.data();
                }
            } catch (e) { console.error('Error fetching station for pricing:', e); }

            this.handleBookingState();
        }, (error) => {
            console.error('Session listener error:', error);
        });
    },

    handleBookingState() {
        // Clear simulation interval if it exists
        if (this.simInterval) {
            clearInterval(this.simInterval);
            this.simInterval = null;
        }

        const activeCard = document.getElementById('activeSessionCard');
        const receiptCard = document.getElementById('sessionReceiptCard');
        const noActiveCard = document.getElementById('noActiveSessionCard');

        activeCard.style.display = 'none';
        receiptCard.style.display = 'none';
        if (noActiveCard) noActiveCard.style.display = 'none';

        if (this.booking.status === 'charging') {
            activeCard.style.display = 'block';
            this.startSimulation();
        } else if (this.booking.status === 'completed') {
            receiptCard.style.display = 'block';
            this.renderReceipt();
        } else {
            if (noActiveCard) noActiveCard.style.display = 'block';
        }
    },

    // ============ SIMULATION LOOP ============
    startSimulation() {
        document.getElementById('sessionStationName').textContent = this.booking.stationName;

        const startTime = new Date(this.booking.createdAt);
        const chargerType = this.booking.chargerType || 'DC';
        const basePower = chargerType === 'DC' ? 120 : 22; // kW rate
        const ratePerKwh = this.station ? (parseFloat(this.station.pricePerKwh) || 0.45) : 0.45;
        const isFree = this.station ? this.station.freeCharging : false;

        // Render Limits Display
        const limitsDisplay = document.getElementById('sessionLimitsDisplay');
        const limitDurationRow = document.getElementById('limitDurationRow');
        const limitDurationVal = document.getElementById('limitDurationVal');
        const limitCostRow = document.getElementById('limitCostRow');
        const limitCostVal = document.getElementById('limitCostVal');

        if (limitsDisplay) {
            let hasLimit = false;
            if (this.booking.durationLimitMinutes) {
                limitDurationRow.style.display = 'flex';
                const mins = parseFloat(this.booking.durationLimitMinutes);
                if (mins < 1) {
                    const secs = Math.round(mins * 60);
                    limitDurationVal.textContent = `${secs} Second${secs !== 1 ? 's' : ''}`;
                } else {
                    limitDurationVal.textContent = `${mins} Min${mins !== 1 ? 's' : ''}`;
                }
                hasLimit = true;
            } else {
                limitDurationRow.style.display = 'none';
            }

            if (this.booking.costLimitUSD) {
                limitCostRow.style.display = 'flex';
                limitCostVal.textContent = `$${parseFloat(this.booking.costLimitUSD).toFixed(2)}`;
                hasLimit = true;
            } else {
                limitCostRow.style.display = 'none';
            }

            limitsDisplay.style.display = hasLimit ? 'block' : 'none';
        }

        const updateSimulation = () => {
            const now = new Date();
            const elapsedMs = now - startTime;
            const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

            // Format Timer: HH:MM:SS
            const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(elapsedSeconds % 60).padStart(2, '0');
            document.getElementById('sessionTimer').textContent = `${hours}:${minutes}:${seconds}`;

            // Simulate charging rate fluctuation (power output in kW)
            const fluctuation = (Math.random() * 10 - 5); // +/- 5kW fluctuation
            const currentPower = Math.max(5, basePower + fluctuation);
            document.getElementById('sessionPower').textContent = `${currentPower.toFixed(1)} kW`;

            // Calculate Energy Delivered (kWh)
            // energy = (power * hours) -> kW * (seconds / 3600)
            const energyKwh = (basePower * (elapsedSeconds / 3600));
            document.getElementById('sessionEnergy').textContent = `${energyKwh.toFixed(3)} kWh`;

            // Calculate Battery SOC percentage
            // Start at 20%, add 1% every 8 seconds (DC) or 40 seconds (AC)
            const step = chargerType === 'DC' ? 8 : 40;
            const batteryPercent = Math.min(100, 20 + Math.floor(elapsedSeconds / step));
            document.getElementById('sessionBattery').textContent = `${batteryPercent}%`;

            // Update Progress Ring color gradient arc
            const ring = document.getElementById('sessionProgressRing');
            if (ring) {
                ring.style.background = `conic-gradient(var(--success) ${batteryPercent}%, rgba(255, 255, 255, 0.05) 0)`;
            }

            // Calculate Cost Charged
            const cost = isFree ? 0 : energyKwh * ratePerKwh;
            document.getElementById('sessionCost').textContent = `$${cost.toFixed(2)}`;

            // Check if duration limit is reached
            if (this.booking.durationLimitMinutes) {
                const limitSeconds = Math.round(parseFloat(this.booking.durationLimitMinutes) * 60);
                if (elapsedSeconds >= limitSeconds) {
                    clearInterval(this.simInterval);
                    this.toast('Duration limit reached! Stopping session automatically...', 'success');
                    this.stopChargingSession(true);
                    return;
                }
            }

            // Check if cost limit is reached
            if (this.booking.costLimitUSD) {
                const limitCost = parseFloat(this.booking.costLimitUSD);
                if (cost >= limitCost) {
                    clearInterval(this.simInterval);
                    this.toast('Cost limit reached! Stopping session automatically...', 'success');
                    this.stopChargingSession(true);
                    return;
                }
            }

            // Check if battery is fully charged (100%)
            if (batteryPercent >= 100) {
                clearInterval(this.simInterval);
                this.toast('Battery fully charged! Stopping session automatically...', 'success');
                this.stopChargingSession(true);
            }
        };

        // Run immediately then schedule interval
        updateSimulation();
        this.simInterval = setInterval(updateSimulation, 1000);
    },

    async stopChargingSession(isAuto = false) {
        if (!isAuto) {
            const confirmStop = confirm('Are you sure you want to stop charging?');
            if (!confirmStop) return;
        }

        clearInterval(this.simInterval);

        const btn = document.getElementById('stopChargingBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Stopping...';

        try {
            // Fetch final simulated data
            const startTime = new Date(this.booking.createdAt);
            const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
            const chargerType = this.booking.chargerType || 'DC';
            const basePower = chargerType === 'DC' ? 120 : 22;
            const energyKwh = parseFloat((basePower * (elapsedSeconds / 3600)).toFixed(3));
            const ratePerKwh = this.station ? (parseFloat(this.station.pricePerKwh) || 0.45) : 0.45;
            const isFree = this.station ? this.station.freeCharging : false;
            const finalCost = isFree ? 0 : parseFloat((energyKwh * ratePerKwh).toFixed(2));

            // Cache metrics in localStorage before calling API to survive database schema limitations
            localStorage.setItem(`receipt_${this.bookingId}`, JSON.stringify({
                cost: finalCost,
                energyKwh: energyKwh,
                durationSeconds: elapsedSeconds
            }));

            const token = await auth.getAccessToken();
            if (!token) {
                throw new Error("You must be logged in to stop a charging session.");
            }

            const response = await fetch(`/api/bookings/${this.bookingId}/stop`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.message || "Failed to stop charging session.");
            }

            this.toast('Session stopped! Generating receipt...', 'success');

            // Manually transition UI state immediately to avoid depending on Realtime listener
            this.booking.status = 'completed';
            this.handleBookingState();
        } catch (e) {
            console.error('Error stopping charging session:', e);
            this.toast('Failed to stop session.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Stop Charging';
        }
    },

    renderReceipt() {
        const b = this.booking;
        
        let cached = {};
        try {
            const cachedStr = localStorage.getItem(`receipt_${b.id}`);
            if (cachedStr) cached = JSON.parse(cachedStr);
        } catch (e) {}

        // Prioritize cached receipt data from localStorage to keep the values locked in the UI
        // even if database timestamps change (e.g. during payment updates)
        const cost = cached.cost !== undefined && cached.cost !== null ? cached.cost : (b.cost || 0);
        const energyKwh = cached.energyKwh !== undefined && cached.energyKwh !== null ? cached.energyKwh : (b.energyKwh || 0);
        const elapsed = cached.durationSeconds !== undefined && cached.durationSeconds !== null ? cached.durationSeconds : (b.durationSeconds || 0);

        const ratePerKwh = this.station ? (parseFloat(this.station.pricePerKwh) || 0.45) : 0.45;
        const isFree = this.station ? this.station.freeCharging : false;

        document.getElementById('receiptStationName').textContent = b.stationName;
        document.getElementById('receiptCost').textContent = `$${cost.toFixed(2)}`;
        
        // Format Duration
        const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        
        document.getElementById('receiptDuration').textContent = `${hours}:${minutes}:${seconds}`;
        document.getElementById('receiptEnergy').textContent = `${energyKwh} kWh`;
        document.getElementById('receiptRate').textContent = isFree ? 'Free' : `$${ratePerKwh.toFixed(2)}/kWh`;
        document.getElementById('receiptSessionId').textContent = `#${b.id.substring(0, 8).toUpperCase()}`;

        // Toggle Pay button visibility
        const payBtn = document.getElementById('payBtn');
        const backBtn = document.getElementById('backToSessionsBtn');
        if (payBtn && backBtn) {
            backBtn.style.display = 'block'; // Always show back button
            if (b.paid === true || cost <= 0) {
                // Paid state: Disable payBtn and style as Paid badge
                payBtn.disabled = true;
                payBtn.style.background = 'rgba(16, 185, 129, 0.2)';
                payBtn.style.color = 'var(--success)';
                payBtn.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                payBtn.style.boxShadow = 'none';
                payBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Paid';
            } else {
                // Unpaid state: Enable payBtn and style as primary button
                payBtn.disabled = false;
                payBtn.style.background = 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))';
                payBtn.style.color = 'white';
                payBtn.style.border = 'none';
                payBtn.style.boxShadow = '0 4px 14px 0 rgba(59, 130, 246, 0.3)';
                payBtn.innerHTML = 'Pay Online';
            }
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

// Initialize
document.addEventListener('DOMContentLoaded', () => SessionApp.init());

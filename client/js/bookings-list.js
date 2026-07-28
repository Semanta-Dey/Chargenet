/**
 * ChargeNet User Bookings List handler
 */

const BookingsListApp = {
    user: null,

    async init() {
        // Enforce authentication
        this.user = await Auth.checkAuth('user', '/index.html');
        if (!this.user) return;

        // Display user name
        const greetingEl = document.getElementById('userNameDisplay');
        if (greetingEl) {
            greetingEl.textContent = `Hello, ${this.user.name || 'Driver'}`;
        }

        this.loadBookings();
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

        // Live charging modal triggers
        const cancelLiveBtn = document.getElementById('cancelLiveChargeBtn');
        if (cancelLiveBtn) cancelLiveBtn.addEventListener('click', () => this.closeLiveChargeModal());
        const closeLiveBtn = document.getElementById('closeLiveChargeModalBtn');
        if (closeLiveBtn) closeLiveBtn.addEventListener('click', () => this.closeLiveChargeModal());
        const confirmLiveBtn = document.getElementById('confirmLiveChargeBtn');
        if (confirmLiveBtn) confirmLiveBtn.addEventListener('click', () => this.confirmLiveCharge());
    },

    async loadBookings() {
        const tbody = document.getElementById('bookingsTableBody');
        const emptyState = document.getElementById('bookingsEmptyState');
        const tableWrapper = document.getElementById('historyTableWrapper');

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:var(--primary-color);"></i></td></tr>';
        emptyState.style.display = 'none';

        try {
            db.collection('bookings')
                .where('userId', '==', this.user.uid)
                .onSnapshot((snapshot) => {
                    this.bookings = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(b => b.status !== 'completed') // Only display pending, approved, rejected, and charging
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                    this.renderBookingsList();
                });
        } catch (e) {
            console.error('Error loading bookings:', e);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--danger);">Failed to load bookings list.</td></tr>';
        }
    },

    renderBookingsList() {
        const tbody = document.getElementById('bookingsTableBody');
        const emptyState = document.getElementById('bookingsEmptyState');
        const tableWrapper = document.getElementById('historyTableWrapper');

        if (!this.bookings || this.bookings.length === 0) {
            tbody.innerHTML = '';
            tableWrapper.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        tableWrapper.style.display = 'block';
        emptyState.style.display = 'none';
        tbody.innerHTML = this.bookings.map(b => {
            const statusClass = (b.status || 'pending').toLowerCase();
            const durationStr = b.durationHours ? ` (${b.durationHours} hr${b.durationHours > 1 ? 's' : ''})` : '';
            const timeStr = new Date(b.date + 'T' + b.time).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) + durationStr;

            const portStr = b.portNumber ? `Port ${b.portNumber}` : 'N/A';

            // Check if booking is within 1 hour or has started (allow deletion always if rejected)
            const diffMs = new Date(b.date + 'T' + b.time) - new Date();
            const canDelete = b.status === 'rejected' || diffMs > 60 * 60 * 1000;

            const deleteBtnHtml = canDelete 
                ? `<button class="btn btn-outline" style="padding: 8px 16px; font-size:0.8rem; border: 1px solid var(--danger); color: var(--danger); background: transparent; border-radius: 8px; cursor: pointer;" onclick="BookingsListApp.deleteBooking('${b.id}', '${b.date}', '${b.time}', '${b.status}')">Delete</button>`
                : `<button class="btn btn-outline" style="padding: 8px 16px; font-size:0.8rem; border: 1px solid rgba(239, 68, 68, 0.4); color: rgba(239, 68, 68, 0.4); background: transparent; border-radius: 8px; cursor: not-allowed;" onclick="alert('You cannot delete a booking that starts within 1 hour or has already started.')">Delete</button>`;

            let actionBtn = '';
            if (b.status === 'approved') {
                actionBtn = `
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn btn-start" style="padding: 8px 16px; font-size:0.8rem; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);" onclick="BookingsListApp.startChargingFromHistory('${b.id}', '${b.stationId}')">Start Charge</button>
                        ${deleteBtnHtml}
                    </div>
                `;
            } else if (b.status === 'charging') {
                actionBtn = `<a href="session.html?bookingId=${b.id}" class="btn btn-primary" style="padding: 8px 16px; font-size:0.8rem; background: linear-gradient(135deg, #06B6D4, #0891B2); border: none; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 10px rgba(6, 182, 212, 0.2);">View Active</a>`;
            } else if (b.status === 'rejected') {
                actionBtn = `
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <a href="station-details.html?id=${b.stationId}" class="btn btn-primary" style="padding: 8px 16px; font-size:0.8rem; background: linear-gradient(135deg, var(--primary-color), var(--primary-hover)); border: none; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);">
                            <i class="fa-solid fa-charging-station"></i> Rebook
                        </a>
                        ${deleteBtnHtml}
                    </div>
                `;
            } else {
                actionBtn = `
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${deleteBtnHtml}
                    </div>
                `;
            }

            let statusHtml = `<span class="table-status ${statusClass}">${b.status}</span>`;
            if (b.status === 'rejected') {
                statusHtml += `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 6px; font-weight: 500; line-height: 1.3;"><i class="fa-solid fa-triangle-exclamation"></i> Any error to station or that port.</div>`;
            }

            return `
                <tr>
                    <td style="font-weight:600;">${b.stationName}</td>
                    <td>${timeStr}</td>
                    <td>${b.chargerType}</td>
                    <td>${portStr}</td>
                    <td>${statusHtml}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    },
    pendingHistoryCharge: null,

    async startChargingFromHistory(bookingId, stationId) {
        this.pendingHistoryCharge = { bookingId, stationId };
        this.openLiveChargeModal();
    },

    openLiveChargeModal() {
        document.getElementById('chargeDurationLimit').value = '';
        document.getElementById('chargeCostLimit').value = '';
        document.getElementById('liveChargeModal').classList.add('active');
    },

    closeLiveChargeModal() {
        document.getElementById('liveChargeModal').classList.remove('active');
        this.pendingHistoryCharge = null;
    },

    async confirmLiveCharge() {
        if (!this.pendingHistoryCharge) return;
        const { bookingId, stationId } = this.pendingHistoryCharge;

        const durationLimit = document.getElementById('chargeDurationLimit').value;
        const costLimit = document.getElementById('chargeCostLimit').value;

        const confirmLiveBtn = document.getElementById('confirmLiveChargeBtn');
        confirmLiveBtn.disabled = true;
        confirmLiveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';

        try {
            const token = await auth.getAccessToken();
            if (!token) {
                throw new Error("You must be logged in to start a charging session.");
            }

            const response = await fetch(`/api/bookings/${bookingId}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    durationLimitMinutes: durationLimit ? parseFloat(durationLimit) : null,
                    costLimitUSD: costLimit ? parseFloat(costLimit) : null
                })
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.message || "Failed to start charging session.");
            }

            this.toast('Session started! Loading session dashboard...', 'success');
            this.closeLiveChargeModal();
            setTimeout(() => {
                window.location.href = `session.html?bookingId=${bookingId}`;
            }, 1000);

        } catch (e) {
            console.error(e);
            this.toast(e.message || 'Failed to start session.', 'error');
        } finally {
            confirmLiveBtn.disabled = false;
            confirmLiveBtn.innerHTML = 'Start Session';
        }
    },
    async deleteBooking(bookingId, date, time, status) {
        if (status !== 'rejected') {
            const bookingStart = new Date(date + 'T' + time);
            const now = new Date();
            const diffMs = bookingStart - now;
            const oneHourMs = 60 * 60 * 1000;

            if (diffMs <= oneHourMs) {
                alert("You cannot delete a booking that starts within 1 hour or has already started.");
                return;
            }
        }

        const confirmDelete = confirm("Are you sure you want to cancel and delete this booking?");
        if (!confirmDelete) return;

        try {
            const token = await auth.getAccessToken();
            if (!token) {
                this.toast("You must be logged in to delete a booking.", "error");
                return;
            }

            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.message || "Failed to delete booking.");
            }

            // Instantly remove from local list and re-render for real-time responsiveness
            this.bookings = this.bookings.filter(b => b.id !== bookingId);
            this.renderBookingsList();

            this.toast("Booking deleted successfully!", "success");
        } catch (e) {
            console.error("Delete booking error:", e);
            this.toast(e.message || "Failed to delete booking.", "error");
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
document.addEventListener('DOMContentLoaded', () => BookingsListApp.init());

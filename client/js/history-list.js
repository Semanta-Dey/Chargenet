/**
 * ChargeNet User Charging History List handler
 */

const HistoryListApp = {
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

        this.loadHistory();
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
    },

    async loadHistory() {
        const tbody = document.getElementById('historyTableBody');
        const emptyState = document.getElementById('historyEmptyState');
        const tableWrapper = document.getElementById('historyTableWrapper');

        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:var(--primary-color);"></i></td></tr>';
        emptyState.style.display = 'none';

        try {
            db.collection('bookings')
                .where('userId', '==', this.user.uid)
                .where('status', '==', 'completed')
                .onSnapshot((snapshot) => {
                    const bookings = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                    if (bookings.length === 0) {
                        tbody.innerHTML = '';
                        tableWrapper.style.display = 'none';
                        emptyState.style.display = 'block';
                        return;
                    }

                    tableWrapper.style.display = 'block';
                    emptyState.style.display = 'none';
                    tbody.innerHTML = bookings.map(b => {
                        const durationStr = b.durationHours ? ` (${b.durationHours} hr${b.durationHours > 1 ? 's' : ''})` : '';
                        const timeStr = new Date(b.date + 'T' + b.time).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) + durationStr;

                        const chargerStr = b.portNumber ? `${b.chargerType} (Port ${b.portNumber})` : b.chargerType;

                        // Format duration seconds to HH:MM:SS
                        let cached = {};
                        try {
                            const cachedStr = localStorage.getItem(`receipt_${b.id}`);
                            if (cachedStr) cached = JSON.parse(cachedStr);
                        } catch (e) {}

                        const elapsed = b.durationSeconds !== undefined && b.durationSeconds !== null ? b.durationSeconds : (cached.durationSeconds || 0);
                        const energyKwh = b.energyKwh !== undefined && b.energyKwh !== null ? b.energyKwh : (cached.energyKwh || 0);
                        const cost = b.cost !== undefined && b.cost !== null ? b.cost : (cached.cost || 0);

                        const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
                        const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
                        const seconds = String(elapsed % 60).padStart(2, '0');
                        const durationFormatted = `${hours}:${minutes}:${seconds}`;

                        const isPaid = b.paid === true || cost <= 0;
                        const paidBadge = isPaid 
                            ? `<span class="table-status approved">Paid</span>`
                            : `<span class="table-status rejected">Unpaid</span>`;

                        const actionBtn = `<a href="session.html?bookingId=${b.id}" class="btn btn-outline" style="padding: 8px 16px; font-size:0.8rem; border-radius: 8px; text-decoration: none; display: inline-block;">View Receipt</a>`;

                        return `
                            <tr>
                                <td style="font-weight:600;">${b.stationName}</td>
                                <td>${timeStr}</td>
                                <td>${chargerStr}</td>
                                <td>${durationFormatted}</td>
                                <td>${energyKwh} kWh</td>
                                <td>$${cost.toFixed(2)}</td>
                                <td>${paidBadge}</td>
                                <td>${actionBtn}</td>
                            </tr>
                        `;
                    }).join('');
                });
        } catch (e) {
            console.error('Error loading history:', e);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--danger);">Failed to load history list.</td></tr>';
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => HistoryListApp.init());

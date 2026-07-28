/**
 * ChargeNet User Station Search & Filter Portal
 */

const StationApp = {
    user: null,
    stations: [],

    async init() {
        // Enforce user authentication
        this.user = await Auth.checkAuth('user', '/index.html');
        if (!this.user) return;

        // Display user name
        const greetingEl = document.getElementById('userNameDisplay');
        if (greetingEl) {
            greetingEl.textContent = `Hello, ${this.user.name || 'Driver'}`;
        }

        // Setup real-time listener for stations
        this.setupRealtimeListener();

        // Bind filter event listeners
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

        // Input search and filters listeners
        document.getElementById('stationSearchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('filterCity').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterType').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterStatus').addEventListener('change', () => this.applyFilters());
        document.getElementById('sortBy').addEventListener('change', () => this.applyFilters());
    },

    setupRealtimeListener() {
        const grid = document.getElementById('stationGrid');
        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i></div>';

        db.collection('stations').onSnapshot((snapshot) => {
            this.stations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Populate city dropdown options
            this.populateCities();

            // Extract initial search if redirected from dashboard
            const urlParams = new URLSearchParams(window.location.search);
            const initialSearch = urlParams.get('search');
            if (initialSearch) {
                const searchInput = document.getElementById('stationSearchInput');
                if (searchInput) searchInput.value = initialSearch;
                // Clear query parameter from URL bar silently
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            // Apply all filters and render
            this.applyFilters();
        }, (error) => {
            console.error('Error loading stations:', error);
            grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem; color: var(--danger);">Failed to load stations.</div>';
        });
    },

    populateCities() {
        const select = document.getElementById('filterCity');
        if (!select) return;
        const currentVal = select.value;
        const cities = [...new Set(this.stations.map(s => s.city).filter(Boolean))].sort();
        
        select.innerHTML = '<option value="">All Cities</option>' + 
            cities.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
    },

    applyFilters() {
        const query = document.getElementById('stationSearchInput').value.toLowerCase();
        const city = document.getElementById('filterCity').value;
        const type = document.getElementById('filterType').value;
        const status = document.getElementById('filterStatus').value;
        const sort = document.getElementById('sortBy').value;

        let filtered = this.stations.filter(s => {
            const matchQuery = !query || 
                s.stationName.toLowerCase().includes(query) || 
                (s.city || '').toLowerCase().includes(query) || 
                (s.address || '').toLowerCase().includes(query);
            const matchCity = !city || s.city === city;
            const matchType = !type || s.chargerType === type;
            const matchStatus = !status || s.status === status;

            return matchQuery && matchCity && matchType && matchStatus;
        });

        // Apply Sorting
        if (sort === 'latest') {
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (sort === 'power-desc') {
            filtered.sort((a, b) => parseFloat(b.powerKW || 0) - parseFloat(a.powerKW || 0));
        } else if (sort === 'power-asc') {
            filtered.sort((a, b) => parseFloat(a.powerKW || 0) - parseFloat(b.powerKW || 0));
        } else if (sort === 'price-asc') {
            filtered.sort((a, b) => {
                const priceA = a.freeCharging ? 0 : parseFloat(a.pricePerKwh !== undefined ? a.pricePerKwh : 0.45);
                const priceB = b.freeCharging ? 0 : parseFloat(b.pricePerKwh !== undefined ? b.pricePerKwh : 0.45);
                return priceA - priceB;
            });
        } else if (sort === 'price-desc') {
            filtered.sort((a, b) => {
                const priceA = a.freeCharging ? 0 : parseFloat(a.pricePerKwh !== undefined ? a.pricePerKwh : 0.45);
                const priceB = b.freeCharging ? 0 : parseFloat(b.pricePerKwh !== undefined ? b.pricePerKwh : 0.45);
                return priceB - priceA;
            });
        }

        this.renderStations(filtered);
    },

    renderStations(stations) {
        const grid = document.getElementById('stationGrid');
        const emptyState = document.getElementById('stationEmptyState');

        if (stations.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        grid.innerHTML = stations.map(s => {
            const statusClass = (s.status || '').toLowerCase();
            const imgSrc = s.imageUrl || './assets/images/station_hub_1776618964384.png';
            const priceText = s.freeCharging ? 'Free' : `$${s.pricePerKwh || 0.45} / kWh`;
            
            // Simulating a mock distance for UI aesthetics
            const mockDistance = (Math.random() * 8 + 0.3).toFixed(1);

            const facilities = s.facilities || [];
            const facilitiesHtml = facilities.length > 0 ? `
                <div class="card-facilities" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: -0.75rem; margin-bottom: 1.25rem;">
                    ${facilities.map(f => {
                        const icons = {
                            Parking: 'fa-square-parking',
                            Restroom: 'fa-restroom',
                            WiFi: 'fa-wifi',
                            Cafe: 'fa-mug-hot',
                            Security: 'fa-shield-halved'
                        };
                        const icon = icons[f] || 'fa-star';
                        return `
                            <span class="facility-tag" style="font-size: 0.7rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); color: var(--primary-color); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;">
                                <i class="fa-solid ${icon}"></i> ${f}
                            </span>
                        `;
                    }).join('')}
                </div>
            ` : '';

            return `
                <div class="station-card">
                    <img src="${imgSrc}" alt="${s.stationName}" class="card-img" onerror="this.src='./assets/images/station_hub_1776618964384.png'">
                    <div class="card-body">
                        <div class="card-title-row">
                            <h3>${s.stationName}</h3>
                            <span class="status-badge ${statusClass}">
                                <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> ${s.status}
                            </span>
                        </div>
                        <p class="address"><i class="fa-solid fa-location-dot"></i> ${s.address}, ${s.city} (${mockDistance} km away)</p>
                        <div class="spec-tags">
                            <span class="tag">${s.chargerType} Fast</span>
                            <span class="tag">${s.powerKW} kW</span>
                            <span class="tag">${s.connectorType}</span>
                        </div>
                        ${facilitiesHtml}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 1rem;">
                            <span style="font-weight: 700; color: var(--success); font-size: 0.95rem;">${priceText}</span>
                            <a href="station-details.html?id=${s.id}" class="btn btn-primary" style="width: auto; padding: 8px 16px; font-size: 0.85rem;">View Details</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// Auto init
document.addEventListener('DOMContentLoaded', () => StationApp.init());

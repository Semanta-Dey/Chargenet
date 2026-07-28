/**
 * ChargeNet User Dashboard - Client-Side Logic
 */

const Dashboard = {
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

        // Bind events
        this.bindEvents();

        // Load nearby stations
        this.loadNearbyStations();
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

        // Search input dynamic filtering
        const searchInput = document.querySelector('.map-search input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.applySearchFilter();
            });
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchInput.blur();
                }
            });
        }

        // Re-render chart on theme change
        window.addEventListener('themechange', () => {
            if (this.stations && this.stations.length > 0) {
                this.renderPriceChart(this.stations);
            }
        });
    },

    chart: null,

    loadNearbyStations() {
        const grid = document.getElementById('stationGrid');
        if (!grid) return;

        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i></div>';

        // Subscribe to all stations in real-time
        db.collection('stations').onSnapshot((snapshot) => {
            const allStations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.stations = allStations;

            // Apply search filter (which renders either filtered stations or default nearby stations)
            this.applySearchFilter();

            // Render the price comparison chart
            this.renderPriceChart(allStations);

        }, (error) => {
            console.error('Error loading stations:', error);
            grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem; color: var(--danger);">Failed to load stations.</div>';
        });
    },

    applySearchFilter() {
        const searchInput = document.querySelector('.map-search input');
        const grid = document.getElementById('stationGrid');
        const titleEl = document.querySelector('.station-section .grid-header h2');
        if (!searchInput || !grid) return;

        const query = searchInput.value.trim().toLowerCase();

        if (!query) {
            // Restore default view (Nearby Stations)
            if (titleEl) titleEl.textContent = 'Nearby Stations';
            
            const nearby = this.stations
                .filter(s => ['Active', 'Available', 'Busy'].includes(s.status))
                .slice(0, 3);

            if (nearby.length === 0) {
                grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem; color: var(--text-muted);">No charging stations found nearby.</div>';
            } else {
                this.renderStations(nearby, grid);
            }
        } else {
            // Filter all stations matching query
            if (titleEl) titleEl.textContent = `Search Results for "${searchInput.value.trim()}"`;

            const filtered = this.stations.filter(s => 
                s.stationName.toLowerCase().includes(query) || 
                (s.city || '').toLowerCase().includes(query) || 
                (s.address || '').toLowerCase().includes(query)
            );

            if (filtered.length === 0) {
                grid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 2rem; color: var(--text-muted);">No charging stations found matching "${searchInput.value.trim()}".</div>`;
            } else {
                this.renderStations(filtered, grid);
            }
        }
    },

    renderPriceChart(stations) {
        const ctx = document.getElementById('chartPriceComparison');
        if (!ctx) return;

        // If chart already exists, destroy it first to prevent overlapping rendering on updates
        if (this.chart) {
            this.chart.destroy();
        }

        const isLight = document.body.classList.contains('light-theme');
        const tickColor = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.5)';
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

        // Prepare labels and data
        const labels = stations.map(s => s.stationName);
        const data = stations.map(s => s.freeCharging ? 0.00 : parseFloat(s.pricePerKwh || 0.45));

        // Create new Chart instance
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price per kWh ($)',
                    data: data,
                    backgroundColor: isLight ? 'rgba(59, 130, 246, 0.65)' : 'rgba(59, 130, 246, 0.4)',
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    hoverBackgroundColor: 'rgba(16, 185, 129, 0.5)',
                    hoverBorderColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Price: $${context.raw.toFixed(2)} / kWh`;
                            }
                        },
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                        titleColor: isLight ? '#0f172a' : '#fff',
                        bodyColor: '#3b82f6',
                        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            },
                            color: tickColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: tickColor
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },

    renderStations(stations, container) {
        container.innerHTML = stations.map(s => {
            const statusClass = (s.status || '').toLowerCase();
            const imgSrc = s.imageUrl || './assets/images/station_hub_1776618964384.png';
            const priceText = s.freeCharging ? 'Free' : `$${s.pricePerKwh || 0.45} / kWh`;
            
            // Calculate a mock distance for aesthetics
            const mockDistance = (Math.random() * 5 + 0.5).toFixed(1);

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

// Start when document loaded
document.addEventListener('DOMContentLoaded', () => Dashboard.init());

/**
 * ChargeNet Admin Dashboard - Client-Side Firebase Logic
 */

const AdminApp = {
    user: null,
    stations: [],
    bookings: [],
    users: [],
    deleteTargetId: null,
    charts: {},

    // ============ INITIALIZATION ============
    async init() {
        // Enforce Admin Authentication
        this.user = await Auth.checkAuth('admin', '/index.html');
        if (!this.user) return;

        // Toggle UI visibility from login card to dashboard panel
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';

        // Set profile name
        document.getElementById('adminName').textContent = this.user.name || 'Admin';
        if (document.getElementById('settingsEmail')) {
            document.getElementById('settingsEmail').value = this.user.email || '';
        }

        // Setup real-time snapshot listeners
        this.setupRealtimeListeners();
        this.bindEvents();
    },

    bindEvents() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-link[data-section]').forEach(btn => {
            btn.addEventListener('click', () => this.navigateTo(btn.dataset.section));
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
        
        // Station Form Submission
        document.getElementById('stationForm').addEventListener('submit', (e) => { 
            e.preventDefault(); 
            this.createStation(); 
        });
        document.getElementById('resetFormBtn').addEventListener('click', () => this.resetForm());
        
        // Image upload drag-and-drop preview
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('stationImage');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            uploadArea.style.borderColor = 'var(--primary-color)'; 
        });
        uploadArea.addEventListener('dragleave', () => { 
            uploadArea.style.borderColor = 'var(--border-color)'; 
        });
        uploadArea.addEventListener('drop', (e) => { 
            e.preventDefault(); 
            uploadArea.style.borderColor = 'var(--border-color)'; 
            if (e.dataTransfer.files[0]) { 
                fileInput.files = e.dataTransfer.files; 
                this.previewImage(fileInput); 
            }
        });
        fileInput.addEventListener('change', () => this.previewImage(fileInput));

        // Free charging toggle label updater
        document.getElementById('freeCharging').addEventListener('change', (e) => {
            document.getElementById('freeChargingLabel').textContent = e.target.checked ? 'Yes' : 'No';
        });

        // Search & Filter key events
        document.getElementById('stationSearch').addEventListener('input', () => this.filterStations());
        document.getElementById('filterCity').addEventListener('change', () => this.filterStations());
        document.getElementById('filterStatus').addEventListener('change', () => this.filterStations());

        // Edit Modal Submit
        document.getElementById('saveEditBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveEdit();
        });

        // Delete Modal Confirmation
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());

        // Modal Overlay Close Click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => { 
                if (e.target === overlay) this.closeModal(overlay.id); 
            });
        });

        // Re-render analytics charts on theme change
        window.addEventListener('themechange', () => {
            const activeSection = document.querySelector('.admin-section.active');
            if (activeSection && activeSection.id === 'sec-analytics') {
                this.renderAnalytics();
            }
        });
    },

    // ============ REAL-TIME SYNC ============
    setupRealtimeListeners() {
        // Listen to Stations
        db.collection('stations').orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                this.stations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.populateCityFilter();
                this.filterStations();
                this.updateStats();
            }, (error) => {
                console.error('Stations listener error:', error);
            });

        // Listen to Bookings
        db.collection('bookings').orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                this.bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const active = this.bookings.filter(b => b.status !== 'completed' && b.status !== 'rejected');
                const history = this.bookings.filter(b => b.status === 'completed' || b.status === 'rejected');
                this.renderBookings(active);
                this.renderHistory(history);
                this.updateStats();
            }, (error) => {
                console.error('Bookings listener error:', error);
            });

        // Listen to Users
        db.collection('users').orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                this.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderUsers(this.users);
                this.updateStats();
            }, (error) => {
                console.error('Users listener error:', error);
            });
    },

    // ============ NAVIGATION ============
    navigateTo(section) {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
        
        const targetSection = document.getElementById(`sec-${section}`);
        if (targetSection) targetSection.classList.add('active');
        
        const navBtn = document.querySelector(`.sidebar-link[data-section="${section}"]`);
        if (navBtn) navBtn.classList.add('active');
        
        if (section === 'analytics') {
            this.renderAnalytics();
        }
    },

    // ============ STATISTICS & CHARTS ============
    updateStats() {
        const totalStations = this.stations.length;
        const activeStations = this.stations.filter(s => s.status === 'Active' || s.status === 'Available' || s.status === 'Busy').length;
        const busyStations = this.stations.filter(s => s.status === 'Busy').length;
        const offlineStations = this.stations.filter(s => s.status === 'Offline').length;
        
        const totalPorts = this.stations.reduce((sum, s) => sum + (parseInt(s.totalPorts) || 0), 0);
        const availablePorts = this.stations.reduce((sum, s) => {
            const isAvailable = s.status === 'Active' || s.status === 'Available';
            return sum + (isAvailable ? (parseInt(s.availablePorts) || 0) : 0);
        }, 0);
        const totalUsers = this.users.length;
        const totalBookings = this.bookings.length;

        // Revenue calculation: Sum of actual costs from completed bookings
        const completedBookings = this.bookings.filter(b => b.status === 'completed');
        let estimatedRevenue = 0;
        completedBookings.forEach(b => {
            estimatedRevenue += parseFloat(b.cost) || 0;
        });

        // Set card values safely
        const setElVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setElVal('statTotalStations', totalStations);
        setElVal('statActiveStations', activeStations);
        setElVal('statBusyStations', busyStations);
        setElVal('statTotalPorts', totalPorts);
        setElVal('statAvailablePorts', availablePorts);
        setElVal('statRevenue', `$${estimatedRevenue.toFixed(2)}`);

        // Render dashboard overview mini charts if on dashboard section
        if (document.getElementById('sec-dashboard').classList.contains('active')) {
            this.renderDashboardCharts();
        }
    },

    renderDashboardCharts() {
        const total = this.stations.length || 1;
        const activeCount = this.stations.filter(s => s.status === 'Active' || s.status === 'Available').length;
        const busyCount = this.stations.filter(s => s.status === 'Busy').length;
        const maintCount = this.stations.filter(s => s.status === 'Maintenance').length;
        const offlineCount = this.stations.filter(s => s.status === 'Offline').length;

        const successfulBookingsCount = this.bookings.filter(b => b.status === 'approved' || b.status === 'charging' || b.status === 'completed').length;

        const grid = document.getElementById('chartsGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="chart-card">
                <h3>Station Status Distribution</h3>
                <div class="chart-bar-container" style="margin-top: 1.5rem;">
                    <div class="chart-bar-item">
                        <span class="chart-bar-label">Available</span>
                        <div class="chart-bar">
                            <div class="chart-bar-fill green" style="width:${(activeCount/total*100)}%">${activeCount}</div>
                        </div>
                    </div>
                    <div class="chart-bar-item">
                        <span class="chart-bar-label">Busy</span>
                        <div class="chart-bar">
                            <div class="chart-bar-fill yellow" style="width:${(busyCount/total*100)}%">${busyCount}</div>
                        </div>
                    </div>
                    <div class="chart-bar-item">
                        <span class="chart-bar-label">Maintenance</span>
                        <div class="chart-bar">
                            <div class="chart-bar-fill purple" style="width:${(maintCount/total*100)}%">${maintCount}</div>
                        </div>
                    </div>
                    <div class="chart-bar-item">
                        <span class="chart-bar-label">Offline</span>
                        <div class="chart-bar">
                            <div class="chart-bar-fill red" style="width:${(offlineCount/total*100)}%">${offlineCount}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="chart-card">
                <h3>Key Information</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
                    <div class="detail-item"><div class="detail-label">Total Registered Users</div><div class="detail-value" style="font-size:2rem;color:var(--primary-color)">${this.users.length}</div></div>
                    <div class="detail-item"><div class="detail-label">Successful Charging Completed</div><div class="detail-value" style="font-size:2rem;color:var(--success)">${successfulBookingsCount}</div></div>
                </div>
            </div>
        `;
    },

    // ============ ANALYTICS GRAPH RENDERING (CHART.JS) ============
    renderAnalytics() {
        const grid = document.getElementById('analyticsCharts');
        if (!grid) return;

        if (!this.stations.length) {
            grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-pie"></i><h3>No Data Yet</h3><p>Add stations to see analytics.</p></div>';
            return;
        }

        // Setup DOM for charts
        grid.innerHTML = `
            <div class="chart-card" style="grid-column: span 2; height: 350px;">
                <h3>Cumulative Station Growth</h3>
                <canvas id="chartStationGrowth" style="width: 100%; height: 100%; max-height: 280px;"></canvas>
            </div>
            <div class="chart-card" style="height: 350px;">
                <h3>Bookings by Status</h3>
                <canvas id="chartBookings" style="width: 100%; height: 100%; max-height: 280px;"></canvas>
            </div>
            <div class="chart-card" style="height: 350px;">
                <h3>Estimated Revenue per Station</h3>
                <canvas id="chartRevenue" style="width: 100%; height: 100%; max-height: 280px;"></canvas>
            </div>
        `;

        // Clean up previous Chart instances to prevent canvas overlapping
        Object.values(this.charts).forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = {};

        // 1. Station Growth Data
        const stationsSorted = [...this.stations].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        const growthLabels = [];
        const growthData = [];
        let runningTotal = 0;
        
        stationsSorted.forEach(s => {
            const dateStr = new Date(s.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'});
            growthLabels.push(dateStr);
            runningTotal++;
            growthData.push(runningTotal);
        });

        // 2. Booking Status Data
        const bookingStatusCounts = { pending: 0, approved: 0, rejected: 0, completed: 0, charging: 0 };
        this.bookings.forEach(b => {
            if (bookingStatusCounts[b.status] !== undefined) {
                bookingStatusCounts[b.status]++;
            }
        });

        // 3. Station Revenue Data
        const revenueLabels = [];
        const revenueData = [];
        this.stations.forEach(s => {
            const bookingsForStation = this.bookings.filter(b => b.stationId === s.id && b.status === 'completed');
            const stationRevenue = bookingsForStation.reduce((sum, b) => sum + (parseFloat(b.cost) || 0), 0);
            revenueLabels.push(s.stationName);
            revenueData.push(stationRevenue.toFixed(2));
        });

        // Initialize Chart.js Growth Chart
        const ctxGrowth = document.getElementById('chartStationGrowth').getContext('2d');
        this.charts.growth = new Chart(ctxGrowth, {
            type: 'line',
            data: {
                labels: growthLabels,
                datasets: [{
                    label: 'Total Stations Added',
                    data: growthData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: this.getChartOptions()
        });

        // Initialize Chart.js Bookings Status Chart
        const ctxBookings = document.getElementById('chartBookings').getContext('2d');
        this.charts.bookings = new Chart(ctxBookings, {
            type: 'bar',
            data: {
                labels: ['Pending', 'Approved', 'Rejected', 'Charging', 'Completed'],
                datasets: [{
                    data: [
                        bookingStatusCounts.pending,
                        bookingStatusCounts.approved,
                        bookingStatusCounts.rejected,
                        bookingStatusCounts.charging,
                        bookingStatusCounts.completed
                    ],
                    backgroundColor: ['#F59E0B', '#3B82F6', '#EF4444', '#06b6d4', '#10B981'],
                    borderRadius: 8
                }]
            },
            options: {
                ...this.getChartOptions(),
                plugins: { legend: { display: false } }
            }
        });

        // Initialize Chart.js Revenue Chart
        const ctxRevenue = document.getElementById('chartRevenue').getContext('2d');
        this.charts.revenue = new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: revenueLabels,
                datasets: [{
                    data: revenueData,
                    backgroundColor: '#10B981',
                    borderRadius: 8
                }]
            },
            options: {
                ...this.getChartOptions(),
                plugins: { legend: { display: false } }
            }
        });
    },

    getChartOptions() {
        const isLight = document.body.classList.contains('light-theme');
        const textColor = isLight ? '#475569' : '#94A3B8';
        const legendColor = isLight ? '#0F172A' : '#F8FAFC';
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { labels: { color: legendColor } }
            }
        };
    },

    // ============ STATION CRUD OPERATIONS ============
    async createStation() {
        const btn = document.getElementById('saveStationBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const stationName = document.getElementById('stationName').value.trim();
            const ownerName = document.getElementById('ownerName').value.trim();
            const contact = document.getElementById('contact').value.trim();
            const email = document.getElementById('email').value.trim().toLowerCase();
            
            const address = document.getElementById('address').value.trim();
            const city = document.getElementById('city').value.trim();
            const latitude = parseFloat(document.getElementById('latitude').value) || 0;
            const longitude = parseFloat(document.getElementById('longitude').value) || 0;
            const mapLink = document.getElementById('mapLink').value.trim();

            const chargerType = document.getElementById('chargerType').value;
            const connectorType = document.getElementById('connectorType').value;
            const powerKW = parseFloat(document.getElementById('powerKW').value) || 0;
            const status = document.getElementById('stationStatus').value;
            const totalPorts = parseInt(document.getElementById('totalPorts').value) || 1;
            const availablePorts = parseInt(document.getElementById('availablePorts').value) || 0;

            const pricePerKwh = parseFloat(document.getElementById('pricePerKwh').value) || 0;
            const freeCharging = document.getElementById('freeCharging').checked;

            const facilities = [];
            document.querySelectorAll('input[name="facilities"]:checked').forEach(cb => facilities.push(cb.value));

            // Image Upload
            const imageFile = document.getElementById('stationImage').files[0];
            let imageUrl = '';
            if (imageFile) {
                const formData = new FormData();
                formData.append('image', imageFile);
                
                const response = await fetch('/api/admin/stations/upload-image', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Image upload failed.');
                }
                
                const resData = await response.json();
                imageUrl = resData.imageUrl;
            }

            const newStation = {
                stationName, ownerName, contact, email,
                address, city, latitude, longitude, mapUrl: mapLink,
                chargerType, connectorType, powerKW, status,
                totalPorts, availablePorts, pricePerKwh, freeCharging,
                facilities, imageUrl,
                occupiedPorts: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await db.collection('stations').add(newStation);

            this.toast('Station created successfully!', 'success');
            this.resetForm();
            this.navigateTo('manageStations');
        } catch (err) {
            console.error('Create station error:', err);
            this.toast(err.message || 'Failed to create station', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Station';
        }
    },

    openEditModal(station) {
        document.getElementById('editId').value = station.id;
        document.getElementById('editStationName').value = station.stationName || '';
        document.getElementById('editOwnerName').value = station.ownerName || '';
        document.getElementById('editContact').value = station.contact || '';
        document.getElementById('editEmail').value = station.email || '';
        document.getElementById('editAddress').value = station.address || '';
        document.getElementById('editCity').value = station.city || '';
        document.getElementById('editChargerType').value = station.chargerType || 'AC';
        document.getElementById('editConnectorType').value = station.connectorType || 'Type1';
        document.getElementById('editPowerKW').value = station.powerKW || '';
        document.getElementById('editStatus').value = station.status || 'Available';
        document.getElementById('editTotalPorts').value = station.totalPorts || '';
        document.getElementById('editAvailablePorts').value = station.availablePorts || '';
        document.getElementById('editPricePerKwh').value = station.pricePerKwh || '';
        document.getElementById('editImage').value = '';
        this.openModal('editModal');
    },

    async saveEdit() {
        const id = document.getElementById('editId').value;
        const btn = document.getElementById('saveEditBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const stationRef = db.collection('stations').doc(id);
            const docSnap = await stationRef.get();
            if (!docSnap.exists) throw new Error('Station not found.');
            const existingData = docSnap.data();

            const updateData = {
                stationName: document.getElementById('editStationName').value.trim(),
                ownerName: document.getElementById('editOwnerName').value.trim(),
                contact: document.getElementById('editContact').value.trim(),
                email: document.getElementById('editEmail').value.trim().toLowerCase(),
                address: document.getElementById('editAddress').value.trim(),
                city: document.getElementById('editCity').value.trim(),
                chargerType: document.getElementById('editChargerType').value,
                connectorType: document.getElementById('editConnectorType').value,
                powerKW: parseFloat(document.getElementById('editPowerKW').value) || 0,
                status: document.getElementById('editStatus').value,
                totalPorts: parseInt(document.getElementById('editTotalPorts').value) || 0,
                availablePorts: parseInt(document.getElementById('editAvailablePorts').value) || 0,
                pricePerKwh: parseFloat(document.getElementById('editPricePerKwh').value) || 0,
                updatedAt: new Date().toISOString()
            };

            // Check for new image
            const editImageFile = document.getElementById('editImage').files[0];
            if (editImageFile) {
                // Delete old image first if exists (only for Firebase Storage URLs)
                if (existingData.imageUrl && existingData.imageUrl.includes('firebasestorage.googleapis.com')) {
                    try {
                        const oldRef = storage.refFromURL(existingData.imageUrl);
                        await oldRef.delete();
                    } catch(e) { console.warn('Old image delete warning:', e.message); }
                }
                const formData = new FormData();
                formData.append('image', editImageFile);
                
                const response = await fetch('/api/admin/stations/upload-image', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Image upload failed.');
                }
                
                const resData = await response.json();
                updateData.imageUrl = resData.imageUrl;
            }

            await stationRef.update(updateData);

            this.toast('Station updated successfully!', 'success');
            this.closeModal('editModal');
        } catch (err) {
            console.error('Update station error:', err);
            this.toast(err.message || 'Failed to update station', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Save Changes';
        }
    },

    openDeleteModal(id) {
        this.deleteTargetId = id;
        this.openModal('deleteModal');
    },

    async confirmDelete() {
        if (!this.deleteTargetId) return;
        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

        try {
            const stationRef = db.collection('stations').doc(this.deleteTargetId);
            const docSnap = await stationRef.get();
            if (docSnap.exists) {
                const data = docSnap.data();
                // Delete image from storage if it is a Firebase Storage URL
                if (data.imageUrl && data.imageUrl.includes('firebasestorage.googleapis.com')) {
                    try {
                        const imgRef = storage.refFromURL(data.imageUrl);
                        await imgRef.delete();
                    } catch (e) { console.error('Image delete error:', e); }
                }
            }
            await stationRef.delete();
            this.toast('Station deleted successfully', 'success');
            this.closeModal('deleteModal');
        } catch (err) {
            console.error('Delete station error:', err);
            this.toast(err.message || 'Failed to delete station', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Delete';
            this.deleteTargetId = null;
        }
    },

    openViewModal(station) {
        const body = document.getElementById('viewModalBody');
        const imgSrc = station.imageUrl || '';
        const statusClass = (station.status || '').toLowerCase();
        
        body.innerHTML = `
            ${imgSrc ? `<img src="${imgSrc}" class="detail-img" alt="${station.stationName}" style="width:100%;height:200px;object-fit:cover;border-radius:12px;margin-bottom:1rem;">` : ''}
            <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div class="detail-item"><div class="detail-label">Station Name</div><div class="detail-value">${station.stationName}</div></div>
                <div class="detail-item"><div class="detail-label">Owner</div><div class="detail-value">${station.ownerName}</div></div>
                <div class="detail-item"><div class="detail-label">Contact</div><div class="detail-value">${station.contact}</div></div>
                <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${station.email}</div></div>
                <div class="detail-item" style="grid-column:span 2"><div class="detail-label">Address</div><div class="detail-value">${station.address}, ${station.city}</div></div>
                <div class="detail-item"><div class="detail-label">Charger Type</div><div class="detail-value">${station.chargerType}</div></div>
                <div class="detail-item"><div class="detail-label">Connector</div><div class="detail-value">${station.connectorType}</div></div>
                <div class="detail-item"><div class="detail-label">Power</div><div class="detail-value">${station.powerKW} kW</div></div>
                <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="table-status ${statusClass}">${station.status}</span></div></div>
                <div class="detail-item"><div class="detail-label">Total Ports</div><div class="detail-value">${station.totalPorts}</div></div>
                <div class="detail-item"><div class="detail-label">Available</div><div class="detail-value">${Math.max(0, parseInt(station.totalPorts) - (station.occupiedPorts || []).length)}</div></div>
                <div class="detail-item"><div class="detail-label">Price/kWh</div><div class="detail-value">${station.freeCharging ? 'Free' : '$' + (station.pricePerKwh || 0)}</div></div>
                ${station.facilities && station.facilities.length ? `<div class="detail-item" style="grid-column:span 2"><div class="detail-label">Facilities</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;">${station.facilities.map(f => `<span class="tag">${f}</span>`).join('')}</div></div>` : ''}
            </div>
        `;
        this.openModal('viewModal');
    },

    // ============ STATION TABLE RENDERING ============
    renderStations(stations) {
        const tbody = document.getElementById('stationsTableBody');
        const emptyState = document.getElementById('emptyState');

        if (!stations.length) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        tbody.innerHTML = stations.map(s => {
            const imgSrc = s.imageUrl || '';
            const statusClass = (s.status || '').toLowerCase();
            return `<tr>
                <td>${imgSrc ? `<img src="${imgSrc}" class="table-img" alt="${s.stationName}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '<div style="width:40px;height:40px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border-radius:6px;">⚡</div>'}</td>
                <td class="table-station-name">${s.stationName}</td>
                <td>${s.city}</td>
                <td>${s.chargerType} / ${s.connectorType}</td>
                <td>${s.totalPorts}</td>
                <td>${Math.max(0, parseInt(s.totalPorts) - (s.occupiedPorts || []).length)}</td>
                <td><span class="table-status ${statusClass}">${s.status}</span></td>
                <td>${s.freeCharging ? 'Free' : '$' + (s.pricePerKwh || 0)}</td>
                <td><div class="table-actions">
                    <button class="btn-action view" title="View" onclick='AdminApp.openViewModal(${JSON.stringify(s).replace(/'/g,"\\'")})'><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action edit" title="Edit" onclick='AdminApp.openEditModal(${JSON.stringify(s).replace(/'/g,"\\'")})'><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action delete" title="Delete" onclick="AdminApp.openDeleteModal('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    },

    // ============ BOOKING MANAGEMENT ============
    renderBookings(bookings) {
        const tbody = document.getElementById('bookingsTableBody');
        const emptyState = document.getElementById('bookingsEmptyState');

        if (!bookings.length) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        tbody.innerHTML = bookings.map(b => {
            const statusClass = (b.status || '').toLowerCase();
            const dateStr = new Date(b.date + 'T' + b.time).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Status actions
            let actionButtons = '';
            if (b.status === 'pending') {
                actionButtons = `
                    <button class="btn-action view" title="Approve" style="background:rgba(16,185,129,0.15);color:var(--success);" onclick="AdminApp.updateBookingStatus('${b.id}', 'approved')"><i class="fa-solid fa-check"></i></button>
                    <button class="btn-action delete" title="Reject" style="background:rgba(239,68,68,0.15);color:var(--danger);" onclick="AdminApp.updateBookingStatus('${b.id}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else if (b.status === 'approved') {
                actionButtons = `
                    <button class="btn-action view" title="Start Charging" style="background:rgba(6,182,212,0.15);color:#06b6d4;" onclick="AdminApp.startChargingFromBooking('${b.id}', '${b.stationId}')"><i class="fa-solid fa-bolt"></i></button>
                    <button class="btn-action delete" title="Reject" style="background:rgba(239,68,68,0.15);color:var(--danger);" onclick="AdminApp.updateBookingStatus('${b.id}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else if (b.status === 'charging') {
                actionButtons = `
                    <button class="btn-action view" title="Complete Charging" style="background:rgba(16,185,129,0.15);color:var(--success);" onclick="AdminApp.completeChargingFromBooking('${b.id}', '${b.stationId}')"><i class="fa-solid fa-circle-stop"></i></button>
                `;
            } else {
                actionButtons = `<span style="font-size:0.8rem;color:var(--text-muted);">None</span>`;
            }

            return `<tr>
                <td>${b.userEmail}</td>
                <td>${b.stationName}</td>
                <td>${b.date}</td>
                <td>${b.time}${b.durationHours ? ` (${b.durationHours}h)` : ''}</td>
                <td>${b.chargerType}</td>
                <td><span class="table-status ${statusClass}">${b.status}</span></td>
                <td><div class="table-actions">${actionButtons}</div></td>
            </tr>`;
        }).join('');
    },

    renderHistory(history) {
        const tbody = document.getElementById('historyTableBody');
        const emptyState = document.getElementById('historyEmptyState');

        if (!history.length) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        tbody.innerHTML = history.map(b => {
            const statusClass = (b.status || '').toLowerCase();
            return `<tr>
                <td>${b.userEmail}</td>
                <td>${b.stationName}</td>
                <td>${b.date}</td>
                <td>${b.time}${b.durationHours ? ` (${b.durationHours}h)` : ''}${b.durationSeconds ? ` (Sim: ${Math.round(b.durationSeconds)}s)` : ''}</td>
                <td>${b.chargerType}</td>
                <td><span class="table-status ${statusClass}">${b.status}</span></td>
                <td><span style="font-size:0.8rem;color:var(--text-muted);">None</span></td>
            </tr>`;
        }).join('');
    },

    async updateBookingStatus(id, newStatus) {
        try {
            await db.collection('bookings').doc(id).update({
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            this.toast(`Booking status updated to ${newStatus}`, 'success');
        } catch (e) {
            console.error('Update booking error:', e);
            this.toast('Failed to update booking status', 'error');
        }
    },

    async startChargingFromBooking(bookingId, stationId) {
        try {
            // Decrement port availability and update occupied list
            const stationRef = db.collection('stations').doc(stationId);
            await db.runTransaction(async (transaction) => {
                const sDoc = await transaction.get(stationRef);
                if (!sDoc.exists) throw new Error("Station not found!");
                
                const bookingDoc = await transaction.get(db.collection('bookings').doc(bookingId));
                if (!bookingDoc.exists) throw new Error("Booking not found!");
                const portNumber = parseInt(bookingDoc.data().portNumber);

                const available = parseInt(sDoc.data().availablePorts) || 0;
                if (available <= 0) throw new Error("No available ports left!");

                const occupiedPorts = sDoc.data().occupiedPorts || [];
                if (portNumber && !occupiedPorts.includes(portNumber)) {
                    occupiedPorts.push(portNumber);
                }

                transaction.update(stationRef, { 
                    availablePorts: available - 1,
                    occupiedPorts: occupiedPorts
                });
            });

            // Update booking status
            await db.collection('bookings').doc(bookingId).update({
                status: 'charging',
                updatedAt: new Date().toISOString()
            });

            this.toast('Session started! Port occupancy updated.', 'success');
        } catch (e) {
            this.toast(e.message || 'Failed to start session', 'error');
        }
    },

    async completeChargingFromBooking(bookingId, stationId) {
        try {
            // Increment port availability (cap at total ports) and release port
            const stationRef = db.collection('stations').doc(stationId);
            await db.runTransaction(async (transaction) => {
                const sDoc = await transaction.get(stationRef);
                if (!sDoc.exists) throw new Error("Station not found!");

                const bookingDoc = await transaction.get(db.collection('bookings').doc(bookingId));
                if (!bookingDoc.exists) throw new Error("Booking not found!");
                const portNumber = parseInt(bookingDoc.data().portNumber);

                const available = parseInt(sDoc.data().availablePorts) || 0;
                const total = parseInt(sDoc.data().totalPorts) || 1;

                let occupiedPorts = sDoc.data().occupiedPorts || [];
                if (portNumber) {
                    occupiedPorts = occupiedPorts.filter(p => p !== portNumber);
                }

                if (available < total) {
                    transaction.update(stationRef, { 
                        availablePorts: available + 1,
                        occupiedPorts: occupiedPorts
                    });
                } else {
                    transaction.update(stationRef, {
                        occupiedPorts: occupiedPorts
                    });
                }
            });

            // Update booking status
            await db.collection('bookings').doc(bookingId).update({
                status: 'completed',
                updatedAt: new Date().toISOString()
            });

            this.toast('Session completed! Port released.', 'success');
        } catch (e) {
            this.toast('Failed to complete session', 'error');
        }
    },

    // ============ USER MANAGEMENT ============
    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        const totalCountEl = document.getElementById('totalUsersCount');
        if (totalCountEl) {
            totalCountEl.textContent = users.length;
        }

        tbody.innerHTML = users.map(u => {
            const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
            const deleteBtn = u.role === 'admin' ? 
                `<span style="font-size:0.8rem;color:var(--text-muted);">Protected</span>` : 
                `<button class="btn-action delete" title="Delete User" onclick="AdminApp.deleteUser('${u.id}', '${u.name}')"><i class="fa-solid fa-trash"></i></button>`;
            return `<tr>
                <td style="font-weight:600;">${u.name || 'EV Driver'}</td>
                <td>${u.email}</td>
                <td><span class="table-status ${u.role === 'admin' ? 'active' : 'busy'}">${u.role}</span></td>
                <td>${dateStr}</td>
                <td><div class="table-actions">${deleteBtn}</div></td>
            </tr>`;
        }).join('');
    },

    async deleteUser(userId, userName) {
        if (confirm(`Are you sure you want to delete user "${userName}"?`)) {
            try {
                await db.collection('users').doc(userId).delete();
                this.toast('User deleted successfully', 'success');
            } catch (e) {
                console.error('Delete user error:', e);
                this.toast('Failed to delete user', 'error');
            }
        }
    },

    // ============ SEARCH & FILTERING ============
    populateCityFilter() {
        const select = document.getElementById('filterCity');
        if (!select) return;
        const cities = [...new Set(this.stations.map(s => s.city).filter(Boolean))].sort();
        select.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    filterStations() {
        const query = document.getElementById('stationSearch').value.toLowerCase();
        const city = document.getElementById('filterCity').value;
        const status = document.getElementById('filterStatus').value;
        
        const filtered = this.stations.filter(s => {
            const matchSearch = !query || s.stationName.toLowerCase().includes(query) || (s.city || '').toLowerCase().includes(query) || (s.ownerName || '').toLowerCase().includes(query);
            const matchCity = !city || s.city === city;
            const matchStatus = !status || s.status === status;
            return matchSearch && matchCity && matchStatus;
        });
        
        this.renderStations(filtered);
    },

    // ============ FILE AND UI CONTROLS ============
    previewImage(input) {
        const preview = document.getElementById('imagePreview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                preview.src = e.target.result; 
                preview.style.display = 'block'; 
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    resetForm() {
        document.getElementById('stationForm').reset();
        const preview = document.getElementById('imagePreview');
        if (preview) preview.style.display = 'none';
        const label = document.getElementById('freeChargingLabel');
        if (label) label.textContent = 'No';
    },

    openModal(id) { 
        const el = document.getElementById(id);
        if (el) el.classList.add('active'); 
    },
    
    closeModal(id) { 
        const el = document.getElementById(id);
        if (el) el.classList.remove('active'); 
    },

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

// Start admin dashboard when page loads
document.addEventListener('DOMContentLoaded', () => AdminApp.init());

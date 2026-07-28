/**
 * ChargeNet User Profile settings controller
 */

const ProfileApp = {
    user: null,
    profileData: null,

    async init() {
        // Enforce user authentication
        this.user = await Auth.checkAuth('user', '/index.html');
        if (!this.user) return;

        // Display user name greeting
        const greetingEl = document.getElementById('userNameDisplay');
        if (greetingEl) {
            greetingEl.textContent = `Hello, ${this.user.name || 'Driver'}`;
        }

        // Load profile data from Firestore
        await this.loadProfile();
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

        // Profile Form Submit
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Reset Form Button
        document.getElementById('resetProfileBtn').addEventListener('click', () => {
            this.populateForm(this.profileData);
            this.toast('Form reset to saved profile details.', 'info');
        });
    },

    async loadProfile() {
        try {
            const doc = await db.collection('users').doc(this.user.uid).get();
            if (!doc.exists) {
                this.toast('Profile not found in database.', 'error');
                return;
            }

            this.profileData = { id: doc.id, ...doc.data() };
            this.populateForm(this.profileData);
        } catch (e) {
            console.error('Error loading profile:', e);
            this.toast('Failed to load user profile.', 'error');
        }
    },

    populateForm(data) {
        // Set header meta
        document.getElementById('profileMetaName').textContent = data.name || 'EV Driver';
        document.getElementById('profileMetaRole').textContent = (data.role || 'user').toUpperCase();
        
        const joinedDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : 'N/A';
        document.getElementById('profileMetaJoined').textContent = `Joined: ${joinedDate}`;

        // Set inputs
        document.getElementById('profileName').value = data.name || '';
        document.getElementById('profileEmail').value = data.email || '';
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileVehicle').value = data.vehicleModel || '';
    },

    async saveProfile() {
        const saveBtn = document.getElementById('saveProfileBtn');
        const originalText = saveBtn.innerHTML;

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const updatedName = document.getElementById('profileName').value.trim();
        const updatedPhone = document.getElementById('profilePhone').value.trim();
        const updatedVehicle = document.getElementById('profileVehicle').value.trim();

        if (!updatedName) {
            this.toast('Full name is required.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            return;
        }

        try {
            const userRef = db.collection('users').doc(this.user.uid);
            const updates = {
                name: updatedName,
                phone: updatedPhone,
                vehicleModel: updatedVehicle,
                updatedAt: new Date().toISOString()
            };

            await userRef.update(updates);

            // Update local state
            this.profileData = { ...this.profileData, ...updates };
            
            // Update local storage so page transitions reflect the new name immediately
            localStorage.setItem('userName', updatedName);

            // Refresh displayed names
            document.getElementById('profileMetaName').textContent = updatedName;
            const greetingEl = document.getElementById('userNameDisplay');
            if (greetingEl) {
                greetingEl.textContent = `Hello, ${updatedName}`;
            }

            this.toast('Profile updated successfully!', 'success');
        } catch (e) {
            console.error('Error saving profile:', e);
            this.toast('Failed to save changes.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
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

// Auto init
document.addEventListener('DOMContentLoaded', () => ProfileApp.init());

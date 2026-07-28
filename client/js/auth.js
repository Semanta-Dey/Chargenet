/**
 * ChargeNet Authentication Handler
 */

// Check and apply stored theme immediately to avoid flash of dark theme
(function() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
    }
})();

const Auth = {
    // Register user
    async register(name, email, password) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Add user record in Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email.toLowerCase(),
                role: 'user',
                createdAt: new Date().toISOString()
            });
            
            return user;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    // Login user
    async login(email, password, requiredRole = 'user') {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Fetch user profile from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                await auth.signOut();
                throw new Error('This account does not exist or has been deleted by an administrator.');
            }
            
            const profile = userDoc.data();
            if (requiredRole === 'admin' && profile.role !== 'admin') {
                await auth.signOut();
                throw new Error('Access denied. Admin privileges required.');
            }
            
            // Store user details in localStorage
            localStorage.setItem('userUid', user.uid);
            localStorage.setItem('userName', profile.name || 'EV Driver');
            localStorage.setItem('userEmail', profile.email);
            localStorage.setItem('userRole', profile.role);
            
            return { uid: user.uid, ...profile };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Logout
    async logout() {
        try {
            await auth.signOut();
            localStorage.clear();
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // Check if user is logged in and has the correct role
    checkAuth(requiredRole = 'user', redirectUrl = '/index.html') {
        const cachedUid = localStorage.getItem('userUid');
        const cachedRole = localStorage.getItem('userRole');
        const cachedName = localStorage.getItem('userName');
        const cachedEmail = localStorage.getItem('userEmail');

        if (cachedUid && cachedRole) {
            if (requiredRole === 'admin' && cachedRole !== 'admin') {
                window.location.href = redirectUrl;
                return Promise.resolve(null);
            }
            
            // Background check to handle logout, session expiration, or account deletion
            auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    localStorage.clear();
                    window.location.href = redirectUrl;
                } else {
                    try {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (!userDoc.exists) {
                            await auth.signOut();
                            localStorage.clear();
                            window.location.href = redirectUrl;
                        }
                    } catch (err) {
                        console.error('Background account check failed:', err);
                    }
                }
            });

            return Promise.resolve({
                uid: cachedUid,
                name: cachedName || 'EV Driver',
                email: cachedEmail || '',
                role: cachedRole
            });
        }

        return new Promise((resolve) => {
            let resolved = false;
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                if (resolved) return;
                
                // Safely unsubscribe to prevent memory leaks, handling synchronous execution cases
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                } else {
                    setTimeout(() => {
                        if (typeof unsubscribe === 'function') unsubscribe();
                    }, 0);
                }
                resolved = true;

                console.log("CheckAuth: triggered. User:", user ? user.email : "null");
                if (!user) {
                    console.log("CheckAuth: No user found. Redirecting to:", redirectUrl);
                    window.location.href = redirectUrl;
                    resolve(null);
                    return;
                }
                
                try {
                    console.log("CheckAuth: Fetching user document for UID:", user.uid);
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (!userDoc.exists) {
                        console.log("CheckAuth: Document does not exist in Firestore.");
                        await auth.signOut();
                        localStorage.clear();
                        window.location.href = redirectUrl;
                        resolve(null);
                        return;
                    }
                    
                    const profile = userDoc.data();
                    console.log("CheckAuth: Profile role loaded:", profile.role);
                    if (requiredRole === 'admin' && profile.role !== 'admin') {
                        console.log("CheckAuth: Role mismatch. Required 'admin' but user has:", profile.role);
                        await auth.signOut();
                        window.location.href = redirectUrl;
                        resolve(null);
                        return;
                    }
                    
                    // Cache credentials
                    localStorage.setItem('userUid', user.uid);
                    localStorage.setItem('userName', profile.name || 'EV Driver');
                    localStorage.setItem('userEmail', profile.email);
                    localStorage.setItem('userRole', profile.role);

                    resolve({ uid: user.uid, ...profile });
                } catch (e) {
                    console.error('CheckAuth: Exception caught:', e);
                    window.location.href = redirectUrl;
                    resolve(null);
                }
            });
        });
    }
};

// Initialize mobile navigation dynamically on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const aside = document.querySelector('aside:not(.admin-sidebar)');
    
    if (!header || !aside) return;

    // Make user badge clickable to navigate to profile page
    const userBadge = header.querySelector('.user-badge');
    if (userBadge) {
        userBadge.style.cursor = 'pointer';
        userBadge.title = 'View Profile';
        userBadge.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }

    // Inject 'Profile' tab into sidebar navigation dynamically (excluding admin)
    const sidebarNav = aside.querySelector('nav');
    if (sidebarNav) {
        const profileLink = document.createElement('a');
        profileLink.href = 'profile.html';
        profileLink.className = 'nav-link';
        if (window.location.pathname.includes('profile.html')) {
            profileLink.className += ' active';
        }
        profileLink.innerHTML = `
            <i class="fa-solid fa-user-gear"></i>
            Profile
        `;
        sidebarNav.appendChild(profileLink);
    }

    // Create and inject the mobile hamburger toggle button
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.id = 'mobileMenuBtn';
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    header.appendChild(mobileMenuBtn);

    // Create and inject backdrop overlay
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-menu-backdrop';
    document.body.appendChild(backdrop);

    // Define toggle function
    const toggleMenu = () => {
        aside.classList.toggle('active');
        backdrop.classList.toggle('active');
        
        // Toggle icon between bars and close X icon
        if (aside.classList.contains('active')) {
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        } else {
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    };

    // Attach click event listeners
    mobileMenuBtn.addEventListener('click', toggleMenu);
    backdrop.addEventListener('click', toggleMenu);

    // Configure sidebar items for mobile view
    if (sidebarNav) {
        // 1. Mobile Greeting Profile
        const userGreeting = document.createElement('div');
        userGreeting.className = 'mobile-user-greeting';
        
        const cachedName = localStorage.getItem('userName') || 'EV Driver';
        userGreeting.innerHTML = `
            <div class="user-badge" style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:rgba(59, 130, 246, 0.15); border:1px solid rgba(59, 130, 246, 0.3); color:var(--primary-color);">
                <i class="fa-solid fa-user"></i>
            </div>
            <span style="font-weight:600; font-size: 0.95rem; color: var(--text-main);">Hello, ${cachedName}</span>
        `;
        sidebarNav.insertBefore(userGreeting, sidebarNav.firstChild);

        // 2. Divider line
        const divider = document.createElement('div');
        divider.className = 'mobile-menu-divider';
        sidebarNav.insertBefore(divider, sidebarNav.children[1]);

        // 3. Mobile Logout Tab
        const mobileLogout = document.createElement('a');
        mobileLogout.href = '#';
        mobileLogout.className = 'nav-link mobile-logout-link';
        mobileLogout.style.marginTop = 'auto';
        mobileLogout.innerHTML = `
            <i class="fa-solid fa-arrow-right-from-bracket" style="color:var(--danger);"></i>
            <span style="color:var(--danger); font-weight:600;">Logout</span>
        `;
        mobileLogout.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
        sidebarNav.appendChild(mobileLogout);
    }

    // Inject footer into main content container (excluding admin, dashboard page only)
    const mainContent = document.querySelector('main:not(.admin-main)');
    const isDashboard = window.location.pathname.includes('dashboard');
    if (mainContent && isDashboard) {
        const footer = document.createElement('footer');
        footer.className = 'app-footer';
        footer.innerHTML = `
            <div class="footer-content">
                <div class="footer-left">
                    <div class="logo" style="font-size: 1.1rem; gap: 6px; display: flex; align-items: center;">
                        <i class="fa-solid fa-bolt-lightning"></i>
                        <span>ChargeNet</span>
                    </div>
                    <p class="copyright">© ${new Date().getFullYear()} ChargeNet. All rights reserved.</p>
                </div>
                <div class="footer-right">
                    <a href="#" class="footer-link">Privacy Policy</a>
                    <a href="#" class="footer-link">Terms of Service</a>
                    <a href="#" class="footer-link">Support Helpdesk</a>
                    <a href="#" class="footer-link">Contact Us</a>
                </div>
            </div>
        `;
        mainContent.appendChild(footer);
    }

    // Inject Theme Switcher Button into header dynamically (supporting both desktop and mobile viewports)
    const headerEl = document.querySelector('header');
    if (headerEl) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.className = 'theme-toggle-btn';
        themeBtn.style.background = 'none';
        themeBtn.style.border = 'none';
        themeBtn.style.color = 'var(--text-muted)';
        themeBtn.style.fontSize = '1.2rem';
        themeBtn.style.cursor = 'pointer';
        themeBtn.style.display = 'flex';
        themeBtn.style.alignItems = 'center';
        themeBtn.style.justifyContent = 'center';
        themeBtn.style.padding = '8px';
        themeBtn.style.borderRadius = '50%';
        themeBtn.style.transition = 'all 0.3s ease';
        themeBtn.style.marginLeft = 'auto'; // pushes theme switcher to the right next to hamburger/nav-right
        themeBtn.style.marginRight = '10px'; // adds space between theme switcher and hamburger/nav-right
        themeBtn.title = 'Toggle Theme';

        // Set initial icon based on theme
        const currentTheme = localStorage.getItem('theme') || 'dark';
        if (currentTheme === 'light') {
            themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        // Add hover effects dynamically
        themeBtn.addEventListener('mouseenter', () => {
            themeBtn.style.color = 'var(--primary-color)';
            themeBtn.style.background = 'rgba(59, 130, 246, 0.08)';
        });
        themeBtn.addEventListener('mouseleave', () => {
            themeBtn.style.color = 'var(--text-muted)';
            themeBtn.style.background = 'none';
        });

        // Add toggle action
        themeBtn.addEventListener('click', () => {
            if (document.body.classList.contains('light-theme')) {
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            } else {
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            }
            // Dispatch event for reactive pages
            window.dispatchEvent(new Event('themechange'));
        });

        // Insert theme button before navRight / mobileMenuBtn
        const target = headerEl.querySelector('.nav-right') || headerEl.querySelector('.mobile-menu-btn');
        if (target) {
            headerEl.insertBefore(themeBtn, target);
        } else {
            headerEl.appendChild(themeBtn);
        }
    }
});

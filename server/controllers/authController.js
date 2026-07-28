const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

// Admin Login
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Authenticate user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: password
        });

        if (authError || !authData.user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Fetch user profile from public.users to verify role
        const { data: profile, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (dbError || !profile || profile.role !== 'admin') {
            // Sign out of auth session since role is not admin
            await supabase.auth.signOut();
            return res.status(401).json({ message: 'Access denied. Admin privileges required.' });
        }

        const token = jwt.sign(
            { id: profile.id, email: profile.email, name: profile.name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            admin: {
                id: profile.id,
                email: profile.email,
                name: profile.name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

// Verify Token
const verifyToken = async (req, res) => {
    res.json({ valid: true, admin: req.admin });
};

module.exports = { loginAdmin, verifyToken };

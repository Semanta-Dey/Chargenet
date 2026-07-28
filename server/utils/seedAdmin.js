require('dotenv').config();
const { supabase } = require('../config/supabase');

const seed = async () => {
    const email = process.env.ADMIN_EMAIL || 'admin@chargenet.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    try {
        console.log(`⚡ Seeding admin user in Supabase: ${email}...`);

        // Check if user already exists
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        let user = users.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        let uid = user ? user.id : null;

        if (!user) {
            // Create user using admin API (bypasses email verification)
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email.toLowerCase(),
                password: password,
                email_confirm: true,
                user_metadata: { name: 'System Admin' }
            });
            if (createError) throw createError;
            user = newUser.user;
            uid = user.id;
            console.log(`✅ Auth account created. UID: ${uid}`);
        } else {
            console.log(`⚠️ Admin auth account already exists. UID: ${uid}. Resetting password...`);
            // Update password in case it changed in .env
            const { error: updateError } = await supabase.auth.admin.updateUserById(uid, {
                password: password
            });
            if (updateError) throw updateError;
        }

        // Upsert record in public.users to ensure role is 'admin'
        const { error: dbError } = await supabase.from('users').upsert({
            id: uid,
            name: 'System Admin',
            email: email.toLowerCase(),
            role: 'admin'
        });
        if (dbError) throw dbError;

        console.log('✅ Public users table record verified and created with admin role.');
        console.log('🎉 Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during seeding:', error.message || error);
        process.exit(1);
    }
};

seed();

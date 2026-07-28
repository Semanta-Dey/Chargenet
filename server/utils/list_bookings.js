require('dotenv').config();
const { supabase } = require('../config/supabase');

async function run() {
    try {
        console.log('Querying all bookings from Supabase...');
        const { data, error } = await supabase
            .from('bookings')
            .select('*, users(email, name), stations(station_name)');
        
        if (error) {
            console.error('Error fetching bookings:', error);
        } else {
            console.log('Total bookings in DB:', data.length);
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error(err);
    }
}

run();

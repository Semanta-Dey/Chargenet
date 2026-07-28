require('dotenv').config();
const { supabase } = require('../config/supabase');

async function run() {
    try {
        console.log('Querying pg_policies...');
        const { data: policies, error: policiesError } = await supabase
            .from('pg_policies')
            .select('*');
        
        if (policiesError) {
            console.error('Error fetching pg_policies:', policiesError);
        } else {
            console.log('Database policies:', policies);
        }

        console.log('Querying publication tables...');
        const { data: pubTables, error: pubError } = await supabase
            .from('pg_publication_tables')
            .select('*')
            .eq('pubname', 'supabase_realtime');
        
        if (pubError) {
            console.error('Error fetching publication tables:', pubError);
        } else {
            console.log('Tables in supabase_realtime:', pubTables);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();

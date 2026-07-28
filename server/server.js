require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { supabase } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`[HTTP Request] ${req.method} ${req.url}`);
    next();
});
// Supabase Proxy Route to bypass CORS / Adblockers
app.all('/api/supabase-proxy/*', async (req, res) => {
    try {
        const path = req.params[0] || '';
        const targetUrl = `${process.env.SUPABASE_URL}/${path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
        
        console.log(`[Proxy Request] ${req.method} -> ${targetUrl}`);
        
        const headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;
        delete headers['content-length'];
        
        const fetchOptions = {
            method: req.method,
            headers: headers
        };

        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        }

        const response = await fetch(targetUrl, fetchOptions);
        
        console.log(`[Proxy Response] ${response.status} from ${targetUrl}`);
        
        res.status(response.status);
        response.headers.forEach((value, name) => {
            const normalized = name.toLowerCase();
            if (normalized !== 'content-encoding' && normalized !== 'transfer-encoding' && normalized !== 'content-length') {
                res.setHeader(name, value);
            }
        });

        const data = await response.text();
        res.send(data);
    } catch (error) {
        console.error('Supabase Proxy Error:', error);
        res.status(500).json({ error: 'Supabase Proxy failed', message: error.message });
    }
});

// Dynamic Firebase Config endpoint replaced with Supabase Compatibility Adapter
app.get('/firebase-config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(`
        (function() {
            const SUPABASE_URL = "${process.env.SUPABASE_URL || ''}";
            const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY || ''}";

            // Load Supabase script
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            document.head.appendChild(script);

            let supabaseClient = null;
            const readyCallbacks = [];

            script.onload = function() {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    global: {
                        fetch: async (url, options) => {
                            // Proxy all API requests through local backend server to bypass CORS / Adblockers
                            const localUrl = url.replace(SUPABASE_URL, '/api/supabase-proxy');
                            return fetch(localUrl, options);
                        }
                    }
                });
                console.log('✅ Supabase client initialized via Proxy Compatibility Adapter');
                
                // Execute queued initialization tasks
                while (readyCallbacks.length > 0) {
                    const cb = readyCallbacks.shift();
                    cb(supabaseClient);
                }
            };


            function onSupabaseReady(cb) {
                if (supabaseClient) {
                    cb(supabaseClient);
                } else {
                    readyCallbacks.push(cb);
                }
            }

            // Helper to generate UUIDs for new records (since Firestore client auto-generates keys)
            function generateUUID() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }

            // Mappings between Firestore client camelCase and Postgres snake_case
            const mappings = {
                users: {
                    toJS: row => ({
                        uid: row.id,
                        id: row.id,
                        name: row.name,
                        email: row.email,
                        role: row.role,
                        phone: row.phone,
                        vehicleModel: row.vehicle_model,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    }),
                    toDB: data => {
                        const row = {};
                        if (data.name !== undefined) row.name = data.name;
                        if (data.email !== undefined) row.email = data.email;
                        if (data.role !== undefined) row.role = data.role;
                        if (data.phone !== undefined) row.phone = data.phone;
                        if (data.vehicleModel !== undefined) row.vehicle_model = data.vehicleModel;
                        if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
                        return row;
                    }
                },
                stations: {
                    toJS: row => ({
                        id: row.id,
                        stationName: row.station_name,
                        ownerName: row.owner_name,
                        contact: row.contact,
                        email: row.email,
                        address: row.address,
                        city: row.city,
                        latitude: row.latitude,
                        longitude: row.longitude,
                        mapLink: row.map_link,
                        chargerType: row.charger_type,
                        connectorType: row.connector_type,
                        powerKW: row.power_kw,
                        totalPorts: row.total_ports,
                        availablePorts: row.available_ports,
                        pricePerKwh: row.price_per_kwh,
                        freeCharging: row.free_charging,
                        status: row.status,
                        facilities: row.facilities || [],
                        image: row.image,
                        imageUrl: row.image,
                        occupiedPorts: row.occupied_ports || [],
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    }),
                    toDB: data => {
                        const row = {};
                        if (data.stationName !== undefined) row.station_name = data.stationName;
                        if (data.ownerName !== undefined) row.owner_name = data.ownerName;
                        if (data.contact !== undefined) row.contact = data.contact;
                        if (data.email !== undefined) row.email = data.email;
                        if (data.address !== undefined) row.address = data.address;
                        if (data.city !== undefined) row.city = data.city;
                        if (data.latitude !== undefined) row.latitude = parseFloat(data.latitude) || 0;
                        if (data.longitude !== undefined) row.longitude = parseFloat(data.longitude) || 0;
                        
                        const mapLink = data.mapLink !== undefined ? data.mapLink : data.mapUrl;
                        if (mapLink !== undefined) row.map_link = mapLink;
                        
                        if (data.chargerType !== undefined) row.charger_type = data.chargerType;
                        if (data.connectorType !== undefined) row.connector_type = data.connectorType;
                        if (data.powerKW !== undefined) row.power_kw = parseFloat(data.powerKW) || 0;
                        if (data.totalPorts !== undefined) row.total_ports = parseInt(data.totalPorts) || 1;
                        if (data.availablePorts !== undefined) row.available_ports = parseInt(data.availablePorts) || 0;
                        if (data.pricePerKwh !== undefined) row.price_per_kwh = parseFloat(data.pricePerKwh) || 0;
                        if (data.freeCharging !== undefined) row.free_charging = !!data.freeCharging;
                        if (data.status !== undefined) row.status = data.status;
                        if (data.facilities !== undefined) row.facilities = data.facilities;
                        const image = data.image !== undefined ? data.image : data.imageUrl;
                        if (image !== undefined) row.image = image;
                        if (data.occupiedPorts !== undefined) row.occupied_ports = data.occupiedPorts;
                        if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
                        return row;
                    }
                },
                bookings: {
                    toJS: row => {
                        const elapsedSeconds = row.status === 'completed' || row.status === 'charging'
                            ? Math.max(0, Math.floor((new Date(row.updated_at || 0) - new Date(row.created_at || 0)) / 1000))
                            : 0;
                        const chargerType = row.charger_type || 'DC';
                        const basePower = chargerType === 'DC' ? 120 : 22;
                        const energyKwh = parseFloat((basePower * (elapsedSeconds / 3600)).toFixed(3));
                        const stationPrice = row.stations && row.stations.price_per_kwh !== undefined ? parseFloat(row.stations.price_per_kwh) : 0.45;
                        const isFree = row.stations ? !!row.stations.free_charging : false;
                        const cost = isFree ? 0 : parseFloat((energyKwh * stationPrice).toFixed(2));

                        return {
                            id: row.id,
                            userId: row.user_id,
                            stationId: row.station_id,
                            date: row.date,
                            time: row.time,
                            durationHours: row.duration_hours,
                            portNumber: row.port_number,
                            status: row.status,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at,
                            userName: row.user_name || (row.users ? row.users.name : 'EV Driver'),
                            userEmail: row.user_email || (row.users ? row.users.email : ''),
                            stationName: row.station_name || (row.stations ? row.stations.station_name : ''),
                            chargerType: row.charger_type,
                            paid: row.paid,
                            durationLimitMinutes: row.duration_limit_minutes,
                            costLimitUSD: row.cost_limit_usd,
                            durationSeconds: elapsedSeconds,
                            energyKwh: energyKwh,
                            cost: cost
                        };
                    },
                    toDB: data => {
                        const row = {};
                        if (data.userId !== undefined) row.user_id = data.userId;
                        if (data.stationId !== undefined) row.station_id = data.stationId;
                        if (data.date !== undefined) row.date = data.date;
                        if (data.time !== undefined) row.time = data.time;
                        if (data.durationHours !== undefined) row.duration_hours = parseInt(data.durationHours) || 1;
                        if (data.portNumber !== undefined) row.port_number = parseInt(data.portNumber);
                        if (data.status !== undefined) row.status = data.status;
                        if (data.userName !== undefined) row.user_name = data.userName;
                        if (data.userEmail !== undefined) row.user_email = data.userEmail;
                        if (data.stationName !== undefined) row.station_name = data.stationName;
                        if (data.chargerType !== undefined) row.charger_type = data.chargerType;
                        if (data.paid !== undefined) row.paid = data.paid;
                        if (data.durationLimitMinutes !== undefined) row.duration_limit_minutes = data.durationLimitMinutes;
                        if (data.costLimitUSD !== undefined) row.cost_limit_usd = data.costLimitUSD;
                        if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
                        return row;
                    }
                },
                sessions: {
                    toJS: row => ({
                        id: row.id,
                        bookingId: row.booking_id,
                        userId: row.user_id,
                        elapsedSeconds: row.elapsed_seconds,
                        energyKwh: row.energy_kwh,
                        cost: row.cost,
                        currentKw: row.current_kw,
                        status: row.status,
                        updatedAt: row.updated_at
                    }),
                    toDB: data => {
                        const row = {};
                        if (data.bookingId !== undefined) row.booking_id = data.bookingId;
                        if (data.userId !== undefined) row.user_id = data.userId;
                        if (data.elapsedSeconds !== undefined) row.elapsed_seconds = parseInt(data.elapsedSeconds) || 0;
                        if (data.energyKwh !== undefined) row.energy_kwh = parseFloat(data.energyKwh) || 0;
                        if (data.cost !== undefined) row.cost = parseFloat(data.cost) || 0;
                        if (data.currentKw !== undefined) row.current_kw = parseFloat(data.currentKw) || 0;
                        if (data.status !== undefined) row.status = data.status;
                        return row;
                    }
                }
            };

            function mapRowToJS(tableName, row) {
                const m = mappings[tableName];
                return m ? m.toJS(row) : row;
            }

            function mapJSToRow(tableName, data) {
                const m = mappings[tableName];
                return m ? m.toDB(data) : data;
            }

            // Dynamic Query Builder implementation
            class QueryBuilder {
                constructor(tableName) {
                    this.tableName = tableName;
                    this.filters = [];
                    this.orderByField = null;
                    this.orderByDirection = 'desc';
                }

                where(field, op, value) {
                    let dbField = field;
                    if (field === 'stationId') dbField = 'station_id';
                    if (field === 'userId') dbField = 'user_id';
                    this.filters.push({ field: dbField, op, value });
                    return this;
                }

                orderBy(field, direction = 'asc') {
                    let dbField = field;
                    if (field === 'createdAt') dbField = 'created_at';
                    this.orderByField = dbField;
                    this.orderByDirection = direction;
                    return this;
                }

                async get() {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                let selectStr = '*';
                                if (this.tableName === 'bookings') {
                                    selectStr = '*, users(name, email), stations(station_name, price_per_kwh, free_charging)';
                                }
                                let q = supabase.from(this.tableName).select(selectStr);
                                for (const f of this.filters) {
                                    if (f.op === '==' || f.op === '===') {
                                        q = q.eq(f.field, f.value);
                                    }
                                    if (f.op === 'in') {
                                        q = q.in(f.field, f.value);
                                    }
                                }
                                if (this.orderByField) {
                                    q = q.order(this.orderByField, { ascending: this.orderByDirection === 'asc' });
                                }

                                const { data, error } = await q;
                                if (error) throw error;

                                const docs = (data || []).map(row => {
                                    const mappedData = mapRowToJS(this.tableName, row);
                                    return {
                                        id: row.id,
                                        exists: true,
                                        data: () => mappedData
                                    };
                                });

                                resolve({
                                    docs,
                                    size: docs.length,
                                    empty: docs.length === 0,
                                    forEach: (cb) => docs.forEach(cb)
                                });
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }

                onSnapshot(onNext, onError) {
                    let active = true;
                    let subscription = null;

                    onSupabaseReady(async (supabase) => {
                        if (!active) return;
                        try {
                            const runQuery = () => {
                                this.get().then(res => {
                                    if (active) onNext(res);
                                }).catch(err => {
                                    if (active && onError) onError(err);
                                });
                            };

                            runQuery();

                            const channelName = \`\${this.tableName}-query-\${generateUUID().substring(0,8)}\`;
                            console.log(\`[Realtime] Subscribing to query for table: \${this.tableName} (channel: \${channelName})\`);
                            subscription = supabase.channel(channelName)
                                .on('postgres_changes', { event: '*', schema: 'public', table: this.tableName }, (payload) => {
                                    console.log(\`[Realtime] Change detected on \${this.tableName}:\`, payload);
                                    runQuery();
                                })
                                .subscribe((status, err) => {
                                    if (err) {
                                        console.error(\`[Realtime] Subscription error for \${this.tableName}:\`, err);
                                    } else {
                                        console.log(\`[Realtime] Subscription status for \${this.tableName}: \${status}\`);
                                    }
                                });
                        } catch (err) {
                            if (onError) onError(err);
                        }
                    });

                    return () => {
                        active = false;
                        if (subscription) {
                            onSupabaseReady(supabase => supabase.removeChannel(subscription));
                        }
                    };
                }
            }

            // Document Reference implementation
            class DocRef {
                constructor(tableName, id) {
                    this.tableName = tableName;
                    this.id = id || generateUUID();
                }

                async get() {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                let selectStr = '*';
                                if (this.tableName === 'bookings') {
                                    selectStr = '*, users(name, email), stations(station_name, price_per_kwh, free_charging)';
                                }
                                const { data, error } = await supabase
                                    .from(this.tableName)
                                    .select(selectStr)
                                    .eq('id', this.id)
                                    .maybeSingle();

                                if (error) throw error;

                                if (!data) {
                                    resolve({ id: this.id, exists: false, data: () => null });
                                } else {
                                    resolve({
                                        id: this.id,
                                        exists: true,
                                        data: () => mapRowToJS(this.tableName, data)
                                    });
                                }
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }

                async set(data) {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const row = mapJSToRow(this.tableName, data);
                                row.id = this.id;
                                const { error } = await supabase.from(this.tableName).upsert(row);
                                if (error) throw error;
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }

                async update(data) {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const row = mapJSToRow(this.tableName, data);
                                const { error } = await supabase.from(this.tableName).update(row).eq('id', this.id);
                                if (error) throw error;
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }

                async delete() {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const { error } = await supabase.from(this.tableName).delete().eq('id', this.id);
                                if (error) throw error;
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }

                onSnapshot(onNext, onError) {
                    let active = true;
                    let subscription = null;

                    onSupabaseReady(async (supabase) => {
                        if (!active) return;
                        try {
                            const runGet = () => {
                                this.get().then(res => {
                                    if (active) onNext(res);
                                }).catch(err => {
                                    if (active && onError) onError(err);
                                });
                            };

                            runGet();

                            const channelName = \`doc-\${this.tableName}-\${this.id.substring(0,8)}\`;
                            console.log(\`[Realtime] Subscribing to document: \${this.tableName}/\${this.id} (channel: \${channelName})\`);
                            subscription = supabase.channel(channelName)
                                .on('postgres_changes', { 
                                    event: '*', 
                                    schema: 'public', 
                                    table: this.tableName,
                                    filter: \`id=eq.\${this.id}\`
                                }, (payload) => {
                                    console.log(\`[Realtime] Change detected on \${this.tableName}/\${this.id}:\`, payload);
                                    runGet();
                                })
                                .subscribe((status, err) => {
                                    if (err) {
                                        console.error(\`[Realtime] Subscription error for \${this.tableName}/\${this.id}:\`, err);
                                    } else {
                                        console.log(\`[Realtime] Subscription status for \${this.tableName}/\${this.id}: \${status}\`);
                                    }
                                });
                        } catch (err) {
                            if (onError) onError(err);
                        }
                    });

                    return () => {
                        active = false;
                        if (subscription) {
                            onSupabaseReady(supabase => supabase.removeChannel(subscription));
                        }
                    };
                }
            }

            // Global Database definition
            window.db = {
                collection(tableName) {
                    return {
                        doc: (id) => new DocRef(tableName, id),
                        add: async (data) => {
                            const id = generateUUID();
                            const ref = new DocRef(tableName, id);
                            await ref.set(data);
                            return { id };
                        },
                        where: (field, op, value) => {
                            const q = new QueryBuilder(tableName);
                            return q.where(field, op, value);
                        },
                        orderBy: (field, direction) => {
                            const q = new QueryBuilder(tableName);
                            return q.orderBy(field, direction);
                        },
                        onSnapshot: (onNext, onError) => {
                            const q = new QueryBuilder(tableName);
                            return q.onSnapshot(onNext, onError);
                        },
                        get: () => {
                            const q = new QueryBuilder(tableName);
                            return q.get();
                        }
                    };
                },
                enablePersistence(options) {
                    return Promise.resolve();
                },
                async runTransaction(callback) {
                    const transaction = {
                        get: async (docRef) => {
                            return docRef.get();
                        },
                        update: (docRef, data) => {
                            return docRef.update(data);
                        },
                        set: (docRef, data) => {
                            return docRef.set(data);
                        }
                    };
                    try {
                        return await callback(transaction);
                    } catch (err) {
                        console.error('Transaction execution failed:', err);
                        throw err;
                    }
                }
            };

            // Global Auth definition
            window.auth = {
                authStateListeners: [],
                
                async createUserWithEmailAndPassword(email, password) {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const { data, error } = await supabase.auth.signUp({
                                    email,
                                    password
                                });
                                if (error) throw error;
                                
                                const mappedUser = {
                                    uid: data.user.id,
                                    id: data.user.id,
                                    email: data.user.email
                                };
                                resolve({ user: mappedUser });
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                },

                async signInWithEmailAndPassword(email, password) {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const { data, error } = await supabase.auth.signInWithPassword({
                                    email,
                                    password
                                });
                                if (error) throw error;
                                
                                const mappedUser = {
                                    uid: data.user.id,
                                    id: data.user.id,
                                    email: data.user.email
                                };
                                resolve({ user: mappedUser });
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                },

                async signOut() {
                    return new Promise((resolve, reject) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const { error } = await supabase.auth.signOut();
                                if (error) throw error;
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                },

                async getAccessToken() {
                    return new Promise((resolve) => {
                        onSupabaseReady(async (supabase) => {
                            try {
                                const { data: { session } } = await supabase.auth.getSession();
                                resolve(session ? session.access_token : null);
                            } catch (e) {
                                resolve(null);
                            }
                        });
                    });
                },

                onAuthStateChanged(callback) {
                    let active = true;
                    let subscription = null;

                    onSupabaseReady(async (supabase) => {
                        if (!active) return;
                        
                        try {
                            // 1. Get initial session state reliably
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!active) return;
                            const user = session ? session.user : null;
                            const mappedUser = user ? { uid: user.id, id: user.id, email: user.email } : null;
                            callback(mappedUser);
                        } catch (err) {
                            console.error('onAuthStateChanged: Failed to get initial session:', err);
                            if (active) callback(null);
                        }

                        if (!active) return;

                        // 2. Listen to subsequent changes, skipping the redundant initial check
                        let isFirstChange = true;
                        const { data } = supabase.auth.onAuthStateChange((event, session) => {
                            if (!active) return;
                            if (isFirstChange) {
                                isFirstChange = false;
                                return;
                            }
                            const user = session ? session.user : null;
                            const mappedUser = user ? { uid: user.id, id: user.id, email: user.email } : null;
                            callback(mappedUser);
                        });
                        
                        subscription = data.subscription;
                    });

                    // Return unsubscribe
                    return () => {
                        active = false;
                        if (subscription) {
                            subscription.unsubscribe();
                        }
                    };
                }
            };

            // Firebase compat mockup objects just in case scripts query them
            window.firebase = {
                apps: [{ name: '[DEFAULT]' }],
                initializeApp: () => {},
                firestore: () => window.db,
                auth: () => window.auth
            };
        })();
    `);
});

// Serve static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../client')));

// User Authentication Middleware using Supabase Session Token
const userAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        const token = authHeader.split(' ')[1];

        // Verify session token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ message: 'Invalid or expired session token.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('User authentication middleware error:', error);
        return res.status(401).json({ message: 'Authentication failed.' });
    }
};

// DELETE /api/bookings/:id - Securely cancel and delete booking (bypasses RLS using Service Role Key)
app.delete('/api/bookings/:id', userAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Retrieve booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchError || !booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Verify ownership
        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You do not own this booking.' });
        }

        // Enforce 1-hour cancellation limit
        if (booking.status !== 'rejected') {
            const bookingStart = new Date(booking.date + 'T' + booking.time);
            const now = new Date();
            const diffMs = bookingStart - now;
            const oneHourMs = 60 * 60 * 1000;
            if (diffMs <= oneHourMs) {
                return res.status(400).json({ message: 'You cannot cancel a booking that starts within 1 hour or has already started.' });
            }
        }

        // Perform deletion
        const { error: deleteError } = await supabase
            .from('bookings')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ message: 'Booking cancelled and deleted successfully.' });
    } catch (error) {
        console.error('API delete booking error:', error);
        res.status(500).json({ message: 'Failed to delete booking.' });
    }
});

// POST /api/bookings/:id/start - Start charging session (bypasses client RLS)
app.post('/api/bookings/:id/start', userAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { durationLimitMinutes, costLimitUSD } = req.body;

        // 1. Fetch booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (bookingError || !booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You do not own this booking.' });
        }

        if (booking.status !== 'approved') {
            return res.status(400).json({ message: `Cannot start session for booking with status: ${booking.status}` });
        }

        // 2. Fetch station
        const { data: station, error: stationError } = await supabase
            .from('stations')
            .select('*')
            .eq('id', booking.station_id)
            .maybeSingle();

        if (stationError || !station) {
            return res.status(404).json({ message: 'Station not found.' });
        }

        const available = parseInt(station.available_ports) || 0;
        if (available <= 0) {
            return res.status(400).json({ message: 'Sorry, no available ports left on this station!' });
        }

        const portNumber = parseInt(booking.port_number);
        let occupiedPorts = station.occupied_ports || [];
        if (portNumber && !occupiedPorts.includes(portNumber)) {
            occupiedPorts.push(portNumber);
        }

        // 3. Update station
        const { error: stationUpdateError } = await supabase
            .from('stations')
            .update({
                available_ports: available - 1,
                occupied_ports: occupiedPorts
            })
            .eq('id', booking.station_id);

        if (stationUpdateError) throw stationUpdateError;

        // 4. Update booking
        const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({
                status: 'charging',
                duration_limit_minutes: durationLimitMinutes ? parseFloat(durationLimitMinutes) : null,
                cost_limit_usd: costLimitUSD ? parseFloat(costLimitUSD) : null,
                created_at: new Date().toISOString(), // Charging start time
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (bookingUpdateError) throw bookingUpdateError;

        res.json({ message: 'Charging session started successfully.' });
    } catch (error) {
        console.error('API start charging error:', error);
        res.status(500).json({ message: 'Failed to start session.' });
    }
});

// POST /api/bookings/:id/stop - Stop charging session (bypasses client RLS)
app.post('/api/bookings/:id/stop', userAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (bookingError || !booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You do not own this booking.' });
        }

        if (booking.status !== 'charging') {
            return res.status(400).json({ message: 'This booking is not currently charging.' });
        }

        // 2. Fetch station
        const { data: station, error: stationError } = await supabase
            .from('stations')
            .select('*')
            .eq('id', booking.station_id)
            .maybeSingle();

        if (stationError || !station) {
            return res.status(404).json({ message: 'Station not found.' });
        }

        // 3. Calculate final charging metrics
        const startTime = new Date(booking.created_at);
        const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
        const chargerType = booking.charger_type || 'DC';
        const basePower = chargerType === 'DC' ? 120 : 22;
        const energyKwh = parseFloat((basePower * (elapsedSeconds / 3600)).toFixed(3));
        const ratePerKwh = station.price_per_kwh ? parseFloat(station.price_per_kwh) : 0.45;
        const isFree = station.free_charging || false;
        const finalCost = isFree ? 0 : parseFloat((energyKwh * ratePerKwh).toFixed(2));

        // 4. Update station: restore port availability
        const available = parseInt(station.available_ports) || 0;
        const total = parseInt(station.total_ports) || 1;
        const newAvailable = Math.min(total, available + 1);

        const portNumber = parseInt(booking.port_number);
        let occupiedPorts = station.occupied_ports || [];
        occupiedPorts = occupiedPorts.filter(p => p !== portNumber);

        const { error: stationUpdateError } = await supabase
            .from('stations')
            .update({
                available_ports: newAvailable,
                occupied_ports: occupiedPorts
            })
            .eq('id', booking.station_id);

        if (stationUpdateError) throw stationUpdateError;

        // 5. Update booking to completed
        try {
            const { error: bookingUpdateError } = await supabase
                .from('bookings')
                .update({
                    status: 'completed',
                    cost: finalCost,
                    energy_kwh: energyKwh,
                    duration_seconds: elapsedSeconds,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (bookingUpdateError) {
                // Fallback to legacy update if columns don't exist yet
                console.warn('Could not save cost/energy/duration columns to DB (probably columns not added yet). Falling back to legacy update:', bookingUpdateError.message);
                const { error: fallbackError } = await supabase
                    .from('bookings')
                    .update({
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                if (fallbackError) throw fallbackError;
            }
        } catch (err) {
            console.error('Booking stop update error:', err);
            throw err;
        }

        res.json({ message: 'Charging session stopped successfully.' });
    } catch (error) {
        console.error('API stop charging error:', error);
        res.status(500).json({ message: 'Failed to stop session.' });
    }
});

// API Routes
const adminRoutes = require('./routes/adminRoutes');
const stationRoutes = require('./routes/stationRoutes');

app.use('/api/admin', adminRoutes);
app.use('/api/admin/stations', stationRoutes);

// Serve client pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum is 5MB.' });
    }
    if (err.message && err.message.includes('Only image files')) {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Internal server error.' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║   ⚡ ChargeNet Server Running             ║
    ║   🌐 http://localhost:${PORT}               ║
    ║   📋 Admin: http://localhost:${PORT}/admin   ║
    ╚═══════════════════════════════════════════╝
    `);
});

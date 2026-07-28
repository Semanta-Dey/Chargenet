const { supabase } = require('../config/supabase');
const path = require('path');
const fs = require('fs');

// Helper: Map DB row to Frontend camelCase
const toCamelCase = (row) => {
    if (!row) return null;
    return {
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
    };
};

// Helper: Map Frontend camelCase to DB snake_case
const toSnakeCase = (data) => {
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
    if (data.freeCharging !== undefined) {
        row.free_charging = data.freeCharging === 'true' || data.freeCharging === true;
    }
    if (data.status !== undefined) row.status = data.status;
    if (data.facilities !== undefined) {
        row.facilities = typeof data.facilities === 'string' ? JSON.parse(data.facilities) : data.facilities;
    }
    if (data.image !== undefined) row.image = data.image;
    if (data.occupiedPorts !== undefined) row.occupied_ports = data.occupiedPorts;
    if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
    return row;
};

// CREATE - Add new station
const createStation = async (req, res) => {
    try {
        const {
            stationName, ownerName, contact, email,
            address, city, latitude, longitude, mapLink,
            chargerType, connectorType, powerKW,
            totalPorts, availablePorts, pricePerKwh,
            freeCharging, status, facilities
        } = req.body;

        if (!stationName || !ownerName || !contact || !email || !address || !city || !chargerType || !connectorType) {
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }

        const stationData = toSnakeCase({
            stationName: stationName.trim(),
            ownerName: ownerName.trim(),
            contact: contact.trim(),
            email: email.trim().toLowerCase(),
            address: address.trim(),
            city: city.trim(),
            latitude,
            longitude,
            mapLink,
            chargerType,
            connectorType,
            powerKW,
            totalPorts,
            availablePorts,
            pricePerKwh,
            freeCharging,
            status,
            facilities,
            image: req.file ? `/uploads/${req.file.filename}` : ''
        });

        const { data, error } = await supabase
            .from('stations')
            .insert(stationData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Station created successfully',
            id: data.id,
            station: toCamelCase(data)
        });
    } catch (error) {
        console.error('Create station error:', error);
        res.status(500).json({ message: 'Failed to create station.' });
    }
};

// READ - Get all stations
const getAllStations = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const stations = data.map(toCamelCase);
        res.json({ stations, total: stations.length });
    } catch (error) {
        console.error('Get stations error:', error);
        res.status(500).json({ message: 'Failed to fetch stations.' });
    }
};

// READ - Get single station
const getStation = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('stations')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ message: 'Station not found.' });
        }

        res.json({ station: toCamelCase(data) });
    } catch (error) {
        console.error('Get station error:', error);
        res.status(500).json({ message: 'Failed to fetch station.' });
    }
};

// UPDATE - Edit station
const updateStation = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = toSnakeCase(req.body);

        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        // Fetch current station to check for old image
        const { data: currentStation, error: fetchError } = await supabase
            .from('stations')
            .select('image')
            .eq('id', id)
            .single();

        if (fetchError || !currentStation) {
            return res.status(404).json({ message: 'Station not found.' });
        }

        // Delete old image if a new one is uploaded
        if (req.file && currentStation.image) {
            const oldPath = path.join(__dirname, '..', currentStation.image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const { data: updatedStation, error: updateError } = await supabase
            .from('stations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            message: 'Station updated successfully',
            station: toCamelCase(updatedStation)
        });
    } catch (error) {
        console.error('Update station error:', error);
        res.status(500).json({ message: 'Failed to update station.' });
    }
};

// DELETE - Remove station
const deleteStation = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch station image
        const { data: station, error: fetchError } = await supabase
            .from('stations')
            .select('image')
            .eq('id', id)
            .single();

        if (fetchError || !station) {
            return res.status(404).json({ message: 'Station not found.' });
        }

        if (station.image) {
            const imgPath = path.join(__dirname, '..', station.image);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }

        const { error: deleteError } = await supabase
            .from('stations')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ message: 'Station deleted successfully' });
    } catch (error) {
        console.error('Delete station error:', error);
        res.status(500).json({ message: 'Failed to delete station.' });
    }
};

// STATS - Dashboard analytics
const getStats = async (req, res) => {
    try {
        const { data: stations, error } = await supabase
            .from('stations')
            .select('*');

        if (error) throw error;

        const mappedStations = stations.map(toCamelCase);

        const stats = {
            totalStations: mappedStations.length,
            activeStations: mappedStations.filter(s => s.status === 'Active' || s.status === 'Available').length,
            busyStations: mappedStations.filter(s => s.status === 'Busy').length,
            maintenanceStations: mappedStations.filter(s => s.status === 'Maintenance').length,
            offlineStations: mappedStations.filter(s => s.status === 'Offline').length,
            totalPorts: mappedStations.reduce((sum, s) => sum + (s.totalPorts || 0), 0),
            availablePorts: mappedStations.reduce((sum, s) => sum + (s.availablePorts || 0), 0),
            totalRevenue: mappedStations.reduce((sum, s) => sum + ((s.pricePerKwh || 0) * (s.totalPorts || 0) * 50), 0),
            cityCounts: {},
            chargerTypeCounts: { AC: 0, DC: 0 }
        };

        mappedStations.forEach(s => {
            if (s.city) stats.cityCounts[s.city] = (stats.cityCounts[s.city] || 0) + 1;
            if (s.chargerType) stats.chargerTypeCounts[s.chargerType] = (stats.chargerTypeCounts[s.chargerType] || 0) + 1;
        });

        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Failed to fetch stats.' });
    }
};

// GET - Get bookings for a single station (bypasses RLS)
const getStationBookings = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('station_id', id)
            .in('status', ['approved', 'charging']);

        if (error) throw error;

        // Map database row to CamelCase matching client-side expectations
        const bookings = data.map(b => ({
            id: b.id,
            userId: b.user_id,
            stationId: b.station_id,
            date: b.date,
            time: b.time,
            durationHours: b.duration_hours,
            portNumber: b.port_number,
            status: b.status,
            createdAt: b.created_at,
            userEmail: b.user_email,
            userName: b.user_name,
            stationName: b.station_name,
            chargerType: b.charger_type,
            paid: b.paid,
            durationLimitMinutes: b.duration_limit_minutes,
            costLimitUSD: b.cost_limit_usd,
            updatedAt: b.updated_at
        }));

        res.json({ bookings });
    } catch (error) {
        console.error('Get station bookings error:', error);
        res.status(500).json({ message: 'Failed to fetch bookings.' });
    }
};

module.exports = { createStation, getAllStations, getStation, updateStation, deleteStation, getStats, getStationBookings };

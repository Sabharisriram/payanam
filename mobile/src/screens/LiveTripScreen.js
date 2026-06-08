import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert, ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { getTripStops } from '../api/trips';

const SOCKET_URL = 'http://10.38.6.230:5000';

const STOP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  sightseeing: '📸', viewpoint: '🏔️', fuel: '⛽',
  accommodation: '🏨', stay: '🏨', activity: '🎯',
  meal: '🍽️', food: '🍽️', break: '🛑'
};

export default function LiveTripScreen({ route, navigation }) {
  const { tripId, tripName } = route.params;
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [stops, setStops] = useState([]);
  const [nextStop, setNextStop] = useState(null);
  const [distanceToNext, setDistanceToNext] = useState(null);
  const socketRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    loadStops();
    return () => {
      stopTracking();
    };
  }, []);

  const loadStops = async () => {
    try {
      const data = await getTripStops(tripId);
      setStops(data);
      if (data.length > 0) setNextStop(data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const startTracking = async () => {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required for live tracking');
      return;
    }

    // Connect to socket
    socketRef.current = io(SOCKET_URL);
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      socketRef.current.emit('start_trip', { tripId });
    });

    // Start watching location
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // every 30 seconds
        distanceInterval: 50  // or every 50 meters
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Send to server
        socketRef.current?.emit('location_update', {
          tripId,
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString()
        });

        // Calculate distance to next stop
        if (nextStop?.coords) {
          const dist = calculateDistance(
            latitude, longitude,
            nextStop.coords.lat, nextStop.coords.lng
          );
          setDistanceToNext(dist);
        }
      }
    );

    setIsTracking(true);
  };

  const stopTracking = () => {
    locationSubscription.current?.remove();
    socketRef.current?.emit('end_trip', { tripId });
    socketRef.current?.disconnect();
    setIsTracking(false);
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{tripName}</Text>
        <Text style={styles.subtitle}>Live Trip Tracker</Text>

        {/* Status card */}
        <View style={[styles.statusCard, isTracking ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusIcon}>{isTracking ? '🟢' : '⚪'}</Text>
          <Text style={styles.statusText}>
            {isTracking ? 'Tracking Active' : 'Tracking Stopped'}
          </Text>
        </View>

        {/* Current location */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.cardTitle}>📍 Current Location</Text>
            <Text style={styles.locationText}>
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </Text>
          </View>
        )}

        {/* Next stop */}
        {nextStop && (
          <View style={styles.nextStopCard}>
            <Text style={styles.cardTitle}>⏭️ Next Stop</Text>
            <Text style={styles.nextStopType}>
              {STOP_ICONS[nextStop.stop_type] || '📍'} {nextStop.stop_type?.toUpperCase()}
            </Text>
            <Text style={styles.nextStopTime}>
              Scheduled: {nextStop.suggested_time?.slice(0, 5)}
            </Text>
            {distanceToNext && (
              <Text style={styles.distance}>{distanceToNext} km away</Text>
            )}
          </View>
        )}

        {/* All stops */}
        <Text style={styles.sectionTitle}>Trip Stops ({stops.length})</Text>
        {stops.map((stop, index) => (
          <View key={stop.id || index} style={styles.stopRow}>
            <Text style={styles.stopIcon}>
              {STOP_ICONS[stop.stop_type] || '📍'}
            </Text>
            <View style={styles.stopDetails}>
              <Text style={styles.stopType}>{stop.stop_type}</Text>
              <Text style={styles.stopTime}>{stop.suggested_time?.slice(0, 5)}</Text>
            </View>
          </View>
        ))}

        {/* Control button */}
        <TouchableOpacity
          style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? '⏹ Stop Tracking' : '▶ Start Trip'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: '#f97316', fontSize: 16, marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 12, marginBottom: 16
  },
  statusActive: { backgroundColor: '#166534' },
  statusInactive: { backgroundColor: '#1e293b' },
  statusIcon: { fontSize: 20 },
  statusText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  locationCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 12
  },
  cardTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  locationText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  nextStopCard: {
    backgroundColor: '#1e3a5f', borderRadius: 12,
    padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#f97316'
  },
  nextStopType: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  nextStopTime: { color: '#94a3b8', fontSize: 14 },
  distance: { color: '#f97316', fontSize: 14, marginTop: 4 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 10,
    padding: 12, marginBottom: 8, gap: 12
  },
  stopIcon: { fontSize: 20 },
  stopDetails: { flex: 1 },
  stopType: { color: '#fff', fontSize: 14 },
  stopTime: { color: '#f97316', fontSize: 12, marginTop: 2 },
  button: {
    borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 24
  },
  startButton: { backgroundColor: '#16a34a' },
  stopButton: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
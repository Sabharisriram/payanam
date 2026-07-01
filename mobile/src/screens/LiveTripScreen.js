import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert, ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import {
  Coffee, UtensilsCrossed, Moon, Camera, Mountain,
  Fuel, Hotel, Sparkles, MapPin,
} from 'lucide-react-native';
import { getTripStops, quickReview, markProximityVisited } from '../api/trips';
import QuickReviewSheet from '../components/QuickReviewSheet';
import { C, FONTS } from '../theme/colors';

const SOCKET_URL = 'http://10.38.6.230:5000';

const STOP_ICON_COMPONENTS = {
  tea: Coffee, snack: Coffee,
  breakfast: UtensilsCrossed, lunch: UtensilsCrossed,
  meal: UtensilsCrossed, food: UtensilsCrossed, break: UtensilsCrossed,
  dinner: Moon,
  sightseeing: Camera,
  viewpoint: Mountain, scenic_view: Mountain,
  fuel: Fuel,
  accommodation: Hotel, stay: Hotel, 'stay/accommodation': Hotel,
  activity: Sparkles, attraction: Sparkles,
};

function StopIcon({ type, size = 20, color }) {
  const Icon = STOP_ICON_COMPONENTS[type] || MapPin;
  return <Icon size={size} color={color || C.ACCENT} strokeWidth={2} />;
}

const REVIEWABLE_STOP_TYPES = new Set(['tea', 'breakfast', 'lunch', 'dinner', 'snack', 'fuel', 'accommodation', 'stay']);

export default function LiveTripScreen({ route, navigation }) {
  const { tripId, tripName } = route.params;
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [stops, setStops] = useState([]);
  const [nextStop, setNextStop] = useState(null);
  const [distanceToNext, setDistanceToNext] = useState(null);
  const [reviewStop, setReviewStop] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const socketRef = useRef(null);
  const locationSubscription = useRef(null);
  const stopsRef = useRef([]);
  const shownStopIds = useRef(new Set());
  const inTripRatings = useRef({});

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
      stopsRef.current = data;
      if (data.length > 0) setNextStop(data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required for live tracking');
      return;
    }

    socketRef.current = io(SOCKET_URL);
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      socketRef.current.emit('start_trip', { tripId });
    });

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000,
        distanceInterval: 50
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        socketRef.current?.emit('location_update', {
          tripId,
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString()
        });

        if (nextStop?.coords) {
          const dist = calculateDistance(
            latitude, longitude,
            nextStop.coords.lat, nextStop.coords.lng
          );
          setDistanceToNext(dist);
        }

        const speedKmh = (location.coords.speed ?? 0) * 3.6;
        console.log(`[proximity] update lat=${latitude.toFixed(4)} lng=${longitude.toFixed(4)} speed=${speedKmh.toFixed(1)}km/h stops=${stopsRef.current.length}`);

        if (speedKmh < 40) {
          console.log(`[proximity] checking ${stopsRef.current.length} stops for review`);
          for (const stop of stopsRef.current) {
            const reviewable = REVIEWABLE_STOP_TYPES.has(stop.stop_type);
            const hasCoords = !!(stop.stop_lat && stop.stop_lng);
            const dist = hasCoords
              ? parseFloat(calculateDistance(latitude, longitude, stop.stop_lat, stop.stop_lng))
              : null;
            console.log(`[proximity] stop id=${stop.id} type=${stop.stop_type} reviewable=${reviewable} hasCoords=${hasCoords} dist=${dist ?? 'n/a'}km done=${stop.proximity_review_done} shown=${shownStopIds.current.has(stop.id)}`);
            if (stop.proximity_review_done || shownStopIds.current.has(stop.id)) continue;
            if (!reviewable) continue;
            if (!hasCoords) continue;
            if (dist < 0.5) {
              console.log(`[proximity] TRIGGER stop id=${stop.id} type=${stop.stop_type} dist=${dist}km`);
              shownStopIds.current.add(stop.id);
              setReviewStop(stop);
              setSheetVisible(true);
              break;
            }
          }
        } else {
          console.log(`[proximity] skipped -- speed ${speedKmh.toFixed(1)}km/h >= 40`);
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

  const markStopVisited = (stopId) => {
    const now = new Date().toISOString();
    const update = (list) => list.map(s =>
      s.id === stopId ? { ...s, visited_at: now, proximity_review_done: true } : s
    );
    setStops(prev => update(prev));
    stopsRef.current = update(stopsRef.current);
  };

  const handleQuickRate = async (rating) => {
    setSheetVisible(false);
    if (!reviewStop) return;
    inTripRatings.current[reviewStop.id] = rating;
    try {
      await quickReview(tripId, reviewStop.id, rating);
      markStopVisited(reviewStop.id);
    } catch (err) {
      console.error('[proximity] quickReview error:', err.message);
    }
  };

  const handleQuickSkip = async () => {
    setTimeout(() => { setSheetVisible(false); }, 0);
    if (!reviewStop) return;
    try {
      await markProximityVisited(tripId, reviewStop.id);
      markStopVisited(reviewStop.id);
    } catch (err) {
      console.error('[proximity] markProximityVisited error:', err.message);
    }
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

        <View style={[styles.statusCard, isTracking ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusIcon}>{isTracking ? '🟢' : '⚪'}</Text>
          <Text style={styles.statusText}>
            {isTracking ? 'Tracking Active' : 'Tracking Stopped'}
          </Text>
        </View>

        {currentLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.cardTitle}>📍 Current Location</Text>
            <Text style={styles.locationText}>
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </Text>
          </View>
        )}

        {nextStop && (
          <View style={styles.nextStopCard}>
            <Text style={styles.cardTitle}>⏭️ Next Stop</Text>
            <View style={styles.nextStopTypeRow}>
              <StopIcon type={nextStop.stop_type} size={18} color={C.PRIMARY} />
              <Text style={styles.nextStopType}>{nextStop.stop_type?.toUpperCase()}</Text>
            </View>
            <Text style={styles.nextStopTime}>
              Scheduled: {nextStop.suggested_time?.slice(0, 5)}
            </Text>
            {distanceToNext && (
              <Text style={styles.distance}>{distanceToNext} km away</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Trip Stops ({stops.length})</Text>
        {stops.map((stop, index) => (
          <View key={stop.id || index} style={styles.stopRow}>
            <View style={styles.stopIconWrap}>
              <StopIcon type={stop.stop_type} size={20} />
            </View>
            <View style={styles.stopDetails}>
              <Text style={styles.stopType}>{stop.stop_type}</Text>
              <Text style={styles.stopTime}>{stop.suggested_time?.slice(0, 5)}</Text>
              {stop.visited_at && (
                <Text style={styles.arrivedText}>
                  {'✅ Arrived: ' + new Date(stop.visited_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? '⏹ Stop Tracking' : '▶ Start Trip'}
          </Text>
        </TouchableOpacity>

        {!isTracking && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => navigation.navigate('ReviewTrip', {
              tripId: tripId,
              tripName: tripName,
              prefilledRatings: inTripRatings.current
            })}
          >
            <Text style={styles.reviewButtonText}>⭐ Rate This Trip</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      <QuickReviewSheet
        stop={reviewStop}
        visible={sheetVisible}
        onRate={handleQuickRate}
        onSkip={handleQuickSkip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: C.PRIMARY, fontSize: 16, fontFamily: FONTS.body, marginBottom: 16 },
  title: { color: C.INK, fontSize: 22, fontFamily: FONTS.display },
  subtitle: { color: C.INK_MUTED, fontSize: 14, fontFamily: FONTS.body, marginBottom: 20 },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 12, marginBottom: 16
  },
  statusActive: { backgroundColor: C.SAGE_BG },
  statusInactive: { backgroundColor: C.CARD },
  statusIcon: { fontSize: 20 },
  statusText: { color: C.INK, fontSize: 16, fontFamily: FONTS.bodyBold },
  locationCard: {
    backgroundColor: C.CARD, borderRadius: 12,
    padding: 16, marginBottom: 12
  },
  cardTitle: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, marginBottom: 8 },
  locationText: { color: C.INK, fontSize: 16, fontFamily: FONTS.bodyBold },
  nextStopCard: {
    backgroundColor: C.CARD_ALT, borderRadius: 12,
    padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.PRIMARY
  },
  nextStopTypeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  nextStopType: { color: C.INK, fontSize: 18, fontFamily: FONTS.bodyBold },
  nextStopTime: { color: C.INK_MUTED, fontSize: 14, fontFamily: FONTS.body },
  distance: { color: C.ACCENT, fontSize: 14, fontFamily: FONTS.bodyBold, marginTop: 4 },
  sectionTitle: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, marginBottom: 12 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.CARD, borderRadius: 10,
    padding: 12, marginBottom: 8, gap: 12
  },
  stopIconWrap: { width: 22, alignItems: 'center', justifyContent: 'center' },
  stopDetails: { flex: 1 },
  stopType: { color: C.INK, fontSize: 14, fontFamily: FONTS.body },
  stopTime: { color: C.ACCENT, fontSize: 12, fontFamily: FONTS.body, marginTop: 2 },
  arrivedText: { color: C.SAGE, fontSize: 11, fontFamily: FONTS.body, marginTop: 2 },
  button: {
    borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 24
  },
  startButton: { backgroundColor: '#16a34a' },
  stopButton: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: FONTS.bodyBold },
  reviewButton: {
    backgroundColor: C.CARD, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 12,
    borderWidth: 1, borderColor: C.PRIMARY
  },
  reviewButtonText: { color: C.PRIMARY, fontSize: 15, fontFamily: FONTS.bodyBold },
});
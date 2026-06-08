import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, TouchableOpacity
} from 'react-native';
import { generatePlan, getTrip, getTripStops } from '../api/trips';

const STOP_ICONS = {
  tea: '☕',
  breakfast: '🍳',
  lunch: '🍽️',
  dinner: '🌙',
  sightseeing: '📸',
  viewpoint: '🏔️',
  fuel: '⛽',
  accommodation: '🏨',
  stay: '🏨',
  activity: '🎯',
  meal: '🍽️',
};

const CATEGORY_COLORS = {
  budget: '#166534',
  'mid-range': '#1e3a5f',
  average: '#1e3a5f',
  luxury: '#4c1d95',
  free: '#1e293b',
};

export default function TripPlanScreen({ route, navigation }) {
  const { tripId, plan: initialPlan } = route.params;
  const [plan, setPlan] = useState(initialPlan || null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(!initialPlan);

  useEffect(() => {
    if (!initialPlan) loadPlan();
    loadTrip();
  }, []);

  const loadPlan = async () => {
    try {
      const stops = await getTripStops(tripId);
      setPlan({ stops });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrip = async () => {
    try {
      const data = await getTrip(tripId);
      setTrip(data);
    } catch (err) {
      console.error(err);
    }
  };

  const renderStop = (stop, index) => {
    const icon = STOP_ICONS[stop.stop_type] || '📍';
    const notes = stop.notes?.split('|') || [];
    const location = notes[0]?.trim();
    const description = notes[1]?.trim();
    const category = stop.notes?.includes('Category:')
      ? stop.notes.split('Category:')[1]?.trim()
      : 'budget';

    return (
      <View key={stop.id || index} style={styles.stopCard}>
        <View style={styles.stopHeader}>
          <View style={styles.timeContainer}>
            <Text style={styles.stopIcon}>{icon}</Text>
            <Text style={styles.stopTime}>{stop.suggested_time?.slice(0, 5)}</Text>
          </View>
          <View style={styles.stopInfo}>
            <Text style={styles.stopType}>
              {stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1)}
            </Text>
            <Text style={styles.stopLocation}>{location}</Text>
          </View>
          <View style={[styles.categoryBadge,
            { backgroundColor: CATEGORY_COLORS[category] || '#1e293b' }
          ]}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
        </View>

        {description ? (
          <Text style={styles.stopDescription}>{description}</Text>
        ) : null}

        {stop.nearby_places?.length > 0 && (
          <View style={styles.nearbyContainer}>
            <Text style={styles.nearbyTitle}>📍 Nearby Places</Text>
            {stop.nearby_places.map((place, i) => (
              <View key={i} style={styles.placeRow}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeScore}>⭐ {place.final_score}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#f97316" size="large" />
          <Text style={styles.loadingText}>Generating your trip plan...</Text>
          <Text style={styles.loadingSubtext}>Finding best stops along the route</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stops = plan?.stops || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        {trip && (
          <View style={styles.tripHeader}>
            <Text style={styles.tripName}>{trip.trip_name}</Text>
            <Text style={styles.tripRoute}>
              {trip.start_location} → {trip.end_location}
            </Text>
            <Text style={styles.tripMeta}>
              {trip.trip_type} · {trip.vehicle_type} · {trip.member_count} members
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.liveButton}
          onPress={() => navigation.navigate('LiveTrip', {
            tripId: tripId,
            tripName: trip?.trip_name || 'Trip'
          })}
        >
          <Text style={styles.liveButtonText}>▶ Start Live Trip</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Your Trip Plan ({stops.length} stops)
        </Text>

        {stops.map((stop, index) => renderStop(stop, index))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: '#f97316', fontSize: 16, marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  loadingSubtext: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
  tripHeader: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 20
  },
  tripName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  tripRoute: { color: '#f97316', fontSize: 15, marginBottom: 4 },
  tripMeta: { color: '#94a3b8', fontSize: 13 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  stopCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#f97316'
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeContainer: { alignItems: 'center', marginRight: 12, minWidth: 44 },
  stopIcon: { fontSize: 20 },
  stopTime: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  stopInfo: { flex: 1 },
  stopType: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  stopLocation: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  categoryBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10
  },
  categoryText: { color: '#fff', fontSize: 10 },
  stopDescription: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  nearbyContainer: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  nearbyTitle: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  placeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4
  },
  placeName: { color: '#fff', fontSize: 13, flex: 1 },
  placeScore: { color: '#f97316', fontSize: 12 },
  liveButton: {
    backgroundColor: '#16a34a', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 16
  },
  liveButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
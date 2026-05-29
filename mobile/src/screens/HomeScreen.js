import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, SafeAreaView
} from 'react-native';
import useAuthStore from '../store/authStore';
import { getTrips } from '../api/trips';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const data = await getTrips();
      setTrips(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderTrip = ({ item }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => navigation.navigate('TripPlan', { tripId: item.id })}
    >
      <Text style={styles.tripName}>{item.trip_name}</Text>
      <Text style={styles.tripDetail}>
        {item.start_location} → {item.end_location}
      </Text>
      <Text style={styles.tripMeta}>
        {item.trip_type} · {item.vehicle_type} · {item.member_count} members
      </Text>
      <View style={[styles.badge,
        item.status === 'planned' ? styles.badgePlanned : styles.badgePending
      ]}>
        <Text style={styles.badgeText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>வணக்கம், {user?.name} 👋</Text>
          <Text style={styles.subtitle}>Where are you going today?</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.planButton}
        onPress={() => navigation.navigate('PlanTrip')}
      >
        <Text style={styles.planButtonText}>+ Plan a New Trip</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Your Trips</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <Text style={styles.empty}>No trips yet. Plan your first trip!</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 10
  },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  logout: { color: '#f97316', fontSize: 14 },
  planButton: {
    backgroundColor: '#f97316', margin: 20, borderRadius: 12,
    padding: 16, alignItems: 'center'
  },
  planButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginLeft: 20, marginBottom: 10 },
  tripCard: {
    backgroundColor: '#1e293b', marginHorizontal: 20,
    marginBottom: 12, borderRadius: 12, padding: 16
  },
  tripName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  tripDetail: { color: '#f97316', fontSize: 14, marginBottom: 4 },
  tripMeta: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgePlanned: { backgroundColor: '#166534' },
  badgePending: { backgroundColor: '#1e3a5f' },
  badgeText: { color: '#fff', fontSize: 11 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 60, fontSize: 15 }
});
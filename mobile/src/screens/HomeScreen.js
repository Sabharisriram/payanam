import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import { getTrips, deleteTrip } from '../api/trips';
import { C, FONTS, SHADOWS } from '../theme/colors';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const cardAnims = useRef([]);

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    if (trips.length > 0 && cardAnims.current.length === trips.length) {
      trips.forEach((_, i) => {
        Animated.parallel([
          Animated.timing(cardAnims.current[i].opacity, {
            toValue: 1, duration: 320, delay: i * 50, useNativeDriver: true,
          }),
          Animated.timing(cardAnims.current[i].translateY, {
            toValue: 0, duration: 320, delay: i * 50, useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [trips]);

  const loadTrips = async () => {
    try {
      const data = await getTrips();
      cardAnims.current = data.map(() => ({
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(24),
      }));
      setTrips(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tripId) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip(tripId);
              setTrips(trips.filter(t => t.id !== tripId));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete trip');
            }
          }
        }
      ]
    );
  };

  const renderTrip = ({ item, index }) => {
    const anim = cardAnims.current[index];
    return (
      <Animated.View
        style={anim ? { opacity: anim.opacity, transform: [{ translateY: anim.translateY }] } : null}
      >
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
          <View style={styles.cardFooter}>
            <View style={[styles.badge,
              item.status === 'planned' ? styles.badgePlanned : styles.badgePending
            ]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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
        <ActivityIndicator color={C.PRIMARY} style={{ marginTop: 40 }} />
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
  container: { flex: 1, backgroundColor: C.BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 10
  },
  // Tamil text mixed in — use bodyBold to avoid per-glyph font switching
  greeting: { fontSize: 20, fontFamily: FONTS.bodyBold, color: C.INK },
  subtitle: { fontSize: 13, fontFamily: FONTS.body, color: C.INK_MUTED, marginTop: 2 },
  logout: { color: C.PRIMARY, fontSize: 14, fontFamily: FONTS.body },
  planButton: {
    backgroundColor: C.PRIMARY, margin: 20, borderRadius: 12,
    padding: 16, alignItems: 'center'
  },
  planButtonText: { color: '#fff', fontSize: 16, fontFamily: FONTS.bodyBold },
  sectionTitle: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, marginLeft: 20, marginBottom: 10 },
  tripCard: {
    backgroundColor: C.CARD, marginHorizontal: 20,
    marginBottom: 14, borderRadius: 12, padding: 18,
    borderWidth: 1,
    borderColor: C.BORDER,
    ...SHADOWS.sm,
  },
  tripName: { color: C.INK, fontSize: 16, fontFamily: FONTS.bodyBold, marginBottom: 4 },
  tripDetail: { color: C.PRIMARY, fontSize: 14, fontFamily: FONTS.body, marginBottom: 4 },
  tripMeta: { color: C.INK_MUTED, fontSize: 12, fontFamily: FONTS.body, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgePlanned: { backgroundColor: C.SAGE_BG },
  badgePending: { backgroundColor: C.CARD_ALT },
  badgeText: { color: C.INK, fontSize: 11, fontFamily: FONTS.body },
  deleteBtn: {
    borderWidth: 1, borderColor: '#ef4444',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3
  },
  deleteBtnText: { color: '#ef4444', fontSize: 12, fontFamily: FONTS.body },
  empty: { color: C.INK_MUTED, textAlign: 'center', marginTop: 60, fontSize: 15, fontFamily: FONTS.body }
});
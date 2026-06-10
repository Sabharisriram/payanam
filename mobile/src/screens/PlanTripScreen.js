import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { createTrip, generatePlan } from '../api/trips';

const TRIP_TYPES = ['solo', 'family', 'friends', 'boys', 'bachelor'];
const VEHICLES = ['car', 'bike', 'bus', 'auto'];
const PLANNING_MODES = ['essential', 'sightseeing', 'customized'];
const MODE_DESCRIPTIONS = {
  essential: 'Tea, breakfast, lunch, snack & dinner only — no sightseeing',
  sightseeing: 'Meals + 2 real sightseeing spots along the route',
  customized: 'Enter your own places — meals planned around them',
};

export default function PlanTripScreen({ navigation }) {
  const [tripName, setTripName] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [tripType, setTripType] = useState('family');
  const [vehicle, setVehicle] = useState('car');
  const [members, setMembers] = useState('1');
  const [tripDays, setTripDays] = useState('1');
  const [planningMode, setPlanningMode] = useState('sightseeing');
  const [customPlaces, setCustomPlaces] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePlanTrip = async () => {
    if (!tripName || !startLocation || !endLocation || !startDate) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const trip = await createTrip({
        trip_name: tripName,
        start_location: startLocation,
        end_location: endLocation,
        start_date: startDate,
        start_time: startTime,
        trip_type: tripType,
        vehicle_type: vehicle,
        member_count: parseInt(members),
        trip_days: parseInt(tripDays),
        planning_mode: planningMode,
        custom_places: planningMode === 'customized' ? customPlaces : null,
      });

      const plan = await generatePlan(trip.id);
      navigation.navigate('TripPlan', { tripId: trip.id, plan });

    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to plan trip');
    } finally {
      setLoading(false);
    }
  };

  const Selector = ({ label, options, value, onChange }) => (
    <View style={styles.selectorContainer}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Plan Your Trip</Text>

        <Text style={styles.label}>Trip Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Coimbatore to Ooty"
          placeholderTextColor="#888"
          value={tripName}
          onChangeText={setTripName}
        />

        <Text style={styles.label}>From</Text>
        <TextInput
          style={styles.input}
          placeholder="Starting location"
          placeholderTextColor="#888"
          value={startLocation}
          onChangeText={setStartLocation}
        />

        <Text style={styles.label}>To</Text>
        <TextInput
          style={styles.input}
          placeholder="Destination"
          placeholderTextColor="#888"
          value={endLocation}
          onChangeText={setEndLocation}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2026-06-15"
          placeholderTextColor="#888"
          value={startDate}
          onChangeText={setStartDate}
        />

        <Text style={styles.label}>Start Time (HH:MM)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 06:00"
          placeholderTextColor="#888"
          value={startTime}
          onChangeText={setStartTime}
        />

        <Text style={styles.label}>Number of Members</Text>
        <TextInput
          style={styles.input}
          placeholder="Number of members"
          placeholderTextColor="#888"
          keyboardType="number-pad"
          value={members}
          onChangeText={setMembers}
        />

        <Text style={styles.label}>Number of Days</Text>
        <TextInput
          style={styles.input}
          placeholder="How many days? e.g. 2"
          placeholderTextColor="#888"
          keyboardType="number-pad"
          value={tripDays}
          onChangeText={setTripDays}
        />

        <Selector
          label="Trip Type"
          options={TRIP_TYPES}
          value={tripType}
          onChange={setTripType}
        />

        <Selector
          label="Vehicle"
          options={VEHICLES}
          value={vehicle}
          onChange={setVehicle}
        />

        <Selector
          label="Planning Mode"
          options={PLANNING_MODES}
          value={planningMode}
          onChange={setPlanningMode}
        />
        <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS[planningMode]}</Text>

        {planningMode === 'customized' && (
          <>
            <Text style={styles.label}>Your Places (one per line)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder={'e.g. Pykara Lake, Ooty\nEmerald Dam\nDoddabetta Peak'}
              placeholderTextColor="#888"
              multiline
              numberOfLines={4}
              value={customPlaces}
              onChangeText={setCustomPlaces}
            />
          </>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handlePlanTrip}
          disabled={loading}
        >
          {loading ? (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.loadingText}>✨ Generating your plan...</Text>
              <Text style={styles.loadingSubText}>Finding best stops along the route</Text>
              <Text style={styles.loadingSubText}>This takes about 20 seconds</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Generate Trip Plan ✨</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: '#f97316', fontSize: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#1e293b', color: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155'
  },
  selectorContainer: { marginBottom: 16 },
  chip: {
    backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155'
  },
  chipSelected: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#94a3b8', fontSize: 14 },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  button: {
    backgroundColor: '#f97316', borderRadius: 12,
    padding: 18, alignItems: 'center', marginTop: 20
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingText: { color: '#fff', fontSize: 15, marginTop: 10 },
  loadingSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  modeDesc: { color: '#64748b', fontSize: 12, marginBottom: 14, marginTop: -6, paddingLeft: 2 },
  multilineInput: { height: 100, textAlignVertical: 'top' },
});
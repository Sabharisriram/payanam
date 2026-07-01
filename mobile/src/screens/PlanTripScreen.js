import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView, Animated
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createTrip, generatePlan } from '../api/trips';
import { C, FONTS } from '../theme/colors';

const TRIP_TYPES = ['solo', 'family', 'friends', 'boys', 'bachelor'];
const VEHICLES = ['car', 'bike', 'bus', 'auto'];
const PLANNING_MODES = ['essential', 'sightseeing', 'customized'];
const MODE_DESCRIPTIONS = {
  essential: 'Tea, breakfast, lunch, snack & dinner only — no sightseeing',
  sightseeing: 'Meals + 2 real sightseeing spots along the route',
  customized: 'Enter your own places — meals planned around them',
};

const makeDefaultTime = () => {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d;
};

const formatDateDisplay = (d) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const formatDateAPI = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatTimeDisplay = (d) =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const formatTimeAPI = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ── Animated chip — scale-bounce on press ──────────────────────────────────
function AnimatedChip({ opt, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
    ]).start();
    onPress(opt);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.chipTouch}>
      <Animated.View style={[
        styles.chip,
        selected && styles.chipSelected,
        { transform: [{ scale }] },
      ]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function Selector({ label, options, value, onChange }) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map(opt => (
          <AnimatedChip
            key={opt}
            opt={opt}
            selected={value === opt}
            onPress={onChange}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function PlanTripScreen({ navigation }) {
  const [tripName, setTripName] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startDateObj, setStartDateObj] = useState(new Date());
  const [startTimeObj, setStartTimeObj] = useState(makeDefaultTime);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tripType, setTripType] = useState('family');
  const [vehicle, setVehicle] = useState('car');
  const [members, setMembers] = useState('1');
  const [tripDays, setTripDays] = useState('1');
  const [planningMode, setPlanningMode] = useState('sightseeing');
  const [customPlaces, setCustomPlaces] = useState('');
  const [loading, setLoading] = useState(false);

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (event.type !== 'dismissed' && selected) setStartDateObj(selected);
  };

  const onTimeChange = (event, selected) => {
    setShowTimePicker(false);
    if (event.type !== 'dismissed' && selected) setStartTimeObj(selected);
  };

  const handlePlanTrip = async () => {
    if (!tripName || !startLocation || !endLocation) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const trip = await createTrip({
        trip_name: tripName,
        start_location: startLocation,
        end_location: endLocation,
        start_date: formatDateAPI(startDateObj),
        start_time: formatTimeAPI(startTimeObj),
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
          placeholderTextColor={C.INK_MUTED}
          value={tripName}
          onChangeText={setTripName}
        />

        <Text style={styles.label}>From</Text>
        <TextInput
          style={styles.input}
          placeholder="Starting location"
          placeholderTextColor={C.INK_MUTED}
          value={startLocation}
          onChangeText={setStartLocation}
        />

        <Text style={styles.label}>To</Text>
        <TextInput
          style={styles.input}
          placeholder="Destination"
          placeholderTextColor={C.INK_MUTED}
          value={endLocation}
          onChangeText={setEndLocation}
        />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.pickerBtnText}>📅  {formatDateDisplay(startDateObj)}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Start Time</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.pickerBtnText}>🕐  {formatTimeDisplay(startTimeObj)}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={startDateObj}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={startTimeObj}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={onTimeChange}
          />
        )}

        <Text style={styles.label}>Number of Members</Text>
        <TextInput
          style={styles.input}
          placeholder="Number of members"
          placeholderTextColor={C.INK_MUTED}
          keyboardType="number-pad"
          value={members}
          onChangeText={setMembers}
        />

        <Text style={styles.label}>Number of Days</Text>
        <TextInput
          style={styles.input}
          placeholder="How many days? e.g. 2"
          placeholderTextColor={C.INK_MUTED}
          keyboardType="number-pad"
          value={tripDays}
          onChangeText={setTripDays}
        />

        <Selector label="Trip Type" options={TRIP_TYPES} value={tripType} onChange={setTripType} />
        <Selector label="Vehicle" options={VEHICLES} value={vehicle} onChange={setVehicle} />
        <Selector label="Planning Mode" options={PLANNING_MODES} value={planningMode} onChange={setPlanningMode} />
        <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS[planningMode]}</Text>

        {planningMode === 'customized' && (
          <>
            <Text style={styles.label}>Your Places (one per line)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder={'e.g. Pykara Lake, Ooty\nEmerald Dam\nDoddabetta Peak'}
              placeholderTextColor={C.INK_MUTED}
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
  container: { flex: 1, backgroundColor: C.BG },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: C.PRIMARY, fontSize: 16, fontFamily: FONTS.body, marginBottom: 16 },
  title: { fontSize: 24, fontFamily: FONTS.display, color: C.INK, marginBottom: 24 },
  label: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: C.CARD, color: C.INK, borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 15,
    fontFamily: FONTS.body,
    borderWidth: 1, borderColor: C.BORDER,
  },
  pickerBtn: {
    backgroundColor: C.CARD, borderRadius: 10, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: C.BORDER,
  },
  pickerBtnText: { color: C.INK, fontSize: 15, fontFamily: FONTS.body },
  selectorContainer: { marginBottom: 16 },
  chipTouch: { marginRight: 8 },
  chip: {
    backgroundColor: C.CARD, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 8, borderWidth: 1, borderColor: C.BORDER,
  },
  chipSelected: { backgroundColor: C.PRIMARY, borderColor: C.PRIMARY },
  chipText: { color: C.INK_MUTED, fontSize: 14, fontFamily: FONTS.body },
  chipTextSelected: { color: '#fff', fontFamily: FONTS.bodyBold },
  button: {
    backgroundColor: C.PRIMARY, borderRadius: 12,
    padding: 18, alignItems: 'center', marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: FONTS.bodyBold },
  loadingText: { color: '#fff', fontSize: 15, fontFamily: FONTS.bodyBold, marginTop: 10 },
  loadingSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: FONTS.body, marginTop: 4 },
  modeDesc: { color: C.INK_MUTED, fontSize: 12, fontFamily: FONTS.body, marginBottom: 14, marginTop: -6, paddingLeft: 2 },
  multilineInput: { height: 100, textAlignVertical: 'top' },
});
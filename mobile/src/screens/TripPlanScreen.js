import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, TouchableOpacity
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { getTrip, getTripStops, voiceCommand } from '../api/trips';

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
  'stay/accommodation': '🏨',
  activity: '🎯',
  meal: '🍽️',
  snack: '🥤',
};

const CATEGORY_COLORS = {
  budget: '#166534',
  'mid-range': '#1e3a5f',
  average: '#1e3a5f',
  luxury: '#4c1d95',
  free: '#1e293b',
};

const VOICE_STYLE = {
  idle:       { bg: '#4f1d96', border: '#7c3aed' },
  listening:  { bg: '#7f1d1d', border: '#ef4444' },
  processing: { bg: '#1e293b', border: '#475569' },
  done:       { bg: '#14532d', border: '#22c55e' },
  error:      { bg: '#7f1d1d', border: '#ef4444' },
};

// Inline HTML that runs webkitSpeechRecognition and posts messages back to RN
const SPEECH_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'unsupported'}));
    return;
  }
  var rec = new SR();
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;

  rec.onresult = function(e) {
    var partial = '', final = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) { final += e.results[i][0].transcript; }
      else { partial += e.results[i][0].transcript; }
    }
    if (final) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',text:final.trim()}));
    } else if (partial) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'partial',text:partial.trim()}));
    }
  };

  rec.onerror = function(e) {
    // no-speech just means silence — let the 'end' event handle the UI
    if (e.error === 'no-speech') return;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',error:e.error}));
  };

  rec.onend = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'end'}));
  };

  window.startRecognition = function() { try { rec.start(); } catch(e) {} };
  window.stopRecognition  = function() { try { rec.stop();  } catch(e) {} };

  window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
})();
<\/script>
</body></html>`;

export default function TripPlanScreen({ route, navigation }) {
  const { tripId, plan: initialPlan } = route.params;
  const [plan, setPlan] = useState(initialPlan || null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(!initialPlan);

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceResult, setVoiceResult] = useState('');
  const [partialText, setPartialText] = useState('');
  const speechRef = useRef(null);
  const voiceResetTimer = useRef(null);

  useEffect(() => {
    if (!initialPlan) loadPlan();
    loadTrip();
    return () => { if (voiceResetTimer.current) clearTimeout(voiceResetTimer.current); };
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
    try { setTrip(await getTrip(tripId)); }
    catch (err) { console.error(err); }
  };

  // ── Voice ────────────────────────────────────────────────────────────────────

  const startListening = () => {
    if (voiceState === 'processing' || voiceState === 'listening') return;
    setPartialText('');
    setVoiceResult('');
    setVoiceState('listening');
    // Start recognition only after TTS finishes — prevents the mic capturing "Listening"
    Speech.speak('Listening', {
      language: 'en-IN',
      onDone: () => speechRef.current?.injectJavaScript('window.startRecognition(); true;'),
    });
  };

  const stopListening = () => {
    if (voiceState !== 'listening') return;
    speechRef.current?.injectJavaScript('window.stopRecognition(); true;');
  };

  const handleVoicePress = () => {
    if (voiceState === 'listening') {
      stopListening();
    } else if (voiceState !== 'processing') {
      startListening();
    }
  };

  const handleSpeechMessage = async (event) => {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); }
    catch (_) { return; }

    if (data.type === 'partial') {
      setPartialText(data.text);
      return;
    }

    if (data.type === 'result') {
      setPartialText('');
      setVoiceState('processing');
      try {
        // Get GPS location to send with the command for location-aware stop updates
        let locationCtx = {};
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const now = new Date();
            locationCtx = {
              current_lat: loc.coords.latitude,
              current_lng: loc.coords.longitude,
              current_time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
              avg_speed_kmh: 60,
            };
          }
        } catch (_) { /* location unavailable — proceed without it */ }

        const result = await voiceCommand(tripId, data.text, locationCtx);
        if (result.success && result.updated_stop) {
          setVoiceResult(`✓  ${result.understood_command}`);
          setVoiceState('done');
          setPlan(prev => {
            const newStops = (prev?.stops || []).map(s =>
              s.id === result.updated_stop.id ? { ...s, ...result.updated_stop } : s
            );
            return { ...(prev || {}), stops: newStops };
          });
          const a = result.action;
          let ttsMsg;
          if (a?.action === 'update_time') {
            if (a.location_aware && a.new_place_name) {
              ttsMsg = `Done! Changed your ${a.stop_type || 'stop'} to ${a.new_time} at ${a.new_place_name}.`;
            } else {
              ttsMsg = `Done! Changed your ${a.stop_type || 'stop'} time to ${a.new_time || 'the new time'}.`;
            }
          } else if (a?.action === 'change_place') {
            ttsMsg = `Done! Changed your ${a.stop_type || 'stop'} stop to ${a.new_place_name || 'the new place'}.`;
          } else {
            ttsMsg = `Done! ${result.understood_command || 'Your trip has been updated.'}`;
          }
          Speech.speak(ttsMsg, { language: 'en-IN' });
        } else if (result.success) {
          setVoiceResult(`✓  ${result.understood_command}`);
          setVoiceState('done');
          Speech.speak(`Done! ${result.understood_command || 'Your trip has been updated.'}`, { language: 'en-IN' });
        } else {
          setVoiceResult(`?  ${result.understood_command || 'Could not understand'}`);
          setVoiceState('error');
          Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
        }
      } catch (err) {
        console.error('Voice command error:', err.message);
        setVoiceResult('⚠  Server error. Try again.');
        setVoiceState('error');
        Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
      } finally {
        scheduleVoiceReset();
      }
      return;
    }

    if (data.type === 'end') {
      setPartialText('');
      // Only fire "nothing heard" if we never got a result (still in listening state)
      setVoiceState(prev => {
        if (prev === 'listening') {
          setVoiceResult('⚠  Nothing heard. Try again.');
          Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
          scheduleVoiceReset();
          return 'error';
        }
        return prev;
      });
      return;
    }

    if (data.type === 'error') {
      setPartialText('');
      setVoiceResult(`⚠  ${data.error === 'not-allowed' ? 'Mic permission denied' : 'Voice error. Try again.'}`);
      setVoiceState('error');
      Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
      scheduleVoiceReset();
      return;
    }

    if (data.type === 'unsupported') {
      setVoiceResult('⚠  Voice not supported on this device');
      setVoiceState('error');
      Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
      scheduleVoiceReset();
    }
  };

  const scheduleVoiceReset = () => {
    if (voiceResetTimer.current) clearTimeout(voiceResetTimer.current);
    voiceResetTimer.current = setTimeout(() => {
      setVoiceState('idle');
      setVoiceResult('');
      setPartialText('');
    }, 4000);
  };

  const getVoiceLabel = () => {
    if (voiceState === 'listening') return partialText || '🔴  Speak now...';
    if (voiceState === 'done' || voiceState === 'error') return voiceResult;
    return '🎤  Tap to Speak';
  };

  // ── Stop card ────────────────────────────────────────────────────────────────

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

  // ── Loading ──────────────────────────────────────────────────────────────────

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
  const vs = VOICE_STYLE[voiceState];

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden WebView — Web Speech API bridge */}
      <WebView
        ref={speechRef}
        source={{ html: SPEECH_HTML }}
        style={styles.hiddenWebView}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={handleSpeechMessage}
        onPermissionRequest={({ nativeEvent }) => {
          if (nativeEvent.grant) nativeEvent.grant(nativeEvent.resources);
        }}
        mediaPlaybackRequiresUserGesture={false}
      />

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

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.liveBtn]}
            onPress={() => navigation.navigate('LiveTrip', {
              tripId: tripId,
              tripName: trip?.trip_name || 'Trip'
            })}
          >
            <Text style={styles.actionBtnText}>▶ Live Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.mapBtn]}
            onPress={() => navigation.navigate('MapScreen', {
              stops: stops.map(s => ({
                ...s,
                stop_lat: s.stop_lat ?? s.coords?.lat ?? null,
                stop_lng: s.stop_lng ?? s.coords?.lng ?? null,
              })),
              tripName: trip?.trip_name || 'Trip',
            })}
          >
            <Text style={styles.actionBtnText}>🗺️ View Map</Text>
          </TouchableOpacity>
        </View>

        {/* Voice command button */}
        <TouchableOpacity
          style={[
            styles.voiceBtn,
            { backgroundColor: vs.bg, borderColor: vs.border },
            voiceState === 'processing' && styles.voiceBtnDisabled,
          ]}
          onPress={handleVoicePress}
          disabled={voiceState === 'processing'}
          activeOpacity={0.8}
        >
          {voiceState === 'processing' ? (
            <View style={styles.voiceRow}>
              <ActivityIndicator color="#94a3b8" size="small" />
              <Text style={[styles.voiceBtnText, { color: '#94a3b8', marginLeft: 8 }]}>
                Processing...
              </Text>
            </View>
          ) : (
            <Text style={styles.voiceBtnText} numberOfLines={2}>{getVoiceLabel()}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.voiceHint}>
          Tap, wait for beep, then speak  ·  "Change tea time to 8am"  ·  "Move dinner to 9pm"
        </Text>

        <Text style={styles.sectionTitle}>
          Your Trip Plan ({stops.length} stops)
        </Text>

        {Array.from(new Set(stops.map(s => s.day_number || 1))).sort().map(day => (
          <View key={day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>📅 Day {day}</Text>
            </View>
            {stops
              .filter(s => (s.day_number || 1) === day)
              .map((stop, index) => renderStop(stop, index))
            }
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  hiddenWebView: { height: 1, width: 1, position: 'absolute', opacity: 0 },
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
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
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
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  liveBtn: { backgroundColor: '#16a34a' },
  mapBtn: { backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: '#f97316' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  voiceBtn: {
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1.5, marginBottom: 6, minHeight: 48,
  },
  voiceBtnDisabled: { opacity: 0.6 },
  voiceRow: { flexDirection: 'row', alignItems: 'center' },
  voiceBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  voiceHint: {
    color: '#475569', fontSize: 11, textAlign: 'center',
    marginBottom: 20, lineHeight: 16,
  },
  dayHeader: {
    backgroundColor: '#1e3a5f', borderRadius: 8,
    padding: 10, marginBottom: 8, marginTop: 8
  },
  dayTitle: { color: '#f97316', fontSize: 15, fontWeight: 'bold' },
});

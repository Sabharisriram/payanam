import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, TouchableOpacity, Animated
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import {
  Coffee, UtensilsCrossed, Moon, Camera, Mountain,
  Fuel, Hotel, Sparkles, MapPin,
} from 'lucide-react-native';
import { getTrip, getTripStops, voiceCommand, updateStopByType } from '../api/trips';
import { C, FONTS, SHADOWS } from '../theme/colors';

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

function StopIcon({ type, size = 20 }) {
  const Icon = STOP_ICON_COMPONENTS[type] || MapPin;
  return <Icon size={size} color={C.ACCENT} strokeWidth={2} />;
}

const CATEGORY_COLORS = {
  budget: C.SAGE_BG,
  'mid-range': C.CARD_ALT,
  average: C.CARD_ALT,
  luxury: '#4c1d95',
  free: C.CARD,
};

const VOICE_STYLE = {
  idle:       { bg: C.PRIMARY, border: C.PRIMARY },
  listening:  { bg: '#7f1d1d', border: '#ef4444' },
  processing: { bg: C.CARD, border: '#475569' },
  done:       { bg: C.SAGE_BG, border: C.SAGE },
  error:      { bg: '#7f1d1d', border: '#ef4444' },
};

// Returns the index of the first stop whose time >= now, or -1 if all passed
function findNextStopIndex(dayStops) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < dayStops.length; i++) {
    const t = dayStops[i].suggested_time;
    if (!t) continue;
    const parts = t.split(':').map(Number);
    if (parts[0] * 60 + parts[1] >= nowMins) return i;
  }
  return -1;
}

// Extract day number from a spoken phrase like "Day 1", "second day", "two", "day two"
function extractDayNumber(text) {
  const t = text.toLowerCase();
  const digit = t.match(/\b(\d+)\b/);
  if (digit) return parseInt(digit[1], 10);
  const words = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4 };
  for (const [word, num] of Object.entries(words)) {
    if (t.includes(word)) return num;
  }
  return null;
}

// Command recognition WebView — single utterance, posts result back to RN
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

// Wake word WebView — loops continuously, fires {type:'wake'} when "payanam" heard
const WAKE_WORD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  var rec = new SR();
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  var paused = false;

  function checkForWake(transcript) {
    var t = transcript.toLowerCase();
    // 'payan' covers payanam, payan am, payyanam — also accept common greetings
    return t.indexOf('payan') !== -1 ||
           t.indexOf('hey payanam') !== -1 ||
           t.indexOf('hi payanam') !== -1;
  }

  rec.onresult = function(e) {
    if (paused) return;
    for (var i = e.resultIndex; i < e.results.length; i++) {
      // Check both interim and final results for faster response
      for (var j = 0; j < e.results[i].length; j++) {
        if (checkForWake(e.results[i][j].transcript)) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'wake'}));
          return;
        }
      }
    }
  };

  rec.onerror = function(e) {
    if (paused) return;
    setTimeout(function() { if (!paused) { try { rec.start(); } catch(ex) {} } }, 100);
  };

  rec.onend = function() {
    if (!paused) { try { rec.start(); } catch(ex) {} }
  };

  window.pauseWake  = function() { paused = true;  try { rec.stop();  } catch(ex) {} };
  window.resumeWake = function() { paused = false; try { rec.start(); } catch(ex) {} };

  // Auto-start quickly — WebView is already settled by the time user sees this screen
  setTimeout(function() { try { rec.start(); } catch(ex) {} }, 100);
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
  const [clarificationPrompt, setClarificationPrompt] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const speechRef = useRef(null);
  const wakeRef = useRef(null);
  const voiceResetTimer = useRef(null);
  const clarificationRef = useRef(null);

  // Pulsing glow animation for the next upcoming stop card
  const pulseAnim = useRef(new Animated.Value(0.2)).current;
  // Voice button color transition (0=idle, 1=listening, 2=processing, 3=done, 4=error)
  const voiceColorAnim = useRef(new Animated.Value(0)).current;
  // Pulsing ring around mic while listening
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!initialPlan) loadPlan();
    loadTrip();
    return () => {
      if (voiceResetTimer.current) clearTimeout(voiceResetTimer.current);
      wakeRef.current?.injectJavaScript('window.pauseWake(); true;');
    };
  }, []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.15, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Smooth 250ms color cross-fade between voice states
  useEffect(() => {
    const idx = { idle: 0, listening: 1, processing: 2, done: 3, error: 4 }[voiceState] ?? 0;
    Animated.timing(voiceColorAnim, {
      toValue: idx,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [voiceState]);

  // Pulsing ring — looping while listening, resets otherwise
  useEffect(() => {
    if (voiceState === 'listening') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); ringAnim.setValue(0); };
    }
    ringAnim.setValue(0);
  }, [voiceState]);

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

  // ── Wake word ─────────────────────────────────────────────────────────────────

  const handleWakeMessage = (event) => {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch (_) { return; }

    if (data.type === 'wake') {
      if (voiceState === 'processing' || voiceState === 'listening') return;
      wakeRef.current?.injectJavaScript('window.pauseWake(); true;');
      setPartialText('');
      setVoiceResult('');
      setVoiceState('listening');
      Speech.speak('Yes, I am listening', {
        language: 'en-IN',
        onDone: () => speechRef.current?.injectJavaScript('window.startRecognition(); true;'),
      });
    }
  };

  // ── Voice ────────────────────────────────────────────────────────────────────

  const startListening = () => {
    if (voiceState === 'processing' || voiceState === 'listening') return;
    wakeRef.current?.injectJavaScript('window.pauseWake(); true;');
    setPartialText('');
    setVoiceResult('');
    setVoiceState('listening');
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

      // Fast path: if we're in clarification mode, extract the day number locally and hit DB directly
      let commandText = data.text;
      console.log(`[clarify] result arrived text="${data.text}" clarificationRef=${JSON.stringify(clarificationRef.current)}`);
      if (clarificationRef.current) {
        const pending = clarificationRef.current;
        const dayNumber = extractDayNumber(data.text);
        clarificationRef.current = null;
        setClarificationPrompt('');
        console.log(`[clarify] second turn dayNumber=${dayNumber} pending=${JSON.stringify(pending)}`);

        if (dayNumber && pending.new_time) {
          setVoiceState('processing');
          try {
            let locationCtx = {};
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const now = new Date();
                locationCtx = {
                  current_lat: loc.coords.latitude,
                  current_lng: loc.coords.longitude,
                  current_time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
                  avg_speed_kmh: 60,
                };
              }
            } catch (_) {}

            console.log(`[clarify] fast-path updateStopByType stop_type=${pending.stop_type} day=${dayNumber} new_time=${pending.new_time}`);
            const result = await updateStopByType(tripId, {
              stop_type: pending.stop_type,
              day_number: dayNumber,
              new_time: pending.new_time,
              ...locationCtx,
            });
            console.log(`[clarify] fast-path result success=${result.success} updated_stop=${result.updated_stop?.id ?? 'null'}`);

            if (result.success) {
              setVoiceResult(`✓  Changed ${pending.stop_type} to ${pending.new_time} on day ${dayNumber}`);
              setVoiceState('done');
              if (result.updated_stop) {
                setPlan(prev => ({
                  ...(prev || {}),
                  stops: (prev?.stops || []).map(s =>
                    s.id === result.updated_stop.id ? { ...s, ...result.updated_stop } : s
                  ),
                }));
              }
              Speech.speak(`Done! Changed your ${pending.stop_type} time to ${pending.new_time} on day ${dayNumber}.`, { language: 'en-IN' });
            } else {
              setVoiceResult(`⚠  No ${pending.stop_type} stop on day ${dayNumber}`);
              setVoiceState('error');
              Speech.speak(`Sorry, I couldn't find a ${pending.stop_type} stop on day ${dayNumber}.`, { language: 'en-IN' });
            }
          } catch (err) {
            console.error('[clarify] fast-path error:', err.message);
            setVoiceResult('⚠  Server error. Try again.');
            setVoiceState('error');
            Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
          }
          scheduleVoiceReset();
          return;
        }

        // Couldn't extract a day number — fall through to Gemini with reconstructed command
        if (pending.new_time) {
          commandText = `change ${pending.stop_type} time to ${pending.new_time} on ${data.text}`;
        } else if (pending.new_place_name) {
          commandText = `change ${pending.stop_type} to ${pending.new_place_name} on ${data.text}`;
        }
        console.log(`[clarify] no day extracted, Gemini fallback commandText="${commandText}"`);
      }

      setVoiceState('processing');
      try {
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

        // Append user turn to history, then send history with request
        const userTurn = { role: 'user', text: commandText, timestamp: Date.now() };
        const historyToSend = [...conversationHistory, userTurn];
        setConversationHistory(historyToSend.slice(-6));

        console.log(`[agent] sending commandText="${commandText}" history=${historyToSend.length}`);
        const result = await voiceCommand(tripId, commandText, locationCtx, historyToSend.slice(-3));
        console.log(`[agent] action=${result.action} success=${result.success}`);

        // Append assistant turn to history
        if (result.response_text) {
          setConversationHistory(prev =>
            [...prev, { role: 'assistant', text: result.response_text, timestamp: Date.now() }].slice(-6)
          );
        }

        if (result.needs_clarification && result.question) {
          clarificationRef.current = result.pending_action;
          console.log(`[clarify] asking day: question="${result.question}" pending=${JSON.stringify(result.pending_action)}`);
          setClarificationPrompt('Say: "Day 1" or "Day 2"');
          setVoiceResult(`?  ${result.question}`);
          setVoiceState('listening');
          Speech.speak(result.question, {
            language: 'en-IN',
            onDone: () => {
              console.log('[clarify] TTS done — starting recognition for day answer');
              speechRef.current?.injectJavaScript('window.startRecognition(); true;');
            },
          });
          if (voiceResetTimer.current) clearTimeout(voiceResetTimer.current);
          voiceResetTimer.current = setTimeout(() => {
            clarificationRef.current = null;
            setClarificationPrompt('');
            setVoiceState('idle');
            setVoiceResult('');
            setPartialText('');
            wakeRef.current?.injectJavaScript('window.resumeWake(); true;');
          }, 15000);
          return;
        }

        if (result.success) {
          setVoiceResult(`✓  ${result.response_text || 'Done'}`);
          setVoiceState('done');
          if (result.updated_stop) {
            setPlan(prev => ({
              ...(prev || {}),
              stops: (prev?.stops || []).map(s =>
                s.id === result.updated_stop.id ? { ...s, ...result.updated_stop } : s
              ),
            }));
          }
          if (result.new_stop) {
            setPlan(prev => ({
              ...(prev || {}),
              stops: [...(prev?.stops || []), result.new_stop],
            }));
          }
          Speech.speak(result.response_text || 'Done!', { language: 'en-IN' });
          scheduleVoiceReset();
        } else {
          setVoiceResult(`?  ${result.response_text || 'Could not understand'}`);
          setVoiceState('error');
          Speech.speak(result.response_text || "Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
          scheduleVoiceReset();
        }
      } catch (err) {
        console.error('Voice command error:', err.message);
        setVoiceResult('⚠  Server error. Try again.');
        setVoiceState('error');
        Speech.speak("Sorry, I couldn't understand. Please try again.", { language: 'en-IN' });
        scheduleVoiceReset();
      }
      return;
    }

    if (data.type === 'end') {
      setPartialText('');
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
      setClarificationPrompt('');
      wakeRef.current?.injectJavaScript('window.resumeWake(); true;');
    }, 4000);
  };

  const getVoiceLabel = () => {
    if (voiceState === 'listening') return partialText || '🔴  Speak now...';
    if (voiceState === 'done' || voiceState === 'error') return voiceResult;
    return '🎤  Tap to Speak';
  };

  // ── Stop card ────────────────────────────────────────────────────────────────

  const renderStop = (stop, index, isNext, isLast) => {
    const notes = stop.notes?.split('|') || [];
    const location = notes[0]?.trim();
    const description = notes[1]?.trim();
    const category = stop.notes?.includes('Category:')
      ? stop.notes.split('Category:')[1]?.trim()
      : 'budget';

    return (
      <View key={stop.id || index} style={styles.stopWrapper}>

        {/* Timeline column: dot + dashed connecting line */}
        <View style={styles.timelineCol}>
          <View style={[styles.timelineDot, isNext && styles.timelineDotNext]} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        {/* Card */}
        <View style={[styles.stopCard, isNext && styles.stopCardNext]}>
          {/* Pulsing glow border overlay — only on the next upcoming stop */}
          {isNext && (
            <Animated.View
              style={[styles.glowBorder, { opacity: pulseAnim }]}
              pointerEvents="none"
            />
          )}

          <View style={styles.stopHeader}>
            <View style={styles.timeContainer}>
              <StopIcon type={stop.stop_type} />
              <Text style={styles.stopTime}>{stop.suggested_time?.slice(0, 5)}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopType}>
                {stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1)}
              </Text>
              <Text style={styles.stopLocation}>{location}</Text>
            </View>
            <View style={[styles.categoryBadge,
              { backgroundColor: CATEGORY_COLORS[category] || C.CARD }
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

      </View>
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={C.PRIMARY} size="large" />
          <Text style={styles.loadingText}>Generating your trip plan...</Text>
          <Text style={styles.loadingSubtext}>Finding best stops along the route</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stops = plan?.stops || [];
  const animatedVoiceBg = voiceColorAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [
      VOICE_STYLE.idle.bg,
      VOICE_STYLE.listening.bg,
      VOICE_STYLE.processing.bg,
      VOICE_STYLE.done.bg,
      VOICE_STYLE.error.bg,
    ],
  });
  const animatedVoiceBorder = voiceColorAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [
      VOICE_STYLE.idle.border,
      VOICE_STYLE.listening.border,
      VOICE_STYLE.processing.border,
      VOICE_STYLE.done.border,
      VOICE_STYLE.error.border,
    ],
  });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.45, 0] });
  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.6] });

  return (
    <SafeAreaView style={styles.container}>

      {/* Command recognition WebView — hidden 1×1, triggered by button or wake word */}
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

      {/* Wake word WebView — always-on loop, posts {type:'wake'} on "payanam" */}
      <WebView
        ref={wakeRef}
        source={{ html: WAKE_WORD_HTML }}
        style={styles.hiddenWebView}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={handleWakeMessage}
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
            <Text style={styles.mapBtnText}>🗺️ View Map</Text>
          </TouchableOpacity>
        </View>

        {/* Voice command button — animated color + pulsing ring while listening */}
        <View style={styles.voiceBtnOuter}>
          <Animated.View
            style={[styles.voiceRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            pointerEvents="none"
          />
          <TouchableOpacity
            onPress={handleVoicePress}
            disabled={voiceState === 'processing'}
            activeOpacity={0.8}
            style={voiceState === 'processing' ? styles.voiceBtnDisabled : null}
          >
            <Animated.View style={[styles.voiceBtn, {
              backgroundColor: animatedVoiceBg,
              borderColor: animatedVoiceBorder,
            }]}>
              {voiceState === 'processing' ? (
                <View style={styles.voiceRow}>
                  <ActivityIndicator color={C.INK_MUTED} size="small" />
                  <Text style={[styles.voiceBtnText, { color: C.INK_MUTED, marginLeft: 8 }]}>
                    Processing...
                  </Text>
                </View>
              ) : (
                <Text style={styles.voiceBtnText} numberOfLines={2}>{getVoiceLabel()}</Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>

        {clarificationPrompt ? (
          <View style={styles.clarificationBanner}>
            <Text style={styles.clarificationText}>{clarificationPrompt}</Text>
          </View>
        ) : null}

        <Text style={styles.voiceHint}>
          Say "Payanam" to activate  ·  or tap  ·  "Change tea time to 8am"
        </Text>

        {(() => {
          const lastAssistant = [...conversationHistory].reverse().find(h => h.role === 'assistant');
          if (!lastAssistant) return null;
          return (
            <View style={styles.lastReplyBubble}>
              <Text style={styles.lastReplyText} numberOfLines={2}>💬 {lastAssistant.text}</Text>
            </View>
          );
        })()}

        <Text style={styles.sectionTitle}>
          Your Trip Plan ({stops.length} stops)
        </Text>

        {Array.from(new Set(stops.map(s => s.day_number || 1))).sort().map(day => {
          const dayStops = stops.filter(s => (s.day_number || 1) === day);
          const nextIndex = findNextStopIndex(dayStops);
          return (
            <View key={day}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>📅 Day {day}</Text>
              </View>
              {dayStops.map((stop, index) =>
                renderStop(stop, index, index === nextIndex, index === dayStops.length - 1)
              )}
            </View>
          );
        })}

      </ScrollView>

      {/* Always-on wake word indicator */}
      <View style={styles.wakeIndicator}>
        <Text style={styles.wakeIndicatorText}>🎤  Payanam is listening...</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  hiddenWebView: { height: 1, width: 1, position: 'absolute', opacity: 0 },
  inner: { padding: 20, paddingBottom: 40 },
  back: { color: C.PRIMARY, fontSize: 16, fontFamily: FONTS.body, marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: C.INK, fontSize: 18, fontFamily: FONTS.display, marginTop: 20 },
  loadingSubtext: { color: C.INK_MUTED, fontSize: 14, fontFamily: FONTS.body, marginTop: 8 },
  tripHeader: {
    backgroundColor: C.CARD, borderRadius: 12,
    padding: 16, marginBottom: 20,
    ...SHADOWS.sm,
  },
  tripName: { color: C.INK, fontSize: 20, fontFamily: FONTS.display, marginBottom: 4 },
  tripRoute: { color: C.PRIMARY, fontSize: 15, fontFamily: FONTS.body, marginBottom: 4 },
  tripMeta: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body },
  sectionTitle: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, marginBottom: 16 },

  // ── Timeline row ──────────────────────────────────────────────────────────
  stopWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 14,
  },
  timelineCol: {
    width: 22,
    alignItems: 'center',
    paddingTop: 16,
  },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.PRIMARY,
    opacity: 0.55,
  },
  timelineDotNext: {
    width: 14, height: 14, borderRadius: 7,
    opacity: 1,
    shadowColor: C.PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    borderStyle: 'dashed',
    borderLeftWidth: 2,
    borderLeftColor: C.PRIMARY,
    opacity: 0.35,
    marginTop: 5,
  },

  // ── Stop card ─────────────────────────────────────────────────────────────
  stopCard: {
    flex: 1,
    backgroundColor: C.CARD,
    borderRadius: 12,
    padding: 18,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: C.BORDER,
    ...SHADOWS.sm,
  },
  stopCardNext: {
    ...SHADOWS.md,
  },
  // Pulsing terracotta glow border — absolutely positioned over the card
  glowBorder: {
    position: 'absolute',
    top: -1.5, left: -1.5, right: -1.5, bottom: -1.5,
    borderRadius: 13.5,
    borderWidth: 2,
    borderColor: C.PRIMARY,
  },

  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeContainer: { alignItems: 'center', marginRight: 12, minWidth: 44 },
  stopTime: { color: C.ACCENT, fontSize: 12, fontFamily: FONTS.bodyBold, marginTop: 4 },
  stopInfo: { flex: 1 },
  stopType: { color: C.INK, fontSize: 15, fontFamily: FONTS.bodyBold },
  stopLocation: { color: C.INK_MUTED, fontSize: 12, fontFamily: FONTS.body, marginTop: 2 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  categoryText: { color: C.INK, fontSize: 10, fontFamily: FONTS.body },
  stopDescription: { color: C.INK_MUTED, fontSize: 13, fontFamily: FONTS.body, lineHeight: 18, marginBottom: 8 },
  nearbyContainer: { borderTopWidth: 1, borderTopColor: C.BORDER, paddingTop: 10 },
  nearbyTitle: { color: C.INK_MUTED, fontSize: 12, fontFamily: FONTS.body, marginBottom: 6 },
  placeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4
  },
  placeName: { color: C.INK, fontSize: 13, fontFamily: FONTS.body, flex: 1 },
  placeScore: { color: C.ACCENT, fontSize: 12, fontFamily: FONTS.body },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  liveBtn: { backgroundColor: C.PRIMARY },
  mapBtn: { backgroundColor: C.CARD_ALT, borderWidth: 1, borderColor: C.PRIMARY },
  actionBtnText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bodyBold },
  mapBtnText: { color: C.INK, fontSize: 14, fontFamily: FONTS.bodyBold },
  voiceBtnOuter: {
    marginBottom: 6,
    position: 'relative',
  },
  voiceRing: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#ef4444',
  },
  voiceBtn: {
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1.5, minHeight: 48,
  },
  voiceBtnDisabled: { opacity: 0.6 },
  voiceRow: { flexDirection: 'row', alignItems: 'center' },
  voiceBtnText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bodyBold, textAlign: 'center' },
  clarificationBanner: {
    backgroundColor: C.CARD_ALT,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.PRIMARY,
  },
  clarificationText: { color: C.PRIMARY, fontSize: 13, fontFamily: FONTS.bodyBold },
  voiceHint: {
    color: C.INK_MUTED, fontSize: 11, fontFamily: FONTS.body,
    textAlign: 'center', marginBottom: 20, lineHeight: 16,
  },
  dayHeader: {
    backgroundColor: C.CARD_ALT, borderRadius: 8,
    padding: 10, marginBottom: 8, marginTop: 8
  },
  dayTitle: { color: C.ACCENT, fontSize: 15, fontFamily: FONTS.bodyBold },
  wakeIndicator: {
    backgroundColor: C.BG,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.CARD,
  },
  wakeIndicatorText: { color: C.INK_MUTED, fontSize: 12, fontFamily: FONTS.body },
  lastReplyBubble: {
    backgroundColor: C.CARD_ALT,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: C.PRIMARY,
  },
  lastReplyText: {
    color: C.INK_MUTED,
    fontSize: 12,
    fontFamily: FONTS.body,
    lineHeight: 18,
  },
});
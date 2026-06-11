import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal
} from 'react-native';

const STOP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  sightseeing: '📸', viewpoint: '🏔️', fuel: '⛽',
  accommodation: '🏨', stay: '🏨', activity: '🎯',
  meal: '🍽️', food: '🍽️', snack: '🥤',
};

const AUTO_DISMISS_SECS = 10;

export default function QuickReviewSheet({ stop, visible, onRate, onSkip }) {
  const slideAnim = useRef(new Animated.Value(350)).current;
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECS);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setCountdown(AUTO_DISMISS_SECS);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            onSkip();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 220,
        useNativeDriver: true,
      }).start();
      clearInterval(countdownRef.current);
    }

    return () => clearInterval(countdownRef.current);
  }, [visible]);

  if (!stop) return null;

  const icon = STOP_ICONS[stop.stop_type] || '📍';
  const placeName = stop.notes?.split('|')[0]?.trim() || stop.stop_type;
  const stopLabel = stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1);
  const timerWidth = `${(countdown / AUTO_DISMISS_SECS) * 100}%`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Stop info */}
          <View style={styles.stopRow}>
            <Text style={styles.stopIcon}>{icon}</Text>
            <View style={styles.stopInfo}>
              <Text style={styles.stopLabel}>{stopLabel}</Text>
              <Text style={styles.placeName} numberOfLines={1}>{placeName}</Text>
              {stop.suggested_time && (
                <Text style={styles.stopTime}>{stop.suggested_time.slice(0, 5)}</Text>
              )}
            </View>
            <Text style={styles.countdown}>{countdown}s</Text>
          </View>

          <Text style={styles.prompt}>How was this stop?</Text>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => onRate(star)}
                style={styles.starBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.starText}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Countdown progress bar */}
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: timerWidth }]} />
          </View>

          {/* Skip */}
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stopIcon: { fontSize: 32 },
  stopInfo: { flex: 1 },
  stopLabel: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  placeName: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  stopTime: { color: '#f97316', fontSize: 12, marginTop: 2 },
  countdown: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
  prompt: {
    color: '#cbd5e1',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  starBtn: { padding: 4 },
  starText: { fontSize: 40, color: '#f97316' },
  timerTrack: {
    height: 3,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timerFill: {
    height: 3,
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: { color: '#64748b', fontSize: 14 },
});
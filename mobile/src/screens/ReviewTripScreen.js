import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert, TextInput
} from 'react-native';
import { getTripStops, submitReview, completeTrip } from '../api/trips';

const StarRating = ({ value, onChange, label }) => {
  return (
    <View style={styles.starContainer}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => onChange(star)}>
            <Text style={[styles.star, star <= value && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default function ReviewTripScreen({ route, navigation }) {
  const { tripId, tripName } = route.params;
  const [stops, setStops] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviews, setReviews] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStops();
  }, []);

  const loadStops = async () => {
    try {
      const data = await getTripStops(tripId);
      setStops(data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateReview = (stopId, field, value) => {
    setReviews(prev => ({
      ...prev,
      [stopId]: { ...prev[stopId], [field]: value }
    }));
  };

  const handleNext = async () => {
    const stop = stops[currentIndex];
    const review = reviews[stop.id];

    if (review?.rating) {
      try {
        await submitReview(tripId, stop.id, {
          rating: review.rating,
          cleanliness_rating: review.cleanliness || 3,
          food_quality: review.food_quality || 3,
          comment: review.comment || ''
        });
      } catch (err) {
        console.error('Review submit error:', err);
      }
    }

    if (currentIndex < stops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    if (currentIndex < stops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await completeTrip(tripId);
      Alert.alert(
        '🎉 Trip Completed!',
        'Your reviews help other travelers find the best stops.',
        [{ text: 'Done', onPress: () => navigation.navigate('Home') }]
      );
    } catch (err) {
      console.error(err);
      navigation.navigate('Home');
    } finally {
      setSubmitting(false);
    }
  };

  if (stops.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading stops...</Text>
      </SafeAreaView>
    );
  }

  const stop = stops[currentIndex];
  const review = reviews[stop.id] || {};
  const progress = `${currentIndex + 1} / ${stops.length}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>

        <Text style={styles.title}>Rate Your Stops</Text>
        <Text style={styles.tripName}>{tripName}</Text>
        <Text style={styles.progress}>{progress}</Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${((currentIndex + 1) / stops.length) * 100}%`
          }]} />
        </View>

        {/* Stop card */}
        <View style={styles.stopCard}>
          <Text style={styles.stopType}>
            {stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1)}
          </Text>
          <Text style={styles.stopTime}>{stop.suggested_time?.slice(0, 5)}</Text>
          <Text style={styles.stopNotes} numberOfLines={2}>
            {stop.notes?.split('|')[0]?.trim()}
          </Text>
        </View>

        {/* Rating */}
        <View style={styles.reviewCard}>
          <StarRating
            label="Overall Rating"
            value={review.rating || 0}
            onChange={(v) => updateReview(stop.id, 'rating', v)}
          />
          <StarRating
            label="Cleanliness"
            value={review.cleanliness || 0}
            onChange={(v) => updateReview(stop.id, 'cleanliness', v)}
          />
          <StarRating
            label="Food Quality"
            value={review.food_quality || 0}
            onChange={(v) => updateReview(stop.id, 'food_quality', v)}
          />

          <Text style={styles.commentLabel}>Comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            placeholderTextColor="#475569"
            multiline
            value={review.comment || ''}
            onChangeText={(v) => updateReview(stop.id, 'comment', v)}
          />
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          disabled={submitting}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === stops.length - 1 ? '✅ Finish Trip' : 'Next Stop →'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip this stop</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { padding: 20, paddingBottom: 40 },
  loading: { color: '#fff', textAlign: 'center', marginTop: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  tripName: { color: '#f97316', fontSize: 14, marginBottom: 8 },
  progress: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  progressBar: {
    height: 4, backgroundColor: '#1e293b',
    borderRadius: 2, marginBottom: 20
  },
  progressFill: {
    height: 4, backgroundColor: '#f97316', borderRadius: 2
  },
  stopCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: '#f97316'
  },
  stopType: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  stopTime: { color: '#f97316', fontSize: 13, marginBottom: 4 },
  stopNotes: { color: '#94a3b8', fontSize: 13 },
  reviewCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 16
  },
  starContainer: { marginBottom: 16 },
  starLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: '#334155' },
  starActive: { color: '#f97316' },
  commentLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  commentInput: {
    backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 8, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
    minHeight: 80, textAlignVertical: 'top'
  },
  nextButton: {
    backgroundColor: '#f97316', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 12
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  skipButton: { alignItems: 'center', padding: 12 },
  skipButtonText: { color: '#94a3b8', fontSize: 14 }
});
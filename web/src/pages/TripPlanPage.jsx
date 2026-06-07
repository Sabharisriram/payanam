import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrip, getTripStops, generatePlan } from '../api/trips';

const STOP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  sightseeing: '📸', viewpoint: '🏔️', fuel: '⛽',
  accommodation: '🏨', stay: '🏨', activity: '🎯',
  meal: '🍽️', food: '🍽️', break: '🛑', attraction: '🎡',
  scenic_view: '🌄'
};

const CATEGORY_COLORS = {
  budget: '#166534', 'mid-range': '#1e3a5f',
  average: '#1e3a5f', luxury: '#4c1d95', free: '#334155', moderate: '#1e3a5f'
};

export default function TripPlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tripData, stopsData] = await Promise.all([
        getTrip(id),
        getTripStops(id)
      ]);
      setTrip(tripData);
      setStops(stopsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePlan(id);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading your trip plan...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>

        <button style={styles.back} onClick={() => navigate('/')}>← Back</button>

        {trip && (
          <div style={styles.tripHeader}>
            <h2 style={styles.tripName}>{trip.trip_name}</h2>
            <p style={styles.tripRoute}>{trip.start_location} → {trip.end_location}</p>
            <p style={styles.tripMeta}>
              {trip.trip_type} · {trip.vehicle_type} · {trip.member_count} members
            </p>
          </div>
        )}

        <p style={styles.sectionTitle}>Your Trip Plan ({stops.length} stops)</p>

        {stops.length === 0 && (
          <div style={styles.emptyPlan}>
            <p style={styles.emptyText}>No plan generated yet.</p>
            <button
              style={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? '✨ Generating... (~20 seconds)' : 'Generate Plan ✨'}
            </button>
          </div>
        )}

        {stops.map((stop, index) => {
          const icon = STOP_ICONS[stop.stop_type?.toLowerCase()] || '📍';
          const notes = stop.notes?.split('|') || [];
          const location = notes[0]?.trim();
          const description = notes[1]?.trim();
          const category = stop.notes?.includes('Category:')
            ? stop.notes.split('Category:')[1]?.trim()
            : 'budget';

          return (
            <div key={stop.id || index} style={styles.stopCard}>
              <div style={styles.stopHeader}>
                <div style={styles.timeBox}>
                  <span style={styles.icon}>{icon}</span>
                  <span style={styles.time}>{stop.suggested_time?.slice(0, 5)}</span>
                </div>
                <div style={styles.stopInfo}>
                  <p style={styles.stopType}>
                    {stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1)}
                  </p>
                  <p style={styles.stopLocation}>{location}</p>
                </div>
                <span style={{
                  ...styles.badge,
                  backgroundColor: CATEGORY_COLORS[category] || '#334155'
                }}>
                  {category}
                </span>
              </div>

              {description && (
                <p style={styles.description}>{description}</p>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a' },
  inner: { maxWidth: 700, margin: '0 auto', padding: '20px 16px 60px' },
  loadingContainer: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center'
  },
  loadingText: { color: '#fff', fontSize: 18 },
  back: { backgroundColor: 'transparent', color: '#f97316', fontSize: 16, marginBottom: 16 },
  tripHeader: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 20
  },
  tripName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  tripRoute: { color: '#f97316', fontSize: 15, marginBottom: 4 },
  tripMeta: { color: '#94a3b8', fontSize: 13 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  emptyPlan: { textAlign: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', marginBottom: 16 },
  generateBtn: {
    backgroundColor: '#f97316', color: '#fff',
    padding: '12px 24px', borderRadius: 10,
    fontSize: 15, fontWeight: 'bold'
  },
  stopCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderLeft: '3px solid #f97316'
  },
  stopHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  timeBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 },
  icon: { fontSize: 20 },
  time: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  stopInfo: { flex: 1 },
  stopType: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  stopLocation: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  badge: {
    padding: '3px 10px', borderRadius: 20,
    color: '#fff', fontSize: 11, whiteSpace: 'nowrap'
  },
  description: { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }
};
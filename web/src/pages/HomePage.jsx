import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getTrips, deleteTrip } from '../api/trips';
import { C } from '../theme/colors';

export default function HomePage() {
  const { user, logout } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDelete = async (e, tripId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this trip?')) return;
    try {
      await deleteTrip(tripId);
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (err) {
      alert('Failed to delete trip');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>

        <div style={styles.header}>
          <div>
            <h2 style={styles.greeting}>வணக்கம், {user?.name} 👋</h2>
            <p style={styles.subtitle}>Where are you going today?</p>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroCircle1} />
          <div style={styles.heroCircle2} />
          <p style={styles.heroTagline}>Ready for your next journey?</p>
          <button style={styles.heroBtn} onClick={() => navigate('/plan')}>
            + Plan a New Trip
          </button>
        </div>

        <p style={styles.sectionTitle}>Your Trips</p>

        {loading ? (
          <p style={styles.empty}>Loading trips...</p>
        ) : trips.length === 0 ? (
          <p style={styles.empty}>No trips yet. Plan your first trip!</p>
        ) : (
          trips.map(trip => (
            <div
              key={trip.id}
              style={styles.tripCard}
              onClick={() => navigate(`/trip/${trip.id}`)}
            >
              <h3 style={styles.tripName}>{trip.trip_name}</h3>
              <p style={styles.tripRoute}>{trip.start_location} → {trip.end_location}</p>
              <p style={styles.tripMeta}>
                {trip.trip_type} · {trip.vehicle_type} · {trip.member_count} members
              </p>
              <div style={styles.cardFooter}>
                <span style={{
                  ...styles.badge,
                  backgroundColor: trip.status === 'planned' ? C.SAGE_BG : C.CARD_ALT
                }}>
                  {trip.status}
                </span>
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => handleDelete(e, trip.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: C.BG },
  inner: { maxWidth: 700, margin: '0 auto', padding: '20px 16px' },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: C.INK },
  subtitle: { color: C.INK_MUTED, marginTop: 4 },
  logoutBtn: {
    backgroundColor: 'transparent', color: C.PRIMARY,
    fontSize: 14, padding: '8px 16px',
    border: `1px solid ${C.PRIMARY}`, borderRadius: 8
  },
  heroCard: {
    backgroundColor: C.PRIMARY, height: 140, borderRadius: 16,
    marginBottom: 24, padding: 20, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'relative',
  },
  heroCircle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.10)', top: -45, right: -30, pointerEvents: 'none',
  },
  heroCircle2: {
    position: 'absolute', width: 90, height: 90, borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -25, right: 90, pointerEvents: 'none',
  },
  heroTagline: { color: '#fff', fontSize: 18, fontWeight: '600', position: 'relative' },
  heroBtn: {
    backgroundColor: '#fff', color: C.PRIMARY, borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 'bold',
    alignSelf: 'flex-start', position: 'relative',
  },
  sectionTitle: { color: C.INK_MUTED, fontSize: 13, marginBottom: 12 },
  tripCard: {
    backgroundColor: C.CARD, borderRadius: 12,
    padding: 16, marginBottom: 12, cursor: 'pointer',
    borderLeft: `3px solid ${C.PRIMARY}`
  },
  tripName: { color: C.INK, fontSize: 17, marginBottom: 4 },
  tripRoute: { color: C.PRIMARY, fontSize: 14, marginBottom: 4 },
  tripMeta: { color: C.INK_MUTED, fontSize: 12, marginBottom: 8 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: 20, color: C.INK, fontSize: 11
  },
  deleteBtn: {
    backgroundColor: 'transparent', color: '#ef4444',
    fontSize: 12, border: '1px solid #ef4444',
    borderRadius: 6, padding: '3px 10px', cursor: 'pointer'
  },
  empty: { color: C.INK_MUTED, textAlign: 'center', marginTop: 60 }
};
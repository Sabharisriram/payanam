import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getTrips, deleteTrip } from '../api/trips';

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

        <button style={styles.planBtn} onClick={() => navigate('/plan')}>
          + Plan a New Trip
        </button>

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
                  backgroundColor: trip.status === 'planned' ? '#166534' : '#1e3a5f'
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
  container: { minHeight: '100vh', backgroundColor: '#0f172a' },
  inner: { maxWidth: 700, margin: '0 auto', padding: '20px 16px' },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#94a3b8', marginTop: 4 },
  logoutBtn: {
    backgroundColor: 'transparent', color: '#f97316',
    fontSize: 14, padding: '8px 16px',
    border: '1px solid #f97316', borderRadius: 8
  },
  planBtn: {
    width: '100%', padding: 16,
    backgroundColor: '#f97316', color: '#fff',
    borderRadius: 12, fontSize: 16,
    fontWeight: 'bold', marginBottom: 24
  },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  tripCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 12, cursor: 'pointer',
    borderLeft: '3px solid #f97316'
  },
  tripName: { color: '#fff', fontSize: 17, marginBottom: 4 },
  tripRoute: { color: '#f97316', fontSize: 14, marginBottom: 4 },
  tripMeta: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: 20, color: '#fff', fontSize: 11
  },
  deleteBtn: {
    backgroundColor: 'transparent', color: '#ef4444',
    fontSize: 12, border: '1px solid #ef4444',
    borderRadius: 6, padding: '3px 10px', cursor: 'pointer'
  },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 60 }
};
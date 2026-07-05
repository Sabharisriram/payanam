import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip, generatePlan } from '../api/trips';
import { C } from '../theme/colors';

const TRIP_TYPES = ['solo', 'family', 'friends', 'boys', 'bachelor'];
const VEHICLES = ['car', 'bike', 'bus', 'auto'];
const PLANNING_MODES = ['essential', 'sightseeing', 'customized'];
const MODE_DESCRIPTIONS = {
  essential: 'Tea, breakfast, lunch, snack & dinner only — no sightseeing',
  sightseeing: 'Meals + 2 real sightseeing spots along the route',
  customized: 'Enter your own places — meals planned around them',
};

export default function PlanTripPage() {
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
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tripName || !startLocation || !endLocation || !startDate) {
      setError('Please fill all required fields');
      return;
    }
    setLoading(true);
    setError('');
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
      navigate(`/trip/${trip.id}`, { state: { plan } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <button style={styles.back} onClick={() => navigate('/')}>← Back</button>
        <h2 style={styles.title}>Plan Your Trip</h2>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit}>

          {/* ROUTE */}
          <div style={styles.sectionCard}>
            <span style={styles.sectionLabel}>ROUTE</span>
            <label style={styles.label}>Trip Name</label>
            <input style={styles.input} placeholder="e.g. Coimbatore to Ooty"
              value={tripName} onChange={(e) => setTripName(e.target.value)} />
            <label style={styles.label}>From</label>
            <input style={styles.input} placeholder="Starting location"
              value={startLocation} onChange={(e) => setStartLocation(e.target.value)} />
            <label style={styles.label}>To</label>
            <input style={{ ...styles.input, marginBottom: 0 }} placeholder="Destination"
              value={endLocation} onChange={(e) => setEndLocation(e.target.value)} />
          </div>

          {/* SCHEDULE */}
          <div style={styles.sectionCard}>
            <span style={styles.sectionLabel}>SCHEDULE</span>
            <label style={styles.label}>Date</label>
            <input style={styles.input} type="date"
              value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <label style={styles.label}>Start Time</label>
            <input style={{ ...styles.input, marginBottom: 0 }} type="time"
              value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>

          {/* PASSENGERS */}
          <div style={styles.sectionCard}>
            <span style={styles.sectionLabel}>PASSENGERS</span>
            <label style={styles.label}>Number of Members</label>
            <input style={styles.input} type="number" min="1" max="20"
              value={members} onChange={(e) => setMembers(e.target.value)} />
            <label style={styles.label}>Number of Days</label>
            <input style={{ ...styles.input, marginBottom: 0 }} type="number" min="1" max="30"
              placeholder="e.g. 2"
              value={tripDays} onChange={(e) => setTripDays(e.target.value)} />
          </div>

          {/* PREFERENCES */}
          <div style={styles.sectionCard}>
            <span style={styles.sectionLabel}>PREFERENCES</span>
            <label style={styles.label}>Trip Type</label>
            <div style={styles.chips}>
              {TRIP_TYPES.map(t => (
                <button key={t} type="button"
                  style={{ ...styles.chip, ...(tripType === t ? styles.chipActive : {}) }}
                  onClick={() => setTripType(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <label style={styles.label}>Vehicle</label>
            <div style={styles.chips}>
              {VEHICLES.map(v => (
                <button key={v} type="button"
                  style={{ ...styles.chip, ...(vehicle === v ? styles.chipActive : {}) }}
                  onClick={() => setVehicle(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <label style={styles.label}>Planning Mode</label>
            <div style={styles.chips}>
              {PLANNING_MODES.map(m => (
                <button key={m} type="button"
                  style={{ ...styles.chip, ...(planningMode === m ? styles.chipActive : {}) }}
                  onClick={() => setPlanningMode(m)}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p style={styles.modeDesc}>{MODE_DESCRIPTIONS[planningMode]}</p>
            {planningMode === 'customized' && (
              <>
                <label style={styles.label}>Your Places (one per line)</label>
                <textarea
                  style={{ ...styles.textarea, marginBottom: 0 }}
                  placeholder={'e.g. Pykara Lake, Ooty\nEmerald Dam\nDoddabetta Peak'}
                  value={customPlaces}
                  onChange={(e) => setCustomPlaces(e.target.value)}
                  rows={4}
                />
              </>
            )}
          </div>

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? (
              <div style={styles.loadingBox}>
                <div style={styles.spinner}></div>
                <span>Generating your plan... this takes ~20 seconds</span>
              </div>
            ) : 'Generate Trip Plan ✨'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: C.BG },
  inner: { maxWidth: 600, margin: '0 auto', padding: '20px 16px 60px' },
  back: { backgroundColor: 'transparent', color: C.PRIMARY, fontSize: 16, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: C.INK, marginBottom: 24 },
  sectionCard: {
    backgroundColor: C.CARD, border: `1px solid ${C.BORDER}`,
    borderRadius: 12, padding: 20, marginBottom: 16,
  },
  sectionLabel: {
    display: 'block', color: C.PRIMARY, fontSize: 11, fontWeight: '700',
    letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14,
  },
  label: { display: 'block', color: C.INK_MUTED, fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    width: '100%', padding: '13px 16px',
    backgroundColor: C.BG, border: `1px solid ${C.BORDER}`,
    borderRadius: 10, color: C.INK, fontSize: 15,
    marginBottom: 14, display: 'block', boxSizing: 'border-box',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    padding: '8px 18px', borderRadius: 20,
    backgroundColor: C.CARD, border: `1px solid ${C.BORDER}`,
    color: C.INK_MUTED, fontSize: 14,
  },
  chipActive: {
    backgroundColor: C.PRIMARY, borderColor: C.PRIMARY, color: '#fff',
  },
  button: {
    width: '100%', padding: 16, marginTop: 20,
    backgroundColor: C.PRIMARY, color: '#fff',
    borderRadius: 12, fontSize: 16, fontWeight: 'bold',
  },
  error: { color: '#ef4444', marginBottom: 16 },
  modeDesc: { color: C.INK_MUTED, fontSize: 12, marginTop: -8, marginBottom: 14 },
  textarea: {
    width: '100%', padding: '13px 16px',
    backgroundColor: C.BG, border: `1px solid ${C.BORDER}`,
    borderRadius: 10, color: C.INK, fontSize: 14,
    marginBottom: 14, display: 'block',
    resize: 'vertical', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  loadingBox: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  spinner: {
    width: 20, height: 20,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
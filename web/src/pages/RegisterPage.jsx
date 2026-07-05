import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { C } from '../theme/colors';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    await register(name, phone, email, password);
    const user = useAuthStore.getState().user;
    if (user) navigate('/');
  };

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div style={styles.heroCircle1} />
        <div style={styles.heroCircle2} />
        <h1 style={styles.heroBrand}>பயணம்</h1>
        <p style={styles.heroTagline}>Start Your Journey</p>
        <p style={styles.heroDesc}>
          Create your account and plan your first trip with AI-powered
          stops, real-time maps, and personalized itineraries.
        </p>
      </div>

      <div className="auth-form-panel">
        <div style={styles.card}>
          <h2 style={styles.formTitle}>Create account</h2>
          <p style={styles.formSubtitle}>Join Payanam today</p>

          {error && <p style={styles.error}>{error}</p>}

          <form onSubmit={handleRegister}>
            <input
              style={styles.input}
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={styles.input}
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              style={styles.input}
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.button} type="submit" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p style={styles.link}>
            Already have an account? <Link to="/login" style={styles.linkText}>Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  heroCircle1: {
    position: 'absolute', width: 280, height: 280, borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.08)', top: -80, right: -80,
  },
  heroCircle2: {
    position: 'absolute', width: 160, height: 160, borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 60,
  },
  heroBrand: { fontSize: 52, color: '#fff', marginBottom: 16, position: 'relative' },
  heroTagline: { fontSize: 20, color: '#fff', fontWeight: '700', marginBottom: 12, position: 'relative' },
  heroDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: '1.6', position: 'relative' },
  card: {
    width: '100%', maxWidth: 400,
    padding: 40, backgroundColor: C.CARD,
    borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  formTitle: { fontSize: 24, color: C.INK, marginBottom: 6 },
  formSubtitle: { color: C.INK_MUTED, marginBottom: 28 },
  input: {
    width: '100%', padding: '14px 16px',
    backgroundColor: C.BG, border: `1px solid ${C.BORDER}`,
    borderRadius: 10, color: C.INK, fontSize: 15,
    marginBottom: 14, display: 'block', boxSizing: 'border-box',
  },
  button: {
    width: '100%', padding: 16,
    backgroundColor: C.PRIMARY, color: '#fff',
    borderRadius: 10, fontSize: 16,
    fontWeight: 'bold', marginTop: 8,
  },
  link: { color: C.INK_MUTED, textAlign: 'center', marginTop: 20 },
  linkText: { color: C.PRIMARY },
  error: { color: '#ef4444', textAlign: 'center', marginBottom: 16 },
};
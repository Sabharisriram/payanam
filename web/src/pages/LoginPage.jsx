import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    await login(phone, password);
    const user = useAuthStore.getState().user;
    if (user) navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>பயணம்</h1>
        <p style={styles.tagline}>Your Smart Travel Companion</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            style={styles.input}
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button style={styles.button} type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={styles.link}>
          Don't have an account? <Link to="/register" style={styles.linkText}>Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f172a'
  },
  card: {
    width: '100%', maxWidth: 420,
    padding: 40, backgroundColor: '#1e293b',
    borderRadius: 16
  },
  logo: { fontSize: 42, color: '#f97316', textAlign: 'center', marginBottom: 8 },
  tagline: { color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
  input: {
    width: '100%', padding: '14px 16px',
    backgroundColor: '#0f172a', border: '1px solid #334155',
    borderRadius: 10, color: '#fff', fontSize: 15,
    marginBottom: 14, display: 'block'
  },
  button: {
    width: '100%', padding: 16,
    backgroundColor: '#f97316', color: '#fff',
    borderRadius: 10, fontSize: 16,
    fontWeight: 'bold', marginTop: 8
  },
  link: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },
  linkText: { color: '#f97316' },
  error: { color: '#ef4444', textAlign: 'center', marginBottom: 16 }
};
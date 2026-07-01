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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>பயணம்</h1>
        <p style={styles.tagline}>Create your account</p>

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
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.BG
  },
  card: {
    width: '100%', maxWidth: 420,
    padding: 40, backgroundColor: C.CARD,
    borderRadius: 16
  },
  logo: { fontSize: 42, color: C.PRIMARY, textAlign: 'center', marginBottom: 8 },
  tagline: { color: C.INK_MUTED, textAlign: 'center', marginBottom: 32 },
  input: {
    width: '100%', padding: '14px 16px',
    backgroundColor: C.BG, border: `1px solid ${C.BORDER}`,
    borderRadius: 10, color: C.INK, fontSize: 15,
    marginBottom: 14, display: 'block'
  },
  button: {
    width: '100%', padding: 16,
    backgroundColor: C.PRIMARY, color: '#fff',
    borderRadius: 10, fontSize: 16,
    fontWeight: 'bold', marginTop: 8
  },
  link: { color: C.INK_MUTED, textAlign: 'center', marginTop: 20 },
  linkText: { color: C.PRIMARY },
  error: { color: '#ef4444', textAlign: 'center', marginBottom: 16 }
};
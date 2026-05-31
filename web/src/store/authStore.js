import { create } from 'zustand';
import { login, register, logout, getStoredUser } from '../api/auth';

const useAuthStore = create((set) => ({
  user: getStoredUser(),
  isLoading: false,
  error: null,

  login: async (phone, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await login(phone, password);
      set({ user: data.user, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
    }
  },

  register: async (name, phone, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await register(name, phone, email, password);
      set({ user: data.user, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Register failed', isLoading: false });
    }
  },

  logout: () => {
    logout();
    set({ user: null });
  }
}));

export default useAuthStore;
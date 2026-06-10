import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.38.6.230:5000/api';
// Replace with your PC's local IP — run `ipconfig` to find it

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Auto-attach JWT token to every request
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('payanam_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
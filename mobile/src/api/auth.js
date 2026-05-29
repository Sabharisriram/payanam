import client from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const register = async (name, phone, email, password) => {
  const response = await client.post('/auth/register', {
    name, phone, email, password
  });
  await AsyncStorage.setItem('payanam_token', response.data.token);
  await AsyncStorage.setItem('payanam_user', JSON.stringify(response.data.user));
  return response.data;
};

export const login = async (phone, password) => {
  const response = await client.post('/auth/login', {
    phone, password
  });
  await AsyncStorage.setItem('payanam_token', response.data.token);
  await AsyncStorage.setItem('payanam_user', JSON.stringify(response.data.user));
  return response.data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('payanam_token');
  await AsyncStorage.removeItem('payanam_user');
};

export const getStoredUser = async () => {
  const user = await AsyncStorage.getItem('payanam_user');
  return user ? JSON.parse(user) : null;
};
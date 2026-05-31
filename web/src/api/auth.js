import client from './client';

export const register = async (name, phone, email, password) => {
  const response = await client.post('/auth/register', { name, phone, email, password });
  localStorage.setItem('payanam_token', response.data.token);
  localStorage.setItem('payanam_user', JSON.stringify(response.data.user));
  return response.data;
};

export const login = async (phone, password) => {
  const response = await client.post('/auth/login', { phone, password });
  localStorage.setItem('payanam_token', response.data.token);
  localStorage.setItem('payanam_user', JSON.stringify(response.data.user));
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('payanam_token');
  localStorage.removeItem('payanam_user');
};

export const getStoredUser = () => {
  const user = localStorage.getItem('payanam_user');
  return user ? JSON.parse(user) : null;
};
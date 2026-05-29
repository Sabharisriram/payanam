import client from './client';

export const createTrip = async (tripData) => {
  const response = await client.post('/trips', tripData);
  return response.data;
};

export const getTrips = async () => {
  const response = await client.get('/trips');
  return response.data;
};

export const getTrip = async (id) => {
  const response = await client.get(`/trips/${id}`);
  return response.data;
};

export const generatePlan = async (tripId) => {
  const response = await client.post(`/trips/${tripId}/plan`);
  return response.data;
};

export const getTripStops = async (tripId) => {
  const response = await client.get(`/trips/${tripId}/stops`);
  return response.data;
};
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
  const response = await client.post(`/trips/${tripId}/plan`, {}, { timeout: 120000 });
  return response.data;
};

export const getTripStops = async (tripId) => {
  const response = await client.get(`/trips/${tripId}/stops`);
  return response.data;
};
export const deleteTrip = async (id) => {
  const response = await client.delete(`/trips/${id}`);
  return response.data;
};

export const submitReview = async (tripId, stopId, reviewData) => {
  const response = await client.post(`/trips/${tripId}/stops/${stopId}/review`, reviewData);
  return response.data;
};

export const completeTrip = async (tripId) => {
  const response = await client.patch(`/trips/${tripId}/complete`);
  return response.data;
};

export const voiceCommand = async (tripId, commandText) => {
  const response = await client.post(
    `/trips/${tripId}/voice-command`,
    { command: commandText },
    { timeout: 30000 }
  );
  return response.data;
};
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import PlanTripScreen from '../screens/PlanTripScreen';
import TripPlanScreen from '../screens/TripPlanScreen';

import useAuthStore from '../store/authStore';
import LiveTripScreen from '../screens/LiveTripScreen';
import ReviewTripScreen from '../screens/ReviewTripScreen';
import MapScreen from '../screens/MapScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PlanTrip" component={PlanTripScreen} />
            <Stack.Screen name="TripPlan" component={TripPlanScreen} />
            <Stack.Screen name="LiveTrip" component={LiveTripScreen} />
            <Stack.Screen name="ReviewTrip" component={ReviewTripScreen} />
            <Stack.Screen name="MapScreen" component={MapScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
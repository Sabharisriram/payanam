import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import useAuthStore from './src/store/authStore';
import { C } from './src/theme/colors';

export default function App() {
  const loadUser = useAuthStore((state) => state.loadUser);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    loadUser();
  }, []);

  if (!fontsLoaded) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.BG }}>
          <ActivityIndicator color={C.PRIMARY} size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
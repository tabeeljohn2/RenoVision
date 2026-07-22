// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ActivityIndicator } from 'react-native';

import LoginScreen    from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen     from './screens/HomeScreen';
import UploadScreen   from './screens/UploadScreen';
import ResultsScreen  from './screens/ResultsScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const raw = await AsyncStorage.getItem('renovisionUser');
      if (!raw) { setIsLoggedIn(false); return; }

      const user = JSON.parse(raw);
      // Require both token and email to be present
      if (user?.token && user?.email) {
        setIsLoggedIn(true);
      } else {
        await AsyncStorage.removeItem('renovisionUser');
        setIsLoggedIn(false);
      }
    } catch {
      setIsLoggedIn(false);
    }
  };

  // Splash screen while checking storage
  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '900', color: '#F5F5F0', letterSpacing: -1 }}>
          Reno<Text style={{ color: '#D4AF37' }}>Vision</Text>
        </Text>
        <Text style={{ color: '#555555', fontSize: 13, marginTop: 8 }}>
          AI-Based Smart Interior Planner
        </Text>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animationEnabled: true }}
        initialRouteName={isLoggedIn ? 'Home' : 'Login'}
      >
        <Stack.Screen name="Login"    component={LoginScreen}    />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home"     component={HomeScreen}     />
        <Stack.Screen name="Upload"   component={UploadScreen}   />
        <Stack.Screen name="Results"  component={ResultsScreen}  />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Modal } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { supabase } from './supabase';
import AuthScreen from './screens/AuthScreen';
import ScanScreen from './screens/ScanScreen';
import SettingsScreen from './screens/SettingsScreen';
import CreditScreen from './screens/CreditScreen';

const Stack = createNativeStackNavigator();
const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_KEY;

export default function App() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [credits, setCredits]   = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits]   = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#06B6D4" />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={STRIPE_KEY} merchantIdentifier="merchant.com.ssmshsoil.bizcardscanner">
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="Scan">
              {() => (
                <>
                  <ScanScreen
                    user={user}
                    credits={credits}
                    setCredits={setCredits}
                    onOpenSettings={() => setShowSettings(true)}
                    onOpenCredits={() => setShowCredits(true)}
                  />
                  <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
                    <SettingsScreen
                      user={user}
                      credits={credits}
                      onClose={() => setShowSettings(false)}
                      onOpenCredits={() => { setShowSettings(false); setShowCredits(true); }}
                    />
                  </Modal>
                  <Modal visible={showCredits} animationType="slide" presentationStyle="pageSheet">
                    <CreditScreen
                      user={user}
                      credits={credits}
                      setCredits={setCredits}
                      onClose={() => setShowCredits(false)}
                    />
                  </Modal>
                </>
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </StripeProvider>
  );
}

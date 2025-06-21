import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { useColorScheme, StatusBar, Platform } from 'react-native';
import { loadConfiguration, forceLoadConfiguration, getCurrentConfig } from '../services/autoConfig';
import { forceSetConfigurationNow } from '../services/directConfig';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Set status bar to light mode (white text) for dark theme
  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  // Auto-configure the app on startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        
        // Force set configuration directly first
        console.log('🚨 Using direct configuration approach...');
        const directSuccess = await forceSetConfigurationNow();
        
        if (directSuccess) {
          console.log('✅ Direct configuration successful');
        } else {
          console.log('⚠️ Direct configuration failed, trying normal approach...');
          await loadConfiguration();
        }
        
        // Set a global flag to indicate configuration is complete
        (global as any).configurationLoaded = true;
      } catch (error) {
        console.error('❌ App auto-configuration failed:', error);
        (global as any).configurationLoaded = false;
        
        // Try one more time with force load
        try {
          console.log('🚨 Attempting emergency configuration...');
          await forceLoadConfiguration();
          (global as any).configurationLoaded = true;
        } catch (emergencyError) {
          console.error('💥 Emergency configuration also failed:', emergencyError);
        }
      }
    };
    
    initializeApp();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // Always use dark theme
  const darkTheme = {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      background: '#121212',
      surface: '#1e1e1e',
      primary: '#BB86FC',
    },
  };

  return (
    <PaperProvider theme={darkTheme}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={Platform.OS === 'android'}
      />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: 'modal', 
            title: 'About MCP Bridge Agent',
            headerStyle: {
              backgroundColor: '#1e1e1e',
            },
            headerTintColor: '#ffffff',
          }} 
        />
      </Stack>
    </PaperProvider>
  );
}

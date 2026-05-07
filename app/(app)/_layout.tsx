import React from 'react';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#ddd',
          backgroundColor: '#fff',
        },
      }}
    >
      <Tab.Screen
        name="(home)"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
        }}
      />
      <Tab.Screen
        name="proposals"
        options={{
          title: 'Proposals',
          tabBarLabel: 'Proposals',
        }}
      />
      <Tab.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarLabel: 'Posts',
        }}
      />
      <Tab.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'Chat' }} />
      <Stack.Screen name="[channelId]" options={{ headerTitle: 'Channel' }} />
    </Stack>
  );
}

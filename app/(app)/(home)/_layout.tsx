import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'Chat',
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerTitle: 'Chat' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function BrandsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="brand-management" />
    </Stack>
  );
}
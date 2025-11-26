import { Stack } from 'expo-router';

export default function CreateOrderLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="select-client"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="product-search"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="payment-method"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="spin-wheel"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="collect-email"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="confirmation"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="order-summary"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
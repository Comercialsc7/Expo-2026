import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDER_NUMBER_BASE_DATE = new Date('2026-05-21T00:00:00');
const DAY_MS = 24 * 60 * 60 * 1000;

function sanitizeSellerCode(rawSellerCode?: string): string {
  const digits = String(rawSellerCode || '').replace(/\D/g, '');
  const normalized = digits.slice(-4);
  return normalized.padStart(4, '0');
}

function getDayOffset(today: Date = new Date()): number {
  const baseMidnight = new Date(
    ORDER_NUMBER_BASE_DATE.getFullYear(),
    ORDER_NUMBER_BASE_DATE.getMonth(),
    ORDER_NUMBER_BASE_DATE.getDate(),
  ).getTime();

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.floor((todayMidnight - baseMidnight) / DAY_MS));
}

function getDayPart(dayOffset: number): string {
  return String(dayOffset % 10).padStart(1, '0');
}

function getSequenceStorageKey(sellerPart: string, dayOffset: number): string {
  return `order-number-seq:${sellerPart}:${dayOffset}`;
}

export async function generateShortOrderNumber(rawSellerCode?: string): Promise<string> {
  const sellerPart = sanitizeSellerCode(rawSellerCode);
  const dayOffset = getDayOffset();
  const dayPart = getDayPart(dayOffset);
  const sequenceKey = getSequenceStorageKey(sellerPart, dayOffset);

  const currentValue = await AsyncStorage.getItem(sequenceKey);
  const parsedCurrent = Number.parseInt(String(currentValue || '-1'), 10);

  const nextSequence = Number.isNaN(parsedCurrent)
    ? 0
    : (parsedCurrent + 1) % 1000;

  await AsyncStorage.setItem(sequenceKey, String(nextSequence));

  const sequencePart = String(nextSequence).padStart(3, '0');

  // 8 digits: vendedor(4) + sequencia(3) + dia(1)
  return `${sellerPart}${sequencePart}${dayPart}`;
}

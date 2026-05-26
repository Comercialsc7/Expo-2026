import { supabase } from './supabase';
import SQLiteStore from './SQLiteStore';
import type { CachedOrder } from '../store/useCachedOrdersStore';

const STORAGE_BUCKET = 'spinprizeimages';
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;

interface SyncedSpinPrizeOrder {
  orderId: string;
  publicUrl: string | null;
  publicUrls: string[];
}

interface SyncSpinPrizeResult {
  synced: SyncedSpinPrizeOrder[];
  failed: Array<{ orderId: string; error: Error }>;
}

const isRemoteUrl = (value?: string) => !!value && /^https?:\/\//i.test(value);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  attempts: number = RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = toError(error);

      if (attempt === attempts) {
        break;
      }

      const jitterMs = Math.floor(Math.random() * 300);
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitterMs;
      console.warn(
        `[spinPrizeSync] ${label} falhou (tentativa ${attempt}/${attempts}). Nova tentativa em ${delayMs}ms.`,
        lastError.message,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`[spinPrizeSync] ${label} falhou após ${attempts} tentativas: ${lastError?.message || 'erro desconhecido'}`);
}

async function uploadSpinPrizePhoto(photoUri: string, orderId: string): Promise<string> {
  if (isRemoteUrl(photoUri)) {
    return photoUri;
  }

  const fileName = `spin_prize_${orderId}_${Date.now()}.jpg`;
  const blob = await withRetry(async () => {
    const response = await fetch(photoUri);
    if (!response.ok) {
      throw new Error(`Falha ao ler a imagem do prêmio do pedido ${orderId}`);
    }
    return response.blob();
  }, `Leitura da foto local do pedido ${orderId}`);

  await withRetry(async () => {
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }
  }, `Upload da foto do prêmio do pedido ${orderId}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    throw new Error(`Não foi possível gerar a URL pública da imagem do pedido ${orderId}`);
  }

  return publicUrl;
}

function normalizeSpinPrizes(order: CachedOrder) {
  if (order.spinPrizes && order.spinPrizes.length > 0) {
    return order.spinPrizes;
  }

  if (order.spinPrize) {
    return [order.spinPrize];
  }

  return [];
}

function buildProdutosPayload(order: CachedOrder) {
  return order.items.map((item) => ({
    produto_id: item.code,
    produto_nome: item.name,
    quantidade: item.quantity,
    preco_unitario: item.price,
    desconto: item.discount,
    embalagem: item.box,
    acelerador: item.isAccelerator,
  }));
}

export async function syncCachedOrdersSpinPrizes(orders: CachedOrder[]): Promise<SyncSpinPrizeResult> {
  const result: SyncSpinPrizeResult = {
    synced: [],
    failed: [],
  };

  for (const order of orders) {
    try {
      const normalizedPrizes = normalizeSpinPrizes(order);
      const syncedPrizes = [];

      for (const prize of normalizedPrizes) {
        const uploadedPhotoUrl = prize.photo
          ? await uploadSpinPrizePhoto(prize.photo, order.id)
          : null;

        syncedPrizes.push({
          ...prize,
          photo: uploadedPhotoUrl || prize.photo,
          photoSynced: !prize.photo || !!uploadedPhotoUrl,
        });
      }

      const firstPrize = syncedPrizes[0];
      const firstPrizeUrl = syncedPrizes.find((prize) => !!prize.photo)?.photo || null;
      const prizeSummaryPayload = syncedPrizes.map((prize) => ({
        type: prize.type,
        description: prize.description,
        photo_url: prize.photo || null,
        photo_synced: !!prize.photoSynced,
      }));

      const payload = {
        pedido_id: order.id,
        numero_pedido_curto: order.shortOrderNumber || null,
        vendedor_codigo: order.sellerCode || '',
        cliente_code: order.client.code,
        cliente_nome: order.client.name,
        email: order.email || '',
        produtos: buildProdutosPayload(order),
        subtotal: order.subtotal,
        desconto: order.discount,
        total: order.total,
        prazo_pagamento: order.paymentTerm?.description || '',
        premio_tipo: firstPrize?.type || null,
        premio_descricao: firstPrize?.description || null,
        premios_roleta: prizeSummaryPayload,
        premio_imagem_url: firstPrizeUrl,
        status_envio: 'pendente',
      };

      await withRetry(async () => {
        const { error } = await supabase
          .from('pedidos')
          .upsert(payload, { onConflict: 'pedido_id' });

        if (error) {
          throw error;
        }
      }, `Upsert do pedido ${order.id} na tabela pedidos`);

      await SQLiteStore.save('cached_orders', {
        ...order,
        _id: order.id,
        enviado: true,
        spinPrize: syncedPrizes[0],
        spinPrizes: syncedPrizes,
      });

      result.synced.push({
        orderId: order.id,
        publicUrl: firstPrizeUrl,
        publicUrls: syncedPrizes.map((prize) => prize.photo).filter((photo): photo is string => !!photo),
      });
    } catch (error) {
      result.failed.push({
        orderId: order.id,
        error: toError(error),
      });
    }
  }

  return result;
}
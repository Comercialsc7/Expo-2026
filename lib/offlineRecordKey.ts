export function inferOfflineRecordKey(tableName: string, record: any): string {
  if (!record || typeof record !== 'object') {
    return `${Date.now()}-${Math.random()}`;
  }

  if (tableName === 'clients') {
    const id = String(record.id ?? '').trim();
    const code = String(record.code ?? '').trim();
    const equipe = String(record.equipe ?? '').trim();
    const repre = String(record.repre ?? '').trim();

    // Alguns imports podem chegar sem id; nesse caso a composição evita sobrescrever
    // clientes com o mesmo code para vendedores/equipes diferentes.
    const composed = `${id}:${code}:${equipe}:${repre}`.replace(/^:+|:+$/g, '');
    if (composed) return composed;
  }

  if (record.codcli !== undefined && record.diamax !== undefined) {
    return `${String(record.codcli)}:${String(record.diamax)}:${String(record.id ?? '')}`;
  }

  const preferredKeys = ['_id', 'id', 'pedido_id', 'user_id'];
  for (const key of preferredKeys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]) !== '') {
      return String(record[key]);
    }
  }

  if (record.code !== undefined && record.code !== null && String(record.code) !== '') {
    return `code:${String(record.code)}`;
  }

  return `${Date.now()}-${Math.random()}`;
}

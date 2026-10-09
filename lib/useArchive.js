import { api } from './api';
import useCachedResource from './useCachedResource';

// Arsip project selesai dari tab "[ARSIP] FINISHED PROJECT".
// Kembalian: { projects, schema, error, staleError, refreshing, reload, ... }
//   schema = modul yang kolomnya ada di sheet: [{ key, label, hasCap, hasUnit, hasDetail }]
export default function useArchive() {
  const { data, ...rest } = useCachedResource('archive', () => api.getArchive());
  return { projects: data ? data.projects || [] : null, schema: data ? data.schema || [] : [], ...rest };
}

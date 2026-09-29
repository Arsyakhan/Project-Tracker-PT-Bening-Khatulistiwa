import { api } from './api';
import useCachedResource from './useCachedResource';

// Daftar project dengan tampilan instan dari data terakhir + penyegaran di belakang layar.
// Kembalian: { projects, error, staleError, refreshing, mutate, reload }  (lihat useCachedResource)
export default function useProjects() {
  const { data, ...rest } = useCachedResource('projects', () => api.getProjects());
  return { projects: data, ...rest };
}

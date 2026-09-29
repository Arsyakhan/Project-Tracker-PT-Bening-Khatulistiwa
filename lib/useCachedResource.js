import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from './persistedCache';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // data tersimpan lebih tua dari 24 jam tidak ditampilkan

// "Tampilkan dulu, segarkan kemudian" (stale-while-revalidate):
// 1) kalau ada data tersimpan di browser -> langsung ditampilkan (tanpa layar loading)
// 2) di belakang layar, data segar diambil lewat fetcher() lalu menggantikan yang lama
//
// Hasil:
//   data        : data yang ditampilkan (null = belum ada sama sekali -> tampilkan skeleton)
//   error       : pesan error HANYA kalau belum ada data untuk ditampilkan
//   staleError  : pesan kalau gagal menyegarkan padahal data lama sedang tampil
//   refreshing  : true selama data segar sedang diambil
//   mutate(fn)  : ubah data secara lokal (mis. update optimis). Setelah ini, hasil ambil data
//                 yang datang belakangan TIDAK menimpa perubahan lokal.
//   reload()    : paksa ambil ulang dari server
export default function useCachedResource(name, fetcher, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const [data, setDataState] = useState(null);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [refreshing, setRefreshing] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = useRef(true);
  const hasData = useRef(false);
  const touched = useRef(false);

  const load = useCallback(
    async (force) => {
      if (force) touched.current = false;
      setRefreshing(true);
      try {
        const fresh = await fetcherRef.current();
        if (!mounted.current) return;
        if (!touched.current) {
          hasData.current = true;
          setDataState(fresh);
          writeCache(name, fresh);
        }
        setError(null);
        setStaleError(null);
      } catch (e) {
        if (!mounted.current) return;
        const message = (e && e.message) || 'Gagal memuat data';
        if (hasData.current) setStaleError(message);
        else setError(message);
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    },
    [name]
  );

  useEffect(() => {
    mounted.current = true;
    const cached = readCache(name, maxAgeMs);
    if (cached !== null) {
      hasData.current = true;
      setDataState(cached);
    }
    load(false);
    return () => {
      mounted.current = false;
    };
  }, [name, maxAgeMs, load]);

  const mutate = useCallback((updater) => {
    touched.current = true;
    setDataState(updater);
  }, []);

  const reload = useCallback(() => load(true), [load]);

  return { data, error, staleError, refreshing, mutate, reload };
}

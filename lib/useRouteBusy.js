import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// true selama Next.js pindah halaman (lebih dari `delay` ms). Dipakai logo bergerak di sidebar dan header HP:
// tetesnya surut dan bergelombang selama halaman dimuat, lalu penuh lagi. Pindah halaman yang instan tidak
// memicu apa pun karena ada jeda.
export default function useRouteBusy(delay = 150) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer;
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBusy(true), delay);
    };
    const done = () => {
      clearTimeout(timer);
      setBusy(false);
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      clearTimeout(timer);
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router, delay]);

  return busy;
}

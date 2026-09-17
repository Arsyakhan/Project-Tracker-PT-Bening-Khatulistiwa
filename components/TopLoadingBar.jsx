import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

export default function TopLoadingBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    function start() {
      clearInterval(timerRef.current);
      setVisible(true);
      setProgress(15);
      // naik pelan menuju 85% sambil nunggu navigasi selesai,
      // sisa 15% baru diisi pas selesai (biar kerasa "nyelesain", bukan nge-freeze)
      timerRef.current = setInterval(() => {
        setProgress((p) => (p >= 85 ? p : p + Math.random() * 10));
      }, 200);
    }

    function done() {
      clearInterval(timerRef.current);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }

    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      clearInterval(timerRef.current);
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[2.5px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-blueprint transition-all duration-200 ease-out shadow-[0_0_8px_rgba(0,119,182,0.6)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import MeetingEditor from '../../components/meetings/MeetingEditor';

export default function NewMeetingPage() {
  const router = useRouter();
  // Halaman statis: tanpa ?mode, router.isReady sudah true saat hydrate sehingga isi klien beda dengan HTML server
  // (galat React #418). Tunggu sampai terpasang dulu, baru baca ?mode=schedule.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (router.isReady) setReady(true);
  }, [router.isReady]);
  if (!ready) return null;
  return <MeetingEditor meetingId="" schedule={router.query.mode === 'schedule'} />;
}

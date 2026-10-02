import { useRouter } from 'next/router';
import MeetingEditor from '../../../components/meetings/MeetingEditor';

export default function MeetingPage() {
  const router = useRouter();
  if (!router.isReady) return null;
  return <MeetingEditor key={String(router.query.id)} meetingId={String(router.query.id)} />;
}

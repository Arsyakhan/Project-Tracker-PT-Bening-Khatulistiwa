import { useRouter } from 'next/router';
import MeetingEditor from '../../../components/meetings/MeetingEditor';

export default function NewMeetingPage() {
  const router = useRouter();
  if (!router.isReady) return null;
  return <MeetingEditor meetingId="" schedule={router.query.mode === 'schedule'} />;
}

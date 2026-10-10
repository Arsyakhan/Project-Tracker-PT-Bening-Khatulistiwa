import { useMemo } from 'react';
import { api } from './api';
import useCachedResource from './useCachedResource';
import useProjects from './useProjects';
import { computeOpenItems, todayIso } from './meetings';
import { buildActionItems } from './today';

// Semua hal yang perlu ditindak (project, pengadaan, tindak lanjut rapat), dihitung dengan cara yang sama
// di halaman Hari Ini dan di banner Dashboard. Memanggil hook ini di dua halaman tidak menggandakan
// permintaan ke server: datanya lewat cache browser yang sama (lihat useCachedResource).
//
// Kembalian:
//   projects, meetings  : data mentah (null = belum ada)
//   items               : hasil buildActionItems, urut paling mendesak dulu ([] selama project belum ada)
//   settled             : true kalau project, pengadaan, dan rapat sudah punya jawaban (data atau galat)
//   missing             : nama data yang gagal dimuat dan belum punya salinan lama (mis. ['pengadaan'])
//   error, staleError, refreshing : status pemuatan project, untuk RefreshStatus / pesan galat
//   meetingError        : galat memuat rapat (kartu "Rapat berikutnya" memakainya)
export default function useActionItems() {
  const { projects, error, staleError, refreshing } = useProjects();
  const { data: procurement, error: procError } = useCachedResource('procurement', () => api.getProcurement());
  const { data: meetings, error: meetingError } = useCachedResource('meetings', () => api.getMeetings());

  const today = todayIso();
  const openMeetingItems = useMemo(() => computeOpenItems(meetings || []), [meetings]);
  const items = useMemo(
    () => (projects ? buildActionItems({ projects, procurement: procurement || [], openMeetingItems, today }) : []),
    [projects, procurement, openMeetingItems, today]
  );

  const missing = [procError && !procurement && 'pengadaan', meetingError && !meetings && 'rapat'].filter(Boolean);
  const settled = !!projects && (!!procurement || !!procError) && (!!meetings || !!meetingError);

  return { projects, meetings, items, settled, missing, error, staleError, refreshing, meetingError };
}

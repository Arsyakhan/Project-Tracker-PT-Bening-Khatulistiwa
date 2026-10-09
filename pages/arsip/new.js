import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import PageHead from '../../components/PageHead';
import ArchiveEditor from '../../components/ArchiveEditor';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { clearCache } from '../../lib/persistedCache';
import { canWrite } from '../../lib/roles';
import { unpackSpecs } from '../../lib/docgen/specs';
import { projectFlowModules, readTech, toArchiveUnit } from '../../lib/techflow';
import useArchive from '../../lib/useArchive';
import useProjects from '../../lib/useProjects';

export default function ArsipNewPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { showToast } = useToast();
  const { schema, projects: archive, error: archiveError } = useArchive();
  const { projects } = useProjects();
  const fromId = typeof router.query.from === 'string' ? router.query.from : '';

  const [initial, setInitial] = useState(null); // null = belum siap
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Tanpa ?from= : form kosong. Dengan ?from=<projectId> : isi awal dari project yang sedang berjalan.
  useEffect(() => {
    if (!router.isReady || initial) return;
    if (!fromId) { setInitial({ name: '', year: String(new Date().getFullYear()), modules: [] }); return; }
    if (!projects || schema.length === 0) return;
    const p = projects.find((x) => x.id === fromId);
    if (!p) { setInitial({ name: '', year: String(new Date().getFullYear()), modules: [] }); return; }
    let cancelled = false;
    (async () => {
      let specs = {};
      try { specs = (await api.getSpecs(p.id)).specs || {}; } catch (e) { /* tanpa spesifikasi: kapasitas dikosongkan */ }
      if (cancelled) return;
      const keys = new Set(schema.map((s) => s.key));
      // Tahun selesai: ambil dari nama project (konvensi "..., 2026"), kalau tidak ada pakai tahun berjalan.
      const nameYear = (String(p.projectName || '').match(/\b(20\d{2})\b(?!.*\b20\d{2}\b)/) || [])[1];
      const year = nameYear || String(new Date().getFullYear());
      // Teknologi yang sudah dicatat di project (tab Teknologi) dipakai apa adanya; kalau belum ada, dibaca dari data lama.
      const saved = readTech(unpackSpecs(specs));
      const flow = saved || projectFlowModules(p, specs).map((m) => ({ ...m, unit: toArchiveUnit(m.unit) }));
      const skipped = flow.filter((m) => !keys.has(m.key)).map((m) => m.key);
      setInitial({
        name: p.projectName,
        year,
        modules: flow.filter((m) => keys.has(m.key)).map((m) => ({ key: m.key, cap: m.cap, unit: m.unit, detail: m.detail || '' })),
      });
      setNotice(saved
        ? `Terisi dari teknologi yang sudah dicatat di project "${p.projectName}". Periksa sebelum menyimpan.${skipped.length ? ` Modul yang tidak punya kolom di arsip dilewati: ${skipped.join(', ')}.` : ''}`
        : `Terisi dari data lama project "${p.projectName}" (belum ada teknologi yang dicatat). Periksa kapasitas dan satuannya sebelum menyimpan.${skipped.length ? ` Modul yang tidak punya kolom di arsip dilewati: ${skipped.join(', ')}.` : ''}`);
    })();
    return () => { cancelled = true; };
  }, [router.isReady, fromId, projects, schema, initial]);

  async function handleSubmit(form) {
    setSaving(true);
    setError('');
    try {
      const saved = await api.saveArchiveProject(form);
      clearCache('archive');
      showToast('Project arsip ditambahkan.', 'success');
      router.push(`/arsip/${encodeURIComponent(saved.id)}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Tambah Arsip" />
      <nav aria-label="Navigasi" className="text-sm">
        <Link href="/arsip" className="text-blueprint hover:underline">← Arsip Project</Link>
      </nav>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Tambah project ke arsip</h1>
        <p className="text-sm text-inkmute mt-1">Catat teknologi project yang sudah selesai sebagai acuan untuk project berikutnya.</p>
      </div>

      {!writable ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-inkmute">Akun Anda berstatus Viewer (hanya lihat), jadi tidak bisa menambah arsip.</div>
      ) : archiveError && !archive ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-rust" role="alert">Gagal memuat struktur arsip: {archiveError}</div>
      ) : archive && schema.length === 0 ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-inkmute">
          Tab <b className="text-ink">[ARSIP] FINISHED PROJECT</b> belum ada atau baris judulnya (baris 1 dan 2) belum lengkap, jadi modul belum bisa dipilih.
        </div>
      ) : !initial || schema.length === 0 ? (
        <div className="skeleton-shimmer rounded-lg h-56 w-full" />
      ) : (
        <ArchiveEditor schema={schema} initial={initial} saving={saving} error={error} notice={notice} submitLabel="Simpan ke arsip" onSubmit={handleSubmit} onCancel={() => router.push('/arsip')} />
      )}
    </div>
  );
}

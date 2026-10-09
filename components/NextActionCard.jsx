import { useId, useState } from 'react';
import { Pill } from './Badges';
import PicInput from './PicInput';
import { dueText, NEXT_SOON_DAYS } from '../lib/nextAction';
import { daysBetween, fmtShort } from '../lib/meetings';
import { todayISO } from '../lib/projectHelpers';

// Kartu "Langkah berikutnya" tepat di bawah judul project: satu hal konkret yang harus terjadi
// berikutnya, siapa yang mengerjakan, dan kapan. Tampil dulu sebagai teks; tombol Ubah membuka
// isian di tempat. Nilainya ikut tombol "Simpan perubahan" milik halaman (lewat update()).
export default function NextActionCard({ project, writable, update }) {
  const uid = useId().replace(/:/g, '');
  const [editing, setEditing] = useState(false);

  const active = project.status !== 'Completed' && !(project.stageProgress >= 100);
  const hasNext = !!(project.nextAction || project.nextActionOwner || project.nextActionDue);
  if (!active && !hasNext && !project.blocker) return null;

  const dueDays = project.nextActionDue ? daysBetween(todayISO(), project.nextActionDue) : null;
  const dueTone = dueDays === null ? 'neutral' : dueDays < 0 ? 'rust' : dueDays <= NEXT_SOON_DAYS ? 'amber' : 'neutral';
  const field = 'flex flex-col gap-1.5 text-sm';
  const labelCls = 'text-inkmute font-medium';

  function finishStep() {
    update('nextAction', '');
    update('nextActionOwner', '');
    update('nextActionDue', '');
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="bg-panel border border-line border-l-4 border-l-blueprint rounded-lg px-4 py-3 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${uid}-title`} className="text-xs font-semibold uppercase tracking-wide text-inkmute">Langkah berikutnya</h2>
        {writable && (hasNext || editing || project.blocker) && (
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center min-h-[40px] px-2 -my-2 -mr-2 text-sm font-medium text-blueprint hover:underline"
          >
            {editing ? 'Tutup' : 'Ubah'}
          </button>
        )}
      </div>

      {!editing && hasNext && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm font-medium text-ink break-words min-w-0">{project.nextAction || '(tanpa judul)'}</span>
          {project.nextActionOwner && <span className="text-sm text-inkmute">PIC {project.nextActionOwner}</span>}
          {project.nextActionDue && (
            <Pill tone={dueTone}>{fmtShort(project.nextActionDue)} · {dueText(dueDays).toLowerCase()}</Pill>
          )}
        </div>
      )}

      {!editing && !hasNext && (
        writable ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full min-h-[44px] rounded-md border border-dashed border-line text-sm font-medium text-blueprint hover:border-blueprint hover:bg-blueprint/5 transition-colors"
          >
            + Tambah langkah berikutnya
          </button>
        ) : (
          <p className="text-sm text-inkmute">Belum ada langkah berikutnya.</p>
        )
      )}

      {editing && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-inkmute">
            Satu hal konkret yang harus terjadi berikutnya, siapa yang mengerjakan, dan kapan. Tampil di halaman Hari Ini saat mendekati tanggalnya.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px_170px] gap-4">
            <div className={field}>
              <label htmlFor={`${uid}-action`} className={labelCls}>Langkah berikutnya</label>
              <input
                id={`${uid}-action`}
                className="input"
                maxLength={200}
                placeholder="ex: Kirim revisi P&ID ke client"
                value={project.nextAction || ''}
                onChange={(e) => update('nextAction', e.target.value)}
                autoFocus
              />
            </div>
            <div className={field}>
              <label htmlFor={`${uid}-owner`} className={labelCls}>PIC (siapa)</label>
              <PicInput id={`${uid}-owner`} value={project.nextActionOwner} onChange={(v) => update('nextActionOwner', v)} showDivision />
            </div>
            <div className={field}>
              <label htmlFor={`${uid}-due`} className={labelCls}>Target tanggal</label>
              <input id={`${uid}-due`} type="date" className="input" value={project.nextActionDue || ''} onChange={(e) => update('nextActionDue', e.target.value)} />
            </div>
          </div>

          <div className={field}>
            <label htmlFor={`${uid}-blocker`} className={labelCls}>Hambatan (kosongkan kalau tidak ada)</label>
            <input
              id={`${uid}-blocker`}
              className="input"
              maxLength={200}
              placeholder="ex: Menunggu izin impor membran, menunggu pembayaran DP"
              value={project.blocker || ''}
              onChange={(e) => update('blocker', e.target.value)}
            />
            {project.blocker && (
              <p className="text-xs text-inkmute">Project ditandai <b className="text-rust">Terhambat</b> di daftar, papan kanban, dan halaman Hari Ini sampai kolom ini dikosongkan.</p>
            )}
          </div>

          {hasNext && (
            <div>
              <button type="button" onClick={finishStep} className="btn btn-secondary text-teal">Langkah ini selesai</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

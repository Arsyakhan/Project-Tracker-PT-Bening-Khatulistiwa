import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { api } from '../lib/api';
import useCachedResource from '../lib/useCachedResource';
import useProjects from '../lib/useProjects';
import { clearCache } from '../lib/persistedCache';
import { canWrite, canDelete } from '../lib/roles';
import PageHead from '../components/PageHead';
import RefreshStatus from '../components/RefreshStatus';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { Pill } from '../components/Badges';
import { copyText, fmtShort, todayIso } from '../lib/meetings';
import {
  PROC_STATUSES, OPEN_STATUSES, SHIPMENT_OPTIONS, isOpen, etaState, etaText, statusTone,
  emptyItem, itemPayload, groupItems, buildProcurementText,
} from '../lib/procurement';

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-inkmute font-medium">{label}</span>
      {children}
    </label>
  );
}

function EtaPill({ it }) {
  const { state } = etaState(it);
  if (state === 'none') return <span className="text-xs text-inkmute/70">ETA belum ada</span>;
  const tone = state === 'late' ? 'rust' : state === 'soon' ? 'amber' : 'neutral';
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Pill tone={tone}>{etaText(it)}</Pill>
      {isOpen(it) && <span className="text-[11px] text-inkmute tnum">{fmtShort(it.eta)}</span>}
    </span>
  );
}

// ---------- Form tambah / ubah ----------
function ItemModal({ initial, projects, saving, onSave, onClose }) {
  const [it, setIt] = useState(initial);
  const firstRef = useRef(null);
  const set = (k, v) => setIt((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (it.item.trim() && !saving) onSave(it); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [it, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEdit = !!it.id;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Ubah barang' : 'Tambah barang'} className="bg-panel border border-line shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-lg">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-panel z-10">
          <h2 className="font-display font-semibold text-ink">{isEdit ? 'Ubah barang' : 'Tambah barang'}</h2>
          <button onClick={onClose} className="text-inkmute hover:text-ink text-sm px-2 h-8" aria-label="Tutup">Tutup</button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama barang *" className="sm:col-span-2">
            <input ref={firstRef} className="input" placeholder="ex: Membran ROPP, Pompa CNP, Pressure Vessel" value={it.item} onChange={(e) => set('item', e.target.value)} />
          </Field>
          <Field label="Terkait project">
            <select className="input" value={it.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">Tidak terkait project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
          </Field>
          <Field label="Untuk (kalau bukan project di Tracker)">
            <input className="input" placeholder="ex: Sago, HPCL, Stok gudang" value={it.forLabel} onChange={(e) => set('forLabel', e.target.value)} disabled={!!it.projectId} />
          </Field>
          <Field label="Jumlah (qty)">
            <input className="input" placeholder="ex: 6 unit" value={it.qty} onChange={(e) => set('qty', e.target.value)} />
          </Field>
          <Field label="Vendor / supplier">
            <input className="input" placeholder="ex: ROPP, Mr. Chia" value={it.vendor} onChange={(e) => set('vendor', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={it.status} onChange={(e) => set('status', e.target.value)}>
              {PROC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pengiriman">
            <input className="input" list="shipment-options" placeholder="Lokal / Sea freight / ..." value={it.shipment} onChange={(e) => set('shipment', e.target.value)} />
            <datalist id="shipment-options">{SHIPMENT_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Tanggal order">
            <input type="date" className="input" value={it.orderDate} onChange={(e) => set('orderDate', e.target.value)} />
          </Field>
          <Field label="ETA (perkiraan tiba)">
            <input type="date" className="input" value={it.eta} onChange={(e) => set('eta', e.target.value)} />
          </Field>
          {(it.status === 'Diterima' || it.status === 'Tiba sebagian') && (
            <Field label="Tanggal diterima (kosong = hari ini)">
              <input type="date" className="input" value={it.receivedDate} onChange={(e) => set('receivedDate', e.target.value)} />
            </Field>
          )}
          <Field label="No. PO ke vendor">
            <input className="input" value={it.poRef} onChange={(e) => set('poRef', e.target.value)} />
          </Field>
          <Field label="Catatan (freight, kendala, dll.)" className="sm:col-span-2">
            <textarea className="input" rows={3} value={it.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-3 sticky bottom-0 bg-panel">
          <span className="hidden sm:inline text-xs text-inkmute mr-auto">Ctrl+Enter untuk simpan</span>
          <button onClick={onClose} className="text-sm font-medium text-inkmute hover:text-ink px-3 h-9">Batal</button>
          <button
            onClick={() => onSave(it)}
            disabled={saving || !it.item.trim()}
            className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Tambah barang'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Halaman ----------
export default function ProcurementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role || 'admin'; // pengecekan sebenarnya di server; ini hanya cerminan tampilan
  const writable = canWrite(role);
  const deletable = canDelete(role);
  const { showToast } = useToast();

  const { data: items, error, staleError, refreshing, reload } = useCachedResource('procurement', () => api.getProcurement());
  const { projects } = useProjects();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // open | all | <status>
  const [projectFilter, setProjectFilter] = useState(''); // '' | '__none' | projectId
  const [onlyLate, setOnlyLate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Buka dari link project: /procurement?project=<id>
  useEffect(() => {
    if (router.isReady && typeof router.query.project === 'string') setProjectFilter(router.query.project);
  }, [router.isReady, router.query.project]);

  const projectsById = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p])), [projects]);
  const projectList = useMemo(() => (projects || []).slice().sort((a, b) => String(a.projectName).localeCompare(String(b.projectName))), [projects]);
  const today = todayIso();

  const all = items || [];
  const open = all.filter(isOpen);
  const lateCount = open.filter((i) => etaState(i, today).state === 'late').length;
  const soonCount = open.filter((i) => etaState(i, today).state === 'soon').length;
  const doneCount = all.filter((i) => i.status === 'Diterima').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((it) => {
      if (statusFilter === 'open' && !isOpen(it)) return false;
      if (statusFilter !== 'open' && statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (projectFilter === '__none' && it.projectId) return false;
      if (projectFilter && projectFilter !== '__none' && it.projectId !== projectFilter) return false;
      if (onlyLate && etaState(it, today).state !== 'late') return false;
      if (q) {
        const pn = projectsById[it.projectId]?.projectName || '';
        const hay = [it.item, it.vendor, it.forLabel, it.poRef, it.notes, it.qty, pn].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, query, statusFilter, projectFilter, onlyLate, projectsById, today]);

  const groups = useMemo(() => groupItems(filtered, projectsById), [filtered, projectsById]);

  async function saveItem(it, { quiet = false } = {}) {
    setSaving(true);
    try {
      await api.saveProcurementItem({ id: it.id || undefined, baseVersion: it.version, ...itemPayload(it) });
      clearCache('procurement');
      await reload();
      if (!quiet) showToast(it.id ? 'Barang diperbarui.' : 'Barang ditambahkan.', 'success');
      setEditing(null);
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(it, status) {
    if (busyId || status === it.status) return;
    setBusyId(it.id);
    try {
      await api.saveProcurementItem({ id: it.id, baseVersion: it.version, ...itemPayload({ ...it, status }) });
      clearCache('procurement');
      await reload();
      showToast(`${it.item}: ${status}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete() {
    const it = deleting;
    setDeleting(null);
    try {
      await api.deleteProcurementItem({ id: it.id });
      clearCache('procurement');
      await reload();
      showToast('Barang dihapus.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function copyRecap() {
    const ok = await copyText(buildProcurementText(filtered, projectsById));
    showToast(ok ? 'Rekap disalin. Tinggal tempel di WhatsApp.' : 'Gagal menyalin teks.', ok ? 'success' : 'error');
  }

  const filtersActive = query || statusFilter !== 'open' || projectFilter || onlyLate;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Pengadaan" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Pengadaan Material</h1>
          <p className="text-sm text-inkmute mt-1">Pantau barang yang dibeli dan ditunggu, per project maupun lintas project.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshStatus refreshing={refreshing && !!items} staleError={staleError} />
          <button
            type="button"
            onClick={copyRecap}
            disabled={!items || filtered.filter(isOpen).length === 0}
            className="border border-line rounded-md px-4 h-9 text-sm font-medium text-ink bg-panel hover:border-blueprint hover:text-blueprint disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Salin rekap untuk WhatsApp
          </button>
          {writable && (
            <button
              type="button"
              onClick={() => setEditing(emptyItem(projectFilter && projectFilter !== '__none' ? projectFilter : ''))}
              className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 h-9 text-sm font-medium transition-colors"
            >
              + Tambah barang
            </button>
          )}
        </div>
      </div>

      {error && !items ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-rust">Gagal memuat data pengadaan: {error}</div>
      ) : !items ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-lg h-20 w-full" />
          <div className="skeleton-shimmer rounded-lg h-56 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Belum datang', value: open.length, tone: 'text-ink' },
              { label: 'Terlambat', value: lateCount, tone: lateCount > 0 ? 'text-rust' : 'text-teal' },
              { label: `Tiba ≤ 7 hari`, value: soonCount, tone: soonCount > 0 ? 'text-amber' : 'text-ink' },
              { label: 'Sudah diterima', value: doneCount, tone: 'text-teal' },
            ].map((c) => (
              <div key={c.label} className="bg-panel border border-line rounded-lg p-4 shadow-sm">
                <p className="text-xs text-inkmute">{c.label}</p>
                <p className={`font-data tnum text-2xl font-semibold mt-1 ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-panel border border-line rounded-lg p-3 sm:p-4 flex flex-col gap-3 shadow-sm">
            <input type="search" className="input" placeholder="Cari barang, vendor, project, atau catatan..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto !min-h-[36px] !py-1" aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="open">Belum selesai</option>
                <option value="all">Semua status</option>
                {PROC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="input !w-auto !min-h-[36px] !py-1 max-w-[260px]" aria-label="Filter project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">Semua project</option>
                <option value="__none">Tanpa project</option>
                {projectList.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
              </select>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} />
                Hanya yang terlambat
              </label>
              {filtersActive && (
                <button type="button" onClick={() => { setQuery(''); setStatusFilter('open'); setProjectFilter(''); setOnlyLate(false); }} className="text-sm font-medium text-blueprint hover:underline ml-auto">
                  Reset filter
                </button>
              )}
            </div>
          </div>

          {all.length === 0 ? (
            <div className="bg-panel border border-dashed border-line rounded-lg p-10 text-center">
              <p className="text-sm font-medium text-ink">Belum ada barang yang dicatat</p>
              <p className="text-xs text-inkmute mt-1">{writable ? 'Klik "Tambah barang" untuk mulai, mis. membran ROPP atau pompa yang sedang ditunggu.' : 'Admin atau Editor dapat menambahkan barang.'}</p>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-inkmute text-center py-10">Tidak ada barang yang cocok dengan filter.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g) => {
                const gLate = g.items.filter((i) => etaState(i, today).state === 'late').length;
                return (
                  <section key={g.key} className="bg-panel border border-line rounded-lg shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-canvas/60 border-b border-line flex flex-wrap items-center justify-between gap-2">
                      {g.projectId ? (
                        <Link href={`/projects/${encodeURIComponent(g.projectId)}`} className="font-display font-semibold text-ink hover:text-blueprint transition-colors">{g.title}</Link>
                      ) : (
                        <h2 className="font-display font-semibold text-ink">{g.title}</h2>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Pill tone="neutral">{g.items.length} barang</Pill>
                        {gLate > 0 && <Pill tone="rust" dot>{gLate} terlambat</Pill>}
                      </div>
                    </div>

                    <ul className="divide-y divide-line">
                      {g.items.map((it) => (
                        <li key={it.id} className="px-4 py-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_130px_auto] md:items-center">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${it.status === 'Batal' ? 'line-through text-inkmute' : 'text-ink'}`}>
                              {it.item}{it.qty && <span className="text-inkmute font-normal"> · {it.qty}</span>}
                            </p>
                            <p className="text-xs text-inkmute mt-0.5">
                              {[it.vendor, it.shipment, it.poRef && `PO ${it.poRef}`].filter(Boolean).join(' · ') || 'Vendor belum diisi'}
                            </p>
                            {it.notes && <p className="text-xs text-ink/80 mt-1 whitespace-pre-wrap break-words line-clamp-2">{it.notes}</p>}
                          </div>

                          {writable ? (
                            <select
                              className="input !min-h-[34px] !py-1 text-sm"
                              aria-label={`Status ${it.item}`}
                              value={it.status}
                              disabled={busyId === it.id}
                              onChange={(e) => quickStatus(it, e.target.value)}
                            >
                              {PROC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <Pill tone={statusTone(it.status)} dot>{it.status}</Pill>
                          )}

                          <div><EtaPill it={it} /></div>

                          <div className="flex items-center gap-3 md:justify-end text-sm">
                            {writable && isOpen(it) && (
                              <button type="button" onClick={() => quickStatus(it, 'Diterima')} disabled={busyId === it.id} className="font-medium text-teal hover:underline disabled:opacity-40 whitespace-nowrap">Diterima</button>
                            )}
                            {writable && <button type="button" onClick={() => setEditing(it)} className="font-medium text-blueprint hover:underline">Ubah</button>}
                            {deletable && <button type="button" onClick={() => setDeleting(it)} className="font-medium text-rust hover:underline">Hapus</button>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && <ItemModal initial={editing} projects={projectList} saving={saving} onSave={(it) => saveItem(it)} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={!!deleting}
        title="Hapus barang ini?"
        description={deleting ? `"${deleting.item}" akan dihapus dari daftar pengadaan. Isinya masih tercatat di tab Aktivitas.` : ''}
        confirmText="Ya, hapus"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

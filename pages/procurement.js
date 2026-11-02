import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { api } from '../lib/api';
import useCachedResource from '../lib/useCachedResource';
import useProjects from '../lib/useProjects';
import { clearCache } from '../lib/persistedCache';
import { canWrite } from '../lib/roles';
import PageHead from '../components/PageHead';
import RefreshStatus from '../components/RefreshStatus';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { Pill } from '../components/Badges';
import PageHeader from '../components/ui/PageHeader';
import StatStrip from '../components/ui/StatStrip';
import SearchField from '../components/ui/SearchField';
import Segmented from '../components/ui/Segmented';
import EmptyState from '../components/ui/EmptyState';
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
  if (state === 'none') return <span className="text-xs text-inkmute">ETA belum diisi</span>;
  const tone = state === 'late' ? 'rust' : state === 'soon' ? 'amber' : 'neutral';
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Pill tone={tone}>{etaText(it)}</Pill>
      {isOpen(it) && <span className="text-xs text-inkmute tnum">{fmtShort(it.eta)}</span>}
    </span>
  );
}

// Posisi barang di alur pengadaan: Perlu dibeli -> Sudah order -> Dalam pengiriman -> Diterima.
// "Tiba sebagian" berada di antara pengiriman dan diterima; "Batal" ditampilkan sebagai jalur abu-abu putus-putus.
const FLOW = ['Perlu dibeli', 'Sudah order', 'Dalam pengiriman', 'Diterima'];
function ProcSteps({ status }) {
  const cancelled = status === 'Batal';
  const pos = status === 'Tiba sebagian' ? 2.5 : FLOW.indexOf(status);
  const done = status === 'Diterima';
  return (
    <span className="flex items-center w-full px-0.5" aria-hidden="true">
      {FLOW.map((step, i) => {
        const reached = !cancelled && pos >= i;
        const current = !cancelled && (Math.floor(pos) === i);
        return (
          <span key={step} className={`flex items-center ${i < FLOW.length - 1 ? 'flex-1' : ''}`} title={step}>
            <span
              className={`block rounded-full shrink-0 ${current ? 'w-2.5 h-2.5 ring-[3px]' : 'w-2 h-2'} ${
                cancelled ? 'bg-line' : reached ? (done ? 'bg-teal ring-teal/20' : 'bg-blueprint ring-blueprint/20') : 'bg-panel border border-line'
              }`}
            />
            {i < FLOW.length - 1 && (
              <span
                className={`flex-1 h-0.5 mx-0.5 ${cancelled ? 'border-t border-dashed border-line h-0' : pos > i ? (done ? 'bg-teal' : 'bg-blueprint') : 'bg-line'}`}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

// ---------- Form tambah / ubah ----------
function ItemModal({ initial, projects, saving, canRemove, onRemove, onSave, onClose }) {
  const [it, setIt] = useState(initial);
  const firstRef = useRef(null);
  const set = (k, v) => setIt((x) => ({ ...x, [k]: v }));

  // Pintasan keyboard memakai ref supaya listener tidak dipasang ulang tiap ketikan.
  const live = useRef({ it, saving, onSave, onClose });
  live.current = { it, saving, onSave, onClose };

  // Fokus ke kolom pertama SEKALI saja saat modal dibuka (bukan tiap isi form berubah).
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      const cur = live.current;
      if (e.key === 'Escape') cur.onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (cur.it.item.trim() && !cur.saving) cur.onSave(cur.it); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isEdit = !!it.id;
  return (
    <div className="layer-scrim fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Ubah barang' : 'Tambah barang'} className="layer-sheet bg-panel border border-line shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-lg pb-[env(safe-area-inset-bottom)] sm:pb-0">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-panel z-10">
          <h2 className="font-display font-semibold text-ink">{isEdit ? 'Ubah barang' : 'Tambah barang'}</h2>
          <button onClick={onClose} className="text-inkmute hover:text-ink text-sm px-2 h-8 max-md:h-10" aria-label="Tutup">Tutup</button>
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
          <Field label="Untuk (jika bukan project di Tracker)">
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
          {isEdit && canRemove ? (
            <button type="button" onClick={() => onRemove(it)} className="text-sm font-medium text-rust hover:underline px-1 h-9 max-md:h-10 mr-auto">Hapus barang...</button>
          ) : (
            <span className="hidden sm:inline text-xs text-inkmute mr-auto">Ctrl+Enter untuk simpan</span>
          )}
          <button onClick={onClose} className="text-sm font-medium text-inkmute hover:text-ink px-3 h-9 max-md:h-10">Batal</button>
          <button
            onClick={() => onSave(it)}
            disabled={saving || !it.item.trim()}
            className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 max-md:h-10 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
  const deletable = writable; // editor & admin boleh menghapus barang; hanya project yang khusus admin
  const { showToast } = useToast();

  const { data: items, error, staleError, refreshing, reload } = useCachedResource('procurement', () => api.getProcurement());
  const { projects } = useProjects();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // open | all | <status>
  const [projectFilter, setProjectFilter] = useState(''); // '' | '__none' | projectId
  const [etaFilter, setEtaFilter] = useState(''); // '' | 'late' | 'soon'
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
      if (etaFilter && etaState(it, today).state !== etaFilter) return false;
      if (q) {
        const pn = projectsById[it.projectId]?.projectName || '';
        const hay = [it.item, it.vendor, it.forLabel, it.poRef, it.notes, it.qty, pn].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, query, statusFilter, projectFilter, etaFilter, projectsById, today]);

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
    showToast(ok ? 'Rekap disalin dan siap ditempel di WhatsApp.' : 'Gagal menyalin teks.', ok ? 'success' : 'error');
  }

  const filtersActive = query || statusFilter !== 'open' || projectFilter || etaFilter;
  function resetFilters() { setQuery(''); setStatusFilter('open'); setProjectFilter(''); setEtaFilter(''); }
  function pick(status, eta = '') { setStatusFilter(status); setEtaFilter(eta); }

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Pengadaan" />

      <PageHeader
        title="Pengadaan Material"
        meta="Pantau pembelian dan kedatangan material untuk setiap project."
        actions={
          <>
            <RefreshStatus refreshing={refreshing && !!items} staleError={staleError} />
            <button type="button" onClick={copyRecap} disabled={!items || filtered.filter(isOpen).length === 0} className="btn btn-secondary">
              Salin rekap untuk WhatsApp
            </button>
            {writable && (
              <button
                type="button"
                onClick={() => setEditing(emptyItem(projectFilter && projectFilter !== '__none' ? projectFilter : ''))}
                className="btn btn-primary"
              >
                + Tambah barang
              </button>
            )}
          </>
        }
      />

      {error && !items ? (
        <div className="bg-panel border border-line rounded-xl p-5 text-sm text-rust" role="alert">Gagal memuat data pengadaan: {error}</div>
      ) : !items ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-xl h-[96px] w-full" />
          <div className="skeleton-shimmer rounded-xl h-56 w-full" />
        </div>
      ) : (
        <>
          <StatStrip
            label="Ringkasan pengadaan"
            items={[
              { key: 'open', label: 'Belum datang', value: open.length, tone: 'muted', hint: 'Semua yang belum selesai', onClick: () => pick('open'), active: statusFilter === 'open' && !etaFilter },
              { key: 'late', label: 'Terlambat', value: lateCount, tone: 'rust', dim: lateCount === 0, hint: 'ETA sudah lewat', onClick: () => pick('open', 'late'), active: etaFilter === 'late' },
              { key: 'soon', label: 'Tiba dalam 7 hari', value: soonCount, tone: 'amber', dim: soonCount === 0, hint: 'Siapkan penerimaan', onClick: () => pick('open', 'soon'), active: etaFilter === 'soon' },
              { key: 'done', label: 'Sudah diterima', value: doneCount, tone: 'teal', hint: 'Lihat riwayat', onClick: () => pick('Diterima'), active: statusFilter === 'Diterima' && !etaFilter },
            ]}
          />

          <div className="bg-panel border border-line rounded-xl px-3 py-3 sm:px-4 flex flex-col lg:flex-row lg:items-center gap-2.5 shadow-sm">
            <SearchField className="lg:flex-1 lg:max-w-sm" value={query} onChange={setQuery} placeholder="Cari barang, vendor, project, atau catatan..." label="Cari barang pengadaan" />
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto max-md:!w-full !min-h-[36px] max-md:!min-h-[40px] !py-1" aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="open">Belum selesai</option>
                <option value="all">Semua status</option>
                {PROC_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
              <select className="input !w-auto max-md:!w-full !min-h-[36px] max-md:!min-h-[40px] !py-1 md:max-w-[240px]" aria-label="Filter project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">Semua project</option>
                <option value="__none">Tanpa project</option>
                {projectList.map((pr) => <option key={pr.id} value={pr.id}>{pr.projectName}</option>)}
              </select>
              <Segmented
                size="sm"
                label="Filter ETA"
                value={etaFilter}
                onChange={setEtaFilter}
                options={[{ key: '', label: 'Semua ETA' }, { key: 'late', label: 'Terlambat' }, { key: 'soon', label: '≤ 7 hari' }]}
              />
            </div>
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="tap text-sm font-medium text-blueprint hover:underline lg:ml-auto whitespace-nowrap self-start lg:self-center">
                Reset filter
              </button>
            )}
          </div>

          {all.length === 0 ? (
            <EmptyState title="Belum ada barang yang dicatat">
              {writable ? 'Klik "Tambah barang" untuk mencatat pembelian, misalnya pressure vessel atau pompa yang sedang dipesan.' : 'Admin atau Editor dapat menambahkan barang.'}
            </EmptyState>
          ) : groups.length === 0 ? (
            <EmptyState title="Tidak ada barang yang cocok dengan filter" dashed={false} action={<button type="button" onClick={resetFilters} className="btn btn-secondary">Reset filter</button>} />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="hidden md:grid grid-cols-[minmax(0,1fr)_200px_150px_150px] gap-4 px-5 -mb-2 text-xs font-semibold text-inkmute">
                <span>Barang</span><span>Status</span><span>ETA</span><span className="text-right">Aksi</span>
              </p>
              {groups.map((g) => {
                const gLate = g.items.filter((i) => etaState(i, today).state === 'late').length;
                const pr = g.projectId ? projectsById[g.projectId] : null;
                return (
                  <section key={g.key} className="bg-panel border border-line rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-canvas/50">
                      <div className="min-w-0">
                        {g.projectId ? (
                          <Link href={`/projects/${encodeURIComponent(g.projectId)}`} className="font-display font-semibold text-ink hover:text-blueprint transition-colors">{g.title}</Link>
                        ) : (
                          <h2 className="font-display font-semibold text-ink">{g.title}</h2>
                        )}
                        {pr && <p className="text-xs text-inkmute mt-0.5">{[pr.currentStage, pr.pic && `PIC ${pr.pic}`].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-inkmute tnum">{g.items.length} barang</span>
                        {gLate > 0 && <Pill tone="rust" dot>{gLate} terlambat</Pill>}
                      </div>
                    </div>

                    <ul className="divide-y divide-line">
                      {g.items.map((it) => (
                        <li key={it.id} className="px-5 py-3.5 grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1fr)_200px_150px_150px] md:items-center">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${it.status === 'Batal' ? 'line-through text-inkmute' : 'text-ink'}`}>
                              {it.item}{it.qty && <span className="text-inkmute font-normal"> · {it.qty}</span>}
                            </p>
                            <p className="text-xs text-inkmute mt-0.5">
                              {[it.vendor, it.shipment, it.poRef && `PO ${it.poRef}`].filter(Boolean).join(' · ') || 'Vendor belum diisi'}
                            </p>
                            {it.notes && <p className="text-xs text-ink/80 mt-1 whitespace-pre-wrap break-words line-clamp-2">{it.notes}</p>}
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <ProcSteps status={it.status} />
                            {writable ? (
                              <select
                                className="input !min-h-[32px] max-md:!min-h-[40px] !py-0.5 !px-2 text-sm"
                                aria-label={`Status ${it.item}`}
                                value={it.status}
                                disabled={busyId === it.id}
                                onChange={(e) => quickStatus(it, e.target.value)}
                              >
                                {PROC_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                              </select>
                            ) : (
                              <Pill tone={statusTone(it.status)} dot className="self-start">{it.status}</Pill>
                            )}
                          </div>

                          <div><EtaPill it={it} /></div>

                          <div className="flex items-center gap-2 md:justify-end text-sm">
                            {writable && isOpen(it) && (
                              <button type="button" onClick={() => quickStatus(it, 'Diterima')} disabled={busyId === it.id} className="btn btn-secondary !min-h-[32px] !py-1 max-md:!min-h-[40px] !px-3 text-teal disabled:opacity-40">Diterima</button>
                            )}
                            {writable && <button type="button" onClick={() => setEditing(it)} className="btn btn-ghost !min-h-[32px] !py-1 max-md:!min-h-[40px] !px-3">Ubah</button>}
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

      {editing && (
        <ItemModal
          initial={editing}
          projects={projectList}
          saving={saving}
          canRemove={deletable}
          onRemove={(it) => { setEditing(null); setDeleting(it); }}
          onSave={(it) => saveItem(it)}
          onClose={() => setEditing(null)}
        />
      )}

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

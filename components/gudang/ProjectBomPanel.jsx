import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { gudangApi, BOM_STATUS, TAHAP_MATERIAL, tahapMaterial, ringkasMaterial, barangLabel, fmtQty, fmtWaktu } from '../../lib/gudang';
import Panel from '../ui/Panel';
import StatusDot from './StatusDot';

// Urutan bar dari kiri: yang sudah sampai teknisi lebih dulu. Daftar barang diurutkan sebaliknya (TAHAP_MATERIAL).
const BAR_ORDER = ['diserahkan', 'siap', 'dipesan', 'diusulkan', 'kurang'];
const BAR_COLOR = { diserahkan: 'bg-teal', siap: 'bg-blueprint', dipesan: 'bg-blueprint/40', diusulkan: 'bg-amber', kurang: 'bg-rust' };
const URUT = Object.keys(TAHAP_MATERIAL);
const TAMPIL_AWAL = 8;

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtTgl = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// BOM dan status material satu project (tab Ringkasan detail project): posisi setiap barang dari kebutuhan BOM sampai
// di tangan teknisi. Data dari modul gudang (Supabase); kalau gagal dimuat, halaman project tetap jalan.
export default function ProjectBomPanel({ projectId, writable }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [semua, setSemua] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!projectId) return undefined;
    gudangApi.getStatusMaterial(projectId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [projectId]);

  const boms = data?.boms || [];
  const items = useMemo(() => (data?.items || [])
    .map((r) => ({ ...r, tahap: tahapMaterial(r) }))
    .sort((a, b) => URUT.indexOf(a.tahap) - URUT.indexOf(b.tahap) || barangLabel(a.barang).localeCompare(barangLabel(b.barang))), [data]);
  const ringkas = useMemo(() => ringkasMaterial(items), [items]);
  const finalCount = boms.filter((b) => b.status === 'final').length;
  const bomJudul = Object.fromEntries(boms.map((b) => [b.id, `${b.judul} Rev. ${b.revisi}`]));
  const shown = items.filter((r) => !filter || r.tahap === filter);
  const visible = semua ? shown : shown.slice(0, TAMPIL_AWAL);
  const today = todayIso();
  const baru = `/gudang/bom?baru=1&project=${encodeURIComponent(projectId)}`;

  return (
    <Panel
      title="BOM & material"
      hint="Posisi setiap barang di BOM yang berlaku, dari kebutuhan sampai di tangan teknisi."
      aside={writable && data && <Link href={baru} className="tap text-sm font-medium text-blueprint hover:underline">Buat BOM</Link>}
      flush
    >
      {error ? (
        <p className="px-5 py-4 text-sm text-inkmute">Status material belum bisa dimuat ({error}).</p>
      ) : !data ? (
        <div className="px-5 py-4 flex flex-col gap-3"><div className="skeleton-shimmer rounded-lg h-10" /><div className="skeleton-shimmer rounded-lg h-24" /></div>
      ) : boms.length === 0 ? (
        <p className="px-5 py-4 text-sm text-inkmute">
          Belum ada BOM untuk project ini.{writable ? ' Mulai dari salinan BOM lama project yang mirip supaya lebih cepat.' : ''}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line border-b border-line">
            {boms.map((b) => (
              <li key={b.id}>
                <Link href={`/gudang/bom/${b.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3 hover:bg-canvas/50">
                  <span className="min-w-0">
                    <span className="text-ink">{b.judul}</span> <span className="text-inkmute">· Rev. {b.revisi}</span>
                    <span className="block text-xs text-inkmute mt-0.5">{b.jumlah_baris} baris · diubah {fmtWaktu(b.diubah_pada)}</span>
                  </span>
                  <StatusDot status={BOM_STATUS[b.status]} />
                </Link>
              </li>
            ))}
          </ul>

          {finalCount === 0 ? (
            <p className="px-5 py-4 text-sm text-inkmute">Status material tampil setelah BOM diterbitkan.</p>
          ) : items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-inkmute">BOM yang berlaku belum punya barang dengan jumlah.</p>
          ) : (
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink">
                  <span className="font-display text-2xl font-semibold tnum">{ringkas.diserahkan}</span>
                  <span className="text-inkmute"> dari {items.length} barang sudah di tangan teknisi</span>
                </p>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-line" role="img"
                  aria-label={BAR_ORDER.map((k) => `${TAHAP_MATERIAL[k].label} ${ringkas[k]}`).join(', ')}>
                  {BAR_ORDER.map((k) => ringkas[k] > 0 && (
                    <span key={k} className={BAR_COLOR[k]} style={{ width: `${(ringkas[k] / items.length) * 100}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring menurut tahap">
                  {BAR_ORDER.filter((k) => ringkas[k] > 0).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={filter === k}
                      onClick={() => { setFilter(filter === k ? '' : k); setSemua(false); }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 h-8 max-md:h-9 text-xs transition-colors ${filter === k ? 'border-ink bg-ink/5 text-ink' : 'border-line text-inkmute hover:text-ink'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${BAR_COLOR[k]}`} aria-hidden="true" />
                      {TAHAP_MATERIAL[k].pendek}
                      <span className="tnum font-semibold text-ink">{ringkas[k]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ul className="divide-y divide-line border border-line rounded-lg">
                {visible.map((r) => {
                  const lewat = r.dipesan > 0 && r.eta && r.eta < today;
                  const angka = [
                    `butuh ${fmtQty(r.butuh)}`,
                    r.diserahkan > 0 && `di teknisi ${fmtQty(r.diserahkan)}`,
                    r.disisihkan > 0 && `siap ${fmtQty(r.disisihkan)}`,
                    r.diusulkan > 0 && `diusulkan ${fmtQty(r.diusulkan)}`,
                  ].filter(Boolean);
                  return (
                    <li key={`${r.bom_id}|${r.barang_kode}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-ink">{barangLabel(r.barang || { nama: r.barang_kode })}</span>
                        <span className="block text-xs text-inkmute">
                          <span className="font-data">{r.barang_kode}</span>
                          {r.barang?.merek ? ` · ${r.barang.merek}` : ''}
                          {finalCount > 1 ? ` · ${bomJudul[r.bom_id] || ''}` : ''}
                        </span>
                        <span className="block text-xs text-inkmute mt-1 tnum">
                          {angka.join(' · ')}
                          {r.dipesan > 0 && (
                            <>
                              {' · '}dipesan {fmtQty(r.dipesan)}
                              {r.eta && <span className={lewat ? 'text-rust' : ''}> (ETA {fmtTgl(r.eta)}{lewat ? ', lewat' : ''})</span>}
                            </>
                          )}
                          {r.kurang > 0 && <span className="text-rust"> · kurang {fmtQty(r.kurang)} {r.satuan || ''}</span>}
                        </span>
                      </span>
                      <StatusDot status={TAHAP_MATERIAL[r.tahap]} className="sm:mt-1" />
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {shown.length > TAMPIL_AWAL ? (
                  <button type="button" className="tap text-sm font-medium text-blueprint hover:underline" onClick={() => setSemua(!semua)}>
                    {semua ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${shown.length})`}
                  </button>
                ) : <span />}
                {writable && ringkas.siap > 0 && (
                  <Link href={`/gudang/serah-terima?baru=1&project=${encodeURIComponent(projectId)}`} className="btn btn-secondary">
                    Serahkan ke teknisi
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

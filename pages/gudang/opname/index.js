import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useCachedResource from '../../../lib/useCachedResource';
import { canWrite } from '../../../lib/roles';
import { gudangApi } from '../../../lib/gudang';
import { fmtDate, todayISO } from '../../../lib/projectHelpers';
import PageHead from '../../../components/PageHead';
import RefreshStatus from '../../../components/RefreshStatus';
import { SkeletonTable } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import EmptyState from '../../../components/ui/EmptyState';
import OpnameStatus from '../../../components/gudang/OpnameStatus';

const NEW_LOKASI = '__baru__';

function judulBawaan() {
  return `Stock opname ${fmtDate(todayISO())}`;
}

// Form "Mulai opname": judul, lokasi gudang (bisa menambah lokasi baru), tanggal, catatan.
function NewOpnameForm({ lokasi, onCancel, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({
    judul: judulBawaan(),
    lokasi_kode: lokasi[0]?.kode || NEW_LOKASI,
    tanggal: todayISO(),
    catatan: '',
    lokasiBaru: '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let lokasi_kode = form.lokasi_kode;
      if (lokasi_kode === NEW_LOKASI) {
        const created = await gudangApi.createLokasi({ nama: form.lokasiBaru });
        lokasi_kode = created.kode;
        showToast(`Lokasi ${created.nama} ditambahkan`);
      }
      const opname = await gudangApi.createOpname({ judul: form.judul, lokasi_kode, tanggal: form.tanggal, catatan: form.catatan });
      onCreated(opname);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Panel title="Mulai stock opname" hint="Satu sesi = satu lokasi gudang. Beberapa orang boleh menghitung di sesi yang sama.">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-inkmute font-medium">Judul</span>
          <input className="input" value={form.judul} onChange={set('judul')} required maxLength={120} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Lokasi gudang</span>
          <select className="input" value={form.lokasi_kode} onChange={set('lokasi_kode')} required>
            {lokasi.map((l) => <option key={l.kode} value={l.kode}>{l.nama}</option>)}
            <option value={NEW_LOKASI}>+ Tambah lokasi baru</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Tanggal opname</span>
          <input type="date" className="input" value={form.tanggal} onChange={set('tanggal')} required />
        </label>
        {form.lokasi_kode === NEW_LOKASI && (
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-inkmute font-medium">Nama lokasi baru</span>
            <input className="input" value={form.lokasiBaru} onChange={set('lokasiBaru')} required maxLength={80} placeholder="mis. Workshop" autoFocus />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-inkmute font-medium">Catatan (opsional)</span>
          <input className="input" value={form.catatan} onChange={set('catatan')} maxLength={500} placeholder="mis. Rak A sampai D" />
        </label>
        {error && <p className="text-sm text-rust sm:col-span-2" role="alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Membuat...' : 'Mulai menghitung'}</button>
        </div>
      </form>
    </Panel>
  );
}

// Daftar sesi stock opname. Hitungan baru menjadi stok setelah sesinya diposting.
export default function StockOpname() {
  const router = useRouter();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { data, error, staleError, refreshing } = useCachedResource('gudang-opname', () => gudangApi.listOpname());
  const [creating, setCreating] = useState(false);

  const header = (
    <PageHeader
      title="Stock Opname"
      meta="Hitung barang di gudang, lalu posting hasilnya sebagai stok. Barang yang tidak dihitung tidak berubah stoknya."
      actions={
        <>
          <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
          {writable && data && !creating && (
            <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">Mulai opname</button>
          )}
        </>
      }
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Stock Opname" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat stock opname: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Stock Opname" />
        {header}
        <SkeletonTable rows={4} />
      </div>
    );
  }

  const list = data.opname || [];
  const drafts = list.filter((o) => o.status === 'draf');

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Stock Opname" />
      {header}

      {creating && (
        <NewOpnameForm
          lokasi={data.lokasi || []}
          onCancel={() => setCreating(false)}
          onCreated={(o) => router.push(`/gudang/opname/${o.id}`)}
        />
      )}

      {drafts.length > 0 && !creating && (
        <p className="text-sm text-inkmute">
          {drafts.length === 1 ? 'Ada 1 sesi yang masih dihitung.' : `Ada ${drafts.length} sesi yang masih dihitung.`} Lanjutkan sesi itu kalau
          lokasinya sama, supaya barang tidak terhitung dua kali.
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="Belum ada stock opname"
          action={writable && !creating && <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">Mulai opname pertama</button>}
        >
          Opname pertama mengisi stok awal gudang. Sesudah itu stok berubah lewat barang masuk, keluar, dan opname berikutnya.
        </EmptyState>
      ) : (
        <Panel flush>
          <ul className="divide-y divide-line">
            {list.map((o) => (
              <li key={o.id}>
                <Link href={`/gudang/opname/${o.id}`} className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5 px-5 py-4 hover:bg-canvas/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{o.judul}</span>
                    <span className="block text-xs text-inkmute mt-0.5">
                      {(data.lokasi || []).find((l) => l.kode === o.lokasi_kode)?.nama || o.lokasi_kode} · {fmtDate(o.tanggal)} · dibuat {o.dibuat_oleh}
                    </span>
                  </span>
                  <span className="flex items-center justify-between sm:justify-end gap-6">
                    <span className="text-sm tnum text-ink whitespace-nowrap">{o.jumlah_barang} barang</span>
                    <span className="sm:w-36"><OpnameStatus status={o.status} /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

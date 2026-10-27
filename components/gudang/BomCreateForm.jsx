import { useEffect, useMemo, useState } from 'react';
import { gudangApi, BOM_STATUS } from '../../lib/gudang';
import { fmtDate } from '../../lib/projectHelpers';
import Panel from '../ui/Panel';
import Segmented from '../ui/Segmented';
import SearchField from '../ui/SearchField';

const ISI = [
  { key: 'kosong', label: 'Mulai kosong' },
  { key: 'arsip', label: 'Salin BOM lama' },
  { key: 'bom', label: 'Salin BOM project lain' },
];
const PENAWARAN = 'Penawaran (BOQ/BOM)';

function projectLabel(p) {
  return [p.projectName, p.poNumber].filter(Boolean).join(' · ');
}

function isFinished(p) {
  return p.status === 'Completed' || Number(p.stageProgress) >= 100;
}

// Form "Buat BOM": pilih project, judul, dan isi awal (kosong, salinan BOM lama dari Dropbox, atau salinan BOM lain).
export default function BomCreateForm({ projects, boms, defaultProjectId, onCancel, onCreated }) {
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [judul, setJudul] = useState('');
  const [judulEdited, setJudulEdited] = useState(false);
  const [jenis, setJenis] = useState('kosong');
  const [sumber, setSumber] = useState(null); // { files } dari getBomSumber
  const [sumberError, setSumberError] = useState(null);
  const [q, setQ] = useState('');
  const [semuaFile, setSemuaFile] = useState(false);
  const [fileId, setFileId] = useState('');
  const [lembar, setLembar] = useState([]);
  const [bomId, setBomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = projects || [];
  const project = list.find((p) => p.id === projectId);
  const berjalan = list.filter((p) => !isFinished(p));
  const selesai = list.filter(isFinished);

  const projectName = project?.projectName || '';
  useEffect(() => {
    if (!judulEdited) setJudul(projectName ? `BOM ${projectName}` : '');
  }, [projectName, judulEdited]);

  useEffect(() => {
    if (jenis !== 'arsip' || sumber) return;
    gudangApi.getBomSumber().then(setSumber).catch((e) => setSumberError(e.message));
  }, [jenis, sumber]);

  const files = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (sumber?.files || [])
      .filter((f) => semuaFile || (f.revisi_terakhir && f.jenis_sumber !== PENAWARAN))
      .filter((f) => {
        if (!words.length) return true;
        const t = `${f.project_label || ''} ${f.nama_file} ${f.revisi || ''}`.toLowerCase();
        return words.every((w) => t.includes(w));
      })
      .slice(0, 40);
  }, [sumber, q, semuaFile]);
  const file = (sumber?.files || []).find((f) => f.id === fileId);

  function pickFile(f) {
    setFileId(f.id);
    setLembar(f.lembar.map((l) => l.lembar));
  }

  const copyable = (boms || []).filter((b) => b.status !== 'diganti');
  const jumlahDisalin = file ? file.lembar.filter((l) => lembar.includes(l.lembar)).reduce((s, l) => s + l.jumlah_baris, 0) : 0;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!project) return setError('Pilih project untuk BOM ini.');
    if (jenis === 'arsip' && !file) return setError('Pilih file BOM lama yang akan disalin.');
    if (jenis === 'arsip' && !lembar.length) return setError('Pilih minimal satu lembar yang disalin.');
    if (jenis === 'bom' && !bomId) return setError('Pilih BOM yang akan disalin.');
    setBusy(true);
    try {
      const r = await gudangApi.createBom({
        project_id: project.id,
        project_nama: project.projectName,
        judul,
        jenis,
        file_id: jenis === 'arsip' ? fileId : undefined,
        lembar: jenis === 'arsip' ? lembar : undefined,
        bom_id: jenis === 'bom' ? bomId : undefined,
      });
      onCreated(r.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Panel title="Buat BOM" hint="BOM disusun per project. Setiap baris memakai kode dari Katalog Barang, jadi stok bisa dicek otomatis.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Project</span>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="" disabled>{projects ? 'Pilih project' : 'Memuat project...'}</option>
              {berjalan.length > 0 && (
                <optgroup label="Project berjalan">
                  {berjalan.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
                </optgroup>
              )}
              {selesai.length > 0 && (
                <optgroup label="Project selesai">
                  {selesai.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Judul BOM</span>
            <input
              className="input"
              value={judul}
              onChange={(e) => { setJudul(e.target.value); setJudulEdited(true); }}
              required
              maxLength={150}
              placeholder="mis. BOM RO 30 MPH"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm text-inkmute font-medium">Isi awal</span>
          <Segmented label="Isi awal BOM" className="max-md:flex-wrap" value={jenis} onChange={setJenis} options={ISI} />

          {jenis === 'kosong' && <p className="text-xs text-inkmute">BOM dibuat tanpa baris. Barang ditambahkan satu per satu dari katalog.</p>}

          {jenis === 'arsip' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-inkmute">
                BOM lama dari Dropbox yang sudah diimpor. Pilih project yang mirip, lalu sesuaikan jumlah dan barangnya. Harga tidak ikut disalin.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <SearchField className="sm:w-96" value={q} onChange={setQ} placeholder="Cari project atau nama file, mis. RO 30" label="Cari BOM lama" />
                <label className="flex items-center gap-2 text-sm text-inkmute">
                  <input type="checkbox" checked={semuaFile} onChange={(e) => setSemuaFile(e.target.checked)} />
                  Tampilkan revisi lama dan penawaran
                </label>
              </div>
              {sumberError && <p className="text-sm text-rust">BOM lama gagal dimuat: {sumberError}</p>}
              {!sumber && !sumberError && <div className="skeleton-shimmer rounded-lg h-32" />}
              {sumber && (
                <ul className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden max-h-80 overflow-y-auto" role="listbox" aria-label="File BOM lama">
                  {files.length === 0 && <li className="px-4 py-3 text-sm text-inkmute">Tidak ada file yang cocok.</li>}
                  {files.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={f.id === fileId}
                        onClick={() => pickFile(f)}
                        className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 ${f.id === fileId ? 'bg-blueprint/10' : 'hover:bg-canvas/60'}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-ink">{f.project_label || f.nama_file}</span>
                          <span className="block text-xs text-inkmute mt-0.5 truncate">
                            {f.nama_file}{f.tanggal_ubah ? ` · ${fmtDate(f.tanggal_ubah)}` : ''}{f.revisi_terakhir ? '' : ' · revisi lama'}
                          </span>
                        </span>
                        <span className="text-xs text-inkmute whitespace-nowrap text-right">
                          {f.jumlah_baris} baris
                          {f.jenis_sumber !== 'BOM project' && <span className="block">{f.jenis_sumber}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {file && (
                <fieldset className="rounded-lg border border-line px-4 py-3">
                  <legend className="px-1 text-xs font-medium text-inkmute">Lembar yang disalin dari {file.nama_file}</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1">
                    {file.lembar.map((l) => (
                      <label key={l.lembar} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={lembar.includes(l.lembar)}
                          onChange={(e) => setLembar((cur) => (e.target.checked ? [...cur, l.lembar] : cur.filter((x) => x !== l.lembar)))}
                        />
                        {l.lembar} <span className="text-inkmute">({l.jumlah_baris} baris)</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-inkmute mt-2">{jumlahDisalin} baris akan disalin. Lembar di BOM lama saling melengkapi (mis. BOM, Electrical, Fitting list).</p>
                </fieldset>
              )}
            </div>
          )}

          {jenis === 'bom' && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-inkmute font-medium">BOM yang disalin</span>
              <select className="input" value={bomId} onChange={(e) => setBomId(e.target.value)} required>
                <option value="" disabled>{copyable.length ? 'Pilih BOM' : 'Belum ada BOM lain di Bening Hub'}</option>
                {copyable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.project_nama} · {b.judul} · Rev. {b.revisi} ({(BOM_STATUS[b.status] || {}).label || b.status})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && <p className="text-sm text-rust" role="alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Membuat...' : 'Buat BOM'}</button>
        </div>
      </form>
    </Panel>
  );
}

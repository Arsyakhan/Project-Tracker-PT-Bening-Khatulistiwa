import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { FieldRow } from './DocFormControls';
import { sectionProgress } from '../../lib/docgen/specs';

// Kolom nama filter tidak ditampilkan: judul butir diambil dari modulnya (Birm / MMF / ACF).
const HIDDEN_IDS = new Set(['f1_type', 'f2_type']);

// Isi modul itu di Teknologi project apa adanya (kapasitas + teks Detail Spesifikasi), supaya terlihat utuh di form ini.
// `mod` kosong = peralatan ditambahkan khusus untuk dokumen ini (belum dicentang di Teknologi).
function TechSource({ mod, projectHref }) {
  const cap = mod && String(mod.cap ?? '').trim() ? `${String(mod.cap).trim()}${mod.unit ? ` ${mod.unit}` : ''}` : '';
  const detail = mod ? String(mod.detail ?? '').trim() : '';
  return (
    <div className="sm:col-span-2 min-w-0 rounded-md border border-line bg-canvas/60 p-3 text-xs" data-testid="ho-tech">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-inkmute">Isi di Teknologi</span>
        {cap && <span className="text-ink font-data tnum" data-testid="ho-tech-cap">Kapasitas {cap}</span>}
        {projectHref && (
          <Link href={projectHref} className="text-blueprint hover:underline tap ml-auto">Lengkapi di Teknologi</Link>
        )}
      </div>
      {!mod && <p className="mt-1 text-inkmute">Modul ini belum tercatat di Teknologi project (ditambahkan khusus untuk dokumen ini, atau berasal dari data lama).</p>}
      {mod && detail && (
        <>
          <pre className="mt-2 max-w-full whitespace-pre-wrap break-words font-data text-ink max-h-40 overflow-auto" data-testid="ho-tech-detail">{detail}</pre>
          <p className="mt-2 text-inkmute">Isi Detail yang tidak punya kolom di bawah ikut tercetak sebagai baris tambahan (lihat Pratinjau isi dokumen).</p>
        </>
      )}
      {mod && !detail && (
        <p className="mt-1 text-inkmute">
          {cap ? 'Baru kapasitasnya yang tercatat; belum ada Detail Spesifikasi.' : 'Baru dicentang; belum ada kapasitas maupun Detail Spesifikasi.'} Kolom yang kosong dicetak &quot;.......&quot;.
        </p>
      )}
    </div>
  );
}

// Daftar peralatan untuk dokumen Hand Over: satu seksi = satu butir di dokumen, urut mengikuti alur Teknologi.
// Isinya sama dengan tab Spesifikasi Peralatan (kolom yang bisa diturunkan dari Teknologi sudah terisi otomatis).
// Centang "Cetak" untuk menyertakan butir itu di dokumen; kolom yang dikosongkan dicetak "......." supaya bisa
// dilengkapi tangan di Google Docs.
export default function EquipmentSections({ sections, values, onChange, excluded, onToggle, autoIds, scrollTo, tech, projectHref }) {
  const auto = autoIds || new Set();
  const lastScrolled = useRef(null);

  // Setelah peralatan ditambah, seksi barunya dibuka dan digulir ke layar.
  useEffect(() => {
    if (!scrollTo || lastScrolled.current === scrollTo) return;
    const el = document.getElementById(`ho-sec-${scrollTo}`);
    if (!el) return;
    lastScrolled.current = scrollTo;
    el.open = true;
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, idx) => {
        const off = excluded.has(section.key);
        const p = sectionProgress(section, values);
        const percent = p.total > 0 ? Math.round((p.filled / p.total) * 100) : 0;
        const fields = section.fields.filter((f) => !HIDDEN_IDS.has(f.id));
        const isAuto = (f) => (f.type === 'group' ? f.items.some((it) => auto.has(it.id)) : auto.has(f.id));
        return (
          <details
            key={section.key}
            id={`ho-sec-${section.key}`}
            data-testid="ho-section"
            data-section={section.key}
            open={idx === 0 && !off}
            className={`bg-panel border border-line rounded-lg overflow-hidden group scroll-mt-20 ${off ? 'opacity-70' : ''}`}
          >
            <summary className="cursor-pointer select-none flex items-center gap-3 px-4 py-3 bg-canvas/60 hover:bg-canvas transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-4 h-4 text-inkmute transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-display font-semibold text-ink flex-1 min-w-0 truncate">{section.title}</span>
              {off && <span className="text-xs text-amberink whitespace-nowrap">tidak dicetak</span>}
              <span className={`text-xs font-data tnum ${percent >= 100 ? 'text-teal' : 'text-inkmute'}`}>{p.filled}/{p.total}</span>
              <label className="flex items-center gap-2 text-xs text-inkmute cursor-pointer tap" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blueprint"
                  checked={!off}
                  onChange={() => onToggle(section.key)}
                  aria-label={`Cetak ${section.title} di dokumen`}
                />
                <span>Cetak</span>
              </label>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {section.hint && <p className="sm:col-span-2 text-xs text-inkmute -mb-1">{section.hint}</p>}
              {tech && section.modules && section.modules.length > 0 && (
                <TechSource mod={tech[section.modules[0]] || null} projectHref={projectHref} />
              )}
              {fields.map((f, i) => (
                <div
                  key={f.id || `${f.label}-${i}`}
                  className={f.type === 'textarea' || f.type === 'group' || f.type === 'subheading' ? 'sm:col-span-2' : ''}
                >
                  <FieldRow field={f} values={values} onChange={onChange} />
                  {f.type !== 'subheading' && isAuto(f) && <span className="block text-xs text-teal mt-1">otomatis dari Teknologi</span>}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

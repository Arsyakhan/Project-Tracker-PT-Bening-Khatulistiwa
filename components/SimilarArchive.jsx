import Link from 'next/link';
import { useMemo } from 'react';
import useArchive from '../lib/useArchive';
import { chainText, findSimilar } from '../lib/techflow';

// Project arsip yang teknologinya mirip dengan project yang sedang dibuka.
// Komponen ini mengambil data arsip sendiri, jadi hanya dimuat saat dirender (tab Spesifikasi).
// Kalau arsip belum bisa dibaca (mis. backend belum diperbarui), bagian ini diam saja.
export default function SimilarArchive({ modules }) {
  const { projects } = useArchive();
  const similar = useMemo(() => (projects ? findSimilar(modules, projects, 3) : []), [projects, modules]);
  if (similar.length === 0) return null;
  return (
    <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm" aria-labelledby="mirip-arsip-title">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 id="mirip-arsip-title" className="font-display font-semibold text-ink">Pernah dikerjakan: project arsip yang mirip</h2>
        <Link href="/arsip" className="tap text-xs text-blueprint hover:underline whitespace-nowrap">Semua arsip</Link>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {similar.map(({ project: p, score }) => (
          <li key={p.id}>
            <Link href={`/arsip/${encodeURIComponent(p.id)}`} className="block h-full border border-line rounded-md p-3 hover:border-blueprint transition-colors">
              <span className="block text-sm font-medium text-ink leading-snug">{p.name}</span>
              <span className="block text-xs text-blueprint mt-1">{chainText(p.modules, 4)}</span>
              <span className="block text-xs text-inkmute mt-1">{p.year} · mirip {Math.round(score * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

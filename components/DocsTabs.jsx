import Link from 'next/link';

const TABS = [
  { key: 'generator', href: '/documents', label: 'Generator Dokumen' },
  { key: 'meetings', href: '/documents/meetings', label: 'Notulensi Rapat' },
];

// Sub-tab di bagian Dokumen.
export default function DocsTabs({ active }) {
  return (
    <nav aria-label="Bagian dokumen" className="flex gap-1 border-b border-line -mb-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.key ? 'border-blueprint text-blueprint' : 'border-transparent text-inkmute hover:text-ink'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

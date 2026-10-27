// Kolom pencarian dengan ikon kaca pembesar. Lebar mengikuti pembungkus (className).
export default function SearchField({ value, onChange, placeholder = 'Cari...', label, className = '', autoFocus = false }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
      </svg>
      <input
        type="search"
        className="input !pl-9 !min-h-[36px] max-md:!min-h-[40px]"
        placeholder={placeholder}
        aria-label={label || placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

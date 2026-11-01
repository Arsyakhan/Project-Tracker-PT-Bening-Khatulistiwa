import { useEffect, useState } from 'react';
import { fotoSrc } from '../../lib/foto';

// Foto barang di bidang putih (foto produk umumnya berlatar putih; dipakai juga di tema gelap supaya warnanya jujur),
// utuh tanpa dipotong. Belum ada foto atau tautan rusak: pengganti bergaris kisi dengan kode kategori.
// ukuran: 'kecil' (ikon daftar, <= 64 px), 'kartu', atau 'besar' (galeri).
export function FotoBarang({ foto, kategori, alt = '', ukuran = 'kartu', label = false, className = '' }) {
  const src = fotoSrc(foto, ukuran !== 'besar');
  const [rusak, setRusak] = useState(false);
  useEffect(() => setRusak(false), [src]);

  if (!src || rusak) return <FotoKosong kategori={kategori} ukuran={ukuran} className={className} />;
  return (
    <span className={`relative block overflow-hidden bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto dari tautan luar dan route privat, bukan aset statis */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setRusak(true)}
        className={`absolute inset-0 w-full h-full object-contain ${ukuran === 'kecil' ? 'p-0.5' : 'p-[6%]'}`}
      />
      {label && foto.sumber === 'internet' && (
        <span className="absolute left-2 bottom-2 rounded-md bg-panel/90 border border-line px-1.5 py-0.5 text-xs text-inkmute">
          Foto contoh
        </span>
      )}
    </span>
  );
}

export function FotoKosong({ kategori, ukuran = 'kartu', className = '' }) {
  if (ukuran === 'kecil') {
    return (
      <span className={`kertas-kisi flex items-center justify-center font-data text-[10px] text-inkmute ${className}`} aria-hidden="true">
        {kategori}
      </span>
    );
  }
  return (
    <span className={`kertas-kisi flex flex-col items-center justify-center gap-1 text-inkmute ${className}`}>
      <span className={`font-data ${ukuran === 'besar' ? 'text-4xl' : 'text-xl'} text-blueprint/50`} aria-hidden="true">{kategori}</span>
      <span className="text-xs">Belum ada foto</span>
    </span>
  );
}

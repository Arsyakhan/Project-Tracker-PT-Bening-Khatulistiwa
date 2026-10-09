import { useId } from 'react';
import { DEFAULT_ATTENDEES } from '../lib/meetings';
import { DIVISIONS, divisionFromPic } from '../lib/today';

export const PIC_SUGGESTIONS = [...DEFAULT_ATTENDEES.map((a) => a.name), ...DIVISIONS];

// Isian PIC (nama atau divisi) dengan saran. Teks bebas tetap boleh; saran hanya menjaga penulisan seragam.
// showDivision: tampilkan apakah divisinya terbaca. Ini hanya penting untuk PIC langkah berikutnya dan
// tindak lanjut rapat, karena halaman Hari Ini memakainya untuk filter per divisi.
// Petunjuk ditaruh DI LUAR <label> pemanggil (beri id lalu pasang <label htmlFor>), supaya tidak ikut jadi nama isian.
export default function PicInput({ id, value, onChange, placeholder = 'Nama atau divisi', showDivision = false, className = 'input' }) {
  const listId = `pic-${useId().replace(/:/g, '')}`;
  const text = String(value || '');
  const division = text ? divisionFromPic(text) : '';
  const hintId = `${listId}-hint`;
  return (
    <>
      <input
        id={id}
        className={className}
        list={listId}
        maxLength={200}
        placeholder={placeholder}
        value={text}
        aria-describedby={showDivision && text ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {PIC_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
      </datalist>
      {showDivision && text && (
        <p id={hintId} className={`text-xs ${division ? 'text-inkmute' : 'text-amberink'}`}>
          {division
            ? <>Divisi terbaca: <b className="font-medium text-ink">{division}</b></>
            : 'Divisi belum terbaca, jadi langkah ini tidak muncul di filter divisi halaman Hari Ini. Pilih dari saran atau tulis nama divisinya.'}
        </p>
      )}
    </>
  );
}

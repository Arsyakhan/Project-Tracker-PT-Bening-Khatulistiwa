import { useEffect, useId, useState } from 'react';
import { MarkGraphic, DROP_H } from './BeningMark';

// Ilustrasi halaman login: Bening Hub sebagai "super app" digambar dengan bahasa P&ID.
// Tetes air (sumber) mengisi diri, lalu mengalirkan air lewat pipa header (dengan valve dan panah aliran)
// ke enam modul aplikasi. Urutan gerak = satu momen saja (sekitar 2,5 detik), sesudahnya hanya denyut air
// yang pelan di pipa. Murni hiasan (aria-hidden): arti "super app" disampaikan teks di panel masuk.
// Ikon modul = ikon yang sama dengan menu sidebar (Heroicons outline).

const MODULES = [
  { x: 280, row: 'top', label: 'Project', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
  { x: 420, row: 'top', label: 'Kanban', icon: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z' },
  { x: 560, row: 'top', label: 'Pengadaan', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12' },
  { x: 280, row: 'bottom', label: 'Dokumen', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { x: 420, row: 'bottom', label: 'Rapat', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
  { x: 560, row: 'bottom', label: 'Arsip', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
];

const HEADER_Y = 200;
const NODE_R = 30;
const TOP_Y = 82;
const BOTTOM_Y = 318;
// Tetes setinggi 150 satuan; titik terlebarnya (y=128 di tetes) tepat di garis header.
const DROP_SCALE = 150 / DROP_H;
const DROP_X = 96 - 70 * DROP_SCALE;
const DROP_Y = HEADER_Y - 128 * DROP_SCALE;
const HEADER_START = 96 + 70 * DROP_SCALE; // tepi kanan tetes
const HEADER_END = 560;
const FLOW_START = 2.6; // detik: denyut air pertama, sesudah semua pipa dan modul muncul
const FLOW_CYCLE = 2.8; // detik: satu putaran denyut (sama dengan --flow-cycle di globals.css)

export default function HubDiagram({ className = '' }) {
  const uid = `hub${useId().replace(/:/g, '')}`;
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setFilled(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <svg viewBox="0 0 620 400" className={`hub ${className}`} aria-hidden="true" focusable="false">
      {/* Pipa header dari tetes ke tee terakhir */}
      <path className="hub-pipe" style={{ '--d': '0.95s' }} d={`M${HEADER_START} ${HEADER_Y} H${HEADER_END}`} pathLength="1" />

      {/* Valve (simbol bowtie P&ID) dan panah aliran di header */}
      <g className="hub-fade" style={{ '--d': '1.25s' }}>
        <path className="hub-symbol" d={`M178 ${HEADER_Y - 9} L198 ${HEADER_Y + 9} V${HEADER_Y - 9} L178 ${HEADER_Y + 9} Z`} />
        <path className="hub-symbol" d={`M188 ${HEADER_Y} V${HEADER_Y - 16} M181 ${HEADER_Y - 16} H195`} />
        <path className="hub-arrow" d={`M226 ${HEADER_Y - 6} L236 ${HEADER_Y} L226 ${HEADER_Y + 6} Z`} />
        <path className="hub-arrow" d={`M486 ${HEADER_Y - 6} L496 ${HEADER_Y} L486 ${HEADER_Y + 6} Z`} />
      </g>

      {/* Cabang ke tiap modul */}
      {MODULES.map((m, i) => {
        const end = m.row === 'top' ? TOP_Y + NODE_R : BOTTOM_Y - NODE_R;
        return (
          <path
            key={`b-${m.label}`}
            className="hub-pipe"
            style={{ '--d': `${1.35 + i * 0.08}s` }}
            d={`M${m.x} ${HEADER_Y} V${end}`}
            pathLength="1"
          />
        );
      })}

      {/* Denyut air yang mengalir pelan sesudah semuanya tersambung. Denyut cabang mulai tepat saat denyut header
          melewati tee-nya (kecepatan sama, sekitar 145 satuan/detik), jadi airnya tampak terbagi ke atas dan ke bawah. */}
      <path className="hub-flow" style={{ '--d': `${FLOW_START}s` }} d={`M${HEADER_START} ${HEADER_Y} H${HEADER_END}`} pathLength="1" />
      {MODULES.map((m) => {
        const end = m.row === 'top' ? TOP_Y + NODE_R : BOTTOM_Y - NODE_R;
        const reach = ((m.x - HEADER_START) / (HEADER_END - HEADER_START)) * FLOW_CYCLE;
        return (
          <path
            key={`f-${m.label}`}
            className="hub-flow hub-flow-branch"
            style={{ '--d': `${(FLOW_START + reach).toFixed(2)}s` }}
            d={`M${m.x} ${HEADER_Y} V${end}`}
            pathLength="1"
          />
        );
      })}

      {/* Tee (titik sambungan) */}
      {[280, 420, 560].map((x) => (
        <circle key={`t-${x}`} className="hub-fade hub-tee" style={{ '--d': '1.3s' }} cx={x} cy={HEADER_Y} r="4.5" />
      ))}

      {/* Modul */}
      {MODULES.map((m, i) => {
        const cy = m.row === 'top' ? TOP_Y : BOTTOM_Y;
        const ly = m.row === 'top' ? TOP_Y - NODE_R - 16 : BOTTOM_Y + NODE_R + 28;
        return (
          <g key={m.label} className="hub-node" style={{ '--d': `${1.6 + i * 0.08}s` }}>
            <circle cx={m.x} cy={cy} r={NODE_R} className="hub-node-ring" />
            <g transform={`translate(${m.x - 13.2} ${cy - 13.2}) scale(1.1)`}>
              <path d={m.icon} className="hub-icon" />
            </g>
            <text x={m.x} y={ly} textAnchor="middle" className="hub-label">
              {m.label}
            </text>
          </g>
        );
      })}

      {/* Tetes air sumber */}
      <g transform={`translate(${DROP_X} ${DROP_Y}) scale(${DROP_SCALE})`} className="hub-drop bm-slow">
        <MarkGraphic level={filled ? 1 : 0} live idPrefix={uid} emptyOpacity={0.14} />
      </g>
    </svg>
  );
}

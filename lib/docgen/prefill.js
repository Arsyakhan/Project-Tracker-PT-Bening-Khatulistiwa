import { computePidTags } from './schema';
import {
  effectiveSystems,
  toCommissioningModules,
  toHandoverModules,
  suggestSystemTitle,
} from '../systems';

// Menghasilkan nilai awal form dari data project. Field yang datanya kosong TIDAK dikembalikan,
// jadi tidak menimpa nilai default form.
function compact(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v === '' || v === undefined || v === null) return;
    out[k] = v;
  });
  return out;
}

export function prefillCommissioning(project) {
  const { keys } = effectiveSystems(project);
  const base = compact({
    project_name: project.projectName,
    company_name: project.client,
    po_number: project.poNumber,
    location: project.lokasiPlant,
    alamat: project.alamat,
    owner_company: project.client,
    owner_name: project.kontakOwner,
    system_title: suggestSystemTitle(keys, { upper: true }),
  });
  // Belum ada info sistem: jangan sentuh centang modul yang mungkin sudah diisi manual.
  if (keys.length === 0) return base;
  const modules = toCommissioningModules(keys);
  // Nomor tag PI/PS/FI dihitung dari modul yang aktif (sama seperti saat modul dicentang manual di form).
  return { ...base, ...modules, ...computePidTags(modules) };
}

export function prefillHandover(project) {
  const { keys } = effectiveSystems(project);
  const base = compact({
    project_name: project.projectName,
    buyer_company: project.client,
    po_number: project.poNumber,
    location: project.lokasiPlant,
    system_title: suggestSystemTitle(keys),
  });
  if (keys.length === 0) return base;
  const { values } = toHandoverModules(keys);
  const modules = {};
  Object.keys(values).forEach((k) => {
    // f1_type / f2_type hanya diisi kalau ada nilainya; toggle (boolean) selalu diisi.
    if (typeof values[k] === 'boolean' || values[k]) modules[k] = values[k];
  });
  return { ...base, ...modules };
}

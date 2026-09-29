// Indikator kecil untuk halaman yang memakai useCachedResource / useProjects.
// Tinggi dicadangkan supaya tampilan tidak bergeser saat indikatornya muncul/hilang.
export default function RefreshStatus({ refreshing, staleError }) {
  return (
    <div className="min-h-[1.25rem] flex items-center">
      {staleError ? (
        <p className="text-xs text-rust">
          Gagal menyegarkan data, menampilkan data terakhir. ({staleError})
        </p>
      ) : refreshing ? (
        <p className="text-xs text-inkmute flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-blueprint border-t-transparent animate-spin" />
          Memperbarui data...
        </p>
      ) : null}
    </div>
  );
}

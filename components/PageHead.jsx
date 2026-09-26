import Head from 'next/head';

// Dipakai di tiap halaman supaya tab browser punya judulnya sendiri,
// contoh: <PageHead title="TKE MUS, RO 40 MPH" /> -> tab jadi
// "TKE MUS, RO 40 MPH — Bening Hub".
export default function PageHead({ title }) {
  return (
    <Head>
      <title>{title ? `${title} — Bening Hub` : 'Bening Hub - Bening Khatulistiwa'}</title>
    </Head>
  );
}

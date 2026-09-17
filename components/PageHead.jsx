import Head from 'next/head';

// Dipakai di tiap halaman supaya tab browser punya judulnya sendiri,
// contoh: <PageHead title="TKE MUS, RO 40 MPH" /> -> tab jadi
// "TKE MUS, RO 40 MPH — Project Tracker".
export default function PageHead({ title }) {
  return (
    <Head>
      <title>{title ? `${title} — Project Tracker` : 'Project Tracker - Bening Khatulistiwa'}</title>
    </Head>
  );
}

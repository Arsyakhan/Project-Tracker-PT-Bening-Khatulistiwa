import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    
    // UBAH PASSWORD DI SINI
    if (password === 'admin123') {
      // Set cookie penanda login yang berlaku selama 1 hari (86400 detik)
      document.cookie = "isLoggedIn=true; path=/; max-age=86400";
      router.push('/'); // Arahkan ke dashboard
    } else {
      setError('Password salah! Silakan coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-panel border border-line rounded-xl p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-ink">Bening Khatulistiwa</h1>
          <p className="text-inkmute text-sm mt-1">Project Tracker Portal</p>
        </div>
        
        {error && (
          <div className="bg-rust/10 text-rust text-sm p-3 rounded-md mb-5 text-center font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <input
            type="password"
            placeholder="Masukkan kata sandi..."
            className="border border-line rounded-md px-4 py-3 text-sm outline-none focus:border-blueprint w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-blueprint hover:bg-blueprintdark text-white rounded-md py-3 text-sm font-medium transition-colors"
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Daftar email yang boleh login, diambil dari Environment Variable ALLOWED_EMAILS
// di Vercel (dipisah koma), misal:
// ALLOWED_EMAILS=budi@gmail.com,ani@gmail.com,manager@gmail.com
const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login', // kalau ditolak, balik ke /login dengan ?error=AccessDenied
  },
  callbacks: {
    // Ini yang menentukan boleh/tidaknya seseorang login, dicek di server,
    // bukan di frontend — jadi tidak bisa dilewati dari DevTools.
    async signIn({ user }) {
      if (!user?.email) return false;
      const email = user.email.toLowerCase();

      if (allowedEmails.length === 0) {
        // Kalau ALLOWED_EMAILS belum diset sama sekali, tolak SEMUA orang
        // (lebih aman daripada diam-diam meloloskan semua orang).
        console.error('ALLOWED_EMAILS belum diset di Environment Variables — semua login ditolak.');
        return false;
      }

      return allowedEmails.includes(email);
    },
    async session({ session }) {
      return session;
    },
  },
};

export default NextAuth(authOptions);

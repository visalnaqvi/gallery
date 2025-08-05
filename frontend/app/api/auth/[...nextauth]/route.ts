import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { NextAuthOptions } from 'next-auth';
import { Pool } from 'pg';

// ✅ PostgreSQL pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE!, // Make sure this is set in .env
});

// ✅ Helper to fetch user by email
async function getUserByEmail(email: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    console.log("got user" , result)
    if (result.rowCount === 0) return null;
    return result.rows[0];
  } finally {
    client.release();
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await getUserByEmail(credentials.email);
        console.log("got result"  , user)
        if (!user || !(await bcrypt.compare(credentials.password, user.password_hash))) {
          throw new Error('Invalid credentials');
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',
  },
  secret: process.env.JWT_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

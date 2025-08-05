'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();

        const res = await signIn('credentials', {
            redirect: false,
            email,
            password,
        });

        if (res?.ok) {
            alert('Login successful!');
            router.push('/'); // or wherever you want to redirect
        } else {
            alert('Login failed: ' + res?.error);
        }
    }

    return (
        <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-xl font-semibold">Login</h2>
            <input
                className="w-full border p-2 rounded"
                placeholder="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
            />
            <input
                className="w-full border p-2 rounded"
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
                Login
            </button>
        </form>
    );
}

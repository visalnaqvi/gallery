'use client';

import { useState } from 'react';

export default function SignupForm() {
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        password: '',
        date_of_birth: '',
    });

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();

        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify(form),
        });

        const data = await res.json();
        if (res.ok) {
            alert('Signup successful');
        } else {
            alert(data.error || 'Signup failed');
        }
    }

    return (
        <form onSubmit={handleSignup} className="space-y-4">
            <h2 className="text-xl font-semibold">Sign Up</h2>
            <input
                className="w-full border p-2 rounded"
                placeholder="First Name"
                value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
                required
            />
            <input
                className="w-full border p-2 rounded"
                placeholder="Last Name"
                value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
                required
            />
            <input
                className="w-full border p-2 rounded"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
            />
            <input
                className="w-full border p-2 rounded"
                placeholder="Phone Number"
                value={form.phone_number}
                onChange={e => setForm({ ...form, phone_number: e.target.value })}
            />
            <input
                className="w-full border p-2 rounded"
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
            />
            <input
                className="w-full border p-2 rounded"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
            />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
                Sign Up
            </button>
        </form>
    );
}

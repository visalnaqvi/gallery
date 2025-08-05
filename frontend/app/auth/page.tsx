'use client';

import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignUpForm';

export default function AuthPage() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    return (
        <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow space-y-6">
            <div className="flex justify-between">
                <button
                    onClick={() => setMode('login')}
                    className={`px-4 py-2 rounded ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                    Login
                </button>
                <button
                    onClick={() => setMode('signup')}
                    className={`px-4 py-2 rounded ${mode === 'signup' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                >
                    Sign Up
                </button>
            </div>

            {mode === 'login' ? <LoginForm /> : <SignupForm />}
        </div>
    );
}

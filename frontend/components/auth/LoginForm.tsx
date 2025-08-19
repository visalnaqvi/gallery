'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from "./styles.module.css"
export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();
    const [showPass, setShowPass] = useState(false)
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
        <form onSubmit={handleLogin} className={styles.form}>
            <h2 className={styles.heading}>Hello,</h2>
            <h2 className={styles.heading}>Welcome Back,</h2>
            <p className={styles.tag}>Hey! Welcome back to Snapper, Login to Contniue</p>
            <input
                className={styles.input}
                placeholder="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
            />
            <br></br>
            <input
                className={styles.input}
                placeholder="Password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
            />
            <p className={styles.passSwitch} onClick={() => {
                setShowPass(!showPass)
            }}>{showPass ? "Hide" : "Show"} Password</p>
            <br></br>
            <button type="submit" className={styles.submitBtn}>
                Login
            </button>
        </form>
    );
}

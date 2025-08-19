'use client';

import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignUpForm';
import styles from "./styles.module.css"
import Image from 'next/image';
import img from "../../public/login.png"
export default function AuthPage() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    return (
        <div className={styles.mainWrapper}>

            <div className={styles.formHolder}>
                <div className={styles.left}>

                    {mode === 'login' ? <LoginForm /> : <SignupForm />}
                    <div className={styles.switch}>

                        {mode === 'login' ? <p>Don't have an account? <span onClick={() => setMode('signup')}>Sign Up</span></p> : <p>Already have an account? <span onClick={() => setMode('login')}>Login In</span></p>}
                    </div>
                </div>
                <div className={styles.right}>
                    <Image src={img} alt='login'></Image>
                </div>
            </div>
        </div>
    );
}

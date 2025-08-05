import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE!,
});

export async function POST(req: NextRequest) {
  const { first_name, last_name, password, email, phone_number, date_of_birth } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    const client = await pool.connect();
    await client.query(
      `INSERT INTO users (
        id, first_name, last_name, password_hash, email, phone_number, date_of_birth, is_admin, groups, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, ARRAY[]::uuid[], NOW())`,
      [id, first_name, last_name, hashedPassword, email, phone_number, date_of_birth]
    );
    client.release();

    return NextResponse.json({ message: 'User created successfully', id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// app/api/groups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    const userQuery = await client.query(
      'SELECT groups FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rowCount === 0) {
      client.release();
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const groupIds: string[] = userQuery.rows[0].groups;

    if (!groupIds || groupIds.length === 0) {
      client.release();
      return NextResponse.json({ groups: [] }, { status: 200 });
    }

    const groupQuery = await client.query(
      `SELECT id, name, total_images, total_size, admin_user, last_image_added_at
       FROM groups
       WHERE id = ANY($1::uuid[])`,
      [groupIds]
    );

    client.release();
    return NextResponse.json({ groups: groupQuery.rows }, { status: 200 });

  } catch (err) {
    console.error('Error fetching groups:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, userId } = body;

  if (!name || !userId) {
    return NextResponse.json({ error: 'Invalid group name or userId' }, { status: 400 });
  }

  const groupId = uuidv4();
  const now = new Date().toISOString();

  try {
    const client = await pool.connect();

    await client.query(
      `INSERT INTO groups (id, name, admin_user, total_images, total_size, last_image_added_at)
       VALUES ($1, $2, $3, 0, 0, $4)`,
      [groupId, name, userId, now]
    );

    await client.query(
      `UPDATE users SET groups = array_append(groups, $1) WHERE id = $2`,
      [groupId, userId]
    );

    client.release();
    return NextResponse.json({ message: 'Group created successfully', groupId }, { status: 201 });

  } catch (err) {
    console.error('Error creating group:', err);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE!, // Railway DB connection
});

export async function POST(req: NextRequest) {
  try {
    const { userId, groupId, images } = await req.json();
    const client = await pool.connect();

   const insertQuery = `
  INSERT INTO images (
    id,
    group_id, 
    filename, 
    location, 
    delete_at, 
    status, 
    json_meta_data, 
    thumb_byte, 
    image_byte, 
    uploaded_at, 
    last_accessed_at, 
    last_downloaded_at,  
    created_by_user,
    size
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7 , $8 , $9 , $10 , $11 , $12 , $13 , $14)
`;

for (const img of images) {
  await client.query(insertQuery, [
    img.id,
    groupId,             
    img.filename,        
    img.location,        
    null,                
    "hot",               
    null,                
    null,                
    null,                
    img.uploaded_at,     
    null,                
    null,                       
    userId,
    img.size                    
  ]);
}

    client.release();
    return NextResponse.json({ message: 'Uploaded metadata stored successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to store metadata' }, { status: 500 });
  }
}

'use client';

import GroupsList from '@/components/groups/GroupsList';
import { useSession } from 'next-auth/react';

export default function GroupsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    return <p className="p-8 text-red-600">User not logged in.</p>;
  }
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <GroupsList userId={userId} />
    </div>
  );
}

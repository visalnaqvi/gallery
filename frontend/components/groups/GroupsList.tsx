'use client';

import { useEffect, useState } from 'react';
import CreateGroupModal from './CreateGroupModal';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
interface Group {
    id: string;
    name: string;
    total_images: number;
    total_size: number;
    admin_user: string;
    last_image_added_at: string;
}

export default function GroupsList({ userId }: { userId: string }) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const { setUserId, setGroupId } = useUser()
    const router = useRouter()
    async function fetchGroups() {
        try {
            setLoading(true);
            const res = await fetch(`/api/groups?userId=${userId}`);
            const data = await res.json();
            setGroups(data.groups || []);
        } catch (err) {
            console.error('Failed to fetch groups', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchGroups();
    }, []);

    return (
        <div className="p-4 border rounded max-w-2xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Your Groups</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    + New Group
                </button>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : groups.length === 0 ? (
                <p>No groups found.</p>
            ) : (
                <ul className="space-y-2">
                    {groups.map(group => (
                        <li key={group.id} className="border p-3 rounded" onClick={() => {
                            setUserId(userId)
                            setGroupId(group.id)
                            router.push("/upload")
                        }}>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-sm text-gray-500">Images: {group.total_images}, Size: {group.total_size} bytes</p>
                        </li>
                    ))}
                </ul>
            )}

            {showModal && (
                <CreateGroupModal
                    userId={userId}
                    onClose={() => setShowModal(false)}
                    onGroupCreated={fetchGroups}
                />
            )}
        </div>
    );
}

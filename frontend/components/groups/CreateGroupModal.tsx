'use client';

import { useState } from 'react';

export default function CreateGroupModal({
    userId,
    onClose,
    onGroupCreated,
}: {
    userId: string;
    onClose: () => void;
    onGroupCreated: () => void;
}) {
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleCreateGroup() {
        if (!groupName.trim()) return;

        setLoading(true);
        const res = await fetch(`/api/groups?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: groupName, userId }),
        });

        const data = await res.json();
        setLoading(false);

        if (res.ok) {
            alert('Group created successfully!');
            onGroupCreated();
            onClose();
        } else {
            alert(data.error || 'Failed to create group');
        }
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
                <h2 className="text-lg font-semibold mb-4">Create New Group</h2>
                <input
                    type="text"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full border p-2 rounded mb-4"
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}

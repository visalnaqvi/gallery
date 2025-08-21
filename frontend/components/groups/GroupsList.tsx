'use client';

import { useEffect, useState } from 'react';
import CreateGroupModal from './CreateGroupModal';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import styles from "./styles.module.css"
import Image from 'next/image';
interface Group {
    id: string;
    name: string;
    total_images: number;
    total_size: number;
    admin_user: string;
    last_image_added_at: string;
    profile_pic_location: string;
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
        <div className={styles.mainWrapper}>
            <div className={styles.header}>
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
                <ul className={styles.groupCardsWrapper}>
                    {groups.map(group => (
                        <li key={group.id} className={styles.groupCard}>
                            {
                                group.profile_pic_location == "" ?
                                    <div className={styles.groupImage}>
                                        <div className={styles.innerWordWrapper} onClick={() => {
                                            router.push("/gallery?groupId=" + group.id)
                                        }}>{group.name.charAt(0)}</div>
                                    </div> : <div className={styles.cardThumWrapper} onClick={() => {
                                        router.push("/gallery?groupId=" + group.id)
                                    }}><Image className={styles.img} src={group.profile_pic_location} alt="group image" fill></Image></div>
                            }
                            <div className={styles.groupDetails}>
                                <p className={styles.groupName}>{group.name}</p>
                                <p className={styles.groupData}>Images: {group.total_images}</p>
                                {group.admin_user == userId && <div className={styles.adminPanel}>
                                    <button className={styles.uploadBtn} onClick={() => {
                                        setUserId(userId)
                                        setGroupId(group.id)
                                        router.push("/upload")
                                    }}>Upload Images</button>

                                </div>}
                            </div>

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

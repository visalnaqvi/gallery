'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ContextProps = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  groupId: string | null;
  setGroupId: (id: string | null) => void;
};

const UserContext = createContext<ContextProps | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  return (
    <UserContext.Provider value={{ userId, setUserId, groupId, setGroupId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): ContextProps {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

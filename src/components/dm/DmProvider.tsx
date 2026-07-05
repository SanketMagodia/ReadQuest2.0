"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DmTarget = {
  conversationId?: string;
  username?: string;
};

type DmContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  target: DmTarget | null;
  openInbox: () => void;
  openWithUser: (username: string) => void;
  openConversation: (conversationId: string) => void;
  clearTarget: () => void;
};

const DmContext = createContext<DmContextValue | null>(null);

export function DmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DmTarget | null>(null);

  const openInbox = useCallback(() => {
    setTarget(null);
    setOpen(true);
  }, []);

  const openWithUser = useCallback((username: string) => {
    setTarget({ username: username.toLowerCase() });
    setOpen(true);
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    setTarget({ conversationId });
    setOpen(true);
  }, []);

  const clearTarget = useCallback(() => {
    setTarget(null);
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      target,
      openInbox,
      openWithUser,
      openConversation,
      clearTarget,
    }),
    [open, target, openInbox, openWithUser, openConversation, clearTarget]
  );

  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}

export function useDm() {
  const ctx = useContext(DmContext);
  if (!ctx) {
    throw new Error("useDm must be used within DmProvider");
  }
  return ctx;
}

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { Dialog } from "../components/dialog";
import { useSceneManager } from "../pages/Editor";
import { globalEventEmitter } from "../lib/global-event-emitter";

const ModalContext = createContext<{
  closeModal: () => void;
} | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalManager");
  }
  return context;
}

export function ModalManager() {
  const manager = useSceneManager();

  const [modal, setModal] = useState<{
    open: boolean;
    modal: React.ReactElement;
  } | null>(null);

  const openModal = useEffectEvent((newModal: React.ReactElement) => {
    // NOTE(sedivy): Right now we assume only one modal will be visible at a
    // time and we ignore requests to open a new modal if one is already open.
    if (modal == null || !modal.open) {
      setModal({
        open: true,
        modal: newModal,
      });
    }
  });

  useEffect(() => {
    globalEventEmitter.on("openModal", openModal);
    return () => {
      globalEventEmitter.off("openModal", openModal);
    };
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => (prev ? { ...prev, open: false } : null));
  }, []);

  useEffect(() => {
    if (!modal?.open) {
      manager.setInteractionsEnabled(true);
      return;
    }

    manager.setInteractionsEnabled(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      manager.setInteractionsEnabled(true);
    };
  }, [modal?.open, closeModal, manager]);

  return modal == null ? null : (
    <Dialog open={modal.open} onOpenChange={closeModal}>
      <ModalContext.Provider value={{ closeModal }}>
        {modal.modal}
      </ModalContext.Provider>
    </Dialog>
  );
}

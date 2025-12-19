import { useState, useCallback } from 'react';

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function useConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions>({
    title: '',
    message: '',
    type: 'danger'
  });
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    setOptions({
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: 'danger',
      ...options
    });
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolver) resolver(true);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolver) resolver(false);
  }, [resolver]);

  return {
    confirm,
    modalProps: {
      isOpen,
      onClose: handleCancel,
      onConfirm: handleConfirm,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      type: options.type
    }
  };
}

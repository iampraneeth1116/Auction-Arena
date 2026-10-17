import React from 'react';
import Modal from './Modal';
import Button from './Button';

const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', busy, onConfirm, onCancel }) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    }
  >
    <p className="text-sm leading-relaxed text-mist">{message}</p>
  </Modal>
);

export default ConfirmDialog;

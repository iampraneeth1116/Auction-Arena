import React from 'react';
import Modal from '../ui/Modal';
import PlayerDetail from './PlayerDetail';

// One player's full card in a dialog, e.g. from the Up next list. The caller keeps the
// player set while closing, so the card doesn't empty out as it fades away.
const PlayerDetailModal = ({ open, player, note, onClose }) => (
  <Modal open={open} onClose={onClose} title="Player card">
    {player && <PlayerDetail player={player} note={note} />}
  </Modal>
);

export default PlayerDetailModal;

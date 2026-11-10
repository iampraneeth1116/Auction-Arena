import { useSyncExternalStore } from 'react';
import { getConnectionStatus, subscribeConnectionStatus } from '../lib/socket';

// The live connection to the server: 'connecting' | 'connected' | 'reconnecting' | 'signed-out'
export const useConnectionStatus = () =>
  useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus, () => 'connecting');

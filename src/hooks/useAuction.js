import { createContext, useContext } from 'react';

// Kept apart from AuctionProvider so that file only exports a component (needed for Fast Refresh)
export const AuctionContext = createContext();

export const useAuction = () => useContext(AuctionContext);

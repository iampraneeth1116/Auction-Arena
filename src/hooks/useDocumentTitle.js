import { useEffect } from 'react';

// Sets the browser tab title: "Lobby ABC123 · Auction Arena"
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Auction Arena` : 'Auction Arena — live IPL auctions with friends';
  }, [title]);
}

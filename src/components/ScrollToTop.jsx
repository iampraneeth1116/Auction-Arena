import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// New page, new scroll position: start at the top
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export default ScrollToTop;

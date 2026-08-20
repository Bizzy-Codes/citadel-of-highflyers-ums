import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't reset scroll position on navigation by
// default -- clicking a Link while scrolled down on one page lands
// on the next page still scrolled down. Combined with the fixed-
// position nav bars used on several pages, that made the nav overlap
// page content that had "already scrolled past" its top spacing.
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;

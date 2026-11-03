import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ORIGIN = 'https://citadel-of-highflyers-ums.vercel.app';

// Each public page gets its own title and description, so Google can show
// a different result for admissions, fees and so on.
const PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: "Citadel of Highflyers Int'l Academy, Jos | Nursery & Primary School in Plateau State",
    description: 'Citadel of Highflyers International Academy is a co-educational private nursery and primary school in Jos, Plateau State, Nigeria. Daycare to Grade 5. Apply for admission online.',
  },
  '/admissions': {
    title: "Admissions | Citadel of Highflyers Int'l Academy, Jos",
    description: 'Apply online for admission into Citadel of Highflyers International Academy, Jos. Daycare, Nursery, Pre-Grade and Grades 1 to 5.',
  },
  '/founders': {
    title: "Our Founders | Citadel of Highflyers Int'l Academy, Jos",
    description: 'Meet the founders of Citadel of Highflyers International Academy and the vision behind our school in Jos, Plateau State.',
  },
  '/gallery': {
    title: "Photo Gallery | Citadel of Highflyers Int'l Academy, Jos",
    description: 'Photos of school life, events and pupils at Citadel of Highflyers International Academy, Jos.',
  },
  '/fees': {
    title: "School Fees | Citadel of Highflyers Int'l Academy, Jos",
    description: 'School fees and financial information for Citadel of Highflyers International Academy, Jos, Plateau State.',
  },
  '/bank-details': {
    title: "Bank Details | Citadel of Highflyers Int'l Academy, Jos",
    description: 'Official bank account details for paying fees to Citadel of Highflyers International Academy, Jos.',
  },
};

function setMeta(selector: string, attr: string, value: string) {
  document.head.querySelector(selector)?.setAttribute(attr, value);
}

const PageMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    const isPrivate = path.startsWith('/portal') || ['/login', '/forgot-password', '/reset-password'].includes(path);
    const page = PAGES[path] ?? (path.startsWith('/fees/') ? PAGES['/fees'] : null);

    if (page) {
      document.title = page.title;
      setMeta('meta[name="description"]', 'content', page.description);
      setMeta('meta[property="og:title"]', 'content', page.title);
      setMeta('meta[property="og:description"]', 'content', page.description);
    } else if (isPrivate) {
      document.title = "Parent & Staff Portal | Citadel of Highflyers Int'l Academy";
    }
    const canonical = path.startsWith('/fees/') ? '/fees' : path;
    setMeta('link[rel="canonical"]', 'href', ORIGIN + (canonical === '/' ? '/' : canonical));
    setMeta('meta[property="og:url"]', 'content', ORIGIN + (canonical === '/' ? '/' : canonical));
    setMeta('meta[name="robots"]', 'content', isPrivate ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1');
  }, [pathname]);

  return null;
};

export default PageMeta;

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Site-wide minimal header. Hidden on /forever/* — that page is a poster, no chrome.
export default function SiteHeader() {
  const pathname = usePathname();
  if (pathname && pathname.startsWith('/forever')) return null;
  return (
    <header className="bg-white -mb-10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center">
        <Link
          href="/"
          className="text-sm font-medium text-gray-950 hover:text-rose-600 focus:outline-2 focus:outline-rose-500 focus:outline-offset-4"
        >
          Mother&rsquo;s Day Messages
        </Link>
      </div>
    </header>
  );
}

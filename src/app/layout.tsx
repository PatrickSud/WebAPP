import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

// ============================================
// Root Layout — Meta, PWA, Providers
// ============================================

export const metadata: Metadata = {
  title: 'Ministério App',
  description: 'Aplicação progressiva para gerenciamento de ministério. Acesse de qualquer dispositivo.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ministério',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1E40AF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

/**
 * Client component that registers the service worker.
 */
function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
              // Unregister any active service worker on localhost to avoid caching issues during development
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (var i = 0; i < registrations.length; i++) {
                  registrations[i].unregister().then(function(success) {
                    if (success) console.log('[SW] Unregistered on localhost');
                  });
                }
              });
              // Clear caches
              if ('caches' in window) {
                caches.keys().then(function(keys) {
                  for (var i = 0; i < keys.length; i++) {
                    caches.delete(keys[i]);
                  }
                });
              }
            } else {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) {
                    console.log('[SW] Registered:', reg.scope);
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      if (newWorker) {
                        newWorker.addEventListener('statechange', function() {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[SW] New version available');
                          }
                        });
                      }
                    });
                  })
                  .catch(function(err) {
                    console.warn('[SW] Registration failed:', err);
                  });
              });
            }
          }
        `,
      }}
    />
  );
}

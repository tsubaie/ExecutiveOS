'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ToastHost } from './toast/ToastHost';
export function Providers({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string | undefined;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            refetchInterval: 60000,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      {...(nonce ? { nonce } : {})}
    >
      <QueryClientProvider client={client}>
        <ToastHost>{children}</ToastHost>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

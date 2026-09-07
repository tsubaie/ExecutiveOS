import { type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { currentUser } from '@/core/auth/session';
import { AdminLayout } from '@/ui/layout/AdminLayout';
export default async function Layout({ children }: { children: ReactNode }) {
  if ((await currentUser())?.role !== 'admin') notFound();
  return <AdminLayout>{children}</AdminLayout>;
}

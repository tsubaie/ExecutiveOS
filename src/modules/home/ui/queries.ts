import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Home } from '../schema/validation';
export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: () => request('/home', z.object({ data: Home })),
  });
}

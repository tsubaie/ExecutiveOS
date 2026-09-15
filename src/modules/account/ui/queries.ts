import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@/core/http/client';
import { Account, type AccountPatch } from '../schema/validation';
const response = z.object({ data: Account });
const revoked = z.object({ data: z.object({ revoked: z.number().int() }) });
export const accountKey = ['account'];
export function useAccount() {
  return useQuery({ queryKey: accountKey, queryFn: () => request('/account', response) });
}
function useAccountMutation<I, O>(send: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSettled: () => client.invalidateQueries({ queryKey: accountKey }),
  });
}
export function usePatchAccount() {
  return useAccountMutation((input: AccountPatch) =>
    request('/account', response, { method: 'PATCH', body: z.json().parse(input) }),
  );
}
export function useChangeEmail() {
  return useAccountMutation((input: { revision: number; email: string }) =>
    request('/account/email', response, { method: 'POST', body: input }),
  );
}
// ACCT-B02: the current session survives, so nothing here signs the reader out or clears the cache.
export function useChangePassword() {
  return useAccountMutation((input: { current: string; next: string }) =>
    request('/account/password', revoked, { method: 'POST', body: input }),
  );
}
export function useRevokeSession() {
  return useAccountMutation((id: string) =>
    request(`/account/sessions/${id}`, z.object({ data: z.object({ id: z.uuid() }) }), {
      method: 'DELETE',
    }),
  );
}
export function useSignOutOthers() {
  return useAccountMutation(() =>
    request('/account/sessions/revoke-others', revoked, { method: 'POST', body: {} }),
  );
}

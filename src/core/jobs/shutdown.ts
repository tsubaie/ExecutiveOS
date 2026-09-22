import 'server-only';
import { logger } from '@/core/config/logger';
type Stop = () => Promise<void>;
type Signal = 'SIGINT' | 'SIGTERM';
const exitCodes: Record<Signal, number> = { SIGINT: 130, SIGTERM: 143 };
/**
 * ADMIN-B33 SIGTERM and SIGINT both drain the job runner once. When Next's own signal handling is
 * switched off (NEXT_MANUAL_SIG_HANDLE, set in the production image) the process exits after the
 * drain with the conventional signal code; otherwise Next exits on its own schedule.
 */
export function shutdownHandler(stop: Stop, exit: ((code: number) => void) | null) {
  let started = false;
  return (signal: Signal) => {
    if (started) return;
    started = true;
    logger.info({ signal }, 'Shutting down: draining jobs');
    void stop()
      .catch((error) => logger.error({ err: error }, 'Job drain failed'))
      .finally(() => exit?.(exitCodes[signal]));
  };
}
export function installShutdown(stop: Stop, manualSignals: boolean) {
  const handle = shutdownHandler(stop, manualSignals ? (code) => process.exit(code) : null);
  process.once('SIGTERM', () => handle('SIGTERM'));
  process.once('SIGINT', () => handle('SIGINT'));
}

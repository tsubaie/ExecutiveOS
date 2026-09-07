import 'server-only';
import { v7 } from 'uuid';

export function id() {
  return v7();
}

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['argon2', 'pg'],
};

export default createNextIntlPlugin('./src/core/i18n/request.ts')(config);

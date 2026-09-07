import pkg from '../../../package.json' with { type: 'json' };
// One source for the application version: health, backup manifests, OpenAPI.
export const appVersion: string = pkg.version;

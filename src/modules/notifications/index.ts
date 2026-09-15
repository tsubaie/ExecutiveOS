// The notifications module is a consumer of the contributions other modules declare, the way Home
// is a consumer of home sections, so it exports no `server` and the registry does not list it --
// that is what would close the loop back through the feed's own subject resolution.
export { feed, readOne, readAll } from './service';

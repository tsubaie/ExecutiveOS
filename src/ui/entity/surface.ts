import type { Entity, EntityPageProps } from './types';
import type { EntityController } from './use-entity-controller';
// Every piece of an entity surface is handed the same two things: the module's declaration and the
// controller driving it. The pair lives here rather than in whichever component happened to need it
// first, so a component can take it without importing the component it sits beside — which is how
// the toolbar and the controls inside it came to import each other.
export type Surface<T extends Entity, P extends object, C> = {
  config: EntityPageProps<T, P, C>;
  controller: EntityController<T, P, C>;
};

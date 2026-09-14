// React's <ViewTransition> ships in the canary that Next bundles for the App Router (see
// node_modules/next/dist/docs/01-app/02-guides/view-transitions.md), but @types/react tracks the
// stable release and does not declare it yet. Declaring it here keeps the call sites typed without
// moving the project onto a canary React or casting at every use.
import 'react';
declare module 'react' {
  type ViewTransitionClass = string | { default?: string; [transitionType: string]: string | undefined };
  interface ViewTransitionProps {
    children?: import('react').ReactNode;
    name?: string;
    default?: ViewTransitionClass;
    enter?: ViewTransitionClass;
    exit?: ViewTransitionClass;
    update?: ViewTransitionClass;
    share?: ViewTransitionClass;
    onEnter?: (element: Element, types: string[]) => void;
    onExit?: (element: Element, types: string[]) => void;
  }
  const ViewTransition: import('react').ExoticComponent<ViewTransitionProps>;
}

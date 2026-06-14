// Metro (Expo) polyfills process.env at bundle time.
// Declare the minimal shape so TypeScript accepts it without requiring @types/node.
declare const process: {
  env: Record<string, string | undefined>;
};

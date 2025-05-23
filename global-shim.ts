// Global object polyfill
const globalObject = (() => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  return Function('return this')();
})();

// Export it so we can import it in other files
export default globalObject;

// Also patch the global scope
if (typeof window !== 'undefined') {
  (window as any).global = globalObject;
  
  // Ensure all methods needed by Supabase exist
  if (!window.fetch) {
    console.warn('fetch is not defined in this environment');
  }
  
  // Ensure WebSocket exists (even if just as a stub)
  if (typeof WebSocket === 'undefined') {
    (window as any).WebSocket = class MockWebSocket {
      constructor() {
        console.warn('WebSocket is not available in this environment');
      }
    };
  }
}

// Ensure Promise exists
if (typeof Promise === 'undefined') {
  throw new Error('Promise is required but not available in this environment');
}

// Patch process.env if it doesn't exist
if (typeof process === 'undefined' || !process.env) {
  (globalObject as any).process = { env: {} };
}

// Fix for common binding issues
if (Function.prototype.bind && typeof Function.prototype.bind.toString !== 'function') {
  Function.prototype.toString = function() { 
    return '[function]'; 
  };
} 
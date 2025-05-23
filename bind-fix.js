// Critical fix for bind issues in ES5-compatible code
(function() {
  try {
    // Save native methods before patching anything to avoid circular references
    var nativeBind = Function.prototype.bind;
    var nativeApply = Function.prototype.apply;
    var nativeCall = Function.prototype.call;
    
    // Save a direct reference to native Function.prototype.apply without going through
    // the function prototype chain to avoid recursion
    var directApply = nativeApply;
    if (typeof directApply !== 'function') {
      console.error('Fatal: Could not access native Function.prototype.apply');
      return; // Can't safely continue with the patching
    }
    
    // Create a direct caller that bypasses our patches
    function directFunctionCall(fn, context, args) {
      // Most basic way to call a function with a specific context
      switch (args.length) {
        case 0: return fn.call(context);
        case 1: return fn.call(context, args[0]);
        case 2: return fn.call(context, args[0], args[1]);
        case 3: return fn.call(context, args[0], args[1], args[2]);
        default:
          // For more args, use the native function constructor approach
          var params = [];
          for (var i = 0; i < args.length; i++) {
            params[i] = 'args[' + i + ']';
          }
          // Use Function constructor to avoid using patched methods
          var caller = new Function('fn', 'context', 'args', 
            'return fn.call(context, ' + params.join(', ') + ');');
          return caller(fn, context, args);
      }
    }
    
    // Create safe array-like object to array converter
    function toArray(arrayLike, start) {
      start = start || 0;
      var array = [];
      for (var i = start; i < arrayLike.length; i++) {
        array[i - start] = arrayLike[i];
      }
      return array;
    }
    
    // Check if Function.prototype.bind exists
    if (typeof nativeBind !== 'function') {
      console.warn('Function.prototype.bind is missing, creating polyfill');
      
      // ES5-compatible bind polyfill that doesn't use other patched methods
      Function.prototype.bind = function bindPolyfill(context) {
        if (typeof this !== 'function') {
          console.warn('Cannot bind non-function');
          return function() { return undefined; };
        }
        
        var targetFunction = this;
        var args = toArray(arguments, 1);
        
        function bound() {
          var boundArgs = args.concat(toArray(arguments));
          return directFunctionCall(
            targetFunction, 
            this instanceof bound ? this : context, 
            boundArgs
          );
        }
        
        // Setup the prototype chain
        function EmptyFn() {}
        if (targetFunction.prototype) {
          EmptyFn.prototype = targetFunction.prototype;
        }
        bound.prototype = new EmptyFn();
        
        return bound;
      };
    } else {
      // Patch existing bind to be safe
      Function.prototype.bind = function safeBind(context) {
        if (typeof this !== 'function') {
          console.warn('Attempted to call bind on non-function');
          return function() { return undefined; };
        }
        // Use the native bind directly but make sure 'this' is a function
        return directFunctionCall(nativeBind, this, toArray(arguments));
      };
    }
    
    // Patch apply to be safe
    Function.prototype.apply = function safeApply(context, argsArray) {
      if (typeof this !== 'function') {
        console.warn('Attempted to call apply on non-function');
        return undefined;
      }
      // Use direct call to the native apply
      return nativeApply.call(this, context, argsArray || []);
    };
    
    // Patch call to be safe
    Function.prototype.call = function safeCall(context) {
      if (typeof this !== 'function') {
        console.warn('Attempted to call call() on non-function');
        return undefined;
      }
      // Use direct native apply without going through our patched apply
      var args = toArray(arguments, 1);
      return nativeApply.call(this, context, args);
    };
    
    console.log("Safe bind patch applied successfully");
  } catch (e) {
    console.error("Error applying safe bind patch:", e);
  }
})(); 
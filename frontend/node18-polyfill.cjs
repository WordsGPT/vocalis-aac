if (typeof globalThis.CustomEvent === 'undefined') {
  class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  }
  globalThis.CustomEvent = CustomEvent;
}

const crypto = require('node:crypto');
if (!crypto.hash) {
  crypto.hash = function (algorithm, data, outputEncoding) {
    return crypto.createHash(algorithm).update(data).digest(outputEncoding);
  };
}

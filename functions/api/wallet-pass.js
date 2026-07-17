var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/node-forge/lib/forge.js
var require_forge = __commonJS({
  "node_modules/node-forge/lib/forge.js"(exports, module) {
    module.exports = {
      // default options
      options: {
        usePureJavaScript: false
      }
    };
  }
});

// node_modules/node-forge/lib/baseN.js
var require_baseN = __commonJS({
  "node_modules/node-forge/lib/baseN.js"(exports, module) {
    var api = {};
    module.exports = api;
    var _reverseAlphabets = {};
    api.encode = function(input, alphabet, maxline) {
      if (typeof alphabet !== "string") {
        throw new TypeError('"alphabet" must be a string.');
      }
      if (maxline !== void 0 && typeof maxline !== "number") {
        throw new TypeError('"maxline" must be a number.');
      }
      var output = "";
      if (!(input instanceof Uint8Array)) {
        output = _encodeWithByteBuffer(input, alphabet);
      } else {
        var i2 = 0;
        var base = alphabet.length;
        var first = alphabet.charAt(0);
        var digits = [0];
        for (i2 = 0; i2 < input.length; ++i2) {
          for (var j = 0, carry = input[i2]; j < digits.length; ++j) {
            carry += digits[j] << 8;
            digits[j] = carry % base;
            carry = carry / base | 0;
          }
          while (carry > 0) {
            digits.push(carry % base);
            carry = carry / base | 0;
          }
        }
        for (i2 = 0; input[i2] === 0 && i2 < input.length - 1; ++i2) {
          output += first;
        }
        for (i2 = digits.length - 1; i2 >= 0; --i2) {
          output += alphabet[digits[i2]];
        }
      }
      if (maxline) {
        var regex = new RegExp(".{1," + maxline + "}", "g");
        output = output.match(regex).join("\r\n");
      }
      return output;
    };
    api.decode = function(input, alphabet) {
      if (typeof input !== "string") {
        throw new TypeError('"input" must be a string.');
      }
      if (typeof alphabet !== "string") {
        throw new TypeError('"alphabet" must be a string.');
      }
      var table = _reverseAlphabets[alphabet];
      if (!table) {
        table = _reverseAlphabets[alphabet] = [];
        for (var i2 = 0; i2 < alphabet.length; ++i2) {
          table[alphabet.charCodeAt(i2)] = i2;
        }
      }
      input = input.replace(/\s/g, "");
      var base = alphabet.length;
      var first = alphabet.charAt(0);
      var bytes = [0];
      for (var i2 = 0; i2 < input.length; i2++) {
        var value = table[input.charCodeAt(i2)];
        if (value === void 0) {
          return;
        }
        for (var j = 0, carry = value; j < bytes.length; ++j) {
          carry += bytes[j] * base;
          bytes[j] = carry & 255;
          carry >>= 8;
        }
        while (carry > 0) {
          bytes.push(carry & 255);
          carry >>= 8;
        }
      }
      for (var k = 0; input[k] === first && k < input.length - 1; ++k) {
        bytes.push(0);
      }
      if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes.reverse());
      }
      return new Uint8Array(bytes.reverse());
    };
    function _encodeWithByteBuffer(input, alphabet) {
      var i2 = 0;
      var base = alphabet.length;
      var first = alphabet.charAt(0);
      var digits = [0];
      for (i2 = 0; i2 < input.length(); ++i2) {
        for (var j = 0, carry = input.at(i2); j < digits.length; ++j) {
          carry += digits[j] << 8;
          digits[j] = carry % base;
          carry = carry / base | 0;
        }
        while (carry > 0) {
          digits.push(carry % base);
          carry = carry / base | 0;
        }
      }
      var output = "";
      for (i2 = 0; input.at(i2) === 0 && i2 < input.length() - 1; ++i2) {
        output += first;
      }
      for (i2 = digits.length - 1; i2 >= 0; --i2) {
        output += alphabet[digits[i2]];
      }
      return output;
    }
  }
});

// node_modules/node-forge/lib/util.js
var require_util = __commonJS({
  "node_modules/node-forge/lib/util.js"(exports, module) {
    var forge2 = require_forge();
    var baseN = require_baseN();
    var util = module.exports = forge2.util = forge2.util || {};
    (function() {
      if (typeof process !== "undefined" && process.nextTick && !process.browser) {
        util.nextTick = process.nextTick;
        if (typeof setImmediate === "function") {
          util.setImmediate = setImmediate;
        } else {
          util.setImmediate = util.nextTick;
        }
        return;
      }
      if (typeof setImmediate === "function") {
        util.setImmediate = function() {
          return setImmediate.apply(void 0, arguments);
        };
        util.nextTick = function(callback) {
          return setImmediate(callback);
        };
        return;
      }
      util.setImmediate = function(callback) {
        setTimeout(callback, 0);
      };
      if (typeof window !== "undefined" && typeof window.postMessage === "function") {
        let handler2 = function(event) {
          if (event.source === window && event.data === msg) {
            event.stopPropagation();
            var copy = callbacks.slice();
            callbacks.length = 0;
            copy.forEach(function(callback) {
              callback();
            });
          }
        };
        var handler = handler2;
        var msg = "forge.setImmediate";
        var callbacks = [];
        util.setImmediate = function(callback) {
          callbacks.push(callback);
          if (callbacks.length === 1) {
            window.postMessage(msg, "*");
          }
        };
        window.addEventListener("message", handler2, true);
      }
      if (typeof MutationObserver !== "undefined") {
        var now = Date.now();
        var attr = true;
        var div = document.createElement("div");
        var callbacks = [];
        new MutationObserver(function() {
          var copy = callbacks.slice();
          callbacks.length = 0;
          copy.forEach(function(callback) {
            callback();
          });
        }).observe(div, { attributes: true });
        var oldSetImmediate = util.setImmediate;
        util.setImmediate = function(callback) {
          if (Date.now() - now > 15) {
            now = Date.now();
            oldSetImmediate(callback);
          } else {
            callbacks.push(callback);
            if (callbacks.length === 1) {
              div.setAttribute("a", attr = !attr);
            }
          }
        };
      }
      util.nextTick = util.setImmediate;
    })();
    util.isNodejs = typeof process !== "undefined" && process.versions && process.versions.node;
    util.globalScope = (function() {
      if (util.isNodejs) {
        return global;
      }
      return typeof self === "undefined" ? window : self;
    })();
    util.isArray = Array.isArray || function(x2) {
      return Object.prototype.toString.call(x2) === "[object Array]";
    };
    util.isArrayBuffer = function(x2) {
      return typeof ArrayBuffer !== "undefined" && x2 instanceof ArrayBuffer;
    };
    util.isArrayBufferView = function(x2) {
      return x2 && util.isArrayBuffer(x2.buffer) && x2.byteLength !== void 0;
    };
    function _checkBitsParam(n) {
      if (!(n === 8 || n === 16 || n === 24 || n === 32)) {
        throw new Error("Only 8, 16, 24, or 32 bits supported: " + n);
      }
    }
    util.ByteBuffer = ByteStringBuffer;
    function ByteStringBuffer(b) {
      this.data = "";
      this.read = 0;
      if (typeof b === "string") {
        this.data = b;
      } else if (util.isArrayBuffer(b) || util.isArrayBufferView(b)) {
        if (typeof Buffer !== "undefined" && b instanceof Buffer) {
          this.data = b.toString("binary");
        } else {
          var arr = new Uint8Array(b);
          try {
            this.data = String.fromCharCode.apply(null, arr);
          } catch (e) {
            for (var i2 = 0; i2 < arr.length; ++i2) {
              this.putByte(arr[i2]);
            }
          }
        }
      } else if (b instanceof ByteStringBuffer || typeof b === "object" && typeof b.data === "string" && typeof b.read === "number") {
        this.data = b.data;
        this.read = b.read;
      }
      this._constructedStringLength = 0;
    }
    util.ByteStringBuffer = ByteStringBuffer;
    var _MAX_CONSTRUCTED_STRING_LENGTH = 4096;
    util.ByteStringBuffer.prototype._optimizeConstructedString = function(x2) {
      this._constructedStringLength += x2;
      if (this._constructedStringLength > _MAX_CONSTRUCTED_STRING_LENGTH) {
        this.data.substr(0, 1);
        this._constructedStringLength = 0;
      }
    };
    util.ByteStringBuffer.prototype.length = function() {
      return this.data.length - this.read;
    };
    util.ByteStringBuffer.prototype.isEmpty = function() {
      return this.length() <= 0;
    };
    util.ByteStringBuffer.prototype.putByte = function(b) {
      return this.putBytes(String.fromCharCode(b));
    };
    util.ByteStringBuffer.prototype.fillWithByte = function(b, n) {
      b = String.fromCharCode(b);
      var d = this.data;
      while (n > 0) {
        if (n & 1) {
          d += b;
        }
        n >>>= 1;
        if (n > 0) {
          b += b;
        }
      }
      this.data = d;
      this._optimizeConstructedString(n);
      return this;
    };
    util.ByteStringBuffer.prototype.putBytes = function(bytes) {
      this.data += bytes;
      this._optimizeConstructedString(bytes.length);
      return this;
    };
    util.ByteStringBuffer.prototype.putString = function(str) {
      return this.putBytes(util.encodeUtf8(str));
    };
    util.ByteStringBuffer.prototype.putInt16 = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt24 = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 >> 16 & 255) + String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt32 = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 >> 24 & 255) + String.fromCharCode(i2 >> 16 & 255) + String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt16Le = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 & 255) + String.fromCharCode(i2 >> 8 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt24Le = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 & 255) + String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 >> 16 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt32Le = function(i2) {
      return this.putBytes(
        String.fromCharCode(i2 & 255) + String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 >> 16 & 255) + String.fromCharCode(i2 >> 24 & 255)
      );
    };
    util.ByteStringBuffer.prototype.putInt = function(i2, n) {
      _checkBitsParam(n);
      var bytes = "";
      do {
        n -= 8;
        bytes += String.fromCharCode(i2 >> n & 255);
      } while (n > 0);
      return this.putBytes(bytes);
    };
    util.ByteStringBuffer.prototype.putSignedInt = function(i2, n) {
      if (i2 < 0) {
        i2 += 2 << n - 1;
      }
      return this.putInt(i2, n);
    };
    util.ByteStringBuffer.prototype.putBuffer = function(buffer) {
      return this.putBytes(buffer.getBytes());
    };
    util.ByteStringBuffer.prototype.getByte = function() {
      return this.data.charCodeAt(this.read++);
    };
    util.ByteStringBuffer.prototype.getInt16 = function() {
      var rval = this.data.charCodeAt(this.read) << 8 ^ this.data.charCodeAt(this.read + 1);
      this.read += 2;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt24 = function() {
      var rval = this.data.charCodeAt(this.read) << 16 ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2);
      this.read += 3;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt32 = function() {
      var rval = this.data.charCodeAt(this.read) << 24 ^ this.data.charCodeAt(this.read + 1) << 16 ^ this.data.charCodeAt(this.read + 2) << 8 ^ this.data.charCodeAt(this.read + 3);
      this.read += 4;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt16Le = function() {
      var rval = this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8;
      this.read += 2;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt24Le = function() {
      var rval = this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2) << 16;
      this.read += 3;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt32Le = function() {
      var rval = this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2) << 16 ^ this.data.charCodeAt(this.read + 3) << 24;
      this.read += 4;
      return rval;
    };
    util.ByteStringBuffer.prototype.getInt = function(n) {
      _checkBitsParam(n);
      var rval = 0;
      do {
        rval = (rval << 8) + this.data.charCodeAt(this.read++);
        n -= 8;
      } while (n > 0);
      return rval;
    };
    util.ByteStringBuffer.prototype.getSignedInt = function(n) {
      var x2 = this.getInt(n);
      var max = 2 << n - 2;
      if (x2 >= max) {
        x2 -= max << 1;
      }
      return x2;
    };
    util.ByteStringBuffer.prototype.getBytes = function(count) {
      var rval;
      if (count) {
        count = Math.min(this.length(), count);
        rval = this.data.slice(this.read, this.read + count);
        this.read += count;
      } else if (count === 0) {
        rval = "";
      } else {
        rval = this.read === 0 ? this.data : this.data.slice(this.read);
        this.clear();
      }
      return rval;
    };
    util.ByteStringBuffer.prototype.bytes = function(count) {
      return typeof count === "undefined" ? this.data.slice(this.read) : this.data.slice(this.read, this.read + count);
    };
    util.ByteStringBuffer.prototype.at = function(i2) {
      return this.data.charCodeAt(this.read + i2);
    };
    util.ByteStringBuffer.prototype.setAt = function(i2, b) {
      this.data = this.data.substr(0, this.read + i2) + String.fromCharCode(b) + this.data.substr(this.read + i2 + 1);
      return this;
    };
    util.ByteStringBuffer.prototype.last = function() {
      return this.data.charCodeAt(this.data.length - 1);
    };
    util.ByteStringBuffer.prototype.copy = function() {
      var c = util.createBuffer(this.data);
      c.read = this.read;
      return c;
    };
    util.ByteStringBuffer.prototype.compact = function() {
      if (this.read > 0) {
        this.data = this.data.slice(this.read);
        this.read = 0;
      }
      return this;
    };
    util.ByteStringBuffer.prototype.clear = function() {
      this.data = "";
      this.read = 0;
      return this;
    };
    util.ByteStringBuffer.prototype.truncate = function(count) {
      var len = Math.max(0, this.length() - count);
      this.data = this.data.substr(this.read, len);
      this.read = 0;
      return this;
    };
    util.ByteStringBuffer.prototype.toHex = function() {
      var rval = "";
      for (var i2 = this.read; i2 < this.data.length; ++i2) {
        var b = this.data.charCodeAt(i2);
        if (b < 16) {
          rval += "0";
        }
        rval += b.toString(16);
      }
      return rval;
    };
    util.ByteStringBuffer.prototype.toString = function() {
      return util.decodeUtf8(this.bytes());
    };
    function DataBuffer(b, options) {
      options = options || {};
      this.read = options.readOffset || 0;
      this.growSize = options.growSize || 1024;
      var isArrayBuffer = util.isArrayBuffer(b);
      var isArrayBufferView = util.isArrayBufferView(b);
      if (isArrayBuffer || isArrayBufferView) {
        if (isArrayBuffer) {
          this.data = new DataView(b);
        } else {
          this.data = new DataView(b.buffer, b.byteOffset, b.byteLength);
        }
        this.write = "writeOffset" in options ? options.writeOffset : this.data.byteLength;
        return;
      }
      this.data = new DataView(new ArrayBuffer(0));
      this.write = 0;
      if (b !== null && b !== void 0) {
        this.putBytes(b);
      }
      if ("writeOffset" in options) {
        this.write = options.writeOffset;
      }
    }
    util.DataBuffer = DataBuffer;
    util.DataBuffer.prototype.length = function() {
      return this.write - this.read;
    };
    util.DataBuffer.prototype.isEmpty = function() {
      return this.length() <= 0;
    };
    util.DataBuffer.prototype.accommodate = function(amount, growSize) {
      if (this.length() >= amount) {
        return this;
      }
      growSize = Math.max(growSize || this.growSize, amount);
      var src = new Uint8Array(
        this.data.buffer,
        this.data.byteOffset,
        this.data.byteLength
      );
      var dst = new Uint8Array(this.length() + growSize);
      dst.set(src);
      this.data = new DataView(dst.buffer);
      return this;
    };
    util.DataBuffer.prototype.putByte = function(b) {
      this.accommodate(1);
      this.data.setUint8(this.write++, b);
      return this;
    };
    util.DataBuffer.prototype.fillWithByte = function(b, n) {
      this.accommodate(n);
      for (var i2 = 0; i2 < n; ++i2) {
        this.data.setUint8(b);
      }
      return this;
    };
    util.DataBuffer.prototype.putBytes = function(bytes, encoding) {
      if (util.isArrayBufferView(bytes)) {
        var src = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var len = src.byteLength - src.byteOffset;
        this.accommodate(len);
        var dst = new Uint8Array(this.data.buffer, this.write);
        dst.set(src);
        this.write += len;
        return this;
      }
      if (util.isArrayBuffer(bytes)) {
        var src = new Uint8Array(bytes);
        this.accommodate(src.byteLength);
        var dst = new Uint8Array(this.data.buffer);
        dst.set(src, this.write);
        this.write += src.byteLength;
        return this;
      }
      if (bytes instanceof util.DataBuffer || typeof bytes === "object" && typeof bytes.read === "number" && typeof bytes.write === "number" && util.isArrayBufferView(bytes.data)) {
        var src = new Uint8Array(bytes.data.byteLength, bytes.read, bytes.length());
        this.accommodate(src.byteLength);
        var dst = new Uint8Array(bytes.data.byteLength, this.write);
        dst.set(src);
        this.write += src.byteLength;
        return this;
      }
      if (bytes instanceof util.ByteStringBuffer) {
        bytes = bytes.data;
        encoding = "binary";
      }
      encoding = encoding || "binary";
      if (typeof bytes === "string") {
        var view;
        if (encoding === "hex") {
          this.accommodate(Math.ceil(bytes.length / 2));
          view = new Uint8Array(this.data.buffer, this.write);
          this.write += util.binary.hex.decode(bytes, view, this.write);
          return this;
        }
        if (encoding === "base64") {
          this.accommodate(Math.ceil(bytes.length / 4) * 3);
          view = new Uint8Array(this.data.buffer, this.write);
          this.write += util.binary.base64.decode(bytes, view, this.write);
          return this;
        }
        if (encoding === "utf8") {
          bytes = util.encodeUtf8(bytes);
          encoding = "binary";
        }
        if (encoding === "binary" || encoding === "raw") {
          this.accommodate(bytes.length);
          view = new Uint8Array(this.data.buffer, this.write);
          this.write += util.binary.raw.decode(view);
          return this;
        }
        if (encoding === "utf16") {
          this.accommodate(bytes.length * 2);
          view = new Uint16Array(this.data.buffer, this.write);
          this.write += util.text.utf16.encode(view);
          return this;
        }
        throw new Error("Invalid encoding: " + encoding);
      }
      throw Error("Invalid parameter: " + bytes);
    };
    util.DataBuffer.prototype.putBuffer = function(buffer) {
      this.putBytes(buffer);
      buffer.clear();
      return this;
    };
    util.DataBuffer.prototype.putString = function(str) {
      return this.putBytes(str, "utf16");
    };
    util.DataBuffer.prototype.putInt16 = function(i2) {
      this.accommodate(2);
      this.data.setInt16(this.write, i2);
      this.write += 2;
      return this;
    };
    util.DataBuffer.prototype.putInt24 = function(i2) {
      this.accommodate(3);
      this.data.setInt16(this.write, i2 >> 8 & 65535);
      this.data.setInt8(this.write, i2 >> 16 & 255);
      this.write += 3;
      return this;
    };
    util.DataBuffer.prototype.putInt32 = function(i2) {
      this.accommodate(4);
      this.data.setInt32(this.write, i2);
      this.write += 4;
      return this;
    };
    util.DataBuffer.prototype.putInt16Le = function(i2) {
      this.accommodate(2);
      this.data.setInt16(this.write, i2, true);
      this.write += 2;
      return this;
    };
    util.DataBuffer.prototype.putInt24Le = function(i2) {
      this.accommodate(3);
      this.data.setInt8(this.write, i2 >> 16 & 255);
      this.data.setInt16(this.write, i2 >> 8 & 65535, true);
      this.write += 3;
      return this;
    };
    util.DataBuffer.prototype.putInt32Le = function(i2) {
      this.accommodate(4);
      this.data.setInt32(this.write, i2, true);
      this.write += 4;
      return this;
    };
    util.DataBuffer.prototype.putInt = function(i2, n) {
      _checkBitsParam(n);
      this.accommodate(n / 8);
      do {
        n -= 8;
        this.data.setInt8(this.write++, i2 >> n & 255);
      } while (n > 0);
      return this;
    };
    util.DataBuffer.prototype.putSignedInt = function(i2, n) {
      _checkBitsParam(n);
      this.accommodate(n / 8);
      if (i2 < 0) {
        i2 += 2 << n - 1;
      }
      return this.putInt(i2, n);
    };
    util.DataBuffer.prototype.getByte = function() {
      return this.data.getInt8(this.read++);
    };
    util.DataBuffer.prototype.getInt16 = function() {
      var rval = this.data.getInt16(this.read);
      this.read += 2;
      return rval;
    };
    util.DataBuffer.prototype.getInt24 = function() {
      var rval = this.data.getInt16(this.read) << 8 ^ this.data.getInt8(this.read + 2);
      this.read += 3;
      return rval;
    };
    util.DataBuffer.prototype.getInt32 = function() {
      var rval = this.data.getInt32(this.read);
      this.read += 4;
      return rval;
    };
    util.DataBuffer.prototype.getInt16Le = function() {
      var rval = this.data.getInt16(this.read, true);
      this.read += 2;
      return rval;
    };
    util.DataBuffer.prototype.getInt24Le = function() {
      var rval = this.data.getInt8(this.read) ^ this.data.getInt16(this.read + 1, true) << 8;
      this.read += 3;
      return rval;
    };
    util.DataBuffer.prototype.getInt32Le = function() {
      var rval = this.data.getInt32(this.read, true);
      this.read += 4;
      return rval;
    };
    util.DataBuffer.prototype.getInt = function(n) {
      _checkBitsParam(n);
      var rval = 0;
      do {
        rval = (rval << 8) + this.data.getInt8(this.read++);
        n -= 8;
      } while (n > 0);
      return rval;
    };
    util.DataBuffer.prototype.getSignedInt = function(n) {
      var x2 = this.getInt(n);
      var max = 2 << n - 2;
      if (x2 >= max) {
        x2 -= max << 1;
      }
      return x2;
    };
    util.DataBuffer.prototype.getBytes = function(count) {
      var rval;
      if (count) {
        count = Math.min(this.length(), count);
        rval = this.data.slice(this.read, this.read + count);
        this.read += count;
      } else if (count === 0) {
        rval = "";
      } else {
        rval = this.read === 0 ? this.data : this.data.slice(this.read);
        this.clear();
      }
      return rval;
    };
    util.DataBuffer.prototype.bytes = function(count) {
      return typeof count === "undefined" ? this.data.slice(this.read) : this.data.slice(this.read, this.read + count);
    };
    util.DataBuffer.prototype.at = function(i2) {
      return this.data.getUint8(this.read + i2);
    };
    util.DataBuffer.prototype.setAt = function(i2, b) {
      this.data.setUint8(i2, b);
      return this;
    };
    util.DataBuffer.prototype.last = function() {
      return this.data.getUint8(this.write - 1);
    };
    util.DataBuffer.prototype.copy = function() {
      return new util.DataBuffer(this);
    };
    util.DataBuffer.prototype.compact = function() {
      if (this.read > 0) {
        var src = new Uint8Array(this.data.buffer, this.read);
        var dst = new Uint8Array(src.byteLength);
        dst.set(src);
        this.data = new DataView(dst);
        this.write -= this.read;
        this.read = 0;
      }
      return this;
    };
    util.DataBuffer.prototype.clear = function() {
      this.data = new DataView(new ArrayBuffer(0));
      this.read = this.write = 0;
      return this;
    };
    util.DataBuffer.prototype.truncate = function(count) {
      this.write = Math.max(0, this.length() - count);
      this.read = Math.min(this.read, this.write);
      return this;
    };
    util.DataBuffer.prototype.toHex = function() {
      var rval = "";
      for (var i2 = this.read; i2 < this.data.byteLength; ++i2) {
        var b = this.data.getUint8(i2);
        if (b < 16) {
          rval += "0";
        }
        rval += b.toString(16);
      }
      return rval;
    };
    util.DataBuffer.prototype.toString = function(encoding) {
      var view = new Uint8Array(this.data, this.read, this.length());
      encoding = encoding || "utf8";
      if (encoding === "binary" || encoding === "raw") {
        return util.binary.raw.encode(view);
      }
      if (encoding === "hex") {
        return util.binary.hex.encode(view);
      }
      if (encoding === "base64") {
        return util.binary.base64.encode(view);
      }
      if (encoding === "utf8") {
        return util.text.utf8.decode(view);
      }
      if (encoding === "utf16") {
        return util.text.utf16.decode(view);
      }
      throw new Error("Invalid encoding: " + encoding);
    };
    util.createBuffer = function(input, encoding) {
      encoding = encoding || "raw";
      if (input !== void 0 && encoding === "utf8") {
        input = util.encodeUtf8(input);
      }
      return new util.ByteBuffer(input);
    };
    util.fillString = function(c, n) {
      var s = "";
      while (n > 0) {
        if (n & 1) {
          s += c;
        }
        n >>>= 1;
        if (n > 0) {
          c += c;
        }
      }
      return s;
    };
    util.xorBytes = function(s1, s2, n) {
      var s3 = "";
      var b = "";
      var t = "";
      var i2 = 0;
      var c = 0;
      for (; n > 0; --n, ++i2) {
        b = s1.charCodeAt(i2) ^ s2.charCodeAt(i2);
        if (c >= 10) {
          s3 += t;
          t = "";
          c = 0;
        }
        t += String.fromCharCode(b);
        ++c;
      }
      s3 += t;
      return s3;
    };
    util.hexToBytes = function(hex) {
      var rval = "";
      var i2 = 0;
      if (hex.length & true) {
        i2 = 1;
        rval += String.fromCharCode(parseInt(hex[0], 16));
      }
      for (; i2 < hex.length; i2 += 2) {
        rval += String.fromCharCode(parseInt(hex.substr(i2, 2), 16));
      }
      return rval;
    };
    util.bytesToHex = function(bytes) {
      return util.createBuffer(bytes).toHex();
    };
    util.int32ToBytes = function(i2) {
      return String.fromCharCode(i2 >> 24 & 255) + String.fromCharCode(i2 >> 16 & 255) + String.fromCharCode(i2 >> 8 & 255) + String.fromCharCode(i2 & 255);
    };
    var _base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var _base64Idx = [
      /*43 -43 = 0*/
      /*'+',  1,  2,  3,'/' */
      62,
      -1,
      -1,
      -1,
      63,
      /*'0','1','2','3','4','5','6','7','8','9' */
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      /*15, 16, 17,'=', 19, 20, 21 */
      -1,
      -1,
      -1,
      64,
      -1,
      -1,
      -1,
      /*65 - 43 = 22*/
      /*'A','B','C','D','E','F','G','H','I','J','K','L','M', */
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      /*'N','O','P','Q','R','S','T','U','V','W','X','Y','Z' */
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      /*91 - 43 = 48 */
      /*48, 49, 50, 51, 52, 53 */
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      /*97 - 43 = 54*/
      /*'a','b','c','d','e','f','g','h','i','j','k','l','m' */
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      /*'n','o','p','q','r','s','t','u','v','w','x','y','z' */
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51
    ];
    var _base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    util.encode64 = function(input, maxline) {
      var line = "";
      var output = "";
      var chr1, chr2, chr3;
      var i2 = 0;
      while (i2 < input.length) {
        chr1 = input.charCodeAt(i2++);
        chr2 = input.charCodeAt(i2++);
        chr3 = input.charCodeAt(i2++);
        line += _base64.charAt(chr1 >> 2);
        line += _base64.charAt((chr1 & 3) << 4 | chr2 >> 4);
        if (isNaN(chr2)) {
          line += "==";
        } else {
          line += _base64.charAt((chr2 & 15) << 2 | chr3 >> 6);
          line += isNaN(chr3) ? "=" : _base64.charAt(chr3 & 63);
        }
        if (maxline && line.length > maxline) {
          output += line.substr(0, maxline) + "\r\n";
          line = line.substr(maxline);
        }
      }
      output += line;
      return output;
    };
    util.decode64 = function(input) {
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
      var output = "";
      var enc1, enc2, enc3, enc4;
      var i2 = 0;
      while (i2 < input.length) {
        enc1 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc2 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc3 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc4 = _base64Idx[input.charCodeAt(i2++) - 43];
        output += String.fromCharCode(enc1 << 2 | enc2 >> 4);
        if (enc3 !== 64) {
          output += String.fromCharCode((enc2 & 15) << 4 | enc3 >> 2);
          if (enc4 !== 64) {
            output += String.fromCharCode((enc3 & 3) << 6 | enc4);
          }
        }
      }
      return output;
    };
    util.encodeUtf8 = function(str) {
      return unescape(encodeURIComponent(str));
    };
    util.decodeUtf8 = function(str) {
      return decodeURIComponent(escape(str));
    };
    util.binary = {
      raw: {},
      hex: {},
      base64: {},
      base58: {},
      baseN: {
        encode: baseN.encode,
        decode: baseN.decode
      }
    };
    util.binary.raw.encode = function(bytes) {
      return String.fromCharCode.apply(null, bytes);
    };
    util.binary.raw.decode = function(str, output, offset) {
      var out = output;
      if (!out) {
        out = new Uint8Array(str.length);
      }
      offset = offset || 0;
      var j = offset;
      for (var i2 = 0; i2 < str.length; ++i2) {
        out[j++] = str.charCodeAt(i2);
      }
      return output ? j - offset : out;
    };
    util.binary.hex.encode = util.bytesToHex;
    util.binary.hex.decode = function(hex, output, offset) {
      var out = output;
      if (!out) {
        out = new Uint8Array(Math.ceil(hex.length / 2));
      }
      offset = offset || 0;
      var i2 = 0, j = offset;
      if (hex.length & 1) {
        i2 = 1;
        out[j++] = parseInt(hex[0], 16);
      }
      for (; i2 < hex.length; i2 += 2) {
        out[j++] = parseInt(hex.substr(i2, 2), 16);
      }
      return output ? j - offset : out;
    };
    util.binary.base64.encode = function(input, maxline) {
      var line = "";
      var output = "";
      var chr1, chr2, chr3;
      var i2 = 0;
      while (i2 < input.byteLength) {
        chr1 = input[i2++];
        chr2 = input[i2++];
        chr3 = input[i2++];
        line += _base64.charAt(chr1 >> 2);
        line += _base64.charAt((chr1 & 3) << 4 | chr2 >> 4);
        if (isNaN(chr2)) {
          line += "==";
        } else {
          line += _base64.charAt((chr2 & 15) << 2 | chr3 >> 6);
          line += isNaN(chr3) ? "=" : _base64.charAt(chr3 & 63);
        }
        if (maxline && line.length > maxline) {
          output += line.substr(0, maxline) + "\r\n";
          line = line.substr(maxline);
        }
      }
      output += line;
      return output;
    };
    util.binary.base64.decode = function(input, output, offset) {
      var out = output;
      if (!out) {
        out = new Uint8Array(Math.ceil(input.length / 4) * 3);
      }
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
      offset = offset || 0;
      var enc1, enc2, enc3, enc4;
      var i2 = 0, j = offset;
      while (i2 < input.length) {
        enc1 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc2 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc3 = _base64Idx[input.charCodeAt(i2++) - 43];
        enc4 = _base64Idx[input.charCodeAt(i2++) - 43];
        out[j++] = enc1 << 2 | enc2 >> 4;
        if (enc3 !== 64) {
          out[j++] = (enc2 & 15) << 4 | enc3 >> 2;
          if (enc4 !== 64) {
            out[j++] = (enc3 & 3) << 6 | enc4;
          }
        }
      }
      return output ? j - offset : out.subarray(0, j);
    };
    util.binary.base58.encode = function(input, maxline) {
      return util.binary.baseN.encode(input, _base58, maxline);
    };
    util.binary.base58.decode = function(input, maxline) {
      return util.binary.baseN.decode(input, _base58, maxline);
    };
    util.text = {
      utf8: {},
      utf16: {}
    };
    util.text.utf8.encode = function(str, output, offset) {
      str = util.encodeUtf8(str);
      var out = output;
      if (!out) {
        out = new Uint8Array(str.length);
      }
      offset = offset || 0;
      var j = offset;
      for (var i2 = 0; i2 < str.length; ++i2) {
        out[j++] = str.charCodeAt(i2);
      }
      return output ? j - offset : out;
    };
    util.text.utf8.decode = function(bytes) {
      return util.decodeUtf8(String.fromCharCode.apply(null, bytes));
    };
    util.text.utf16.encode = function(str, output, offset) {
      var out = output;
      if (!out) {
        out = new Uint8Array(str.length * 2);
      }
      var view = new Uint16Array(out.buffer);
      offset = offset || 0;
      var j = offset;
      var k = offset;
      for (var i2 = 0; i2 < str.length; ++i2) {
        view[k++] = str.charCodeAt(i2);
        j += 2;
      }
      return output ? j - offset : out;
    };
    util.text.utf16.decode = function(bytes) {
      return String.fromCharCode.apply(null, new Uint16Array(bytes.buffer));
    };
    util.deflate = function(api, bytes, raw) {
      bytes = util.decode64(api.deflate(util.encode64(bytes)).rval);
      if (raw) {
        var start = 2;
        var flg = bytes.charCodeAt(1);
        if (flg & 32) {
          start = 6;
        }
        bytes = bytes.substring(start, bytes.length - 4);
      }
      return bytes;
    };
    util.inflate = function(api, bytes, raw) {
      var rval = api.inflate(util.encode64(bytes)).rval;
      return rval === null ? null : util.decode64(rval);
    };
    var _setStorageObject = function(api, id, obj) {
      if (!api) {
        throw new Error("WebStorage not available.");
      }
      var rval;
      if (obj === null) {
        rval = api.removeItem(id);
      } else {
        obj = util.encode64(JSON.stringify(obj));
        rval = api.setItem(id, obj);
      }
      if (typeof rval !== "undefined" && rval.rval !== true) {
        var error = new Error(rval.error.message);
        error.id = rval.error.id;
        error.name = rval.error.name;
        throw error;
      }
    };
    var _getStorageObject = function(api, id) {
      if (!api) {
        throw new Error("WebStorage not available.");
      }
      var rval = api.getItem(id);
      if (api.init) {
        if (rval.rval === null) {
          if (rval.error) {
            var error = new Error(rval.error.message);
            error.id = rval.error.id;
            error.name = rval.error.name;
            throw error;
          }
          rval = null;
        } else {
          rval = rval.rval;
        }
      }
      if (rval !== null) {
        rval = JSON.parse(util.decode64(rval));
      }
      return rval;
    };
    var _setItem = function(api, id, key, data) {
      var obj = _getStorageObject(api, id);
      if (obj === null) {
        obj = {};
      }
      obj[key] = data;
      _setStorageObject(api, id, obj);
    };
    var _getItem = function(api, id, key) {
      var rval = _getStorageObject(api, id);
      if (rval !== null) {
        rval = key in rval ? rval[key] : null;
      }
      return rval;
    };
    var _removeItem = function(api, id, key) {
      var obj = _getStorageObject(api, id);
      if (obj !== null && key in obj) {
        delete obj[key];
        var empty = true;
        for (var prop in obj) {
          empty = false;
          break;
        }
        if (empty) {
          obj = null;
        }
        _setStorageObject(api, id, obj);
      }
    };
    var _clearItems = function(api, id) {
      _setStorageObject(api, id, null);
    };
    var _callStorageFunction = function(func, args, location) {
      var rval = null;
      if (typeof location === "undefined") {
        location = ["web", "flash"];
      }
      var type;
      var done = false;
      var exception = null;
      for (var idx in location) {
        type = location[idx];
        try {
          if (type === "flash" || type === "both") {
            if (args[0] === null) {
              throw new Error("Flash local storage not available.");
            }
            rval = func.apply(this, args);
            done = type === "flash";
          }
          if (type === "web" || type === "both") {
            args[0] = localStorage;
            rval = func.apply(this, args);
            done = true;
          }
        } catch (ex) {
          exception = ex;
        }
        if (done) {
          break;
        }
      }
      if (!done) {
        throw exception;
      }
      return rval;
    };
    util.setItem = function(api, id, key, data, location) {
      _callStorageFunction(_setItem, arguments, location);
    };
    util.getItem = function(api, id, key, location) {
      return _callStorageFunction(_getItem, arguments, location);
    };
    util.removeItem = function(api, id, key, location) {
      _callStorageFunction(_removeItem, arguments, location);
    };
    util.clearItems = function(api, id, location) {
      _callStorageFunction(_clearItems, arguments, location);
    };
    util.isEmpty = function(obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          return false;
        }
      }
      return true;
    };
    util.format = function(format) {
      var re = /%./g;
      var match;
      var part;
      var argi = 0;
      var parts = [];
      var last = 0;
      while (match = re.exec(format)) {
        part = format.substring(last, re.lastIndex - 2);
        if (part.length > 0) {
          parts.push(part);
        }
        last = re.lastIndex;
        var code = match[0][1];
        switch (code) {
          case "s":
          case "o":
            if (argi < arguments.length) {
              parts.push(arguments[argi++ + 1]);
            } else {
              parts.push("<?>");
            }
            break;
          // FIXME: do proper formating for numbers, etc
          //case 'f':
          //case 'd':
          case "%":
            parts.push("%");
            break;
          default:
            parts.push("<%" + code + "?>");
        }
      }
      parts.push(format.substring(last));
      return parts.join("");
    };
    util.formatNumber = function(number, decimals, dec_point, thousands_sep) {
      var n = number, c = isNaN(decimals = Math.abs(decimals)) ? 2 : decimals;
      var d = dec_point === void 0 ? "," : dec_point;
      var t = thousands_sep === void 0 ? "." : thousands_sep, s = n < 0 ? "-" : "";
      var i2 = parseInt(n = Math.abs(+n || 0).toFixed(c), 10) + "";
      var j = i2.length > 3 ? i2.length % 3 : 0;
      return s + (j ? i2.substr(0, j) + t : "") + i2.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i2).toFixed(c).slice(2) : "");
    };
    util.formatSize = function(size) {
      if (size >= 1073741824) {
        size = util.formatNumber(size / 1073741824, 2, ".", "") + " GiB";
      } else if (size >= 1048576) {
        size = util.formatNumber(size / 1048576, 2, ".", "") + " MiB";
      } else if (size >= 1024) {
        size = util.formatNumber(size / 1024, 0) + " KiB";
      } else {
        size = util.formatNumber(size, 0) + " bytes";
      }
      return size;
    };
    util.bytesFromIP = function(ip) {
      if (ip.indexOf(".") !== -1) {
        return util.bytesFromIPv4(ip);
      }
      if (ip.indexOf(":") !== -1) {
        return util.bytesFromIPv6(ip);
      }
      return null;
    };
    util.bytesFromIPv4 = function(ip) {
      ip = ip.split(".");
      if (ip.length !== 4) {
        return null;
      }
      var b = util.createBuffer();
      for (var i2 = 0; i2 < ip.length; ++i2) {
        var num = parseInt(ip[i2], 10);
        if (isNaN(num)) {
          return null;
        }
        b.putByte(num);
      }
      return b.getBytes();
    };
    util.bytesFromIPv6 = function(ip) {
      var blanks = 0;
      ip = ip.split(":").filter(function(e) {
        if (e.length === 0) ++blanks;
        return true;
      });
      var zeros = (8 - ip.length + blanks) * 2;
      var b = util.createBuffer();
      for (var i2 = 0; i2 < 8; ++i2) {
        if (!ip[i2] || ip[i2].length === 0) {
          b.fillWithByte(0, zeros);
          zeros = 0;
          continue;
        }
        var bytes = util.hexToBytes(ip[i2]);
        if (bytes.length < 2) {
          b.putByte(0);
        }
        b.putBytes(bytes);
      }
      return b.getBytes();
    };
    util.bytesToIP = function(bytes) {
      if (bytes.length === 4) {
        return util.bytesToIPv4(bytes);
      }
      if (bytes.length === 16) {
        return util.bytesToIPv6(bytes);
      }
      return null;
    };
    util.bytesToIPv4 = function(bytes) {
      if (bytes.length !== 4) {
        return null;
      }
      var ip = [];
      for (var i2 = 0; i2 < bytes.length; ++i2) {
        ip.push(bytes.charCodeAt(i2));
      }
      return ip.join(".");
    };
    util.bytesToIPv6 = function(bytes) {
      if (bytes.length !== 16) {
        return null;
      }
      var ip = [];
      var zeroGroups = [];
      var zeroMaxGroup = 0;
      for (var i2 = 0; i2 < bytes.length; i2 += 2) {
        var hex = util.bytesToHex(bytes[i2] + bytes[i2 + 1]);
        while (hex[0] === "0" && hex !== "0") {
          hex = hex.substr(1);
        }
        if (hex === "0") {
          var last = zeroGroups[zeroGroups.length - 1];
          var idx = ip.length;
          if (!last || idx !== last.end + 1) {
            zeroGroups.push({ start: idx, end: idx });
          } else {
            last.end = idx;
            if (last.end - last.start > zeroGroups[zeroMaxGroup].end - zeroGroups[zeroMaxGroup].start) {
              zeroMaxGroup = zeroGroups.length - 1;
            }
          }
        }
        ip.push(hex);
      }
      if (zeroGroups.length > 0) {
        var group = zeroGroups[zeroMaxGroup];
        if (group.end - group.start > 0) {
          ip.splice(group.start, group.end - group.start + 1, "");
          if (group.start === 0) {
            ip.unshift("");
          }
          if (group.end === 7) {
            ip.push("");
          }
        }
      }
      return ip.join(":");
    };
    util.estimateCores = function(options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      options = options || {};
      if ("cores" in util && !options.update) {
        return callback(null, util.cores);
      }
      if (typeof navigator !== "undefined" && "hardwareConcurrency" in navigator && navigator.hardwareConcurrency > 0) {
        util.cores = navigator.hardwareConcurrency;
        return callback(null, util.cores);
      }
      if (typeof Worker === "undefined") {
        util.cores = 1;
        return callback(null, util.cores);
      }
      if (typeof Blob === "undefined") {
        util.cores = 2;
        return callback(null, util.cores);
      }
      var blobUrl = URL.createObjectURL(new Blob([
        "(",
        function() {
          self.addEventListener("message", function(e) {
            var st = Date.now();
            var et2 = st + 4;
            while (Date.now() < et2) ;
            self.postMessage({ st, et: et2 });
          });
        }.toString(),
        ")()"
      ], { type: "application/javascript" }));
      sample([], 5, 16);
      function sample(max, samples, numWorkers) {
        if (samples === 0) {
          var avg = Math.floor(max.reduce(function(avg2, x2) {
            return avg2 + x2;
          }, 0) / max.length);
          util.cores = Math.max(1, avg);
          URL.revokeObjectURL(blobUrl);
          return callback(null, util.cores);
        }
        map(numWorkers, function(err2, results) {
          max.push(reduce(numWorkers, results));
          sample(max, samples - 1, numWorkers);
        });
      }
      function map(numWorkers, callback2) {
        var workers = [];
        var results = [];
        for (var i2 = 0; i2 < numWorkers; ++i2) {
          var worker = new Worker(blobUrl);
          worker.addEventListener("message", function(e) {
            results.push(e.data);
            if (results.length === numWorkers) {
              for (var i3 = 0; i3 < numWorkers; ++i3) {
                workers[i3].terminate();
              }
              callback2(null, results);
            }
          });
          workers.push(worker);
        }
        for (var i2 = 0; i2 < numWorkers; ++i2) {
          workers[i2].postMessage(i2);
        }
      }
      function reduce(numWorkers, results) {
        var overlaps = [];
        for (var n = 0; n < numWorkers; ++n) {
          var r1 = results[n];
          var overlap = overlaps[n] = [];
          for (var i2 = 0; i2 < numWorkers; ++i2) {
            if (n === i2) {
              continue;
            }
            var r2 = results[i2];
            if (r1.st > r2.st && r1.st < r2.et || r2.st > r1.st && r2.st < r1.et) {
              overlap.push(i2);
            }
          }
        }
        return overlaps.reduce(function(max, overlap2) {
          return Math.max(max, overlap2.length);
        }, 0);
      }
    };
  }
});

// node_modules/node-forge/lib/cipher.js
var require_cipher = __commonJS({
  "node_modules/node-forge/lib/cipher.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    module.exports = forge2.cipher = forge2.cipher || {};
    forge2.cipher.algorithms = forge2.cipher.algorithms || {};
    forge2.cipher.createCipher = function(algorithm, key) {
      var api = algorithm;
      if (typeof api === "string") {
        api = forge2.cipher.getAlgorithm(api);
        if (api) {
          api = api();
        }
      }
      if (!api) {
        throw new Error("Unsupported algorithm: " + algorithm);
      }
      return new forge2.cipher.BlockCipher({
        algorithm: api,
        key,
        decrypt: false
      });
    };
    forge2.cipher.createDecipher = function(algorithm, key) {
      var api = algorithm;
      if (typeof api === "string") {
        api = forge2.cipher.getAlgorithm(api);
        if (api) {
          api = api();
        }
      }
      if (!api) {
        throw new Error("Unsupported algorithm: " + algorithm);
      }
      return new forge2.cipher.BlockCipher({
        algorithm: api,
        key,
        decrypt: true
      });
    };
    forge2.cipher.registerAlgorithm = function(name, algorithm) {
      name = name.toUpperCase();
      forge2.cipher.algorithms[name] = algorithm;
    };
    forge2.cipher.getAlgorithm = function(name) {
      name = name.toUpperCase();
      if (name in forge2.cipher.algorithms) {
        return forge2.cipher.algorithms[name];
      }
      return null;
    };
    var BlockCipher = forge2.cipher.BlockCipher = function(options) {
      this.algorithm = options.algorithm;
      this.mode = this.algorithm.mode;
      this.blockSize = this.mode.blockSize;
      this._finish = false;
      this._input = null;
      this.output = null;
      this._op = options.decrypt ? this.mode.decrypt : this.mode.encrypt;
      this._decrypt = options.decrypt;
      this.algorithm.initialize(options);
    };
    BlockCipher.prototype.start = function(options) {
      options = options || {};
      var opts = {};
      for (var key in options) {
        opts[key] = options[key];
      }
      opts.decrypt = this._decrypt;
      this._finish = false;
      this._input = forge2.util.createBuffer();
      this.output = options.output || forge2.util.createBuffer();
      this.mode.start(opts);
    };
    BlockCipher.prototype.update = function(input) {
      if (input) {
        this._input.putBuffer(input);
      }
      while (!this._op.call(this.mode, this._input, this.output, this._finish) && !this._finish) {
      }
      this._input.compact();
    };
    BlockCipher.prototype.finish = function(pad) {
      if (pad && (this.mode.name === "ECB" || this.mode.name === "CBC")) {
        this.mode.pad = function(input) {
          return pad(this.blockSize, input, false);
        };
        this.mode.unpad = function(output) {
          return pad(this.blockSize, output, true);
        };
      }
      var options = {};
      options.decrypt = this._decrypt;
      options.overflow = this._input.length() % this.blockSize;
      if (!this._decrypt && this.mode.pad) {
        if (!this.mode.pad(this._input, options)) {
          return false;
        }
      }
      this._finish = true;
      this.update();
      if (this._decrypt && this.mode.unpad) {
        if (!this.mode.unpad(this.output, options)) {
          return false;
        }
      }
      if (this.mode.afterFinish) {
        if (!this.mode.afterFinish(this.output, options)) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/node-forge/lib/cipherModes.js
var require_cipherModes = __commonJS({
  "node_modules/node-forge/lib/cipherModes.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    forge2.cipher = forge2.cipher || {};
    var modes = module.exports = forge2.cipher.modes = forge2.cipher.modes || {};
    modes.ecb = function(options) {
      options = options || {};
      this.name = "ECB";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = new Array(this._ints);
      this._outBlock = new Array(this._ints);
    };
    modes.ecb.prototype.start = function(options) {
    };
    modes.ecb.prototype.encrypt = function(input, output, finish) {
      if (input.length() < this.blockSize && !(finish && input.length() > 0)) {
        return true;
      }
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._inBlock[i2] = input.getInt32();
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        output.putInt32(this._outBlock[i2]);
      }
    };
    modes.ecb.prototype.decrypt = function(input, output, finish) {
      if (input.length() < this.blockSize && !(finish && input.length() > 0)) {
        return true;
      }
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._inBlock[i2] = input.getInt32();
      }
      this.cipher.decrypt(this._inBlock, this._outBlock);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        output.putInt32(this._outBlock[i2]);
      }
    };
    modes.ecb.prototype.pad = function(input, options) {
      var padding = input.length() === this.blockSize ? this.blockSize : this.blockSize - input.length();
      input.fillWithByte(padding, padding);
      return true;
    };
    modes.ecb.prototype.unpad = function(output, options) {
      if (options.overflow > 0) {
        return false;
      }
      var len = output.length();
      var count = output.at(len - 1);
      if (count > this.blockSize << 2) {
        return false;
      }
      output.truncate(count);
      return true;
    };
    modes.cbc = function(options) {
      options = options || {};
      this.name = "CBC";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = new Array(this._ints);
      this._outBlock = new Array(this._ints);
    };
    modes.cbc.prototype.start = function(options) {
      if (options.iv === null) {
        if (!this._prev) {
          throw new Error("Invalid IV parameter.");
        }
        this._iv = this._prev.slice(0);
      } else if (!("iv" in options)) {
        throw new Error("Invalid IV parameter.");
      } else {
        this._iv = transformIV(options.iv, this.blockSize);
        this._prev = this._iv.slice(0);
      }
    };
    modes.cbc.prototype.encrypt = function(input, output, finish) {
      if (input.length() < this.blockSize && !(finish && input.length() > 0)) {
        return true;
      }
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._inBlock[i2] = this._prev[i2] ^ input.getInt32();
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        output.putInt32(this._outBlock[i2]);
      }
      this._prev = this._outBlock;
    };
    modes.cbc.prototype.decrypt = function(input, output, finish) {
      if (input.length() < this.blockSize && !(finish && input.length() > 0)) {
        return true;
      }
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._inBlock[i2] = input.getInt32();
      }
      this.cipher.decrypt(this._inBlock, this._outBlock);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        output.putInt32(this._prev[i2] ^ this._outBlock[i2]);
      }
      this._prev = this._inBlock.slice(0);
    };
    modes.cbc.prototype.pad = function(input, options) {
      var padding = input.length() === this.blockSize ? this.blockSize : this.blockSize - input.length();
      input.fillWithByte(padding, padding);
      return true;
    };
    modes.cbc.prototype.unpad = function(output, options) {
      if (options.overflow > 0) {
        return false;
      }
      var len = output.length();
      var count = output.at(len - 1);
      if (count > this.blockSize << 2) {
        return false;
      }
      output.truncate(count);
      return true;
    };
    modes.cfb = function(options) {
      options = options || {};
      this.name = "CFB";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = null;
      this._outBlock = new Array(this._ints);
      this._partialBlock = new Array(this._ints);
      this._partialOutput = forge2.util.createBuffer();
      this._partialBytes = 0;
    };
    modes.cfb.prototype.start = function(options) {
      if (!("iv" in options)) {
        throw new Error("Invalid IV parameter.");
      }
      this._iv = transformIV(options.iv, this.blockSize);
      this._inBlock = this._iv.slice(0);
      this._partialBytes = 0;
    };
    modes.cfb.prototype.encrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (inputLength === 0) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      if (this._partialBytes === 0 && inputLength >= this.blockSize) {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._inBlock[i2] = input.getInt32() ^ this._outBlock[i2];
          output.putInt32(this._inBlock[i2]);
        }
        return;
      }
      var partialBytes = (this.blockSize - inputLength) % this.blockSize;
      if (partialBytes > 0) {
        partialBytes = this.blockSize - partialBytes;
      }
      this._partialOutput.clear();
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._partialBlock[i2] = input.getInt32() ^ this._outBlock[i2];
        this._partialOutput.putInt32(this._partialBlock[i2]);
      }
      if (partialBytes > 0) {
        input.read -= this.blockSize;
      } else {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._inBlock[i2] = this._partialBlock[i2];
        }
      }
      if (this._partialBytes > 0) {
        this._partialOutput.getBytes(this._partialBytes);
      }
      if (partialBytes > 0 && !finish) {
        output.putBytes(this._partialOutput.getBytes(
          partialBytes - this._partialBytes
        ));
        this._partialBytes = partialBytes;
        return true;
      }
      output.putBytes(this._partialOutput.getBytes(
        inputLength - this._partialBytes
      ));
      this._partialBytes = 0;
    };
    modes.cfb.prototype.decrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (inputLength === 0) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      if (this._partialBytes === 0 && inputLength >= this.blockSize) {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._inBlock[i2] = input.getInt32();
          output.putInt32(this._inBlock[i2] ^ this._outBlock[i2]);
        }
        return;
      }
      var partialBytes = (this.blockSize - inputLength) % this.blockSize;
      if (partialBytes > 0) {
        partialBytes = this.blockSize - partialBytes;
      }
      this._partialOutput.clear();
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._partialBlock[i2] = input.getInt32();
        this._partialOutput.putInt32(this._partialBlock[i2] ^ this._outBlock[i2]);
      }
      if (partialBytes > 0) {
        input.read -= this.blockSize;
      } else {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._inBlock[i2] = this._partialBlock[i2];
        }
      }
      if (this._partialBytes > 0) {
        this._partialOutput.getBytes(this._partialBytes);
      }
      if (partialBytes > 0 && !finish) {
        output.putBytes(this._partialOutput.getBytes(
          partialBytes - this._partialBytes
        ));
        this._partialBytes = partialBytes;
        return true;
      }
      output.putBytes(this._partialOutput.getBytes(
        inputLength - this._partialBytes
      ));
      this._partialBytes = 0;
    };
    modes.ofb = function(options) {
      options = options || {};
      this.name = "OFB";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = null;
      this._outBlock = new Array(this._ints);
      this._partialOutput = forge2.util.createBuffer();
      this._partialBytes = 0;
    };
    modes.ofb.prototype.start = function(options) {
      if (!("iv" in options)) {
        throw new Error("Invalid IV parameter.");
      }
      this._iv = transformIV(options.iv, this.blockSize);
      this._inBlock = this._iv.slice(0);
      this._partialBytes = 0;
    };
    modes.ofb.prototype.encrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (input.length() === 0) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      if (this._partialBytes === 0 && inputLength >= this.blockSize) {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          output.putInt32(input.getInt32() ^ this._outBlock[i2]);
          this._inBlock[i2] = this._outBlock[i2];
        }
        return;
      }
      var partialBytes = (this.blockSize - inputLength) % this.blockSize;
      if (partialBytes > 0) {
        partialBytes = this.blockSize - partialBytes;
      }
      this._partialOutput.clear();
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this._partialOutput.putInt32(input.getInt32() ^ this._outBlock[i2]);
      }
      if (partialBytes > 0) {
        input.read -= this.blockSize;
      } else {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._inBlock[i2] = this._outBlock[i2];
        }
      }
      if (this._partialBytes > 0) {
        this._partialOutput.getBytes(this._partialBytes);
      }
      if (partialBytes > 0 && !finish) {
        output.putBytes(this._partialOutput.getBytes(
          partialBytes - this._partialBytes
        ));
        this._partialBytes = partialBytes;
        return true;
      }
      output.putBytes(this._partialOutput.getBytes(
        inputLength - this._partialBytes
      ));
      this._partialBytes = 0;
    };
    modes.ofb.prototype.decrypt = modes.ofb.prototype.encrypt;
    modes.ctr = function(options) {
      options = options || {};
      this.name = "CTR";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = null;
      this._outBlock = new Array(this._ints);
      this._partialOutput = forge2.util.createBuffer();
      this._partialBytes = 0;
    };
    modes.ctr.prototype.start = function(options) {
      if (!("iv" in options)) {
        throw new Error("Invalid IV parameter.");
      }
      this._iv = transformIV(options.iv, this.blockSize);
      this._inBlock = this._iv.slice(0);
      this._partialBytes = 0;
    };
    modes.ctr.prototype.encrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (inputLength === 0) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      if (this._partialBytes === 0 && inputLength >= this.blockSize) {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          output.putInt32(input.getInt32() ^ this._outBlock[i2]);
        }
      } else {
        var partialBytes = (this.blockSize - inputLength) % this.blockSize;
        if (partialBytes > 0) {
          partialBytes = this.blockSize - partialBytes;
        }
        this._partialOutput.clear();
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._partialOutput.putInt32(input.getInt32() ^ this._outBlock[i2]);
        }
        if (partialBytes > 0) {
          input.read -= this.blockSize;
        }
        if (this._partialBytes > 0) {
          this._partialOutput.getBytes(this._partialBytes);
        }
        if (partialBytes > 0 && !finish) {
          output.putBytes(this._partialOutput.getBytes(
            partialBytes - this._partialBytes
          ));
          this._partialBytes = partialBytes;
          return true;
        }
        output.putBytes(this._partialOutput.getBytes(
          inputLength - this._partialBytes
        ));
        this._partialBytes = 0;
      }
      inc32(this._inBlock);
    };
    modes.ctr.prototype.decrypt = modes.ctr.prototype.encrypt;
    modes.gcm = function(options) {
      options = options || {};
      this.name = "GCM";
      this.cipher = options.cipher;
      this.blockSize = options.blockSize || 16;
      this._ints = this.blockSize / 4;
      this._inBlock = new Array(this._ints);
      this._outBlock = new Array(this._ints);
      this._partialOutput = forge2.util.createBuffer();
      this._partialBytes = 0;
      this._R = 3774873600;
    };
    modes.gcm.prototype.start = function(options) {
      if (!("iv" in options)) {
        throw new Error("Invalid IV parameter.");
      }
      var iv = forge2.util.createBuffer(options.iv);
      this._cipherLength = 0;
      var additionalData;
      if ("additionalData" in options) {
        additionalData = forge2.util.createBuffer(options.additionalData);
      } else {
        additionalData = forge2.util.createBuffer();
      }
      if ("tagLength" in options) {
        this._tagLength = options.tagLength;
      } else {
        this._tagLength = 128;
      }
      this._tag = null;
      if (options.decrypt) {
        this._tag = forge2.util.createBuffer(options.tag).getBytes();
        if (this._tag.length !== this._tagLength / 8) {
          throw new Error("Authentication tag does not match tag length.");
        }
      }
      this._hashBlock = new Array(this._ints);
      this.tag = null;
      this._hashSubkey = new Array(this._ints);
      this.cipher.encrypt([0, 0, 0, 0], this._hashSubkey);
      this.componentBits = 4;
      this._m = this.generateHashTable(this._hashSubkey, this.componentBits);
      var ivLength = iv.length();
      if (ivLength === 12) {
        this._j0 = [iv.getInt32(), iv.getInt32(), iv.getInt32(), 1];
      } else {
        this._j0 = [0, 0, 0, 0];
        while (iv.length() > 0) {
          this._j0 = this.ghash(
            this._hashSubkey,
            this._j0,
            [iv.getInt32(), iv.getInt32(), iv.getInt32(), iv.getInt32()]
          );
        }
        this._j0 = this.ghash(
          this._hashSubkey,
          this._j0,
          [0, 0].concat(from64To32(ivLength * 8))
        );
      }
      this._inBlock = this._j0.slice(0);
      inc32(this._inBlock);
      this._partialBytes = 0;
      additionalData = forge2.util.createBuffer(additionalData);
      this._aDataLength = from64To32(additionalData.length() * 8);
      var overflow = additionalData.length() % this.blockSize;
      if (overflow) {
        additionalData.fillWithByte(0, this.blockSize - overflow);
      }
      this._s = [0, 0, 0, 0];
      while (additionalData.length() > 0) {
        this._s = this.ghash(this._hashSubkey, this._s, [
          additionalData.getInt32(),
          additionalData.getInt32(),
          additionalData.getInt32(),
          additionalData.getInt32()
        ]);
      }
    };
    modes.gcm.prototype.encrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (inputLength === 0) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      if (this._partialBytes === 0 && inputLength >= this.blockSize) {
        for (var i2 = 0; i2 < this._ints; ++i2) {
          output.putInt32(this._outBlock[i2] ^= input.getInt32());
        }
        this._cipherLength += this.blockSize;
      } else {
        var partialBytes = (this.blockSize - inputLength) % this.blockSize;
        if (partialBytes > 0) {
          partialBytes = this.blockSize - partialBytes;
        }
        this._partialOutput.clear();
        for (var i2 = 0; i2 < this._ints; ++i2) {
          this._partialOutput.putInt32(input.getInt32() ^ this._outBlock[i2]);
        }
        if (partialBytes <= 0 || finish) {
          if (finish) {
            var overflow = inputLength % this.blockSize;
            this._cipherLength += overflow;
            this._partialOutput.truncate(this.blockSize - overflow);
          } else {
            this._cipherLength += this.blockSize;
          }
          for (var i2 = 0; i2 < this._ints; ++i2) {
            this._outBlock[i2] = this._partialOutput.getInt32();
          }
          this._partialOutput.read -= this.blockSize;
        }
        if (this._partialBytes > 0) {
          this._partialOutput.getBytes(this._partialBytes);
        }
        if (partialBytes > 0 && !finish) {
          input.read -= this.blockSize;
          output.putBytes(this._partialOutput.getBytes(
            partialBytes - this._partialBytes
          ));
          this._partialBytes = partialBytes;
          return true;
        }
        output.putBytes(this._partialOutput.getBytes(
          inputLength - this._partialBytes
        ));
        this._partialBytes = 0;
      }
      this._s = this.ghash(this._hashSubkey, this._s, this._outBlock);
      inc32(this._inBlock);
    };
    modes.gcm.prototype.decrypt = function(input, output, finish) {
      var inputLength = input.length();
      if (inputLength < this.blockSize && !(finish && inputLength > 0)) {
        return true;
      }
      this.cipher.encrypt(this._inBlock, this._outBlock);
      inc32(this._inBlock);
      this._hashBlock[0] = input.getInt32();
      this._hashBlock[1] = input.getInt32();
      this._hashBlock[2] = input.getInt32();
      this._hashBlock[3] = input.getInt32();
      this._s = this.ghash(this._hashSubkey, this._s, this._hashBlock);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        output.putInt32(this._outBlock[i2] ^ this._hashBlock[i2]);
      }
      if (inputLength < this.blockSize) {
        this._cipherLength += inputLength % this.blockSize;
      } else {
        this._cipherLength += this.blockSize;
      }
    };
    modes.gcm.prototype.afterFinish = function(output, options) {
      var rval = true;
      if (options.decrypt && options.overflow) {
        output.truncate(this.blockSize - options.overflow);
      }
      this.tag = forge2.util.createBuffer();
      var lengths = this._aDataLength.concat(from64To32(this._cipherLength * 8));
      this._s = this.ghash(this._hashSubkey, this._s, lengths);
      var tag = [];
      this.cipher.encrypt(this._j0, tag);
      for (var i2 = 0; i2 < this._ints; ++i2) {
        this.tag.putInt32(this._s[i2] ^ tag[i2]);
      }
      this.tag.truncate(this.tag.length() % (this._tagLength / 8));
      if (options.decrypt && this.tag.bytes() !== this._tag) {
        rval = false;
      }
      return rval;
    };
    modes.gcm.prototype.multiply = function(x2, y) {
      var z_i = [0, 0, 0, 0];
      var v_i = y.slice(0);
      for (var i2 = 0; i2 < 128; ++i2) {
        var x_i = x2[i2 / 32 | 0] & 1 << 31 - i2 % 32;
        if (x_i) {
          z_i[0] ^= v_i[0];
          z_i[1] ^= v_i[1];
          z_i[2] ^= v_i[2];
          z_i[3] ^= v_i[3];
        }
        this.pow(v_i, v_i);
      }
      return z_i;
    };
    modes.gcm.prototype.pow = function(x2, out) {
      var lsb = x2[3] & 1;
      for (var i2 = 3; i2 > 0; --i2) {
        out[i2] = x2[i2] >>> 1 | (x2[i2 - 1] & 1) << 31;
      }
      out[0] = x2[0] >>> 1;
      if (lsb) {
        out[0] ^= this._R;
      }
    };
    modes.gcm.prototype.tableMultiply = function(x2) {
      var z = [0, 0, 0, 0];
      for (var i2 = 0; i2 < 32; ++i2) {
        var idx = i2 / 8 | 0;
        var x_i = x2[idx] >>> (7 - i2 % 8) * 4 & 15;
        var ah = this._m[i2][x_i];
        z[0] ^= ah[0];
        z[1] ^= ah[1];
        z[2] ^= ah[2];
        z[3] ^= ah[3];
      }
      return z;
    };
    modes.gcm.prototype.ghash = function(h, y, x2) {
      y[0] ^= x2[0];
      y[1] ^= x2[1];
      y[2] ^= x2[2];
      y[3] ^= x2[3];
      return this.tableMultiply(y);
    };
    modes.gcm.prototype.generateHashTable = function(h, bits) {
      var multiplier = 8 / bits;
      var perInt = 4 * multiplier;
      var size = 16 * multiplier;
      var m = new Array(size);
      for (var i2 = 0; i2 < size; ++i2) {
        var tmp = [0, 0, 0, 0];
        var idx = i2 / perInt | 0;
        var shft2 = (perInt - 1 - i2 % perInt) * bits;
        tmp[idx] = 1 << bits - 1 << shft2;
        m[i2] = this.generateSubHashTable(this.multiply(tmp, h), bits);
      }
      return m;
    };
    modes.gcm.prototype.generateSubHashTable = function(mid, bits) {
      var size = 1 << bits;
      var half = size >>> 1;
      var m = new Array(size);
      m[half] = mid.slice(0);
      var i2 = half >>> 1;
      while (i2 > 0) {
        this.pow(m[2 * i2], m[i2] = []);
        i2 >>= 1;
      }
      i2 = 2;
      while (i2 < half) {
        for (var j = 1; j < i2; ++j) {
          var m_i = m[i2];
          var m_j = m[j];
          m[i2 + j] = [
            m_i[0] ^ m_j[0],
            m_i[1] ^ m_j[1],
            m_i[2] ^ m_j[2],
            m_i[3] ^ m_j[3]
          ];
        }
        i2 *= 2;
      }
      m[0] = [0, 0, 0, 0];
      for (i2 = half + 1; i2 < size; ++i2) {
        var c = m[i2 ^ half];
        m[i2] = [mid[0] ^ c[0], mid[1] ^ c[1], mid[2] ^ c[2], mid[3] ^ c[3]];
      }
      return m;
    };
    function transformIV(iv, blockSize) {
      if (typeof iv === "string") {
        iv = forge2.util.createBuffer(iv);
      }
      if (forge2.util.isArray(iv) && iv.length > 4) {
        var tmp = iv;
        iv = forge2.util.createBuffer();
        for (var i2 = 0; i2 < tmp.length; ++i2) {
          iv.putByte(tmp[i2]);
        }
      }
      if (iv.length() < blockSize) {
        throw new Error(
          "Invalid IV length; got " + iv.length() + " bytes and expected " + blockSize + " bytes."
        );
      }
      if (!forge2.util.isArray(iv)) {
        var ints = [];
        var blocks = blockSize / 4;
        for (var i2 = 0; i2 < blocks; ++i2) {
          ints.push(iv.getInt32());
        }
        iv = ints;
      }
      return iv;
    }
    function inc32(block) {
      block[block.length - 1] = block[block.length - 1] + 1 & 4294967295;
    }
    function from64To32(num) {
      return [num / 4294967296 | 0, num & 4294967295];
    }
  }
});

// node_modules/node-forge/lib/aes.js
var require_aes = __commonJS({
  "node_modules/node-forge/lib/aes.js"(exports, module) {
    var forge2 = require_forge();
    require_cipher();
    require_cipherModes();
    require_util();
    module.exports = forge2.aes = forge2.aes || {};
    forge2.aes.startEncrypting = function(key, iv, output, mode) {
      var cipher = _createCipher({
        key,
        output,
        decrypt: false,
        mode
      });
      cipher.start(iv);
      return cipher;
    };
    forge2.aes.createEncryptionCipher = function(key, mode) {
      return _createCipher({
        key,
        output: null,
        decrypt: false,
        mode
      });
    };
    forge2.aes.startDecrypting = function(key, iv, output, mode) {
      var cipher = _createCipher({
        key,
        output,
        decrypt: true,
        mode
      });
      cipher.start(iv);
      return cipher;
    };
    forge2.aes.createDecryptionCipher = function(key, mode) {
      return _createCipher({
        key,
        output: null,
        decrypt: true,
        mode
      });
    };
    forge2.aes.Algorithm = function(name, mode) {
      if (!init) {
        initialize();
      }
      var self2 = this;
      self2.name = name;
      self2.mode = new mode({
        blockSize: 16,
        cipher: {
          encrypt: function(inBlock, outBlock) {
            return _updateBlock(self2._w, inBlock, outBlock, false);
          },
          decrypt: function(inBlock, outBlock) {
            return _updateBlock(self2._w, inBlock, outBlock, true);
          }
        }
      });
      self2._init = false;
    };
    forge2.aes.Algorithm.prototype.initialize = function(options) {
      if (this._init) {
        return;
      }
      var key = options.key;
      var tmp;
      if (typeof key === "string" && (key.length === 16 || key.length === 24 || key.length === 32)) {
        key = forge2.util.createBuffer(key);
      } else if (forge2.util.isArray(key) && (key.length === 16 || key.length === 24 || key.length === 32)) {
        tmp = key;
        key = forge2.util.createBuffer();
        for (var i2 = 0; i2 < tmp.length; ++i2) {
          key.putByte(tmp[i2]);
        }
      }
      if (!forge2.util.isArray(key)) {
        tmp = key;
        key = [];
        var len = tmp.length();
        if (len === 16 || len === 24 || len === 32) {
          len = len >>> 2;
          for (var i2 = 0; i2 < len; ++i2) {
            key.push(tmp.getInt32());
          }
        }
      }
      if (!forge2.util.isArray(key) || !(key.length === 4 || key.length === 6 || key.length === 8)) {
        throw new Error("Invalid key parameter.");
      }
      var mode = this.mode.name;
      var encryptOp = ["CFB", "OFB", "CTR", "GCM"].indexOf(mode) !== -1;
      this._w = _expandKey(key, options.decrypt && !encryptOp);
      this._init = true;
    };
    forge2.aes._expandKey = function(key, decrypt) {
      if (!init) {
        initialize();
      }
      return _expandKey(key, decrypt);
    };
    forge2.aes._updateBlock = _updateBlock;
    registerAlgorithm("AES-ECB", forge2.cipher.modes.ecb);
    registerAlgorithm("AES-CBC", forge2.cipher.modes.cbc);
    registerAlgorithm("AES-CFB", forge2.cipher.modes.cfb);
    registerAlgorithm("AES-OFB", forge2.cipher.modes.ofb);
    registerAlgorithm("AES-CTR", forge2.cipher.modes.ctr);
    registerAlgorithm("AES-GCM", forge2.cipher.modes.gcm);
    function registerAlgorithm(name, mode) {
      var factory = function() {
        return new forge2.aes.Algorithm(name, mode);
      };
      forge2.cipher.registerAlgorithm(name, factory);
    }
    var init = false;
    var Nb = 4;
    var sbox;
    var isbox;
    var rcon;
    var mix;
    var imix;
    function initialize() {
      init = true;
      rcon = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
      var xtime = new Array(256);
      for (var i2 = 0; i2 < 128; ++i2) {
        xtime[i2] = i2 << 1;
        xtime[i2 + 128] = i2 + 128 << 1 ^ 283;
      }
      sbox = new Array(256);
      isbox = new Array(256);
      mix = new Array(4);
      imix = new Array(4);
      for (var i2 = 0; i2 < 4; ++i2) {
        mix[i2] = new Array(256);
        imix[i2] = new Array(256);
      }
      var e = 0, ei = 0, e2, e4, e8, sx, sx2, me, ime;
      for (var i2 = 0; i2 < 256; ++i2) {
        sx = ei ^ ei << 1 ^ ei << 2 ^ ei << 3 ^ ei << 4;
        sx = sx >> 8 ^ sx & 255 ^ 99;
        sbox[e] = sx;
        isbox[sx] = e;
        sx2 = xtime[sx];
        e2 = xtime[e];
        e4 = xtime[e2];
        e8 = xtime[e4];
        me = sx2 << 24 ^ // 2
        sx << 16 ^ // 1
        sx << 8 ^ // 1
        (sx ^ sx2);
        ime = (e2 ^ e4 ^ e8) << 24 ^ // E (14)
        (e ^ e8) << 16 ^ // 9
        (e ^ e4 ^ e8) << 8 ^ // D (13)
        (e ^ e2 ^ e8);
        for (var n = 0; n < 4; ++n) {
          mix[n][e] = me;
          imix[n][sx] = ime;
          me = me << 24 | me >>> 8;
          ime = ime << 24 | ime >>> 8;
        }
        if (e === 0) {
          e = ei = 1;
        } else {
          e = e2 ^ xtime[xtime[xtime[e2 ^ e8]]];
          ei ^= xtime[xtime[ei]];
        }
      }
    }
    function _expandKey(key, decrypt) {
      var w = key.slice(0);
      var temp, iNk = 1;
      var Nk = w.length;
      var Nr1 = Nk + 6 + 1;
      var end = Nb * Nr1;
      for (var i2 = Nk; i2 < end; ++i2) {
        temp = w[i2 - 1];
        if (i2 % Nk === 0) {
          temp = sbox[temp >>> 16 & 255] << 24 ^ sbox[temp >>> 8 & 255] << 16 ^ sbox[temp & 255] << 8 ^ sbox[temp >>> 24] ^ rcon[iNk] << 24;
          iNk++;
        } else if (Nk > 6 && i2 % Nk === 4) {
          temp = sbox[temp >>> 24] << 24 ^ sbox[temp >>> 16 & 255] << 16 ^ sbox[temp >>> 8 & 255] << 8 ^ sbox[temp & 255];
        }
        w[i2] = w[i2 - Nk] ^ temp;
      }
      if (decrypt) {
        var tmp;
        var m0 = imix[0];
        var m1 = imix[1];
        var m2 = imix[2];
        var m3 = imix[3];
        var wnew = w.slice(0);
        end = w.length;
        for (var i2 = 0, wi = end - Nb; i2 < end; i2 += Nb, wi -= Nb) {
          if (i2 === 0 || i2 === end - Nb) {
            wnew[i2] = w[wi];
            wnew[i2 + 1] = w[wi + 3];
            wnew[i2 + 2] = w[wi + 2];
            wnew[i2 + 3] = w[wi + 1];
          } else {
            for (var n = 0; n < Nb; ++n) {
              tmp = w[wi + n];
              wnew[i2 + (3 & -n)] = m0[sbox[tmp >>> 24]] ^ m1[sbox[tmp >>> 16 & 255]] ^ m2[sbox[tmp >>> 8 & 255]] ^ m3[sbox[tmp & 255]];
            }
          }
        }
        w = wnew;
      }
      return w;
    }
    function _updateBlock(w, input, output, decrypt) {
      var Nr = w.length / 4 - 1;
      var m0, m1, m2, m3, sub;
      if (decrypt) {
        m0 = imix[0];
        m1 = imix[1];
        m2 = imix[2];
        m3 = imix[3];
        sub = isbox;
      } else {
        m0 = mix[0];
        m1 = mix[1];
        m2 = mix[2];
        m3 = mix[3];
        sub = sbox;
      }
      var a, b, c, d, a2, b2, c2;
      a = input[0] ^ w[0];
      b = input[decrypt ? 3 : 1] ^ w[1];
      c = input[2] ^ w[2];
      d = input[decrypt ? 1 : 3] ^ w[3];
      var i2 = 3;
      for (var round = 1; round < Nr; ++round) {
        a2 = m0[a >>> 24] ^ m1[b >>> 16 & 255] ^ m2[c >>> 8 & 255] ^ m3[d & 255] ^ w[++i2];
        b2 = m0[b >>> 24] ^ m1[c >>> 16 & 255] ^ m2[d >>> 8 & 255] ^ m3[a & 255] ^ w[++i2];
        c2 = m0[c >>> 24] ^ m1[d >>> 16 & 255] ^ m2[a >>> 8 & 255] ^ m3[b & 255] ^ w[++i2];
        d = m0[d >>> 24] ^ m1[a >>> 16 & 255] ^ m2[b >>> 8 & 255] ^ m3[c & 255] ^ w[++i2];
        a = a2;
        b = b2;
        c = c2;
      }
      output[0] = sub[a >>> 24] << 24 ^ sub[b >>> 16 & 255] << 16 ^ sub[c >>> 8 & 255] << 8 ^ sub[d & 255] ^ w[++i2];
      output[decrypt ? 3 : 1] = sub[b >>> 24] << 24 ^ sub[c >>> 16 & 255] << 16 ^ sub[d >>> 8 & 255] << 8 ^ sub[a & 255] ^ w[++i2];
      output[2] = sub[c >>> 24] << 24 ^ sub[d >>> 16 & 255] << 16 ^ sub[a >>> 8 & 255] << 8 ^ sub[b & 255] ^ w[++i2];
      output[decrypt ? 1 : 3] = sub[d >>> 24] << 24 ^ sub[a >>> 16 & 255] << 16 ^ sub[b >>> 8 & 255] << 8 ^ sub[c & 255] ^ w[++i2];
    }
    function _createCipher(options) {
      options = options || {};
      var mode = (options.mode || "CBC").toUpperCase();
      var algorithm = "AES-" + mode;
      var cipher;
      if (options.decrypt) {
        cipher = forge2.cipher.createDecipher(algorithm, options.key);
      } else {
        cipher = forge2.cipher.createCipher(algorithm, options.key);
      }
      var start = cipher.start;
      cipher.start = function(iv, options2) {
        var output = null;
        if (options2 instanceof forge2.util.ByteBuffer) {
          output = options2;
          options2 = {};
        }
        options2 = options2 || {};
        options2.output = output;
        options2.iv = iv;
        start.call(cipher, options2);
      };
      return cipher;
    }
  }
});

// node_modules/node-forge/lib/oids.js
var require_oids = __commonJS({
  "node_modules/node-forge/lib/oids.js"(exports, module) {
    var forge2 = require_forge();
    forge2.pki = forge2.pki || {};
    var oids = module.exports = forge2.pki.oids = forge2.oids = forge2.oids || {};
    function _IN(id, name) {
      oids[id] = name;
      oids[name] = id;
    }
    function _I_(id, name) {
      oids[id] = name;
    }
    _IN("1.2.840.113549.1.1.1", "rsaEncryption");
    _IN("1.2.840.113549.1.1.4", "md5WithRSAEncryption");
    _IN("1.2.840.113549.1.1.5", "sha1WithRSAEncryption");
    _IN("1.2.840.113549.1.1.7", "RSAES-OAEP");
    _IN("1.2.840.113549.1.1.8", "mgf1");
    _IN("1.2.840.113549.1.1.9", "pSpecified");
    _IN("1.2.840.113549.1.1.10", "RSASSA-PSS");
    _IN("1.2.840.113549.1.1.11", "sha256WithRSAEncryption");
    _IN("1.2.840.113549.1.1.12", "sha384WithRSAEncryption");
    _IN("1.2.840.113549.1.1.13", "sha512WithRSAEncryption");
    _IN("1.3.101.112", "EdDSA25519");
    _IN("1.2.840.10040.4.3", "dsa-with-sha1");
    _IN("1.3.14.3.2.7", "desCBC");
    _IN("1.3.14.3.2.26", "sha1");
    _IN("1.3.14.3.2.29", "sha1WithRSASignature");
    _IN("2.16.840.1.101.3.4.2.1", "sha256");
    _IN("2.16.840.1.101.3.4.2.2", "sha384");
    _IN("2.16.840.1.101.3.4.2.3", "sha512");
    _IN("2.16.840.1.101.3.4.2.4", "sha224");
    _IN("2.16.840.1.101.3.4.2.5", "sha512-224");
    _IN("2.16.840.1.101.3.4.2.6", "sha512-256");
    _IN("1.2.840.113549.2.2", "md2");
    _IN("1.2.840.113549.2.5", "md5");
    _IN("1.2.840.113549.1.7.1", "data");
    _IN("1.2.840.113549.1.7.2", "signedData");
    _IN("1.2.840.113549.1.7.3", "envelopedData");
    _IN("1.2.840.113549.1.7.4", "signedAndEnvelopedData");
    _IN("1.2.840.113549.1.7.5", "digestedData");
    _IN("1.2.840.113549.1.7.6", "encryptedData");
    _IN("1.2.840.113549.1.9.1", "emailAddress");
    _IN("1.2.840.113549.1.9.2", "unstructuredName");
    _IN("1.2.840.113549.1.9.3", "contentType");
    _IN("1.2.840.113549.1.9.4", "messageDigest");
    _IN("1.2.840.113549.1.9.5", "signingTime");
    _IN("1.2.840.113549.1.9.6", "counterSignature");
    _IN("1.2.840.113549.1.9.7", "challengePassword");
    _IN("1.2.840.113549.1.9.8", "unstructuredAddress");
    _IN("1.2.840.113549.1.9.14", "extensionRequest");
    _IN("1.2.840.113549.1.9.20", "friendlyName");
    _IN("1.2.840.113549.1.9.21", "localKeyId");
    _IN("1.2.840.113549.1.9.22.1", "x509Certificate");
    _IN("1.2.840.113549.1.12.10.1.1", "keyBag");
    _IN("1.2.840.113549.1.12.10.1.2", "pkcs8ShroudedKeyBag");
    _IN("1.2.840.113549.1.12.10.1.3", "certBag");
    _IN("1.2.840.113549.1.12.10.1.4", "crlBag");
    _IN("1.2.840.113549.1.12.10.1.5", "secretBag");
    _IN("1.2.840.113549.1.12.10.1.6", "safeContentsBag");
    _IN("1.2.840.113549.1.5.13", "pkcs5PBES2");
    _IN("1.2.840.113549.1.5.12", "pkcs5PBKDF2");
    _IN("1.2.840.113549.1.12.1.1", "pbeWithSHAAnd128BitRC4");
    _IN("1.2.840.113549.1.12.1.2", "pbeWithSHAAnd40BitRC4");
    _IN("1.2.840.113549.1.12.1.3", "pbeWithSHAAnd3-KeyTripleDES-CBC");
    _IN("1.2.840.113549.1.12.1.4", "pbeWithSHAAnd2-KeyTripleDES-CBC");
    _IN("1.2.840.113549.1.12.1.5", "pbeWithSHAAnd128BitRC2-CBC");
    _IN("1.2.840.113549.1.12.1.6", "pbewithSHAAnd40BitRC2-CBC");
    _IN("1.2.840.113549.2.7", "hmacWithSHA1");
    _IN("1.2.840.113549.2.8", "hmacWithSHA224");
    _IN("1.2.840.113549.2.9", "hmacWithSHA256");
    _IN("1.2.840.113549.2.10", "hmacWithSHA384");
    _IN("1.2.840.113549.2.11", "hmacWithSHA512");
    _IN("1.2.840.113549.3.7", "des-EDE3-CBC");
    _IN("2.16.840.1.101.3.4.1.2", "aes128-CBC");
    _IN("2.16.840.1.101.3.4.1.22", "aes192-CBC");
    _IN("2.16.840.1.101.3.4.1.42", "aes256-CBC");
    _IN("2.5.4.3", "commonName");
    _IN("2.5.4.4", "surname");
    _IN("2.5.4.5", "serialNumber");
    _IN("2.5.4.6", "countryName");
    _IN("2.5.4.7", "localityName");
    _IN("2.5.4.8", "stateOrProvinceName");
    _IN("2.5.4.9", "streetAddress");
    _IN("2.5.4.10", "organizationName");
    _IN("2.5.4.11", "organizationalUnitName");
    _IN("2.5.4.12", "title");
    _IN("2.5.4.13", "description");
    _IN("2.5.4.15", "businessCategory");
    _IN("2.5.4.17", "postalCode");
    _IN("2.5.4.42", "givenName");
    _IN("1.3.6.1.4.1.311.60.2.1.2", "jurisdictionOfIncorporationStateOrProvinceName");
    _IN("1.3.6.1.4.1.311.60.2.1.3", "jurisdictionOfIncorporationCountryName");
    _IN("2.16.840.1.113730.1.1", "nsCertType");
    _IN("2.16.840.1.113730.1.13", "nsComment");
    _I_("2.5.29.1", "authorityKeyIdentifier");
    _I_("2.5.29.2", "keyAttributes");
    _I_("2.5.29.3", "certificatePolicies");
    _I_("2.5.29.4", "keyUsageRestriction");
    _I_("2.5.29.5", "policyMapping");
    _I_("2.5.29.6", "subtreesConstraint");
    _I_("2.5.29.7", "subjectAltName");
    _I_("2.5.29.8", "issuerAltName");
    _I_("2.5.29.9", "subjectDirectoryAttributes");
    _I_("2.5.29.10", "basicConstraints");
    _I_("2.5.29.11", "nameConstraints");
    _I_("2.5.29.12", "policyConstraints");
    _I_("2.5.29.13", "basicConstraints");
    _IN("2.5.29.14", "subjectKeyIdentifier");
    _IN("2.5.29.15", "keyUsage");
    _I_("2.5.29.16", "privateKeyUsagePeriod");
    _IN("2.5.29.17", "subjectAltName");
    _IN("2.5.29.18", "issuerAltName");
    _IN("2.5.29.19", "basicConstraints");
    _I_("2.5.29.20", "cRLNumber");
    _I_("2.5.29.21", "cRLReason");
    _I_("2.5.29.22", "expirationDate");
    _I_("2.5.29.23", "instructionCode");
    _I_("2.5.29.24", "invalidityDate");
    _I_("2.5.29.25", "cRLDistributionPoints");
    _I_("2.5.29.26", "issuingDistributionPoint");
    _I_("2.5.29.27", "deltaCRLIndicator");
    _I_("2.5.29.28", "issuingDistributionPoint");
    _I_("2.5.29.29", "certificateIssuer");
    _I_("2.5.29.30", "nameConstraints");
    _IN("2.5.29.31", "cRLDistributionPoints");
    _IN("2.5.29.32", "certificatePolicies");
    _I_("2.5.29.33", "policyMappings");
    _I_("2.5.29.34", "policyConstraints");
    _IN("2.5.29.35", "authorityKeyIdentifier");
    _I_("2.5.29.36", "policyConstraints");
    _IN("2.5.29.37", "extKeyUsage");
    _I_("2.5.29.46", "freshestCRL");
    _I_("2.5.29.54", "inhibitAnyPolicy");
    _IN("1.3.6.1.4.1.11129.2.4.2", "timestampList");
    _IN("1.3.6.1.5.5.7.1.1", "authorityInfoAccess");
    _IN("1.3.6.1.5.5.7.3.1", "serverAuth");
    _IN("1.3.6.1.5.5.7.3.2", "clientAuth");
    _IN("1.3.6.1.5.5.7.3.3", "codeSigning");
    _IN("1.3.6.1.5.5.7.3.4", "emailProtection");
    _IN("1.3.6.1.5.5.7.3.8", "timeStamping");
  }
});

// node_modules/node-forge/lib/asn1.js
var require_asn1 = __commonJS({
  "node_modules/node-forge/lib/asn1.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    require_oids();
    var asn1 = module.exports = forge2.asn1 = forge2.asn1 || {};
    asn1.Class = {
      UNIVERSAL: 0,
      APPLICATION: 64,
      CONTEXT_SPECIFIC: 128,
      PRIVATE: 192
    };
    asn1.Type = {
      NONE: 0,
      BOOLEAN: 1,
      INTEGER: 2,
      BITSTRING: 3,
      OCTETSTRING: 4,
      NULL: 5,
      OID: 6,
      ODESC: 7,
      EXTERNAL: 8,
      REAL: 9,
      ENUMERATED: 10,
      EMBEDDED: 11,
      UTF8: 12,
      ROID: 13,
      SEQUENCE: 16,
      SET: 17,
      PRINTABLESTRING: 19,
      IA5STRING: 22,
      UTCTIME: 23,
      GENERALIZEDTIME: 24,
      BMPSTRING: 30
    };
    asn1.create = function(tagClass, type, constructed, value, options) {
      if (forge2.util.isArray(value)) {
        var tmp = [];
        for (var i2 = 0; i2 < value.length; ++i2) {
          if (value[i2] !== void 0) {
            tmp.push(value[i2]);
          }
        }
        value = tmp;
      }
      var obj = {
        tagClass,
        type,
        constructed,
        composed: constructed || forge2.util.isArray(value),
        value
      };
      if (options && "bitStringContents" in options) {
        obj.bitStringContents = options.bitStringContents;
        obj.original = asn1.copy(obj);
      }
      return obj;
    };
    asn1.copy = function(obj, options) {
      var copy;
      if (forge2.util.isArray(obj)) {
        copy = [];
        for (var i2 = 0; i2 < obj.length; ++i2) {
          copy.push(asn1.copy(obj[i2], options));
        }
        return copy;
      }
      if (typeof obj === "string") {
        return obj;
      }
      copy = {
        tagClass: obj.tagClass,
        type: obj.type,
        constructed: obj.constructed,
        composed: obj.composed,
        value: asn1.copy(obj.value, options)
      };
      if (options && !options.excludeBitStringContents) {
        copy.bitStringContents = obj.bitStringContents;
      }
      return copy;
    };
    asn1.equals = function(obj1, obj2, options) {
      if (forge2.util.isArray(obj1)) {
        if (!forge2.util.isArray(obj2)) {
          return false;
        }
        if (obj1.length !== obj2.length) {
          return false;
        }
        for (var i2 = 0; i2 < obj1.length; ++i2) {
          if (!asn1.equals(obj1[i2], obj2[i2])) {
            return false;
          }
        }
        return true;
      }
      if (typeof obj1 !== typeof obj2) {
        return false;
      }
      if (typeof obj1 === "string") {
        return obj1 === obj2;
      }
      var equal = obj1.tagClass === obj2.tagClass && obj1.type === obj2.type && obj1.constructed === obj2.constructed && obj1.composed === obj2.composed && asn1.equals(obj1.value, obj2.value);
      if (options && options.includeBitStringContents) {
        equal = equal && obj1.bitStringContents === obj2.bitStringContents;
      }
      return equal;
    };
    asn1.getBerValueLength = function(b) {
      var b2 = b.getByte();
      if (b2 === 128) {
        return void 0;
      }
      var length;
      var longForm = b2 & 128;
      if (!longForm) {
        length = b2;
      } else {
        length = b.getInt((b2 & 127) << 3);
      }
      return length;
    };
    function _checkBufferLength(bytes, remaining, n) {
      if (n > remaining) {
        var error = new Error("Too few bytes to parse DER.");
        error.available = bytes.length();
        error.remaining = remaining;
        error.requested = n;
        throw error;
      }
    }
    var _getValueLength = function(bytes, remaining) {
      var b2 = bytes.getByte();
      remaining--;
      if (b2 === 128) {
        return void 0;
      }
      var length;
      var longForm = b2 & 128;
      if (!longForm) {
        length = b2;
      } else {
        var longFormBytes = b2 & 127;
        _checkBufferLength(bytes, remaining, longFormBytes);
        length = bytes.getInt(longFormBytes << 3);
      }
      if (length < 0) {
        throw new Error("Negative length: " + length);
      }
      return length;
    };
    asn1.fromDer = function(bytes, options) {
      if (options === void 0) {
        options = {
          strict: true,
          parseAllBytes: true,
          decodeBitStrings: true
        };
      }
      if (typeof options === "boolean") {
        options = {
          strict: options,
          parseAllBytes: true,
          decodeBitStrings: true
        };
      }
      if (!("strict" in options)) {
        options.strict = true;
      }
      if (!("parseAllBytes" in options)) {
        options.parseAllBytes = true;
      }
      if (!("decodeBitStrings" in options)) {
        options.decodeBitStrings = true;
      }
      if (typeof bytes === "string") {
        bytes = forge2.util.createBuffer(bytes);
      }
      var byteCount = bytes.length();
      var value = _fromDer(bytes, bytes.length(), 0, options);
      if (options.parseAllBytes && bytes.length() !== 0) {
        var error = new Error("Unparsed DER bytes remain after ASN.1 parsing.");
        error.byteCount = byteCount;
        error.remaining = bytes.length();
        throw error;
      }
      return value;
    };
    function _fromDer(bytes, remaining, depth, options) {
      var start;
      _checkBufferLength(bytes, remaining, 2);
      var b1 = bytes.getByte();
      remaining--;
      var tagClass = b1 & 192;
      var type = b1 & 31;
      start = bytes.length();
      var length = _getValueLength(bytes, remaining);
      remaining -= start - bytes.length();
      if (length !== void 0 && length > remaining) {
        if (options.strict) {
          var error = new Error("Too few bytes to read ASN.1 value.");
          error.available = bytes.length();
          error.remaining = remaining;
          error.requested = length;
          throw error;
        }
        length = remaining;
      }
      var value;
      var bitStringContents;
      var constructed = (b1 & 32) === 32;
      if (constructed) {
        value = [];
        if (length === void 0) {
          for (; ; ) {
            _checkBufferLength(bytes, remaining, 2);
            if (bytes.bytes(2) === String.fromCharCode(0, 0)) {
              bytes.getBytes(2);
              remaining -= 2;
              break;
            }
            start = bytes.length();
            value.push(_fromDer(bytes, remaining, depth + 1, options));
            remaining -= start - bytes.length();
          }
        } else {
          while (length > 0) {
            start = bytes.length();
            value.push(_fromDer(bytes, length, depth + 1, options));
            remaining -= start - bytes.length();
            length -= start - bytes.length();
          }
        }
      }
      if (value === void 0 && tagClass === asn1.Class.UNIVERSAL && type === asn1.Type.BITSTRING) {
        bitStringContents = bytes.bytes(length);
      }
      if (value === void 0 && options.decodeBitStrings && tagClass === asn1.Class.UNIVERSAL && // FIXME: OCTET STRINGs not yet supported here
      // .. other parts of forge expect to decode OCTET STRINGs manually
      type === asn1.Type.BITSTRING && length > 1) {
        var savedRead = bytes.read;
        var savedRemaining = remaining;
        var unused = 0;
        if (type === asn1.Type.BITSTRING) {
          _checkBufferLength(bytes, remaining, 1);
          unused = bytes.getByte();
          remaining--;
        }
        if (unused === 0) {
          try {
            start = bytes.length();
            var subOptions = {
              // enforce strict mode to avoid parsing ASN.1 from plain data
              strict: true,
              decodeBitStrings: true
            };
            var composed = _fromDer(bytes, remaining, depth + 1, subOptions);
            var used = start - bytes.length();
            remaining -= used;
            if (type == asn1.Type.BITSTRING) {
              used++;
            }
            var tc = composed.tagClass;
            if (used === length && (tc === asn1.Class.UNIVERSAL || tc === asn1.Class.CONTEXT_SPECIFIC)) {
              value = [composed];
            }
          } catch (ex) {
          }
        }
        if (value === void 0) {
          bytes.read = savedRead;
          remaining = savedRemaining;
        }
      }
      if (value === void 0) {
        if (length === void 0) {
          if (options.strict) {
            throw new Error("Non-constructed ASN.1 object of indefinite length.");
          }
          length = remaining;
        }
        if (type === asn1.Type.BMPSTRING) {
          value = "";
          for (; length > 0; length -= 2) {
            _checkBufferLength(bytes, remaining, 2);
            value += String.fromCharCode(bytes.getInt16());
            remaining -= 2;
          }
        } else {
          value = bytes.getBytes(length);
          remaining -= length;
        }
      }
      var asn1Options = bitStringContents === void 0 ? null : {
        bitStringContents
      };
      return asn1.create(tagClass, type, constructed, value, asn1Options);
    }
    asn1.toDer = function(obj) {
      var bytes = forge2.util.createBuffer();
      var b1 = obj.tagClass | obj.type;
      var value = forge2.util.createBuffer();
      var useBitStringContents = false;
      if ("bitStringContents" in obj) {
        useBitStringContents = true;
        if (obj.original) {
          useBitStringContents = asn1.equals(obj, obj.original);
        }
      }
      if (useBitStringContents) {
        value.putBytes(obj.bitStringContents);
      } else if (obj.composed) {
        if (obj.constructed) {
          b1 |= 32;
        } else {
          value.putByte(0);
        }
        for (var i2 = 0; i2 < obj.value.length; ++i2) {
          if (obj.value[i2] !== void 0) {
            value.putBuffer(asn1.toDer(obj.value[i2]));
          }
        }
      } else {
        if (obj.type === asn1.Type.BMPSTRING) {
          for (var i2 = 0; i2 < obj.value.length; ++i2) {
            value.putInt16(obj.value.charCodeAt(i2));
          }
        } else {
          if (obj.type === asn1.Type.INTEGER && obj.value.length > 1 && // leading 0x00 for positive integer
          (obj.value.charCodeAt(0) === 0 && (obj.value.charCodeAt(1) & 128) === 0 || // leading 0xFF for negative integer
          obj.value.charCodeAt(0) === 255 && (obj.value.charCodeAt(1) & 128) === 128)) {
            value.putBytes(obj.value.substr(1));
          } else {
            value.putBytes(obj.value);
          }
        }
      }
      bytes.putByte(b1);
      if (value.length() <= 127) {
        bytes.putByte(value.length() & 127);
      } else {
        var len = value.length();
        var lenBytes = "";
        do {
          lenBytes += String.fromCharCode(len & 255);
          len = len >>> 8;
        } while (len > 0);
        bytes.putByte(lenBytes.length | 128);
        for (var i2 = lenBytes.length - 1; i2 >= 0; --i2) {
          bytes.putByte(lenBytes.charCodeAt(i2));
        }
      }
      bytes.putBuffer(value);
      return bytes;
    };
    asn1.oidToDer = function(oid) {
      var values = oid.split(".");
      var bytes = forge2.util.createBuffer();
      bytes.putByte(40 * parseInt(values[0], 10) + parseInt(values[1], 10));
      var last, valueBytes, value, b;
      for (var i2 = 2; i2 < values.length; ++i2) {
        last = true;
        valueBytes = [];
        value = parseInt(values[i2], 10);
        do {
          b = value & 127;
          value = value >>> 7;
          if (!last) {
            b |= 128;
          }
          valueBytes.push(b);
          last = false;
        } while (value > 0);
        for (var n = valueBytes.length - 1; n >= 0; --n) {
          bytes.putByte(valueBytes[n]);
        }
      }
      return bytes;
    };
    asn1.derToOid = function(bytes) {
      var oid;
      if (typeof bytes === "string") {
        bytes = forge2.util.createBuffer(bytes);
      }
      var b = bytes.getByte();
      oid = Math.floor(b / 40) + "." + b % 40;
      var value = 0;
      while (bytes.length() > 0) {
        b = bytes.getByte();
        value = value << 7;
        if (b & 128) {
          value += b & 127;
        } else {
          oid += "." + (value + b);
          value = 0;
        }
      }
      return oid;
    };
    asn1.utcTimeToDate = function(utc) {
      var date = /* @__PURE__ */ new Date();
      var year = parseInt(utc.substr(0, 2), 10);
      year = year >= 50 ? 1900 + year : 2e3 + year;
      var MM = parseInt(utc.substr(2, 2), 10) - 1;
      var DD = parseInt(utc.substr(4, 2), 10);
      var hh = parseInt(utc.substr(6, 2), 10);
      var mm = parseInt(utc.substr(8, 2), 10);
      var ss = 0;
      if (utc.length > 11) {
        var c = utc.charAt(10);
        var end = 10;
        if (c !== "+" && c !== "-") {
          ss = parseInt(utc.substr(10, 2), 10);
          end += 2;
        }
      }
      date.setUTCFullYear(year, MM, DD);
      date.setUTCHours(hh, mm, ss, 0);
      if (end) {
        c = utc.charAt(end);
        if (c === "+" || c === "-") {
          var hhoffset = parseInt(utc.substr(end + 1, 2), 10);
          var mmoffset = parseInt(utc.substr(end + 4, 2), 10);
          var offset = hhoffset * 60 + mmoffset;
          offset *= 6e4;
          if (c === "+") {
            date.setTime(+date - offset);
          } else {
            date.setTime(+date + offset);
          }
        }
      }
      return date;
    };
    asn1.generalizedTimeToDate = function(gentime) {
      var date = /* @__PURE__ */ new Date();
      var YYYY = parseInt(gentime.substr(0, 4), 10);
      var MM = parseInt(gentime.substr(4, 2), 10) - 1;
      var DD = parseInt(gentime.substr(6, 2), 10);
      var hh = parseInt(gentime.substr(8, 2), 10);
      var mm = parseInt(gentime.substr(10, 2), 10);
      var ss = parseInt(gentime.substr(12, 2), 10);
      var fff = 0;
      var offset = 0;
      var isUTC = false;
      if (gentime.charAt(gentime.length - 1) === "Z") {
        isUTC = true;
      }
      var end = gentime.length - 5, c = gentime.charAt(end);
      if (c === "+" || c === "-") {
        var hhoffset = parseInt(gentime.substr(end + 1, 2), 10);
        var mmoffset = parseInt(gentime.substr(end + 4, 2), 10);
        offset = hhoffset * 60 + mmoffset;
        offset *= 6e4;
        if (c === "+") {
          offset *= -1;
        }
        isUTC = true;
      }
      if (gentime.charAt(14) === ".") {
        fff = parseFloat(gentime.substr(14), 10) * 1e3;
      }
      if (isUTC) {
        date.setUTCFullYear(YYYY, MM, DD);
        date.setUTCHours(hh, mm, ss, fff);
        date.setTime(+date + offset);
      } else {
        date.setFullYear(YYYY, MM, DD);
        date.setHours(hh, mm, ss, fff);
      }
      return date;
    };
    asn1.dateToUtcTime = function(date) {
      if (typeof date === "string") {
        return date;
      }
      var rval = "";
      var format = [];
      format.push(("" + date.getUTCFullYear()).substr(2));
      format.push("" + (date.getUTCMonth() + 1));
      format.push("" + date.getUTCDate());
      format.push("" + date.getUTCHours());
      format.push("" + date.getUTCMinutes());
      format.push("" + date.getUTCSeconds());
      for (var i2 = 0; i2 < format.length; ++i2) {
        if (format[i2].length < 2) {
          rval += "0";
        }
        rval += format[i2];
      }
      rval += "Z";
      return rval;
    };
    asn1.dateToGeneralizedTime = function(date) {
      if (typeof date === "string") {
        return date;
      }
      var rval = "";
      var format = [];
      format.push("" + date.getUTCFullYear());
      format.push("" + (date.getUTCMonth() + 1));
      format.push("" + date.getUTCDate());
      format.push("" + date.getUTCHours());
      format.push("" + date.getUTCMinutes());
      format.push("" + date.getUTCSeconds());
      for (var i2 = 0; i2 < format.length; ++i2) {
        if (format[i2].length < 2) {
          rval += "0";
        }
        rval += format[i2];
      }
      rval += "Z";
      return rval;
    };
    asn1.integerToDer = function(x2) {
      var rval = forge2.util.createBuffer();
      if (x2 >= -128 && x2 < 128) {
        return rval.putSignedInt(x2, 8);
      }
      if (x2 >= -32768 && x2 < 32768) {
        return rval.putSignedInt(x2, 16);
      }
      if (x2 >= -8388608 && x2 < 8388608) {
        return rval.putSignedInt(x2, 24);
      }
      if (x2 >= -2147483648 && x2 < 2147483648) {
        return rval.putSignedInt(x2, 32);
      }
      var error = new Error("Integer too large; max is 32-bits.");
      error.integer = x2;
      throw error;
    };
    asn1.derToInteger = function(bytes) {
      if (typeof bytes === "string") {
        bytes = forge2.util.createBuffer(bytes);
      }
      var n = bytes.length() * 8;
      if (n > 32) {
        throw new Error("Integer too large; max is 32-bits.");
      }
      return bytes.getSignedInt(n);
    };
    asn1.validate = function(obj, v, capture, errors) {
      var rval = false;
      if ((obj.tagClass === v.tagClass || typeof v.tagClass === "undefined") && (obj.type === v.type || typeof v.type === "undefined")) {
        if (obj.constructed === v.constructed || typeof v.constructed === "undefined") {
          rval = true;
          if (v.value && forge2.util.isArray(v.value)) {
            var j = 0;
            for (var i2 = 0; rval && i2 < v.value.length; ++i2) {
              rval = v.value[i2].optional || false;
              if (obj.value[j]) {
                rval = asn1.validate(obj.value[j], v.value[i2], capture, errors);
                if (rval) {
                  ++j;
                } else if (v.value[i2].optional) {
                  rval = true;
                }
              }
              if (!rval && errors) {
                errors.push(
                  "[" + v.name + '] Tag class "' + v.tagClass + '", type "' + v.type + '" expected value length "' + v.value.length + '", got "' + obj.value.length + '"'
                );
              }
            }
          }
          if (rval && capture) {
            if (v.capture) {
              capture[v.capture] = obj.value;
            }
            if (v.captureAsn1) {
              capture[v.captureAsn1] = obj;
            }
            if (v.captureBitStringContents && "bitStringContents" in obj) {
              capture[v.captureBitStringContents] = obj.bitStringContents;
            }
            if (v.captureBitStringValue && "bitStringContents" in obj) {
              var value;
              if (obj.bitStringContents.length < 2) {
                capture[v.captureBitStringValue] = "";
              } else {
                var unused = obj.bitStringContents.charCodeAt(0);
                if (unused !== 0) {
                  throw new Error(
                    "captureBitStringValue only supported for zero unused bits"
                  );
                }
                capture[v.captureBitStringValue] = obj.bitStringContents.slice(1);
              }
            }
          }
        } else if (errors) {
          errors.push(
            "[" + v.name + '] Expected constructed "' + v.constructed + '", got "' + obj.constructed + '"'
          );
        }
      } else if (errors) {
        if (obj.tagClass !== v.tagClass) {
          errors.push(
            "[" + v.name + '] Expected tag class "' + v.tagClass + '", got "' + obj.tagClass + '"'
          );
        }
        if (obj.type !== v.type) {
          errors.push(
            "[" + v.name + '] Expected type "' + v.type + '", got "' + obj.type + '"'
          );
        }
      }
      return rval;
    };
    var _nonLatinRegex = /[^\\u0000-\\u00ff]/;
    asn1.prettyPrint = function(obj, level, indentation) {
      var rval = "";
      level = level || 0;
      indentation = indentation || 2;
      if (level > 0) {
        rval += "\n";
      }
      var indent = "";
      for (var i2 = 0; i2 < level * indentation; ++i2) {
        indent += " ";
      }
      rval += indent + "Tag: ";
      switch (obj.tagClass) {
        case asn1.Class.UNIVERSAL:
          rval += "Universal:";
          break;
        case asn1.Class.APPLICATION:
          rval += "Application:";
          break;
        case asn1.Class.CONTEXT_SPECIFIC:
          rval += "Context-Specific:";
          break;
        case asn1.Class.PRIVATE:
          rval += "Private:";
          break;
      }
      if (obj.tagClass === asn1.Class.UNIVERSAL) {
        rval += obj.type;
        switch (obj.type) {
          case asn1.Type.NONE:
            rval += " (None)";
            break;
          case asn1.Type.BOOLEAN:
            rval += " (Boolean)";
            break;
          case asn1.Type.INTEGER:
            rval += " (Integer)";
            break;
          case asn1.Type.BITSTRING:
            rval += " (Bit string)";
            break;
          case asn1.Type.OCTETSTRING:
            rval += " (Octet string)";
            break;
          case asn1.Type.NULL:
            rval += " (Null)";
            break;
          case asn1.Type.OID:
            rval += " (Object Identifier)";
            break;
          case asn1.Type.ODESC:
            rval += " (Object Descriptor)";
            break;
          case asn1.Type.EXTERNAL:
            rval += " (External or Instance of)";
            break;
          case asn1.Type.REAL:
            rval += " (Real)";
            break;
          case asn1.Type.ENUMERATED:
            rval += " (Enumerated)";
            break;
          case asn1.Type.EMBEDDED:
            rval += " (Embedded PDV)";
            break;
          case asn1.Type.UTF8:
            rval += " (UTF8)";
            break;
          case asn1.Type.ROID:
            rval += " (Relative Object Identifier)";
            break;
          case asn1.Type.SEQUENCE:
            rval += " (Sequence)";
            break;
          case asn1.Type.SET:
            rval += " (Set)";
            break;
          case asn1.Type.PRINTABLESTRING:
            rval += " (Printable String)";
            break;
          case asn1.Type.IA5String:
            rval += " (IA5String (ASCII))";
            break;
          case asn1.Type.UTCTIME:
            rval += " (UTC time)";
            break;
          case asn1.Type.GENERALIZEDTIME:
            rval += " (Generalized time)";
            break;
          case asn1.Type.BMPSTRING:
            rval += " (BMP String)";
            break;
        }
      } else {
        rval += obj.type;
      }
      rval += "\n";
      rval += indent + "Constructed: " + obj.constructed + "\n";
      if (obj.composed) {
        var subvalues = 0;
        var sub = "";
        for (var i2 = 0; i2 < obj.value.length; ++i2) {
          if (obj.value[i2] !== void 0) {
            subvalues += 1;
            sub += asn1.prettyPrint(obj.value[i2], level + 1, indentation);
            if (i2 + 1 < obj.value.length) {
              sub += ",";
            }
          }
        }
        rval += indent + "Sub values: " + subvalues + sub;
      } else {
        rval += indent + "Value: ";
        if (obj.type === asn1.Type.OID) {
          var oid = asn1.derToOid(obj.value);
          rval += oid;
          if (forge2.pki && forge2.pki.oids) {
            if (oid in forge2.pki.oids) {
              rval += " (" + forge2.pki.oids[oid] + ") ";
            }
          }
        }
        if (obj.type === asn1.Type.INTEGER) {
          try {
            rval += asn1.derToInteger(obj.value);
          } catch (ex) {
            rval += "0x" + forge2.util.bytesToHex(obj.value);
          }
        } else if (obj.type === asn1.Type.BITSTRING) {
          if (obj.value.length > 1) {
            rval += "0x" + forge2.util.bytesToHex(obj.value.slice(1));
          } else {
            rval += "(none)";
          }
          if (obj.value.length > 0) {
            var unused = obj.value.charCodeAt(0);
            if (unused == 1) {
              rval += " (1 unused bit shown)";
            } else if (unused > 1) {
              rval += " (" + unused + " unused bits shown)";
            }
          }
        } else if (obj.type === asn1.Type.OCTETSTRING) {
          if (!_nonLatinRegex.test(obj.value)) {
            rval += "(" + obj.value + ") ";
          }
          rval += "0x" + forge2.util.bytesToHex(obj.value);
        } else if (obj.type === asn1.Type.UTF8) {
          try {
            rval += forge2.util.decodeUtf8(obj.value);
          } catch (e) {
            if (e.message === "URI malformed") {
              rval += "0x" + forge2.util.bytesToHex(obj.value) + " (malformed UTF8)";
            } else {
              throw e;
            }
          }
        } else if (obj.type === asn1.Type.PRINTABLESTRING || obj.type === asn1.Type.IA5String) {
          rval += obj.value;
        } else if (_nonLatinRegex.test(obj.value)) {
          rval += "0x" + forge2.util.bytesToHex(obj.value);
        } else if (obj.value.length === 0) {
          rval += "[null]";
        } else {
          rval += obj.value;
        }
      }
      return rval;
    };
  }
});

// node_modules/node-forge/lib/md.js
var require_md = __commonJS({
  "node_modules/node-forge/lib/md.js"(exports, module) {
    var forge2 = require_forge();
    module.exports = forge2.md = forge2.md || {};
    forge2.md.algorithms = forge2.md.algorithms || {};
  }
});

// node_modules/node-forge/lib/hmac.js
var require_hmac = __commonJS({
  "node_modules/node-forge/lib/hmac.js"(exports, module) {
    var forge2 = require_forge();
    require_md();
    require_util();
    var hmac = module.exports = forge2.hmac = forge2.hmac || {};
    hmac.create = function() {
      var _key = null;
      var _md = null;
      var _ipadding = null;
      var _opadding = null;
      var ctx = {};
      ctx.start = function(md, key) {
        if (md !== null) {
          if (typeof md === "string") {
            md = md.toLowerCase();
            if (md in forge2.md.algorithms) {
              _md = forge2.md.algorithms[md].create();
            } else {
              throw new Error('Unknown hash algorithm "' + md + '"');
            }
          } else {
            _md = md;
          }
        }
        if (key === null) {
          key = _key;
        } else {
          if (typeof key === "string") {
            key = forge2.util.createBuffer(key);
          } else if (forge2.util.isArray(key)) {
            var tmp = key;
            key = forge2.util.createBuffer();
            for (var i2 = 0; i2 < tmp.length; ++i2) {
              key.putByte(tmp[i2]);
            }
          }
          var keylen = key.length();
          if (keylen > _md.blockLength) {
            _md.start();
            _md.update(key.bytes());
            key = _md.digest();
          }
          _ipadding = forge2.util.createBuffer();
          _opadding = forge2.util.createBuffer();
          keylen = key.length();
          for (var i2 = 0; i2 < keylen; ++i2) {
            var tmp = key.at(i2);
            _ipadding.putByte(54 ^ tmp);
            _opadding.putByte(92 ^ tmp);
          }
          if (keylen < _md.blockLength) {
            var tmp = _md.blockLength - keylen;
            for (var i2 = 0; i2 < tmp; ++i2) {
              _ipadding.putByte(54);
              _opadding.putByte(92);
            }
          }
          _key = key;
          _ipadding = _ipadding.bytes();
          _opadding = _opadding.bytes();
        }
        _md.start();
        _md.update(_ipadding);
      };
      ctx.update = function(bytes) {
        _md.update(bytes);
      };
      ctx.getMac = function() {
        var inner = _md.digest().bytes();
        _md.start();
        _md.update(_opadding);
        _md.update(inner);
        return _md.digest();
      };
      ctx.digest = ctx.getMac;
      return ctx;
    };
  }
});

// node_modules/node-forge/lib/md5.js
var require_md5 = __commonJS({
  "node_modules/node-forge/lib/md5.js"(exports, module) {
    var forge2 = require_forge();
    require_md();
    require_util();
    var md5 = module.exports = forge2.md5 = forge2.md5 || {};
    forge2.md.md5 = forge2.md.algorithms.md5 = md5;
    md5.create = function() {
      if (!_initialized) {
        _init();
      }
      var _state = null;
      var _input = forge2.util.createBuffer();
      var _w = new Array(16);
      var md = {
        algorithm: "md5",
        blockLength: 64,
        digestLength: 16,
        // 56-bit length of message so far (does not including padding)
        messageLength: 0,
        // true message length
        fullMessageLength: null,
        // size of message length in bytes
        messageLengthSize: 8
      };
      md.start = function() {
        md.messageLength = 0;
        md.fullMessageLength = md.messageLength64 = [];
        var int32s = md.messageLengthSize / 4;
        for (var i2 = 0; i2 < int32s; ++i2) {
          md.fullMessageLength.push(0);
        }
        _input = forge2.util.createBuffer();
        _state = {
          h0: 1732584193,
          h1: 4023233417,
          h2: 2562383102,
          h3: 271733878
        };
        return md;
      };
      md.start();
      md.update = function(msg, encoding) {
        if (encoding === "utf8") {
          msg = forge2.util.encodeUtf8(msg);
        }
        var len = msg.length;
        md.messageLength += len;
        len = [len / 4294967296 >>> 0, len >>> 0];
        for (var i2 = md.fullMessageLength.length - 1; i2 >= 0; --i2) {
          md.fullMessageLength[i2] += len[1];
          len[1] = len[0] + (md.fullMessageLength[i2] / 4294967296 >>> 0);
          md.fullMessageLength[i2] = md.fullMessageLength[i2] >>> 0;
          len[0] = len[1] / 4294967296 >>> 0;
        }
        _input.putBytes(msg);
        _update(_state, _w, _input);
        if (_input.read > 2048 || _input.length() === 0) {
          _input.compact();
        }
        return md;
      };
      md.digest = function() {
        var finalBlock = forge2.util.createBuffer();
        finalBlock.putBytes(_input.bytes());
        var remaining = md.fullMessageLength[md.fullMessageLength.length - 1] + md.messageLengthSize;
        var overflow = remaining & md.blockLength - 1;
        finalBlock.putBytes(_padding.substr(0, md.blockLength - overflow));
        var bits, carry = 0;
        for (var i2 = md.fullMessageLength.length - 1; i2 >= 0; --i2) {
          bits = md.fullMessageLength[i2] * 8 + carry;
          carry = bits / 4294967296 >>> 0;
          finalBlock.putInt32Le(bits >>> 0);
        }
        var s2 = {
          h0: _state.h0,
          h1: _state.h1,
          h2: _state.h2,
          h3: _state.h3
        };
        _update(s2, _w, finalBlock);
        var rval = forge2.util.createBuffer();
        rval.putInt32Le(s2.h0);
        rval.putInt32Le(s2.h1);
        rval.putInt32Le(s2.h2);
        rval.putInt32Le(s2.h3);
        return rval;
      };
      return md;
    };
    var _padding = null;
    var _g = null;
    var _r = null;
    var _k = null;
    var _initialized = false;
    function _init() {
      _padding = String.fromCharCode(128);
      _padding += forge2.util.fillString(String.fromCharCode(0), 64);
      _g = [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        1,
        6,
        11,
        0,
        5,
        10,
        15,
        4,
        9,
        14,
        3,
        8,
        13,
        2,
        7,
        12,
        5,
        8,
        11,
        14,
        1,
        4,
        7,
        10,
        13,
        0,
        3,
        6,
        9,
        12,
        15,
        2,
        0,
        7,
        14,
        5,
        12,
        3,
        10,
        1,
        8,
        15,
        6,
        13,
        4,
        11,
        2,
        9
      ];
      _r = [
        7,
        12,
        17,
        22,
        7,
        12,
        17,
        22,
        7,
        12,
        17,
        22,
        7,
        12,
        17,
        22,
        5,
        9,
        14,
        20,
        5,
        9,
        14,
        20,
        5,
        9,
        14,
        20,
        5,
        9,
        14,
        20,
        4,
        11,
        16,
        23,
        4,
        11,
        16,
        23,
        4,
        11,
        16,
        23,
        4,
        11,
        16,
        23,
        6,
        10,
        15,
        21,
        6,
        10,
        15,
        21,
        6,
        10,
        15,
        21,
        6,
        10,
        15,
        21
      ];
      _k = new Array(64);
      for (var i2 = 0; i2 < 64; ++i2) {
        _k[i2] = Math.floor(Math.abs(Math.sin(i2 + 1)) * 4294967296);
      }
      _initialized = true;
    }
    function _update(s, w, bytes) {
      var t, a, b, c, d, f, r, i2;
      var len = bytes.length();
      while (len >= 64) {
        a = s.h0;
        b = s.h1;
        c = s.h2;
        d = s.h3;
        for (i2 = 0; i2 < 16; ++i2) {
          w[i2] = bytes.getInt32Le();
          f = d ^ b & (c ^ d);
          t = a + f + _k[i2] + w[i2];
          r = _r[i2];
          a = d;
          d = c;
          c = b;
          b += t << r | t >>> 32 - r;
        }
        for (; i2 < 32; ++i2) {
          f = c ^ d & (b ^ c);
          t = a + f + _k[i2] + w[_g[i2]];
          r = _r[i2];
          a = d;
          d = c;
          c = b;
          b += t << r | t >>> 32 - r;
        }
        for (; i2 < 48; ++i2) {
          f = b ^ c ^ d;
          t = a + f + _k[i2] + w[_g[i2]];
          r = _r[i2];
          a = d;
          d = c;
          c = b;
          b += t << r | t >>> 32 - r;
        }
        for (; i2 < 64; ++i2) {
          f = c ^ (b | ~d);
          t = a + f + _k[i2] + w[_g[i2]];
          r = _r[i2];
          a = d;
          d = c;
          c = b;
          b += t << r | t >>> 32 - r;
        }
        s.h0 = s.h0 + a | 0;
        s.h1 = s.h1 + b | 0;
        s.h2 = s.h2 + c | 0;
        s.h3 = s.h3 + d | 0;
        len -= 64;
      }
    }
  }
});

// node_modules/node-forge/lib/pem.js
var require_pem = __commonJS({
  "node_modules/node-forge/lib/pem.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    var pem = module.exports = forge2.pem = forge2.pem || {};
    pem.encode = function(msg, options) {
      options = options || {};
      var rval = "-----BEGIN " + msg.type + "-----\r\n";
      var header;
      if (msg.procType) {
        header = {
          name: "Proc-Type",
          values: [String(msg.procType.version), msg.procType.type]
        };
        rval += foldHeader(header);
      }
      if (msg.contentDomain) {
        header = { name: "Content-Domain", values: [msg.contentDomain] };
        rval += foldHeader(header);
      }
      if (msg.dekInfo) {
        header = { name: "DEK-Info", values: [msg.dekInfo.algorithm] };
        if (msg.dekInfo.parameters) {
          header.values.push(msg.dekInfo.parameters);
        }
        rval += foldHeader(header);
      }
      if (msg.headers) {
        for (var i2 = 0; i2 < msg.headers.length; ++i2) {
          rval += foldHeader(msg.headers[i2]);
        }
      }
      if (msg.procType) {
        rval += "\r\n";
      }
      rval += forge2.util.encode64(msg.body, options.maxline || 64) + "\r\n";
      rval += "-----END " + msg.type + "-----\r\n";
      return rval;
    };
    pem.decode = function(str) {
      var rval = [];
      var rMessage = /\s*-----BEGIN ([A-Z0-9- ]+)-----\r?\n?([\x21-\x7e\s]+?(?:\r?\n\r?\n))?([:A-Za-z0-9+\/=\s]+?)-----END \1-----/g;
      var rHeader = /([\x21-\x7e]+):\s*([\x21-\x7e\s^:]+)/;
      var rCRLF = /\r?\n/;
      var match;
      while (true) {
        match = rMessage.exec(str);
        if (!match) {
          break;
        }
        var type = match[1];
        if (type === "NEW CERTIFICATE REQUEST") {
          type = "CERTIFICATE REQUEST";
        }
        var msg = {
          type,
          procType: null,
          contentDomain: null,
          dekInfo: null,
          headers: [],
          body: forge2.util.decode64(match[3])
        };
        rval.push(msg);
        if (!match[2]) {
          continue;
        }
        var lines = match[2].split(rCRLF);
        var li = 0;
        while (match && li < lines.length) {
          var line = lines[li].replace(/\s+$/, "");
          for (var nl = li + 1; nl < lines.length; ++nl) {
            var next = lines[nl];
            if (!/\s/.test(next[0])) {
              break;
            }
            line += next;
            li = nl;
          }
          match = line.match(rHeader);
          if (match) {
            var header = { name: match[1], values: [] };
            var values = match[2].split(",");
            for (var vi = 0; vi < values.length; ++vi) {
              header.values.push(ltrim(values[vi]));
            }
            if (!msg.procType) {
              if (header.name !== "Proc-Type") {
                throw new Error('Invalid PEM formatted message. The first encapsulated header must be "Proc-Type".');
              } else if (header.values.length !== 2) {
                throw new Error('Invalid PEM formatted message. The "Proc-Type" header must have two subfields.');
              }
              msg.procType = { version: values[0], type: values[1] };
            } else if (!msg.contentDomain && header.name === "Content-Domain") {
              msg.contentDomain = values[0] || "";
            } else if (!msg.dekInfo && header.name === "DEK-Info") {
              if (header.values.length === 0) {
                throw new Error('Invalid PEM formatted message. The "DEK-Info" header must have at least one subfield.');
              }
              msg.dekInfo = { algorithm: values[0], parameters: values[1] || null };
            } else {
              msg.headers.push(header);
            }
          }
          ++li;
        }
        if (msg.procType === "ENCRYPTED" && !msg.dekInfo) {
          throw new Error('Invalid PEM formatted message. The "DEK-Info" header must be present if "Proc-Type" is "ENCRYPTED".');
        }
      }
      if (rval.length === 0) {
        throw new Error("Invalid PEM formatted message.");
      }
      return rval;
    };
    function foldHeader(header) {
      var rval = header.name + ": ";
      var values = [];
      var insertSpace = function(match, $1) {
        return " " + $1;
      };
      for (var i2 = 0; i2 < header.values.length; ++i2) {
        values.push(header.values[i2].replace(/^(\S+\r\n)/, insertSpace));
      }
      rval += values.join(",") + "\r\n";
      var length = 0;
      var candidate = -1;
      for (var i2 = 0; i2 < rval.length; ++i2, ++length) {
        if (length > 65 && candidate !== -1) {
          var insert = rval[candidate];
          if (insert === ",") {
            ++candidate;
            rval = rval.substr(0, candidate) + "\r\n " + rval.substr(candidate);
          } else {
            rval = rval.substr(0, candidate) + "\r\n" + insert + rval.substr(candidate + 1);
          }
          length = i2 - candidate - 1;
          candidate = -1;
          ++i2;
        } else if (rval[i2] === " " || rval[i2] === "	" || rval[i2] === ",") {
          candidate = i2;
        }
      }
      return rval;
    }
    function ltrim(str) {
      return str.replace(/^\s+/, "");
    }
  }
});

// node_modules/node-forge/lib/des.js
var require_des = __commonJS({
  "node_modules/node-forge/lib/des.js"(exports, module) {
    var forge2 = require_forge();
    require_cipher();
    require_cipherModes();
    require_util();
    module.exports = forge2.des = forge2.des || {};
    forge2.des.startEncrypting = function(key, iv, output, mode) {
      var cipher = _createCipher({
        key,
        output,
        decrypt: false,
        mode: mode || (iv === null ? "ECB" : "CBC")
      });
      cipher.start(iv);
      return cipher;
    };
    forge2.des.createEncryptionCipher = function(key, mode) {
      return _createCipher({
        key,
        output: null,
        decrypt: false,
        mode
      });
    };
    forge2.des.startDecrypting = function(key, iv, output, mode) {
      var cipher = _createCipher({
        key,
        output,
        decrypt: true,
        mode: mode || (iv === null ? "ECB" : "CBC")
      });
      cipher.start(iv);
      return cipher;
    };
    forge2.des.createDecryptionCipher = function(key, mode) {
      return _createCipher({
        key,
        output: null,
        decrypt: true,
        mode
      });
    };
    forge2.des.Algorithm = function(name, mode) {
      var self2 = this;
      self2.name = name;
      self2.mode = new mode({
        blockSize: 8,
        cipher: {
          encrypt: function(inBlock, outBlock) {
            return _updateBlock(self2._keys, inBlock, outBlock, false);
          },
          decrypt: function(inBlock, outBlock) {
            return _updateBlock(self2._keys, inBlock, outBlock, true);
          }
        }
      });
      self2._init = false;
    };
    forge2.des.Algorithm.prototype.initialize = function(options) {
      if (this._init) {
        return;
      }
      var key = forge2.util.createBuffer(options.key);
      if (this.name.indexOf("3DES") === 0) {
        if (key.length() !== 24) {
          throw new Error("Invalid Triple-DES key size: " + key.length() * 8);
        }
      }
      this._keys = _createKeys(key);
      this._init = true;
    };
    registerAlgorithm("DES-ECB", forge2.cipher.modes.ecb);
    registerAlgorithm("DES-CBC", forge2.cipher.modes.cbc);
    registerAlgorithm("DES-CFB", forge2.cipher.modes.cfb);
    registerAlgorithm("DES-OFB", forge2.cipher.modes.ofb);
    registerAlgorithm("DES-CTR", forge2.cipher.modes.ctr);
    registerAlgorithm("3DES-ECB", forge2.cipher.modes.ecb);
    registerAlgorithm("3DES-CBC", forge2.cipher.modes.cbc);
    registerAlgorithm("3DES-CFB", forge2.cipher.modes.cfb);
    registerAlgorithm("3DES-OFB", forge2.cipher.modes.ofb);
    registerAlgorithm("3DES-CTR", forge2.cipher.modes.ctr);
    function registerAlgorithm(name, mode) {
      var factory = function() {
        return new forge2.des.Algorithm(name, mode);
      };
      forge2.cipher.registerAlgorithm(name, factory);
    }
    var spfunction1 = [16843776, 0, 65536, 16843780, 16842756, 66564, 4, 65536, 1024, 16843776, 16843780, 1024, 16778244, 16842756, 16777216, 4, 1028, 16778240, 16778240, 66560, 66560, 16842752, 16842752, 16778244, 65540, 16777220, 16777220, 65540, 0, 1028, 66564, 16777216, 65536, 16843780, 4, 16842752, 16843776, 16777216, 16777216, 1024, 16842756, 65536, 66560, 16777220, 1024, 4, 16778244, 66564, 16843780, 65540, 16842752, 16778244, 16777220, 1028, 66564, 16843776, 1028, 16778240, 16778240, 0, 65540, 66560, 0, 16842756];
    var spfunction2 = [-2146402272, -2147450880, 32768, 1081376, 1048576, 32, -2146435040, -2147450848, -2147483616, -2146402272, -2146402304, -2147483648, -2147450880, 1048576, 32, -2146435040, 1081344, 1048608, -2147450848, 0, -2147483648, 32768, 1081376, -2146435072, 1048608, -2147483616, 0, 1081344, 32800, -2146402304, -2146435072, 32800, 0, 1081376, -2146435040, 1048576, -2147450848, -2146435072, -2146402304, 32768, -2146435072, -2147450880, 32, -2146402272, 1081376, 32, 32768, -2147483648, 32800, -2146402304, 1048576, -2147483616, 1048608, -2147450848, -2147483616, 1048608, 1081344, 0, -2147450880, 32800, -2147483648, -2146435040, -2146402272, 1081344];
    var spfunction3 = [520, 134349312, 0, 134348808, 134218240, 0, 131592, 134218240, 131080, 134217736, 134217736, 131072, 134349320, 131080, 134348800, 520, 134217728, 8, 134349312, 512, 131584, 134348800, 134348808, 131592, 134218248, 131584, 131072, 134218248, 8, 134349320, 512, 134217728, 134349312, 134217728, 131080, 520, 131072, 134349312, 134218240, 0, 512, 131080, 134349320, 134218240, 134217736, 512, 0, 134348808, 134218248, 131072, 134217728, 134349320, 8, 131592, 131584, 134217736, 134348800, 134218248, 520, 134348800, 131592, 8, 134348808, 131584];
    var spfunction4 = [8396801, 8321, 8321, 128, 8396928, 8388737, 8388609, 8193, 0, 8396800, 8396800, 8396929, 129, 0, 8388736, 8388609, 1, 8192, 8388608, 8396801, 128, 8388608, 8193, 8320, 8388737, 1, 8320, 8388736, 8192, 8396928, 8396929, 129, 8388736, 8388609, 8396800, 8396929, 129, 0, 0, 8396800, 8320, 8388736, 8388737, 1, 8396801, 8321, 8321, 128, 8396929, 129, 1, 8192, 8388609, 8193, 8396928, 8388737, 8193, 8320, 8388608, 8396801, 128, 8388608, 8192, 8396928];
    var spfunction5 = [256, 34078976, 34078720, 1107296512, 524288, 256, 1073741824, 34078720, 1074266368, 524288, 33554688, 1074266368, 1107296512, 1107820544, 524544, 1073741824, 33554432, 1074266112, 1074266112, 0, 1073742080, 1107820800, 1107820800, 33554688, 1107820544, 1073742080, 0, 1107296256, 34078976, 33554432, 1107296256, 524544, 524288, 1107296512, 256, 33554432, 1073741824, 34078720, 1107296512, 1074266368, 33554688, 1073741824, 1107820544, 34078976, 1074266368, 256, 33554432, 1107820544, 1107820800, 524544, 1107296256, 1107820800, 34078720, 0, 1074266112, 1107296256, 524544, 33554688, 1073742080, 524288, 0, 1074266112, 34078976, 1073742080];
    var spfunction6 = [536870928, 541065216, 16384, 541081616, 541065216, 16, 541081616, 4194304, 536887296, 4210704, 4194304, 536870928, 4194320, 536887296, 536870912, 16400, 0, 4194320, 536887312, 16384, 4210688, 536887312, 16, 541065232, 541065232, 0, 4210704, 541081600, 16400, 4210688, 541081600, 536870912, 536887296, 16, 541065232, 4210688, 541081616, 4194304, 16400, 536870928, 4194304, 536887296, 536870912, 16400, 536870928, 541081616, 4210688, 541065216, 4210704, 541081600, 0, 541065232, 16, 16384, 541065216, 4210704, 16384, 4194320, 536887312, 0, 541081600, 536870912, 4194320, 536887312];
    var spfunction7 = [2097152, 69206018, 67110914, 0, 2048, 67110914, 2099202, 69208064, 69208066, 2097152, 0, 67108866, 2, 67108864, 69206018, 2050, 67110912, 2099202, 2097154, 67110912, 67108866, 69206016, 69208064, 2097154, 69206016, 2048, 2050, 69208066, 2099200, 2, 67108864, 2099200, 67108864, 2099200, 2097152, 67110914, 67110914, 69206018, 69206018, 2, 2097154, 67108864, 67110912, 2097152, 69208064, 2050, 2099202, 69208064, 2050, 67108866, 69208066, 69206016, 2099200, 0, 2, 69208066, 0, 2099202, 69206016, 2048, 67108866, 67110912, 2048, 2097154];
    var spfunction8 = [268439616, 4096, 262144, 268701760, 268435456, 268439616, 64, 268435456, 262208, 268697600, 268701760, 266240, 268701696, 266304, 4096, 64, 268697600, 268435520, 268439552, 4160, 266240, 262208, 268697664, 268701696, 4160, 0, 0, 268697664, 268435520, 268439552, 266304, 262144, 266304, 262144, 268701696, 4096, 64, 268697664, 4096, 266304, 268439552, 64, 268435520, 268697600, 268697664, 268435456, 262144, 268439616, 0, 268701760, 262208, 268435520, 268697600, 268439552, 268439616, 0, 268701760, 266240, 266240, 4160, 4160, 262208, 268435456, 268701696];
    function _createKeys(key) {
      var pc2bytes0 = [0, 4, 536870912, 536870916, 65536, 65540, 536936448, 536936452, 512, 516, 536871424, 536871428, 66048, 66052, 536936960, 536936964], pc2bytes1 = [0, 1, 1048576, 1048577, 67108864, 67108865, 68157440, 68157441, 256, 257, 1048832, 1048833, 67109120, 67109121, 68157696, 68157697], pc2bytes2 = [0, 8, 2048, 2056, 16777216, 16777224, 16779264, 16779272, 0, 8, 2048, 2056, 16777216, 16777224, 16779264, 16779272], pc2bytes3 = [0, 2097152, 134217728, 136314880, 8192, 2105344, 134225920, 136323072, 131072, 2228224, 134348800, 136445952, 139264, 2236416, 134356992, 136454144], pc2bytes4 = [0, 262144, 16, 262160, 0, 262144, 16, 262160, 4096, 266240, 4112, 266256, 4096, 266240, 4112, 266256], pc2bytes5 = [0, 1024, 32, 1056, 0, 1024, 32, 1056, 33554432, 33555456, 33554464, 33555488, 33554432, 33555456, 33554464, 33555488], pc2bytes6 = [0, 268435456, 524288, 268959744, 2, 268435458, 524290, 268959746, 0, 268435456, 524288, 268959744, 2, 268435458, 524290, 268959746], pc2bytes7 = [0, 65536, 2048, 67584, 536870912, 536936448, 536872960, 536938496, 131072, 196608, 133120, 198656, 537001984, 537067520, 537004032, 537069568], pc2bytes8 = [0, 262144, 0, 262144, 2, 262146, 2, 262146, 33554432, 33816576, 33554432, 33816576, 33554434, 33816578, 33554434, 33816578], pc2bytes9 = [0, 268435456, 8, 268435464, 0, 268435456, 8, 268435464, 1024, 268436480, 1032, 268436488, 1024, 268436480, 1032, 268436488], pc2bytes10 = [0, 32, 0, 32, 1048576, 1048608, 1048576, 1048608, 8192, 8224, 8192, 8224, 1056768, 1056800, 1056768, 1056800], pc2bytes11 = [0, 16777216, 512, 16777728, 2097152, 18874368, 2097664, 18874880, 67108864, 83886080, 67109376, 83886592, 69206016, 85983232, 69206528, 85983744], pc2bytes12 = [0, 4096, 134217728, 134221824, 524288, 528384, 134742016, 134746112, 16, 4112, 134217744, 134221840, 524304, 528400, 134742032, 134746128], pc2bytes13 = [0, 4, 256, 260, 0, 4, 256, 260, 1, 5, 257, 261, 1, 5, 257, 261];
      var iterations = key.length() > 8 ? 3 : 1;
      var keys = [];
      var shifts = [0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0];
      var n = 0, tmp;
      for (var j = 0; j < iterations; j++) {
        var left = key.getInt32();
        var right = key.getInt32();
        tmp = (left >>> 4 ^ right) & 252645135;
        right ^= tmp;
        left ^= tmp << 4;
        tmp = (right >>> -16 ^ left) & 65535;
        left ^= tmp;
        right ^= tmp << -16;
        tmp = (left >>> 2 ^ right) & 858993459;
        right ^= tmp;
        left ^= tmp << 2;
        tmp = (right >>> -16 ^ left) & 65535;
        left ^= tmp;
        right ^= tmp << -16;
        tmp = (left >>> 1 ^ right) & 1431655765;
        right ^= tmp;
        left ^= tmp << 1;
        tmp = (right >>> 8 ^ left) & 16711935;
        left ^= tmp;
        right ^= tmp << 8;
        tmp = (left >>> 1 ^ right) & 1431655765;
        right ^= tmp;
        left ^= tmp << 1;
        tmp = left << 8 | right >>> 20 & 240;
        left = right << 24 | right << 8 & 16711680 | right >>> 8 & 65280 | right >>> 24 & 240;
        right = tmp;
        for (var i2 = 0; i2 < shifts.length; ++i2) {
          if (shifts[i2]) {
            left = left << 2 | left >>> 26;
            right = right << 2 | right >>> 26;
          } else {
            left = left << 1 | left >>> 27;
            right = right << 1 | right >>> 27;
          }
          left &= -15;
          right &= -15;
          var lefttmp = pc2bytes0[left >>> 28] | pc2bytes1[left >>> 24 & 15] | pc2bytes2[left >>> 20 & 15] | pc2bytes3[left >>> 16 & 15] | pc2bytes4[left >>> 12 & 15] | pc2bytes5[left >>> 8 & 15] | pc2bytes6[left >>> 4 & 15];
          var righttmp = pc2bytes7[right >>> 28] | pc2bytes8[right >>> 24 & 15] | pc2bytes9[right >>> 20 & 15] | pc2bytes10[right >>> 16 & 15] | pc2bytes11[right >>> 12 & 15] | pc2bytes12[right >>> 8 & 15] | pc2bytes13[right >>> 4 & 15];
          tmp = (righttmp >>> 16 ^ lefttmp) & 65535;
          keys[n++] = lefttmp ^ tmp;
          keys[n++] = righttmp ^ tmp << 16;
        }
      }
      return keys;
    }
    function _updateBlock(keys, input, output, decrypt) {
      var iterations = keys.length === 32 ? 3 : 9;
      var looping;
      if (iterations === 3) {
        looping = decrypt ? [30, -2, -2] : [0, 32, 2];
      } else {
        looping = decrypt ? [94, 62, -2, 32, 64, 2, 30, -2, -2] : [0, 32, 2, 62, 30, -2, 64, 96, 2];
      }
      var tmp;
      var left = input[0];
      var right = input[1];
      tmp = (left >>> 4 ^ right) & 252645135;
      right ^= tmp;
      left ^= tmp << 4;
      tmp = (left >>> 16 ^ right) & 65535;
      right ^= tmp;
      left ^= tmp << 16;
      tmp = (right >>> 2 ^ left) & 858993459;
      left ^= tmp;
      right ^= tmp << 2;
      tmp = (right >>> 8 ^ left) & 16711935;
      left ^= tmp;
      right ^= tmp << 8;
      tmp = (left >>> 1 ^ right) & 1431655765;
      right ^= tmp;
      left ^= tmp << 1;
      left = left << 1 | left >>> 31;
      right = right << 1 | right >>> 31;
      for (var j = 0; j < iterations; j += 3) {
        var endloop = looping[j + 1];
        var loopinc = looping[j + 2];
        for (var i2 = looping[j]; i2 != endloop; i2 += loopinc) {
          var right1 = right ^ keys[i2];
          var right2 = (right >>> 4 | right << 28) ^ keys[i2 + 1];
          tmp = left;
          left = right;
          right = tmp ^ (spfunction2[right1 >>> 24 & 63] | spfunction4[right1 >>> 16 & 63] | spfunction6[right1 >>> 8 & 63] | spfunction8[right1 & 63] | spfunction1[right2 >>> 24 & 63] | spfunction3[right2 >>> 16 & 63] | spfunction5[right2 >>> 8 & 63] | spfunction7[right2 & 63]);
        }
        tmp = left;
        left = right;
        right = tmp;
      }
      left = left >>> 1 | left << 31;
      right = right >>> 1 | right << 31;
      tmp = (left >>> 1 ^ right) & 1431655765;
      right ^= tmp;
      left ^= tmp << 1;
      tmp = (right >>> 8 ^ left) & 16711935;
      left ^= tmp;
      right ^= tmp << 8;
      tmp = (right >>> 2 ^ left) & 858993459;
      left ^= tmp;
      right ^= tmp << 2;
      tmp = (left >>> 16 ^ right) & 65535;
      right ^= tmp;
      left ^= tmp << 16;
      tmp = (left >>> 4 ^ right) & 252645135;
      right ^= tmp;
      left ^= tmp << 4;
      output[0] = left;
      output[1] = right;
    }
    function _createCipher(options) {
      options = options || {};
      var mode = (options.mode || "CBC").toUpperCase();
      var algorithm = "DES-" + mode;
      var cipher;
      if (options.decrypt) {
        cipher = forge2.cipher.createDecipher(algorithm, options.key);
      } else {
        cipher = forge2.cipher.createCipher(algorithm, options.key);
      }
      var start = cipher.start;
      cipher.start = function(iv, options2) {
        var output = null;
        if (options2 instanceof forge2.util.ByteBuffer) {
          output = options2;
          options2 = {};
        }
        options2 = options2 || {};
        options2.output = output;
        options2.iv = iv;
        start.call(cipher, options2);
      };
      return cipher;
    }
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/node-forge/lib/pbkdf2.js
var require_pbkdf2 = __commonJS({
  "node_modules/node-forge/lib/pbkdf2.js"(exports, module) {
    var forge2 = require_forge();
    require_hmac();
    require_md();
    require_util();
    var pkcs5 = forge2.pkcs5 = forge2.pkcs5 || {};
    var crypto2;
    if (forge2.util.isNodejs && !forge2.options.usePureJavaScript) {
      crypto2 = require_crypto();
    }
    module.exports = forge2.pbkdf2 = pkcs5.pbkdf2 = function(p, s, c, dkLen, md, callback) {
      if (typeof md === "function") {
        callback = md;
        md = null;
      }
      if (forge2.util.isNodejs && !forge2.options.usePureJavaScript && crypto2.pbkdf2 && (md === null || typeof md !== "object") && (crypto2.pbkdf2Sync.length > 4 || (!md || md === "sha1"))) {
        if (typeof md !== "string") {
          md = "sha1";
        }
        p = Buffer.from(p, "binary");
        s = Buffer.from(s, "binary");
        if (!callback) {
          if (crypto2.pbkdf2Sync.length === 4) {
            return crypto2.pbkdf2Sync(p, s, c, dkLen).toString("binary");
          }
          return crypto2.pbkdf2Sync(p, s, c, dkLen, md).toString("binary");
        }
        if (crypto2.pbkdf2Sync.length === 4) {
          return crypto2.pbkdf2(p, s, c, dkLen, function(err3, key) {
            if (err3) {
              return callback(err3);
            }
            callback(null, key.toString("binary"));
          });
        }
        return crypto2.pbkdf2(p, s, c, dkLen, md, function(err3, key) {
          if (err3) {
            return callback(err3);
          }
          callback(null, key.toString("binary"));
        });
      }
      if (typeof md === "undefined" || md === null) {
        md = "sha1";
      }
      if (typeof md === "string") {
        if (!(md in forge2.md.algorithms)) {
          throw new Error("Unknown hash algorithm: " + md);
        }
        md = forge2.md[md].create();
      }
      var hLen = md.digestLength;
      if (dkLen > 4294967295 * hLen) {
        var err2 = new Error("Derived key is too long.");
        if (callback) {
          return callback(err2);
        }
        throw err2;
      }
      var len = Math.ceil(dkLen / hLen);
      var r = dkLen - (len - 1) * hLen;
      var prf = forge2.hmac.create();
      prf.start(md, p);
      var dk = "";
      var xor, u_c, u_c1;
      if (!callback) {
        for (var i2 = 1; i2 <= len; ++i2) {
          prf.start(null, null);
          prf.update(s);
          prf.update(forge2.util.int32ToBytes(i2));
          xor = u_c1 = prf.digest().getBytes();
          for (var j = 2; j <= c; ++j) {
            prf.start(null, null);
            prf.update(u_c1);
            u_c = prf.digest().getBytes();
            xor = forge2.util.xorBytes(xor, u_c, hLen);
            u_c1 = u_c;
          }
          dk += i2 < len ? xor : xor.substr(0, r);
        }
        return dk;
      }
      var i2 = 1, j;
      function outer() {
        if (i2 > len) {
          return callback(null, dk);
        }
        prf.start(null, null);
        prf.update(s);
        prf.update(forge2.util.int32ToBytes(i2));
        xor = u_c1 = prf.digest().getBytes();
        j = 2;
        inner();
      }
      function inner() {
        if (j <= c) {
          prf.start(null, null);
          prf.update(u_c1);
          u_c = prf.digest().getBytes();
          xor = forge2.util.xorBytes(xor, u_c, hLen);
          u_c1 = u_c;
          ++j;
          return forge2.util.setImmediate(inner);
        }
        dk += i2 < len ? xor : xor.substr(0, r);
        ++i2;
        outer();
      }
      outer();
    };
  }
});

// node_modules/node-forge/lib/sha256.js
var require_sha256 = __commonJS({
  "node_modules/node-forge/lib/sha256.js"(exports, module) {
    var forge2 = require_forge();
    require_md();
    require_util();
    var sha256 = module.exports = forge2.sha256 = forge2.sha256 || {};
    forge2.md.sha256 = forge2.md.algorithms.sha256 = sha256;
    sha256.create = function() {
      if (!_initialized) {
        _init();
      }
      var _state = null;
      var _input = forge2.util.createBuffer();
      var _w = new Array(64);
      var md = {
        algorithm: "sha256",
        blockLength: 64,
        digestLength: 32,
        // 56-bit length of message so far (does not including padding)
        messageLength: 0,
        // true message length
        fullMessageLength: null,
        // size of message length in bytes
        messageLengthSize: 8
      };
      md.start = function() {
        md.messageLength = 0;
        md.fullMessageLength = md.messageLength64 = [];
        var int32s = md.messageLengthSize / 4;
        for (var i2 = 0; i2 < int32s; ++i2) {
          md.fullMessageLength.push(0);
        }
        _input = forge2.util.createBuffer();
        _state = {
          h0: 1779033703,
          h1: 3144134277,
          h2: 1013904242,
          h3: 2773480762,
          h4: 1359893119,
          h5: 2600822924,
          h6: 528734635,
          h7: 1541459225
        };
        return md;
      };
      md.start();
      md.update = function(msg, encoding) {
        if (encoding === "utf8") {
          msg = forge2.util.encodeUtf8(msg);
        }
        var len = msg.length;
        md.messageLength += len;
        len = [len / 4294967296 >>> 0, len >>> 0];
        for (var i2 = md.fullMessageLength.length - 1; i2 >= 0; --i2) {
          md.fullMessageLength[i2] += len[1];
          len[1] = len[0] + (md.fullMessageLength[i2] / 4294967296 >>> 0);
          md.fullMessageLength[i2] = md.fullMessageLength[i2] >>> 0;
          len[0] = len[1] / 4294967296 >>> 0;
        }
        _input.putBytes(msg);
        _update(_state, _w, _input);
        if (_input.read > 2048 || _input.length() === 0) {
          _input.compact();
        }
        return md;
      };
      md.digest = function() {
        var finalBlock = forge2.util.createBuffer();
        finalBlock.putBytes(_input.bytes());
        var remaining = md.fullMessageLength[md.fullMessageLength.length - 1] + md.messageLengthSize;
        var overflow = remaining & md.blockLength - 1;
        finalBlock.putBytes(_padding.substr(0, md.blockLength - overflow));
        var next, carry;
        var bits = md.fullMessageLength[0] * 8;
        for (var i2 = 0; i2 < md.fullMessageLength.length - 1; ++i2) {
          next = md.fullMessageLength[i2 + 1] * 8;
          carry = next / 4294967296 >>> 0;
          bits += carry;
          finalBlock.putInt32(bits >>> 0);
          bits = next >>> 0;
        }
        finalBlock.putInt32(bits);
        var s2 = {
          h0: _state.h0,
          h1: _state.h1,
          h2: _state.h2,
          h3: _state.h3,
          h4: _state.h4,
          h5: _state.h5,
          h6: _state.h6,
          h7: _state.h7
        };
        _update(s2, _w, finalBlock);
        var rval = forge2.util.createBuffer();
        rval.putInt32(s2.h0);
        rval.putInt32(s2.h1);
        rval.putInt32(s2.h2);
        rval.putInt32(s2.h3);
        rval.putInt32(s2.h4);
        rval.putInt32(s2.h5);
        rval.putInt32(s2.h6);
        rval.putInt32(s2.h7);
        return rval;
      };
      return md;
    };
    var _padding = null;
    var _initialized = false;
    var _k = null;
    function _init() {
      _padding = String.fromCharCode(128);
      _padding += forge2.util.fillString(String.fromCharCode(0), 64);
      _k = [
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ];
      _initialized = true;
    }
    function _update(s, w, bytes) {
      var t1, t2, s0, s1, ch, maj, i2, a, b, c, d, e, f, g, h;
      var len = bytes.length();
      while (len >= 64) {
        for (i2 = 0; i2 < 16; ++i2) {
          w[i2] = bytes.getInt32();
        }
        for (; i2 < 64; ++i2) {
          t1 = w[i2 - 2];
          t1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
          t2 = w[i2 - 15];
          t2 = (t2 >>> 7 | t2 << 25) ^ (t2 >>> 18 | t2 << 14) ^ t2 >>> 3;
          w[i2] = t1 + w[i2 - 7] + t2 + w[i2 - 16] | 0;
        }
        a = s.h0;
        b = s.h1;
        c = s.h2;
        d = s.h3;
        e = s.h4;
        f = s.h5;
        g = s.h6;
        h = s.h7;
        for (i2 = 0; i2 < 64; ++i2) {
          s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
          ch = g ^ e & (f ^ g);
          s0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
          maj = a & b | c & (a ^ b);
          t1 = h + s1 + ch + _k[i2] + w[i2];
          t2 = s0 + maj;
          h = g;
          g = f;
          f = e;
          e = d + t1 >>> 0;
          d = c;
          c = b;
          b = a;
          a = t1 + t2 >>> 0;
        }
        s.h0 = s.h0 + a | 0;
        s.h1 = s.h1 + b | 0;
        s.h2 = s.h2 + c | 0;
        s.h3 = s.h3 + d | 0;
        s.h4 = s.h4 + e | 0;
        s.h5 = s.h5 + f | 0;
        s.h6 = s.h6 + g | 0;
        s.h7 = s.h7 + h | 0;
        len -= 64;
      }
    }
  }
});

// node_modules/node-forge/lib/prng.js
var require_prng = __commonJS({
  "node_modules/node-forge/lib/prng.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    var _crypto = null;
    if (forge2.util.isNodejs && !forge2.options.usePureJavaScript && !process.versions["node-webkit"]) {
      _crypto = require_crypto();
    }
    var prng = module.exports = forge2.prng = forge2.prng || {};
    prng.create = function(plugin) {
      var ctx = {
        plugin,
        key: null,
        seed: null,
        time: null,
        // number of reseeds so far
        reseeds: 0,
        // amount of data generated so far
        generated: 0,
        // no initial key bytes
        keyBytes: ""
      };
      var md = plugin.md;
      var pools = new Array(32);
      for (var i2 = 0; i2 < 32; ++i2) {
        pools[i2] = md.create();
      }
      ctx.pools = pools;
      ctx.pool = 0;
      ctx.generate = function(count, callback) {
        if (!callback) {
          return ctx.generateSync(count);
        }
        var cipher = ctx.plugin.cipher;
        var increment = ctx.plugin.increment;
        var formatKey = ctx.plugin.formatKey;
        var formatSeed = ctx.plugin.formatSeed;
        var b = forge2.util.createBuffer();
        ctx.key = null;
        generate();
        function generate(err2) {
          if (err2) {
            return callback(err2);
          }
          if (b.length() >= count) {
            return callback(null, b.getBytes(count));
          }
          if (ctx.generated > 1048575) {
            ctx.key = null;
          }
          if (ctx.key === null) {
            return forge2.util.nextTick(function() {
              _reseed(generate);
            });
          }
          var bytes = cipher(ctx.key, ctx.seed);
          ctx.generated += bytes.length;
          b.putBytes(bytes);
          ctx.key = formatKey(cipher(ctx.key, increment(ctx.seed)));
          ctx.seed = formatSeed(cipher(ctx.key, ctx.seed));
          forge2.util.setImmediate(generate);
        }
      };
      ctx.generateSync = function(count) {
        var cipher = ctx.plugin.cipher;
        var increment = ctx.plugin.increment;
        var formatKey = ctx.plugin.formatKey;
        var formatSeed = ctx.plugin.formatSeed;
        ctx.key = null;
        var b = forge2.util.createBuffer();
        while (b.length() < count) {
          if (ctx.generated > 1048575) {
            ctx.key = null;
          }
          if (ctx.key === null) {
            _reseedSync();
          }
          var bytes = cipher(ctx.key, ctx.seed);
          ctx.generated += bytes.length;
          b.putBytes(bytes);
          ctx.key = formatKey(cipher(ctx.key, increment(ctx.seed)));
          ctx.seed = formatSeed(cipher(ctx.key, ctx.seed));
        }
        return b.getBytes(count);
      };
      function _reseed(callback) {
        if (ctx.pools[0].messageLength >= 32) {
          _seed();
          return callback();
        }
        var needed = 32 - ctx.pools[0].messageLength << 5;
        ctx.seedFile(needed, function(err2, bytes) {
          if (err2) {
            return callback(err2);
          }
          ctx.collect(bytes);
          _seed();
          callback();
        });
      }
      function _reseedSync() {
        if (ctx.pools[0].messageLength >= 32) {
          return _seed();
        }
        var needed = 32 - ctx.pools[0].messageLength << 5;
        ctx.collect(ctx.seedFileSync(needed));
        _seed();
      }
      function _seed() {
        ctx.reseeds = ctx.reseeds === 4294967295 ? 0 : ctx.reseeds + 1;
        var md2 = ctx.plugin.md.create();
        md2.update(ctx.keyBytes);
        var _2powK = 1;
        for (var k = 0; k < 32; ++k) {
          if (ctx.reseeds % _2powK === 0) {
            md2.update(ctx.pools[k].digest().getBytes());
            ctx.pools[k].start();
          }
          _2powK = _2powK << 1;
        }
        ctx.keyBytes = md2.digest().getBytes();
        md2.start();
        md2.update(ctx.keyBytes);
        var seedBytes = md2.digest().getBytes();
        ctx.key = ctx.plugin.formatKey(ctx.keyBytes);
        ctx.seed = ctx.plugin.formatSeed(seedBytes);
        ctx.generated = 0;
      }
      function defaultSeedFile(needed) {
        var getRandomValues = null;
        var globalScope = forge2.util.globalScope;
        var _crypto2 = globalScope.crypto || globalScope.msCrypto;
        if (_crypto2 && _crypto2.getRandomValues) {
          getRandomValues = function(arr) {
            return _crypto2.getRandomValues(arr);
          };
        }
        var b = forge2.util.createBuffer();
        if (getRandomValues) {
          while (b.length() < needed) {
            var count = Math.max(1, Math.min(needed - b.length(), 65536) / 4);
            var entropy = new Uint32Array(Math.floor(count));
            try {
              getRandomValues(entropy);
              for (var i3 = 0; i3 < entropy.length; ++i3) {
                b.putInt32(entropy[i3]);
              }
            } catch (e) {
              if (!(typeof QuotaExceededError !== "undefined" && e instanceof QuotaExceededError)) {
                throw e;
              }
            }
          }
        }
        if (b.length() < needed) {
          var hi, lo, next;
          var seed = Math.floor(Math.random() * 65536);
          while (b.length() < needed) {
            lo = 16807 * (seed & 65535);
            hi = 16807 * (seed >> 16);
            lo += (hi & 32767) << 16;
            lo += hi >> 15;
            lo = (lo & 2147483647) + (lo >> 31);
            seed = lo & 4294967295;
            for (var i3 = 0; i3 < 3; ++i3) {
              next = seed >>> (i3 << 3);
              next ^= Math.floor(Math.random() * 256);
              b.putByte(next & 255);
            }
          }
        }
        return b.getBytes(needed);
      }
      if (_crypto) {
        ctx.seedFile = function(needed, callback) {
          _crypto.randomBytes(needed, function(err2, bytes) {
            if (err2) {
              return callback(err2);
            }
            callback(null, bytes.toString());
          });
        };
        ctx.seedFileSync = function(needed) {
          return _crypto.randomBytes(needed).toString();
        };
      } else {
        ctx.seedFile = function(needed, callback) {
          try {
            callback(null, defaultSeedFile(needed));
          } catch (e) {
            callback(e);
          }
        };
        ctx.seedFileSync = defaultSeedFile;
      }
      ctx.collect = function(bytes) {
        var count = bytes.length;
        for (var i3 = 0; i3 < count; ++i3) {
          ctx.pools[ctx.pool].update(bytes.substr(i3, 1));
          ctx.pool = ctx.pool === 31 ? 0 : ctx.pool + 1;
        }
      };
      ctx.collectInt = function(i3, n) {
        var bytes = "";
        for (var x2 = 0; x2 < n; x2 += 8) {
          bytes += String.fromCharCode(i3 >> x2 & 255);
        }
        ctx.collect(bytes);
      };
      ctx.registerWorker = function(worker) {
        if (worker === self) {
          ctx.seedFile = function(needed, callback) {
            function listener2(e) {
              var data = e.data;
              if (data.forge && data.forge.prng) {
                self.removeEventListener("message", listener2);
                callback(data.forge.prng.err, data.forge.prng.bytes);
              }
            }
            self.addEventListener("message", listener2);
            self.postMessage({ forge: { prng: { needed } } });
          };
        } else {
          var listener = function(e) {
            var data = e.data;
            if (data.forge && data.forge.prng) {
              ctx.seedFile(data.forge.prng.needed, function(err2, bytes) {
                worker.postMessage({ forge: { prng: { err: err2, bytes } } });
              });
            }
          };
          worker.addEventListener("message", listener);
        }
      };
      return ctx;
    };
  }
});

// node_modules/node-forge/lib/random.js
var require_random = __commonJS({
  "node_modules/node-forge/lib/random.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_sha256();
    require_prng();
    require_util();
    (function() {
      if (forge2.random && forge2.random.getBytes) {
        module.exports = forge2.random;
        return;
      }
      (function(jQuery2) {
        var prng_aes = {};
        var _prng_aes_output = new Array(4);
        var _prng_aes_buffer = forge2.util.createBuffer();
        prng_aes.formatKey = function(key2) {
          var tmp = forge2.util.createBuffer(key2);
          key2 = new Array(4);
          key2[0] = tmp.getInt32();
          key2[1] = tmp.getInt32();
          key2[2] = tmp.getInt32();
          key2[3] = tmp.getInt32();
          return forge2.aes._expandKey(key2, false);
        };
        prng_aes.formatSeed = function(seed) {
          var tmp = forge2.util.createBuffer(seed);
          seed = new Array(4);
          seed[0] = tmp.getInt32();
          seed[1] = tmp.getInt32();
          seed[2] = tmp.getInt32();
          seed[3] = tmp.getInt32();
          return seed;
        };
        prng_aes.cipher = function(key2, seed) {
          forge2.aes._updateBlock(key2, seed, _prng_aes_output, false);
          _prng_aes_buffer.putInt32(_prng_aes_output[0]);
          _prng_aes_buffer.putInt32(_prng_aes_output[1]);
          _prng_aes_buffer.putInt32(_prng_aes_output[2]);
          _prng_aes_buffer.putInt32(_prng_aes_output[3]);
          return _prng_aes_buffer.getBytes();
        };
        prng_aes.increment = function(seed) {
          ++seed[3];
          return seed;
        };
        prng_aes.md = forge2.md.sha256;
        function spawnPrng() {
          var ctx = forge2.prng.create(prng_aes);
          ctx.getBytes = function(count, callback) {
            return ctx.generate(count, callback);
          };
          ctx.getBytesSync = function(count) {
            return ctx.generate(count);
          };
          return ctx;
        }
        var _ctx = spawnPrng();
        var getRandomValues = null;
        var globalScope = forge2.util.globalScope;
        var _crypto = globalScope.crypto || globalScope.msCrypto;
        if (_crypto && _crypto.getRandomValues) {
          getRandomValues = function(arr) {
            return _crypto.getRandomValues(arr);
          };
        }
        if (forge2.options.usePureJavaScript || !forge2.util.isNodejs && !getRandomValues) {
          if (typeof window === "undefined" || window.document === void 0) {
          }
          _ctx.collectInt(+/* @__PURE__ */ new Date(), 32);
          if (typeof navigator !== "undefined") {
            var _navBytes = "";
            for (var key in navigator) {
              try {
                if (typeof navigator[key] == "string") {
                  _navBytes += navigator[key];
                }
              } catch (e) {
              }
            }
            _ctx.collect(_navBytes);
            _navBytes = null;
          }
          if (jQuery2) {
            jQuery2().mousemove(function(e) {
              _ctx.collectInt(e.clientX, 16);
              _ctx.collectInt(e.clientY, 16);
            });
            jQuery2().keypress(function(e) {
              _ctx.collectInt(e.charCode, 8);
            });
          }
        }
        if (!forge2.random) {
          forge2.random = _ctx;
        } else {
          for (var key in _ctx) {
            forge2.random[key] = _ctx[key];
          }
        }
        forge2.random.createInstance = spawnPrng;
        module.exports = forge2.random;
      })(typeof jQuery !== "undefined" ? jQuery : null);
    })();
  }
});

// node_modules/node-forge/lib/rc2.js
var require_rc2 = __commonJS({
  "node_modules/node-forge/lib/rc2.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    var piTable = [
      217,
      120,
      249,
      196,
      25,
      221,
      181,
      237,
      40,
      233,
      253,
      121,
      74,
      160,
      216,
      157,
      198,
      126,
      55,
      131,
      43,
      118,
      83,
      142,
      98,
      76,
      100,
      136,
      68,
      139,
      251,
      162,
      23,
      154,
      89,
      245,
      135,
      179,
      79,
      19,
      97,
      69,
      109,
      141,
      9,
      129,
      125,
      50,
      189,
      143,
      64,
      235,
      134,
      183,
      123,
      11,
      240,
      149,
      33,
      34,
      92,
      107,
      78,
      130,
      84,
      214,
      101,
      147,
      206,
      96,
      178,
      28,
      115,
      86,
      192,
      20,
      167,
      140,
      241,
      220,
      18,
      117,
      202,
      31,
      59,
      190,
      228,
      209,
      66,
      61,
      212,
      48,
      163,
      60,
      182,
      38,
      111,
      191,
      14,
      218,
      70,
      105,
      7,
      87,
      39,
      242,
      29,
      155,
      188,
      148,
      67,
      3,
      248,
      17,
      199,
      246,
      144,
      239,
      62,
      231,
      6,
      195,
      213,
      47,
      200,
      102,
      30,
      215,
      8,
      232,
      234,
      222,
      128,
      82,
      238,
      247,
      132,
      170,
      114,
      172,
      53,
      77,
      106,
      42,
      150,
      26,
      210,
      113,
      90,
      21,
      73,
      116,
      75,
      159,
      208,
      94,
      4,
      24,
      164,
      236,
      194,
      224,
      65,
      110,
      15,
      81,
      203,
      204,
      36,
      145,
      175,
      80,
      161,
      244,
      112,
      57,
      153,
      124,
      58,
      133,
      35,
      184,
      180,
      122,
      252,
      2,
      54,
      91,
      37,
      85,
      151,
      49,
      45,
      93,
      250,
      152,
      227,
      138,
      146,
      174,
      5,
      223,
      41,
      16,
      103,
      108,
      186,
      201,
      211,
      0,
      230,
      207,
      225,
      158,
      168,
      44,
      99,
      22,
      1,
      63,
      88,
      226,
      137,
      169,
      13,
      56,
      52,
      27,
      171,
      51,
      255,
      176,
      187,
      72,
      12,
      95,
      185,
      177,
      205,
      46,
      197,
      243,
      219,
      71,
      229,
      165,
      156,
      119,
      10,
      166,
      32,
      104,
      254,
      127,
      193,
      173
    ];
    var s = [1, 2, 3, 5];
    var rol = function(word, bits) {
      return word << bits & 65535 | (word & 65535) >> 16 - bits;
    };
    var ror = function(word, bits) {
      return (word & 65535) >> bits | word << 16 - bits & 65535;
    };
    module.exports = forge2.rc2 = forge2.rc2 || {};
    forge2.rc2.expandKey = function(key, effKeyBits) {
      if (typeof key === "string") {
        key = forge2.util.createBuffer(key);
      }
      effKeyBits = effKeyBits || 128;
      var L = key;
      var T = key.length();
      var T1 = effKeyBits;
      var T8 = Math.ceil(T1 / 8);
      var TM = 255 >> (T1 & 7);
      var i2;
      for (i2 = T; i2 < 128; i2++) {
        L.putByte(piTable[L.at(i2 - 1) + L.at(i2 - T) & 255]);
      }
      L.setAt(128 - T8, piTable[L.at(128 - T8) & TM]);
      for (i2 = 127 - T8; i2 >= 0; i2--) {
        L.setAt(i2, piTable[L.at(i2 + 1) ^ L.at(i2 + T8)]);
      }
      return L;
    };
    var createCipher = function(key, bits, encrypt) {
      var _finish = false, _input = null, _output = null, _iv = null;
      var mixRound, mashRound;
      var i2, j, K = [];
      key = forge2.rc2.expandKey(key, bits);
      for (i2 = 0; i2 < 64; i2++) {
        K.push(key.getInt16Le());
      }
      if (encrypt) {
        mixRound = function(R) {
          for (i2 = 0; i2 < 4; i2++) {
            R[i2] += K[j] + (R[(i2 + 3) % 4] & R[(i2 + 2) % 4]) + (~R[(i2 + 3) % 4] & R[(i2 + 1) % 4]);
            R[i2] = rol(R[i2], s[i2]);
            j++;
          }
        };
        mashRound = function(R) {
          for (i2 = 0; i2 < 4; i2++) {
            R[i2] += K[R[(i2 + 3) % 4] & 63];
          }
        };
      } else {
        mixRound = function(R) {
          for (i2 = 3; i2 >= 0; i2--) {
            R[i2] = ror(R[i2], s[i2]);
            R[i2] -= K[j] + (R[(i2 + 3) % 4] & R[(i2 + 2) % 4]) + (~R[(i2 + 3) % 4] & R[(i2 + 1) % 4]);
            j--;
          }
        };
        mashRound = function(R) {
          for (i2 = 3; i2 >= 0; i2--) {
            R[i2] -= K[R[(i2 + 3) % 4] & 63];
          }
        };
      }
      var runPlan = function(plan) {
        var R = [];
        for (i2 = 0; i2 < 4; i2++) {
          var val = _input.getInt16Le();
          if (_iv !== null) {
            if (encrypt) {
              val ^= _iv.getInt16Le();
            } else {
              _iv.putInt16Le(val);
            }
          }
          R.push(val & 65535);
        }
        j = encrypt ? 0 : 63;
        for (var ptr = 0; ptr < plan.length; ptr++) {
          for (var ctr = 0; ctr < plan[ptr][0]; ctr++) {
            plan[ptr][1](R);
          }
        }
        for (i2 = 0; i2 < 4; i2++) {
          if (_iv !== null) {
            if (encrypt) {
              _iv.putInt16Le(R[i2]);
            } else {
              R[i2] ^= _iv.getInt16Le();
            }
          }
          _output.putInt16Le(R[i2]);
        }
      };
      var cipher = null;
      cipher = {
        /**
         * Starts or restarts the encryption or decryption process, whichever
         * was previously configured.
         *
         * To use the cipher in CBC mode, iv may be given either as a string
         * of bytes, or as a byte buffer.  For ECB mode, give null as iv.
         *
         * @param iv the initialization vector to use, null for ECB mode.
         * @param output the output the buffer to write to, null to create one.
         */
        start: function(iv, output) {
          if (iv) {
            if (typeof iv === "string") {
              iv = forge2.util.createBuffer(iv);
            }
          }
          _finish = false;
          _input = forge2.util.createBuffer();
          _output = output || new forge2.util.createBuffer();
          _iv = iv;
          cipher.output = _output;
        },
        /**
         * Updates the next block.
         *
         * @param input the buffer to read from.
         */
        update: function(input) {
          if (!_finish) {
            _input.putBuffer(input);
          }
          while (_input.length() >= 8) {
            runPlan([
              [5, mixRound],
              [1, mashRound],
              [6, mixRound],
              [1, mashRound],
              [5, mixRound]
            ]);
          }
        },
        /**
         * Finishes encrypting or decrypting.
         *
         * @param pad a padding function to use, null for PKCS#7 padding,
         *           signature(blockSize, buffer, decrypt).
         *
         * @return true if successful, false on error.
         */
        finish: function(pad) {
          var rval = true;
          if (encrypt) {
            if (pad) {
              rval = pad(8, _input, !encrypt);
            } else {
              var padding = _input.length() === 8 ? 8 : 8 - _input.length();
              _input.fillWithByte(padding, padding);
            }
          }
          if (rval) {
            _finish = true;
            cipher.update();
          }
          if (!encrypt) {
            rval = _input.length() === 0;
            if (rval) {
              if (pad) {
                rval = pad(8, _output, !encrypt);
              } else {
                var len = _output.length();
                var count = _output.at(len - 1);
                if (count > len) {
                  rval = false;
                } else {
                  _output.truncate(count);
                }
              }
            }
          }
          return rval;
        }
      };
      return cipher;
    };
    forge2.rc2.startEncrypting = function(key, iv, output) {
      var cipher = forge2.rc2.createEncryptionCipher(key, 128);
      cipher.start(iv, output);
      return cipher;
    };
    forge2.rc2.createEncryptionCipher = function(key, bits) {
      return createCipher(key, bits, true);
    };
    forge2.rc2.startDecrypting = function(key, iv, output) {
      var cipher = forge2.rc2.createDecryptionCipher(key, 128);
      cipher.start(iv, output);
      return cipher;
    };
    forge2.rc2.createDecryptionCipher = function(key, bits) {
      return createCipher(key, bits, false);
    };
  }
});

// node_modules/node-forge/lib/jsbn.js
var require_jsbn = __commonJS({
  "node_modules/node-forge/lib/jsbn.js"(exports, module) {
    var forge2 = require_forge();
    module.exports = forge2.jsbn = forge2.jsbn || {};
    var dbits;
    var canary = 244837814094590;
    var j_lm = (canary & 16777215) == 15715070;
    function BigInteger(a, b, c) {
      this.data = [];
      if (a != null)
        if ("number" == typeof a) this.fromNumber(a, b, c);
        else if (b == null && "string" != typeof a) this.fromString(a, 256);
        else this.fromString(a, b);
    }
    forge2.jsbn.BigInteger = BigInteger;
    function nbi() {
      return new BigInteger(null);
    }
    function am1(i2, x2, w, j, c, n) {
      while (--n >= 0) {
        var v = x2 * this.data[i2++] + w.data[j] + c;
        c = Math.floor(v / 67108864);
        w.data[j++] = v & 67108863;
      }
      return c;
    }
    function am2(i2, x2, w, j, c, n) {
      var xl = x2 & 32767, xh = x2 >> 15;
      while (--n >= 0) {
        var l = this.data[i2] & 32767;
        var h = this.data[i2++] >> 15;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 32767) << 15) + w.data[j] + (c & 1073741823);
        c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
        w.data[j++] = l & 1073741823;
      }
      return c;
    }
    function am3(i2, x2, w, j, c, n) {
      var xl = x2 & 16383, xh = x2 >> 14;
      while (--n >= 0) {
        var l = this.data[i2] & 16383;
        var h = this.data[i2++] >> 14;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 16383) << 14) + w.data[j] + c;
        c = (l >> 28) + (m >> 14) + xh * h;
        w.data[j++] = l & 268435455;
      }
      return c;
    }
    if (typeof navigator === "undefined") {
      BigInteger.prototype.am = am3;
      dbits = 28;
    } else if (j_lm && navigator.appName == "Microsoft Internet Explorer") {
      BigInteger.prototype.am = am2;
      dbits = 30;
    } else if (j_lm && navigator.appName != "Netscape") {
      BigInteger.prototype.am = am1;
      dbits = 26;
    } else {
      BigInteger.prototype.am = am3;
      dbits = 28;
    }
    BigInteger.prototype.DB = dbits;
    BigInteger.prototype.DM = (1 << dbits) - 1;
    BigInteger.prototype.DV = 1 << dbits;
    var BI_FP = 52;
    BigInteger.prototype.FV = Math.pow(2, BI_FP);
    BigInteger.prototype.F1 = BI_FP - dbits;
    BigInteger.prototype.F2 = 2 * dbits - BI_FP;
    var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
    var BI_RC = new Array();
    var rr;
    var vv;
    rr = "0".charCodeAt(0);
    for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
    rr = "a".charCodeAt(0);
    for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
    rr = "A".charCodeAt(0);
    for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
    function int2char(n) {
      return BI_RM.charAt(n);
    }
    function intAt(s, i2) {
      var c = BI_RC[s.charCodeAt(i2)];
      return c == null ? -1 : c;
    }
    function bnpCopyTo(r) {
      for (var i2 = this.t - 1; i2 >= 0; --i2) r.data[i2] = this.data[i2];
      r.t = this.t;
      r.s = this.s;
    }
    function bnpFromInt(x2) {
      this.t = 1;
      this.s = x2 < 0 ? -1 : 0;
      if (x2 > 0) this.data[0] = x2;
      else if (x2 < -1) this.data[0] = x2 + this.DV;
      else this.t = 0;
    }
    function nbv(i2) {
      var r = nbi();
      r.fromInt(i2);
      return r;
    }
    function bnpFromString(s, b) {
      var k;
      if (b == 16) k = 4;
      else if (b == 8) k = 3;
      else if (b == 256) k = 8;
      else if (b == 2) k = 1;
      else if (b == 32) k = 5;
      else if (b == 4) k = 2;
      else {
        this.fromRadix(s, b);
        return;
      }
      this.t = 0;
      this.s = 0;
      var i2 = s.length, mi = false, sh = 0;
      while (--i2 >= 0) {
        var x2 = k == 8 ? s[i2] & 255 : intAt(s, i2);
        if (x2 < 0) {
          if (s.charAt(i2) == "-") mi = true;
          continue;
        }
        mi = false;
        if (sh == 0)
          this.data[this.t++] = x2;
        else if (sh + k > this.DB) {
          this.data[this.t - 1] |= (x2 & (1 << this.DB - sh) - 1) << sh;
          this.data[this.t++] = x2 >> this.DB - sh;
        } else
          this.data[this.t - 1] |= x2 << sh;
        sh += k;
        if (sh >= this.DB) sh -= this.DB;
      }
      if (k == 8 && (s[0] & 128) != 0) {
        this.s = -1;
        if (sh > 0) this.data[this.t - 1] |= (1 << this.DB - sh) - 1 << sh;
      }
      this.clamp();
      if (mi) BigInteger.ZERO.subTo(this, this);
    }
    function bnpClamp() {
      var c = this.s & this.DM;
      while (this.t > 0 && this.data[this.t - 1] == c) --this.t;
    }
    function bnToString(b) {
      if (this.s < 0) return "-" + this.negate().toString(b);
      var k;
      if (b == 16) k = 4;
      else if (b == 8) k = 3;
      else if (b == 2) k = 1;
      else if (b == 32) k = 5;
      else if (b == 4) k = 2;
      else return this.toRadix(b);
      var km = (1 << k) - 1, d, m = false, r = "", i2 = this.t;
      var p = this.DB - i2 * this.DB % k;
      if (i2-- > 0) {
        if (p < this.DB && (d = this.data[i2] >> p) > 0) {
          m = true;
          r = int2char(d);
        }
        while (i2 >= 0) {
          if (p < k) {
            d = (this.data[i2] & (1 << p) - 1) << k - p;
            d |= this.data[--i2] >> (p += this.DB - k);
          } else {
            d = this.data[i2] >> (p -= k) & km;
            if (p <= 0) {
              p += this.DB;
              --i2;
            }
          }
          if (d > 0) m = true;
          if (m) r += int2char(d);
        }
      }
      return m ? r : "0";
    }
    function bnNegate() {
      var r = nbi();
      BigInteger.ZERO.subTo(this, r);
      return r;
    }
    function bnAbs() {
      return this.s < 0 ? this.negate() : this;
    }
    function bnCompareTo(a) {
      var r = this.s - a.s;
      if (r != 0) return r;
      var i2 = this.t;
      r = i2 - a.t;
      if (r != 0) return this.s < 0 ? -r : r;
      while (--i2 >= 0) if ((r = this.data[i2] - a.data[i2]) != 0) return r;
      return 0;
    }
    function nbits(x2) {
      var r = 1, t;
      if ((t = x2 >>> 16) != 0) {
        x2 = t;
        r += 16;
      }
      if ((t = x2 >> 8) != 0) {
        x2 = t;
        r += 8;
      }
      if ((t = x2 >> 4) != 0) {
        x2 = t;
        r += 4;
      }
      if ((t = x2 >> 2) != 0) {
        x2 = t;
        r += 2;
      }
      if ((t = x2 >> 1) != 0) {
        x2 = t;
        r += 1;
      }
      return r;
    }
    function bnBitLength() {
      if (this.t <= 0) return 0;
      return this.DB * (this.t - 1) + nbits(this.data[this.t - 1] ^ this.s & this.DM);
    }
    function bnpDLShiftTo(n, r) {
      var i2;
      for (i2 = this.t - 1; i2 >= 0; --i2) r.data[i2 + n] = this.data[i2];
      for (i2 = n - 1; i2 >= 0; --i2) r.data[i2] = 0;
      r.t = this.t + n;
      r.s = this.s;
    }
    function bnpDRShiftTo(n, r) {
      for (var i2 = n; i2 < this.t; ++i2) r.data[i2 - n] = this.data[i2];
      r.t = Math.max(this.t - n, 0);
      r.s = this.s;
    }
    function bnpLShiftTo(n, r) {
      var bs = n % this.DB;
      var cbs = this.DB - bs;
      var bm = (1 << cbs) - 1;
      var ds = Math.floor(n / this.DB), c = this.s << bs & this.DM, i2;
      for (i2 = this.t - 1; i2 >= 0; --i2) {
        r.data[i2 + ds + 1] = this.data[i2] >> cbs | c;
        c = (this.data[i2] & bm) << bs;
      }
      for (i2 = ds - 1; i2 >= 0; --i2) r.data[i2] = 0;
      r.data[ds] = c;
      r.t = this.t + ds + 1;
      r.s = this.s;
      r.clamp();
    }
    function bnpRShiftTo(n, r) {
      r.s = this.s;
      var ds = Math.floor(n / this.DB);
      if (ds >= this.t) {
        r.t = 0;
        return;
      }
      var bs = n % this.DB;
      var cbs = this.DB - bs;
      var bm = (1 << bs) - 1;
      r.data[0] = this.data[ds] >> bs;
      for (var i2 = ds + 1; i2 < this.t; ++i2) {
        r.data[i2 - ds - 1] |= (this.data[i2] & bm) << cbs;
        r.data[i2 - ds] = this.data[i2] >> bs;
      }
      if (bs > 0) r.data[this.t - ds - 1] |= (this.s & bm) << cbs;
      r.t = this.t - ds;
      r.clamp();
    }
    function bnpSubTo(a, r) {
      var i2 = 0, c = 0, m = Math.min(a.t, this.t);
      while (i2 < m) {
        c += this.data[i2] - a.data[i2];
        r.data[i2++] = c & this.DM;
        c >>= this.DB;
      }
      if (a.t < this.t) {
        c -= a.s;
        while (i2 < this.t) {
          c += this.data[i2];
          r.data[i2++] = c & this.DM;
          c >>= this.DB;
        }
        c += this.s;
      } else {
        c += this.s;
        while (i2 < a.t) {
          c -= a.data[i2];
          r.data[i2++] = c & this.DM;
          c >>= this.DB;
        }
        c -= a.s;
      }
      r.s = c < 0 ? -1 : 0;
      if (c < -1) r.data[i2++] = this.DV + c;
      else if (c > 0) r.data[i2++] = c;
      r.t = i2;
      r.clamp();
    }
    function bnpMultiplyTo(a, r) {
      var x2 = this.abs(), y = a.abs();
      var i2 = x2.t;
      r.t = i2 + y.t;
      while (--i2 >= 0) r.data[i2] = 0;
      for (i2 = 0; i2 < y.t; ++i2) r.data[i2 + x2.t] = x2.am(0, y.data[i2], r, i2, 0, x2.t);
      r.s = 0;
      r.clamp();
      if (this.s != a.s) BigInteger.ZERO.subTo(r, r);
    }
    function bnpSquareTo(r) {
      var x2 = this.abs();
      var i2 = r.t = 2 * x2.t;
      while (--i2 >= 0) r.data[i2] = 0;
      for (i2 = 0; i2 < x2.t - 1; ++i2) {
        var c = x2.am(i2, x2.data[i2], r, 2 * i2, 0, 1);
        if ((r.data[i2 + x2.t] += x2.am(i2 + 1, 2 * x2.data[i2], r, 2 * i2 + 1, c, x2.t - i2 - 1)) >= x2.DV) {
          r.data[i2 + x2.t] -= x2.DV;
          r.data[i2 + x2.t + 1] = 1;
        }
      }
      if (r.t > 0) r.data[r.t - 1] += x2.am(i2, x2.data[i2], r, 2 * i2, 0, 1);
      r.s = 0;
      r.clamp();
    }
    function bnpDivRemTo(m, q, r) {
      var pm = m.abs();
      if (pm.t <= 0) return;
      var pt = this.abs();
      if (pt.t < pm.t) {
        if (q != null) q.fromInt(0);
        if (r != null) this.copyTo(r);
        return;
      }
      if (r == null) r = nbi();
      var y = nbi(), ts = this.s, ms = m.s;
      var nsh = this.DB - nbits(pm.data[pm.t - 1]);
      if (nsh > 0) {
        pm.lShiftTo(nsh, y);
        pt.lShiftTo(nsh, r);
      } else {
        pm.copyTo(y);
        pt.copyTo(r);
      }
      var ys = y.t;
      var y0 = y.data[ys - 1];
      if (y0 == 0) return;
      var yt = y0 * (1 << this.F1) + (ys > 1 ? y.data[ys - 2] >> this.F2 : 0);
      var d1 = this.FV / yt, d2 = (1 << this.F1) / yt, e = 1 << this.F2;
      var i2 = r.t, j = i2 - ys, t = q == null ? nbi() : q;
      y.dlShiftTo(j, t);
      if (r.compareTo(t) >= 0) {
        r.data[r.t++] = 1;
        r.subTo(t, r);
      }
      BigInteger.ONE.dlShiftTo(ys, t);
      t.subTo(y, y);
      while (y.t < ys) y.data[y.t++] = 0;
      while (--j >= 0) {
        var qd = r.data[--i2] == y0 ? this.DM : Math.floor(r.data[i2] * d1 + (r.data[i2 - 1] + e) * d2);
        if ((r.data[i2] += y.am(0, qd, r, j, 0, ys)) < qd) {
          y.dlShiftTo(j, t);
          r.subTo(t, r);
          while (r.data[i2] < --qd) r.subTo(t, r);
        }
      }
      if (q != null) {
        r.drShiftTo(ys, q);
        if (ts != ms) BigInteger.ZERO.subTo(q, q);
      }
      r.t = ys;
      r.clamp();
      if (nsh > 0) r.rShiftTo(nsh, r);
      if (ts < 0) BigInteger.ZERO.subTo(r, r);
    }
    function bnMod(a) {
      var r = nbi();
      this.abs().divRemTo(a, null, r);
      if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
      return r;
    }
    function Classic(m) {
      this.m = m;
    }
    function cConvert(x2) {
      if (x2.s < 0 || x2.compareTo(this.m) >= 0) return x2.mod(this.m);
      else return x2;
    }
    function cRevert(x2) {
      return x2;
    }
    function cReduce(x2) {
      x2.divRemTo(this.m, null, x2);
    }
    function cMulTo(x2, y, r) {
      x2.multiplyTo(y, r);
      this.reduce(r);
    }
    function cSqrTo(x2, r) {
      x2.squareTo(r);
      this.reduce(r);
    }
    Classic.prototype.convert = cConvert;
    Classic.prototype.revert = cRevert;
    Classic.prototype.reduce = cReduce;
    Classic.prototype.mulTo = cMulTo;
    Classic.prototype.sqrTo = cSqrTo;
    function bnpInvDigit() {
      if (this.t < 1) return 0;
      var x2 = this.data[0];
      if ((x2 & 1) == 0) return 0;
      var y = x2 & 3;
      y = y * (2 - (x2 & 15) * y) & 15;
      y = y * (2 - (x2 & 255) * y) & 255;
      y = y * (2 - ((x2 & 65535) * y & 65535)) & 65535;
      y = y * (2 - x2 * y % this.DV) % this.DV;
      return y > 0 ? this.DV - y : -y;
    }
    function Montgomery(m) {
      this.m = m;
      this.mp = m.invDigit();
      this.mpl = this.mp & 32767;
      this.mph = this.mp >> 15;
      this.um = (1 << m.DB - 15) - 1;
      this.mt2 = 2 * m.t;
    }
    function montConvert(x2) {
      var r = nbi();
      x2.abs().dlShiftTo(this.m.t, r);
      r.divRemTo(this.m, null, r);
      if (x2.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
      return r;
    }
    function montRevert(x2) {
      var r = nbi();
      x2.copyTo(r);
      this.reduce(r);
      return r;
    }
    function montReduce(x2) {
      while (x2.t <= this.mt2)
        x2.data[x2.t++] = 0;
      for (var i2 = 0; i2 < this.m.t; ++i2) {
        var j = x2.data[i2] & 32767;
        var u0 = j * this.mpl + ((j * this.mph + (x2.data[i2] >> 15) * this.mpl & this.um) << 15) & x2.DM;
        j = i2 + this.m.t;
        x2.data[j] += this.m.am(0, u0, x2, i2, 0, this.m.t);
        while (x2.data[j] >= x2.DV) {
          x2.data[j] -= x2.DV;
          x2.data[++j]++;
        }
      }
      x2.clamp();
      x2.drShiftTo(this.m.t, x2);
      if (x2.compareTo(this.m) >= 0) x2.subTo(this.m, x2);
    }
    function montSqrTo(x2, r) {
      x2.squareTo(r);
      this.reduce(r);
    }
    function montMulTo(x2, y, r) {
      x2.multiplyTo(y, r);
      this.reduce(r);
    }
    Montgomery.prototype.convert = montConvert;
    Montgomery.prototype.revert = montRevert;
    Montgomery.prototype.reduce = montReduce;
    Montgomery.prototype.mulTo = montMulTo;
    Montgomery.prototype.sqrTo = montSqrTo;
    function bnpIsEven() {
      return (this.t > 0 ? this.data[0] & 1 : this.s) == 0;
    }
    function bnpExp(e, z) {
      if (e > 4294967295 || e < 1) return BigInteger.ONE;
      var r = nbi(), r2 = nbi(), g = z.convert(this), i2 = nbits(e) - 1;
      g.copyTo(r);
      while (--i2 >= 0) {
        z.sqrTo(r, r2);
        if ((e & 1 << i2) > 0) z.mulTo(r2, g, r);
        else {
          var t = r;
          r = r2;
          r2 = t;
        }
      }
      return z.revert(r);
    }
    function bnModPowInt(e, m) {
      var z;
      if (e < 256 || m.isEven()) z = new Classic(m);
      else z = new Montgomery(m);
      return this.exp(e, z);
    }
    BigInteger.prototype.copyTo = bnpCopyTo;
    BigInteger.prototype.fromInt = bnpFromInt;
    BigInteger.prototype.fromString = bnpFromString;
    BigInteger.prototype.clamp = bnpClamp;
    BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
    BigInteger.prototype.drShiftTo = bnpDRShiftTo;
    BigInteger.prototype.lShiftTo = bnpLShiftTo;
    BigInteger.prototype.rShiftTo = bnpRShiftTo;
    BigInteger.prototype.subTo = bnpSubTo;
    BigInteger.prototype.multiplyTo = bnpMultiplyTo;
    BigInteger.prototype.squareTo = bnpSquareTo;
    BigInteger.prototype.divRemTo = bnpDivRemTo;
    BigInteger.prototype.invDigit = bnpInvDigit;
    BigInteger.prototype.isEven = bnpIsEven;
    BigInteger.prototype.exp = bnpExp;
    BigInteger.prototype.toString = bnToString;
    BigInteger.prototype.negate = bnNegate;
    BigInteger.prototype.abs = bnAbs;
    BigInteger.prototype.compareTo = bnCompareTo;
    BigInteger.prototype.bitLength = bnBitLength;
    BigInteger.prototype.mod = bnMod;
    BigInteger.prototype.modPowInt = bnModPowInt;
    BigInteger.ZERO = nbv(0);
    BigInteger.ONE = nbv(1);
    function bnClone() {
      var r = nbi();
      this.copyTo(r);
      return r;
    }
    function bnIntValue() {
      if (this.s < 0) {
        if (this.t == 1) return this.data[0] - this.DV;
        else if (this.t == 0) return -1;
      } else if (this.t == 1) return this.data[0];
      else if (this.t == 0) return 0;
      return (this.data[1] & (1 << 32 - this.DB) - 1) << this.DB | this.data[0];
    }
    function bnByteValue() {
      return this.t == 0 ? this.s : this.data[0] << 24 >> 24;
    }
    function bnShortValue() {
      return this.t == 0 ? this.s : this.data[0] << 16 >> 16;
    }
    function bnpChunkSize(r) {
      return Math.floor(Math.LN2 * this.DB / Math.log(r));
    }
    function bnSigNum() {
      if (this.s < 0) return -1;
      else if (this.t <= 0 || this.t == 1 && this.data[0] <= 0) return 0;
      else return 1;
    }
    function bnpToRadix(b) {
      if (b == null) b = 10;
      if (this.signum() == 0 || b < 2 || b > 36) return "0";
      var cs = this.chunkSize(b);
      var a = Math.pow(b, cs);
      var d = nbv(a), y = nbi(), z = nbi(), r = "";
      this.divRemTo(d, y, z);
      while (y.signum() > 0) {
        r = (a + z.intValue()).toString(b).substr(1) + r;
        y.divRemTo(d, y, z);
      }
      return z.intValue().toString(b) + r;
    }
    function bnpFromRadix(s, b) {
      this.fromInt(0);
      if (b == null) b = 10;
      var cs = this.chunkSize(b);
      var d = Math.pow(b, cs), mi = false, j = 0, w = 0;
      for (var i2 = 0; i2 < s.length; ++i2) {
        var x2 = intAt(s, i2);
        if (x2 < 0) {
          if (s.charAt(i2) == "-" && this.signum() == 0) mi = true;
          continue;
        }
        w = b * w + x2;
        if (++j >= cs) {
          this.dMultiply(d);
          this.dAddOffset(w, 0);
          j = 0;
          w = 0;
        }
      }
      if (j > 0) {
        this.dMultiply(Math.pow(b, j));
        this.dAddOffset(w, 0);
      }
      if (mi) BigInteger.ZERO.subTo(this, this);
    }
    function bnpFromNumber(a, b, c) {
      if ("number" == typeof b) {
        if (a < 2) this.fromInt(1);
        else {
          this.fromNumber(a, c);
          if (!this.testBit(a - 1))
            this.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, this);
          if (this.isEven()) this.dAddOffset(1, 0);
          while (!this.isProbablePrime(b)) {
            this.dAddOffset(2, 0);
            if (this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a - 1), this);
          }
        }
      } else {
        var x2 = new Array(), t = a & 7;
        x2.length = (a >> 3) + 1;
        b.nextBytes(x2);
        if (t > 0) x2[0] &= (1 << t) - 1;
        else x2[0] = 0;
        this.fromString(x2, 256);
      }
    }
    function bnToByteArray() {
      var i2 = this.t, r = new Array();
      r[0] = this.s;
      var p = this.DB - i2 * this.DB % 8, d, k = 0;
      if (i2-- > 0) {
        if (p < this.DB && (d = this.data[i2] >> p) != (this.s & this.DM) >> p)
          r[k++] = d | this.s << this.DB - p;
        while (i2 >= 0) {
          if (p < 8) {
            d = (this.data[i2] & (1 << p) - 1) << 8 - p;
            d |= this.data[--i2] >> (p += this.DB - 8);
          } else {
            d = this.data[i2] >> (p -= 8) & 255;
            if (p <= 0) {
              p += this.DB;
              --i2;
            }
          }
          if ((d & 128) != 0) d |= -256;
          if (k == 0 && (this.s & 128) != (d & 128)) ++k;
          if (k > 0 || d != this.s) r[k++] = d;
        }
      }
      return r;
    }
    function bnEquals(a) {
      return this.compareTo(a) == 0;
    }
    function bnMin(a) {
      return this.compareTo(a) < 0 ? this : a;
    }
    function bnMax(a) {
      return this.compareTo(a) > 0 ? this : a;
    }
    function bnpBitwiseTo(a, op, r) {
      var i2, f, m = Math.min(a.t, this.t);
      for (i2 = 0; i2 < m; ++i2) r.data[i2] = op(this.data[i2], a.data[i2]);
      if (a.t < this.t) {
        f = a.s & this.DM;
        for (i2 = m; i2 < this.t; ++i2) r.data[i2] = op(this.data[i2], f);
        r.t = this.t;
      } else {
        f = this.s & this.DM;
        for (i2 = m; i2 < a.t; ++i2) r.data[i2] = op(f, a.data[i2]);
        r.t = a.t;
      }
      r.s = op(this.s, a.s);
      r.clamp();
    }
    function op_and(x2, y) {
      return x2 & y;
    }
    function bnAnd(a) {
      var r = nbi();
      this.bitwiseTo(a, op_and, r);
      return r;
    }
    function op_or(x2, y) {
      return x2 | y;
    }
    function bnOr(a) {
      var r = nbi();
      this.bitwiseTo(a, op_or, r);
      return r;
    }
    function op_xor(x2, y) {
      return x2 ^ y;
    }
    function bnXor(a) {
      var r = nbi();
      this.bitwiseTo(a, op_xor, r);
      return r;
    }
    function op_andnot(x2, y) {
      return x2 & ~y;
    }
    function bnAndNot(a) {
      var r = nbi();
      this.bitwiseTo(a, op_andnot, r);
      return r;
    }
    function bnNot() {
      var r = nbi();
      for (var i2 = 0; i2 < this.t; ++i2) r.data[i2] = this.DM & ~this.data[i2];
      r.t = this.t;
      r.s = ~this.s;
      return r;
    }
    function bnShiftLeft(n) {
      var r = nbi();
      if (n < 0) this.rShiftTo(-n, r);
      else this.lShiftTo(n, r);
      return r;
    }
    function bnShiftRight(n) {
      var r = nbi();
      if (n < 0) this.lShiftTo(-n, r);
      else this.rShiftTo(n, r);
      return r;
    }
    function lbit(x2) {
      if (x2 == 0) return -1;
      var r = 0;
      if ((x2 & 65535) == 0) {
        x2 >>= 16;
        r += 16;
      }
      if ((x2 & 255) == 0) {
        x2 >>= 8;
        r += 8;
      }
      if ((x2 & 15) == 0) {
        x2 >>= 4;
        r += 4;
      }
      if ((x2 & 3) == 0) {
        x2 >>= 2;
        r += 2;
      }
      if ((x2 & 1) == 0) ++r;
      return r;
    }
    function bnGetLowestSetBit() {
      for (var i2 = 0; i2 < this.t; ++i2)
        if (this.data[i2] != 0) return i2 * this.DB + lbit(this.data[i2]);
      if (this.s < 0) return this.t * this.DB;
      return -1;
    }
    function cbit(x2) {
      var r = 0;
      while (x2 != 0) {
        x2 &= x2 - 1;
        ++r;
      }
      return r;
    }
    function bnBitCount() {
      var r = 0, x2 = this.s & this.DM;
      for (var i2 = 0; i2 < this.t; ++i2) r += cbit(this.data[i2] ^ x2);
      return r;
    }
    function bnTestBit(n) {
      var j = Math.floor(n / this.DB);
      if (j >= this.t) return this.s != 0;
      return (this.data[j] & 1 << n % this.DB) != 0;
    }
    function bnpChangeBit(n, op) {
      var r = BigInteger.ONE.shiftLeft(n);
      this.bitwiseTo(r, op, r);
      return r;
    }
    function bnSetBit(n) {
      return this.changeBit(n, op_or);
    }
    function bnClearBit(n) {
      return this.changeBit(n, op_andnot);
    }
    function bnFlipBit(n) {
      return this.changeBit(n, op_xor);
    }
    function bnpAddTo(a, r) {
      var i2 = 0, c = 0, m = Math.min(a.t, this.t);
      while (i2 < m) {
        c += this.data[i2] + a.data[i2];
        r.data[i2++] = c & this.DM;
        c >>= this.DB;
      }
      if (a.t < this.t) {
        c += a.s;
        while (i2 < this.t) {
          c += this.data[i2];
          r.data[i2++] = c & this.DM;
          c >>= this.DB;
        }
        c += this.s;
      } else {
        c += this.s;
        while (i2 < a.t) {
          c += a.data[i2];
          r.data[i2++] = c & this.DM;
          c >>= this.DB;
        }
        c += a.s;
      }
      r.s = c < 0 ? -1 : 0;
      if (c > 0) r.data[i2++] = c;
      else if (c < -1) r.data[i2++] = this.DV + c;
      r.t = i2;
      r.clamp();
    }
    function bnAdd(a) {
      var r = nbi();
      this.addTo(a, r);
      return r;
    }
    function bnSubtract(a) {
      var r = nbi();
      this.subTo(a, r);
      return r;
    }
    function bnMultiply(a) {
      var r = nbi();
      this.multiplyTo(a, r);
      return r;
    }
    function bnDivide(a) {
      var r = nbi();
      this.divRemTo(a, r, null);
      return r;
    }
    function bnRemainder(a) {
      var r = nbi();
      this.divRemTo(a, null, r);
      return r;
    }
    function bnDivideAndRemainder(a) {
      var q = nbi(), r = nbi();
      this.divRemTo(a, q, r);
      return new Array(q, r);
    }
    function bnpDMultiply(n) {
      this.data[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
      ++this.t;
      this.clamp();
    }
    function bnpDAddOffset(n, w) {
      if (n == 0) return;
      while (this.t <= w) this.data[this.t++] = 0;
      this.data[w] += n;
      while (this.data[w] >= this.DV) {
        this.data[w] -= this.DV;
        if (++w >= this.t) this.data[this.t++] = 0;
        ++this.data[w];
      }
    }
    function NullExp() {
    }
    function nNop(x2) {
      return x2;
    }
    function nMulTo(x2, y, r) {
      x2.multiplyTo(y, r);
    }
    function nSqrTo(x2, r) {
      x2.squareTo(r);
    }
    NullExp.prototype.convert = nNop;
    NullExp.prototype.revert = nNop;
    NullExp.prototype.mulTo = nMulTo;
    NullExp.prototype.sqrTo = nSqrTo;
    function bnPow(e) {
      return this.exp(e, new NullExp());
    }
    function bnpMultiplyLowerTo(a, n, r) {
      var i2 = Math.min(this.t + a.t, n);
      r.s = 0;
      r.t = i2;
      while (i2 > 0) r.data[--i2] = 0;
      var j;
      for (j = r.t - this.t; i2 < j; ++i2) r.data[i2 + this.t] = this.am(0, a.data[i2], r, i2, 0, this.t);
      for (j = Math.min(a.t, n); i2 < j; ++i2) this.am(0, a.data[i2], r, i2, 0, n - i2);
      r.clamp();
    }
    function bnpMultiplyUpperTo(a, n, r) {
      --n;
      var i2 = r.t = this.t + a.t - n;
      r.s = 0;
      while (--i2 >= 0) r.data[i2] = 0;
      for (i2 = Math.max(n - this.t, 0); i2 < a.t; ++i2)
        r.data[this.t + i2 - n] = this.am(n - i2, a.data[i2], r, 0, 0, this.t + i2 - n);
      r.clamp();
      r.drShiftTo(1, r);
    }
    function Barrett(m) {
      this.r2 = nbi();
      this.q3 = nbi();
      BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
      this.mu = this.r2.divide(m);
      this.m = m;
    }
    function barrettConvert(x2) {
      if (x2.s < 0 || x2.t > 2 * this.m.t) return x2.mod(this.m);
      else if (x2.compareTo(this.m) < 0) return x2;
      else {
        var r = nbi();
        x2.copyTo(r);
        this.reduce(r);
        return r;
      }
    }
    function barrettRevert(x2) {
      return x2;
    }
    function barrettReduce(x2) {
      x2.drShiftTo(this.m.t - 1, this.r2);
      if (x2.t > this.m.t + 1) {
        x2.t = this.m.t + 1;
        x2.clamp();
      }
      this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
      this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
      while (x2.compareTo(this.r2) < 0) x2.dAddOffset(1, this.m.t + 1);
      x2.subTo(this.r2, x2);
      while (x2.compareTo(this.m) >= 0) x2.subTo(this.m, x2);
    }
    function barrettSqrTo(x2, r) {
      x2.squareTo(r);
      this.reduce(r);
    }
    function barrettMulTo(x2, y, r) {
      x2.multiplyTo(y, r);
      this.reduce(r);
    }
    Barrett.prototype.convert = barrettConvert;
    Barrett.prototype.revert = barrettRevert;
    Barrett.prototype.reduce = barrettReduce;
    Barrett.prototype.mulTo = barrettMulTo;
    Barrett.prototype.sqrTo = barrettSqrTo;
    function bnModPow(e, m) {
      var i2 = e.bitLength(), k, r = nbv(1), z;
      if (i2 <= 0) return r;
      else if (i2 < 18) k = 1;
      else if (i2 < 48) k = 3;
      else if (i2 < 144) k = 4;
      else if (i2 < 768) k = 5;
      else k = 6;
      if (i2 < 8)
        z = new Classic(m);
      else if (m.isEven())
        z = new Barrett(m);
      else
        z = new Montgomery(m);
      var g = new Array(), n = 3, k1 = k - 1, km = (1 << k) - 1;
      g[1] = z.convert(this);
      if (k > 1) {
        var g2 = nbi();
        z.sqrTo(g[1], g2);
        while (n <= km) {
          g[n] = nbi();
          z.mulTo(g2, g[n - 2], g[n]);
          n += 2;
        }
      }
      var j = e.t - 1, w, is1 = true, r2 = nbi(), t;
      i2 = nbits(e.data[j]) - 1;
      while (j >= 0) {
        if (i2 >= k1) w = e.data[j] >> i2 - k1 & km;
        else {
          w = (e.data[j] & (1 << i2 + 1) - 1) << k1 - i2;
          if (j > 0) w |= e.data[j - 1] >> this.DB + i2 - k1;
        }
        n = k;
        while ((w & 1) == 0) {
          w >>= 1;
          --n;
        }
        if ((i2 -= n) < 0) {
          i2 += this.DB;
          --j;
        }
        if (is1) {
          g[w].copyTo(r);
          is1 = false;
        } else {
          while (n > 1) {
            z.sqrTo(r, r2);
            z.sqrTo(r2, r);
            n -= 2;
          }
          if (n > 0) z.sqrTo(r, r2);
          else {
            t = r;
            r = r2;
            r2 = t;
          }
          z.mulTo(r2, g[w], r);
        }
        while (j >= 0 && (e.data[j] & 1 << i2) == 0) {
          z.sqrTo(r, r2);
          t = r;
          r = r2;
          r2 = t;
          if (--i2 < 0) {
            i2 = this.DB - 1;
            --j;
          }
        }
      }
      return z.revert(r);
    }
    function bnGCD(a) {
      var x2 = this.s < 0 ? this.negate() : this.clone();
      var y = a.s < 0 ? a.negate() : a.clone();
      if (x2.compareTo(y) < 0) {
        var t = x2;
        x2 = y;
        y = t;
      }
      var i2 = x2.getLowestSetBit(), g = y.getLowestSetBit();
      if (g < 0) return x2;
      if (i2 < g) g = i2;
      if (g > 0) {
        x2.rShiftTo(g, x2);
        y.rShiftTo(g, y);
      }
      while (x2.signum() > 0) {
        if ((i2 = x2.getLowestSetBit()) > 0) x2.rShiftTo(i2, x2);
        if ((i2 = y.getLowestSetBit()) > 0) y.rShiftTo(i2, y);
        if (x2.compareTo(y) >= 0) {
          x2.subTo(y, x2);
          x2.rShiftTo(1, x2);
        } else {
          y.subTo(x2, y);
          y.rShiftTo(1, y);
        }
      }
      if (g > 0) y.lShiftTo(g, y);
      return y;
    }
    function bnpModInt(n) {
      if (n <= 0) return 0;
      var d = this.DV % n, r = this.s < 0 ? n - 1 : 0;
      if (this.t > 0)
        if (d == 0) r = this.data[0] % n;
        else for (var i2 = this.t - 1; i2 >= 0; --i2) r = (d * r + this.data[i2]) % n;
      return r;
    }
    function bnModInverse(m) {
      var ac = m.isEven();
      if (this.isEven() && ac || m.signum() == 0) return BigInteger.ZERO;
      var u = m.clone(), v = this.clone();
      var a = nbv(1), b = nbv(0), c = nbv(0), d = nbv(1);
      while (u.signum() != 0) {
        while (u.isEven()) {
          u.rShiftTo(1, u);
          if (ac) {
            if (!a.isEven() || !b.isEven()) {
              a.addTo(this, a);
              b.subTo(m, b);
            }
            a.rShiftTo(1, a);
          } else if (!b.isEven()) b.subTo(m, b);
          b.rShiftTo(1, b);
        }
        while (v.isEven()) {
          v.rShiftTo(1, v);
          if (ac) {
            if (!c.isEven() || !d.isEven()) {
              c.addTo(this, c);
              d.subTo(m, d);
            }
            c.rShiftTo(1, c);
          } else if (!d.isEven()) d.subTo(m, d);
          d.rShiftTo(1, d);
        }
        if (u.compareTo(v) >= 0) {
          u.subTo(v, u);
          if (ac) a.subTo(c, a);
          b.subTo(d, b);
        } else {
          v.subTo(u, v);
          if (ac) c.subTo(a, c);
          d.subTo(b, d);
        }
      }
      if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
      if (d.compareTo(m) >= 0) return d.subtract(m);
      if (d.signum() < 0) d.addTo(m, d);
      else return d;
      if (d.signum() < 0) return d.add(m);
      else return d;
    }
    var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509];
    var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];
    function bnIsProbablePrime(t) {
      var i2, x2 = this.abs();
      if (x2.t == 1 && x2.data[0] <= lowprimes[lowprimes.length - 1]) {
        for (i2 = 0; i2 < lowprimes.length; ++i2)
          if (x2.data[0] == lowprimes[i2]) return true;
        return false;
      }
      if (x2.isEven()) return false;
      i2 = 1;
      while (i2 < lowprimes.length) {
        var m = lowprimes[i2], j = i2 + 1;
        while (j < lowprimes.length && m < lplim) m *= lowprimes[j++];
        m = x2.modInt(m);
        while (i2 < j) if (m % lowprimes[i2++] == 0) return false;
      }
      return x2.millerRabin(t);
    }
    function bnpMillerRabin(t) {
      var n1 = this.subtract(BigInteger.ONE);
      var k = n1.getLowestSetBit();
      if (k <= 0) return false;
      var r = n1.shiftRight(k);
      var prng = bnGetPrng();
      var a;
      for (var i2 = 0; i2 < t; ++i2) {
        do {
          a = new BigInteger(this.bitLength(), prng);
        } while (a.compareTo(BigInteger.ONE) <= 0 || a.compareTo(n1) >= 0);
        var y = a.modPow(r, this);
        if (y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
          var j = 1;
          while (j++ < k && y.compareTo(n1) != 0) {
            y = y.modPowInt(2, this);
            if (y.compareTo(BigInteger.ONE) == 0) return false;
          }
          if (y.compareTo(n1) != 0) return false;
        }
      }
      return true;
    }
    function bnGetPrng() {
      return {
        // x is an array to fill with bytes
        nextBytes: function(x2) {
          for (var i2 = 0; i2 < x2.length; ++i2) {
            x2[i2] = Math.floor(Math.random() * 256);
          }
        }
      };
    }
    BigInteger.prototype.chunkSize = bnpChunkSize;
    BigInteger.prototype.toRadix = bnpToRadix;
    BigInteger.prototype.fromRadix = bnpFromRadix;
    BigInteger.prototype.fromNumber = bnpFromNumber;
    BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
    BigInteger.prototype.changeBit = bnpChangeBit;
    BigInteger.prototype.addTo = bnpAddTo;
    BigInteger.prototype.dMultiply = bnpDMultiply;
    BigInteger.prototype.dAddOffset = bnpDAddOffset;
    BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
    BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
    BigInteger.prototype.modInt = bnpModInt;
    BigInteger.prototype.millerRabin = bnpMillerRabin;
    BigInteger.prototype.clone = bnClone;
    BigInteger.prototype.intValue = bnIntValue;
    BigInteger.prototype.byteValue = bnByteValue;
    BigInteger.prototype.shortValue = bnShortValue;
    BigInteger.prototype.signum = bnSigNum;
    BigInteger.prototype.toByteArray = bnToByteArray;
    BigInteger.prototype.equals = bnEquals;
    BigInteger.prototype.min = bnMin;
    BigInteger.prototype.max = bnMax;
    BigInteger.prototype.and = bnAnd;
    BigInteger.prototype.or = bnOr;
    BigInteger.prototype.xor = bnXor;
    BigInteger.prototype.andNot = bnAndNot;
    BigInteger.prototype.not = bnNot;
    BigInteger.prototype.shiftLeft = bnShiftLeft;
    BigInteger.prototype.shiftRight = bnShiftRight;
    BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
    BigInteger.prototype.bitCount = bnBitCount;
    BigInteger.prototype.testBit = bnTestBit;
    BigInteger.prototype.setBit = bnSetBit;
    BigInteger.prototype.clearBit = bnClearBit;
    BigInteger.prototype.flipBit = bnFlipBit;
    BigInteger.prototype.add = bnAdd;
    BigInteger.prototype.subtract = bnSubtract;
    BigInteger.prototype.multiply = bnMultiply;
    BigInteger.prototype.divide = bnDivide;
    BigInteger.prototype.remainder = bnRemainder;
    BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
    BigInteger.prototype.modPow = bnModPow;
    BigInteger.prototype.modInverse = bnModInverse;
    BigInteger.prototype.pow = bnPow;
    BigInteger.prototype.gcd = bnGCD;
    BigInteger.prototype.isProbablePrime = bnIsProbablePrime;
  }
});

// node_modules/node-forge/lib/sha1.js
var require_sha1 = __commonJS({
  "node_modules/node-forge/lib/sha1.js"(exports, module) {
    var forge2 = require_forge();
    require_md();
    require_util();
    var sha1 = module.exports = forge2.sha1 = forge2.sha1 || {};
    forge2.md.sha1 = forge2.md.algorithms.sha1 = sha1;
    sha1.create = function() {
      if (!_initialized) {
        _init();
      }
      var _state = null;
      var _input = forge2.util.createBuffer();
      var _w = new Array(80);
      var md = {
        algorithm: "sha1",
        blockLength: 64,
        digestLength: 20,
        // 56-bit length of message so far (does not including padding)
        messageLength: 0,
        // true message length
        fullMessageLength: null,
        // size of message length in bytes
        messageLengthSize: 8
      };
      md.start = function() {
        md.messageLength = 0;
        md.fullMessageLength = md.messageLength64 = [];
        var int32s = md.messageLengthSize / 4;
        for (var i2 = 0; i2 < int32s; ++i2) {
          md.fullMessageLength.push(0);
        }
        _input = forge2.util.createBuffer();
        _state = {
          h0: 1732584193,
          h1: 4023233417,
          h2: 2562383102,
          h3: 271733878,
          h4: 3285377520
        };
        return md;
      };
      md.start();
      md.update = function(msg, encoding) {
        if (encoding === "utf8") {
          msg = forge2.util.encodeUtf8(msg);
        }
        var len = msg.length;
        md.messageLength += len;
        len = [len / 4294967296 >>> 0, len >>> 0];
        for (var i2 = md.fullMessageLength.length - 1; i2 >= 0; --i2) {
          md.fullMessageLength[i2] += len[1];
          len[1] = len[0] + (md.fullMessageLength[i2] / 4294967296 >>> 0);
          md.fullMessageLength[i2] = md.fullMessageLength[i2] >>> 0;
          len[0] = len[1] / 4294967296 >>> 0;
        }
        _input.putBytes(msg);
        _update(_state, _w, _input);
        if (_input.read > 2048 || _input.length() === 0) {
          _input.compact();
        }
        return md;
      };
      md.digest = function() {
        var finalBlock = forge2.util.createBuffer();
        finalBlock.putBytes(_input.bytes());
        var remaining = md.fullMessageLength[md.fullMessageLength.length - 1] + md.messageLengthSize;
        var overflow = remaining & md.blockLength - 1;
        finalBlock.putBytes(_padding.substr(0, md.blockLength - overflow));
        var next, carry;
        var bits = md.fullMessageLength[0] * 8;
        for (var i2 = 0; i2 < md.fullMessageLength.length - 1; ++i2) {
          next = md.fullMessageLength[i2 + 1] * 8;
          carry = next / 4294967296 >>> 0;
          bits += carry;
          finalBlock.putInt32(bits >>> 0);
          bits = next >>> 0;
        }
        finalBlock.putInt32(bits);
        var s2 = {
          h0: _state.h0,
          h1: _state.h1,
          h2: _state.h2,
          h3: _state.h3,
          h4: _state.h4
        };
        _update(s2, _w, finalBlock);
        var rval = forge2.util.createBuffer();
        rval.putInt32(s2.h0);
        rval.putInt32(s2.h1);
        rval.putInt32(s2.h2);
        rval.putInt32(s2.h3);
        rval.putInt32(s2.h4);
        return rval;
      };
      return md;
    };
    var _padding = null;
    var _initialized = false;
    function _init() {
      _padding = String.fromCharCode(128);
      _padding += forge2.util.fillString(String.fromCharCode(0), 64);
      _initialized = true;
    }
    function _update(s, w, bytes) {
      var t, a, b, c, d, e, f, i2;
      var len = bytes.length();
      while (len >= 64) {
        a = s.h0;
        b = s.h1;
        c = s.h2;
        d = s.h3;
        e = s.h4;
        for (i2 = 0; i2 < 16; ++i2) {
          t = bytes.getInt32();
          w[i2] = t;
          f = d ^ b & (c ^ d);
          t = (a << 5 | a >>> 27) + f + e + 1518500249 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        for (; i2 < 20; ++i2) {
          t = w[i2 - 3] ^ w[i2 - 8] ^ w[i2 - 14] ^ w[i2 - 16];
          t = t << 1 | t >>> 31;
          w[i2] = t;
          f = d ^ b & (c ^ d);
          t = (a << 5 | a >>> 27) + f + e + 1518500249 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        for (; i2 < 32; ++i2) {
          t = w[i2 - 3] ^ w[i2 - 8] ^ w[i2 - 14] ^ w[i2 - 16];
          t = t << 1 | t >>> 31;
          w[i2] = t;
          f = b ^ c ^ d;
          t = (a << 5 | a >>> 27) + f + e + 1859775393 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        for (; i2 < 40; ++i2) {
          t = w[i2 - 6] ^ w[i2 - 16] ^ w[i2 - 28] ^ w[i2 - 32];
          t = t << 2 | t >>> 30;
          w[i2] = t;
          f = b ^ c ^ d;
          t = (a << 5 | a >>> 27) + f + e + 1859775393 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        for (; i2 < 60; ++i2) {
          t = w[i2 - 6] ^ w[i2 - 16] ^ w[i2 - 28] ^ w[i2 - 32];
          t = t << 2 | t >>> 30;
          w[i2] = t;
          f = b & c | d & (b ^ c);
          t = (a << 5 | a >>> 27) + f + e + 2400959708 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        for (; i2 < 80; ++i2) {
          t = w[i2 - 6] ^ w[i2 - 16] ^ w[i2 - 28] ^ w[i2 - 32];
          t = t << 2 | t >>> 30;
          w[i2] = t;
          f = b ^ c ^ d;
          t = (a << 5 | a >>> 27) + f + e + 3395469782 + t;
          e = d;
          d = c;
          c = (b << 30 | b >>> 2) >>> 0;
          b = a;
          a = t;
        }
        s.h0 = s.h0 + a | 0;
        s.h1 = s.h1 + b | 0;
        s.h2 = s.h2 + c | 0;
        s.h3 = s.h3 + d | 0;
        s.h4 = s.h4 + e | 0;
        len -= 64;
      }
    }
  }
});

// node_modules/node-forge/lib/pkcs1.js
var require_pkcs1 = __commonJS({
  "node_modules/node-forge/lib/pkcs1.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    require_random();
    require_sha1();
    var pkcs1 = module.exports = forge2.pkcs1 = forge2.pkcs1 || {};
    pkcs1.encode_rsa_oaep = function(key, message, options) {
      var label;
      var seed;
      var md;
      var mgf1Md;
      if (typeof options === "string") {
        label = options;
        seed = arguments[3] || void 0;
        md = arguments[4] || void 0;
      } else if (options) {
        label = options.label || void 0;
        seed = options.seed || void 0;
        md = options.md || void 0;
        if (options.mgf1 && options.mgf1.md) {
          mgf1Md = options.mgf1.md;
        }
      }
      if (!md) {
        md = forge2.md.sha1.create();
      } else {
        md.start();
      }
      if (!mgf1Md) {
        mgf1Md = md;
      }
      var keyLength = Math.ceil(key.n.bitLength() / 8);
      var maxLength = keyLength - 2 * md.digestLength - 2;
      if (message.length > maxLength) {
        var error = new Error("RSAES-OAEP input message length is too long.");
        error.length = message.length;
        error.maxLength = maxLength;
        throw error;
      }
      if (!label) {
        label = "";
      }
      md.update(label, "raw");
      var lHash = md.digest();
      var PS = "";
      var PS_length = maxLength - message.length;
      for (var i2 = 0; i2 < PS_length; i2++) {
        PS += "\0";
      }
      var DB = lHash.getBytes() + PS + "" + message;
      if (!seed) {
        seed = forge2.random.getBytes(md.digestLength);
      } else if (seed.length !== md.digestLength) {
        var error = new Error("Invalid RSAES-OAEP seed. The seed length must match the digest length.");
        error.seedLength = seed.length;
        error.digestLength = md.digestLength;
        throw error;
      }
      var dbMask = rsa_mgf1(seed, keyLength - md.digestLength - 1, mgf1Md);
      var maskedDB = forge2.util.xorBytes(DB, dbMask, DB.length);
      var seedMask = rsa_mgf1(maskedDB, md.digestLength, mgf1Md);
      var maskedSeed = forge2.util.xorBytes(seed, seedMask, seed.length);
      return "\0" + maskedSeed + maskedDB;
    };
    pkcs1.decode_rsa_oaep = function(key, em, options) {
      var label;
      var md;
      var mgf1Md;
      if (typeof options === "string") {
        label = options;
        md = arguments[3] || void 0;
      } else if (options) {
        label = options.label || void 0;
        md = options.md || void 0;
        if (options.mgf1 && options.mgf1.md) {
          mgf1Md = options.mgf1.md;
        }
      }
      var keyLength = Math.ceil(key.n.bitLength() / 8);
      if (em.length !== keyLength) {
        var error = new Error("RSAES-OAEP encoded message length is invalid.");
        error.length = em.length;
        error.expectedLength = keyLength;
        throw error;
      }
      if (md === void 0) {
        md = forge2.md.sha1.create();
      } else {
        md.start();
      }
      if (!mgf1Md) {
        mgf1Md = md;
      }
      if (keyLength < 2 * md.digestLength + 2) {
        throw new Error("RSAES-OAEP key is too short for the hash function.");
      }
      if (!label) {
        label = "";
      }
      md.update(label, "raw");
      var lHash = md.digest().getBytes();
      var y = em.charAt(0);
      var maskedSeed = em.substring(1, md.digestLength + 1);
      var maskedDB = em.substring(1 + md.digestLength);
      var seedMask = rsa_mgf1(maskedDB, md.digestLength, mgf1Md);
      var seed = forge2.util.xorBytes(maskedSeed, seedMask, maskedSeed.length);
      var dbMask = rsa_mgf1(seed, keyLength - md.digestLength - 1, mgf1Md);
      var db = forge2.util.xorBytes(maskedDB, dbMask, maskedDB.length);
      var lHashPrime = db.substring(0, md.digestLength);
      var error = y !== "\0";
      for (var i2 = 0; i2 < md.digestLength; ++i2) {
        error |= lHash.charAt(i2) !== lHashPrime.charAt(i2);
      }
      var in_ps = 1;
      var index = md.digestLength;
      for (var j = md.digestLength; j < db.length; j++) {
        var code = db.charCodeAt(j);
        var is_0 = code & 1 ^ 1;
        var error_mask = in_ps ? 65534 : 0;
        error |= code & error_mask;
        in_ps = in_ps & is_0;
        index += in_ps;
      }
      if (error || db.charCodeAt(index) !== 1) {
        throw new Error("Invalid RSAES-OAEP padding.");
      }
      return db.substring(index + 1);
    };
    function rsa_mgf1(seed, maskLength, hash) {
      if (!hash) {
        hash = forge2.md.sha1.create();
      }
      var t = "";
      var count = Math.ceil(maskLength / hash.digestLength);
      for (var i2 = 0; i2 < count; ++i2) {
        var c = String.fromCharCode(
          i2 >> 24 & 255,
          i2 >> 16 & 255,
          i2 >> 8 & 255,
          i2 & 255
        );
        hash.start();
        hash.update(seed + c);
        t += hash.digest().getBytes();
      }
      return t.substring(0, maskLength);
    }
  }
});

// node_modules/node-forge/lib/prime.js
var require_prime = __commonJS({
  "node_modules/node-forge/lib/prime.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    require_jsbn();
    require_random();
    (function() {
      if (forge2.prime) {
        module.exports = forge2.prime;
        return;
      }
      var prime = module.exports = forge2.prime = forge2.prime || {};
      var BigInteger = forge2.jsbn.BigInteger;
      var GCD_30_DELTA = [6, 4, 2, 4, 2, 4, 6, 2];
      var THIRTY = new BigInteger(null);
      THIRTY.fromInt(30);
      var op_or = function(x2, y) {
        return x2 | y;
      };
      prime.generateProbablePrime = function(bits, options, callback) {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        options = options || {};
        var algorithm = options.algorithm || "PRIMEINC";
        if (typeof algorithm === "string") {
          algorithm = { name: algorithm };
        }
        algorithm.options = algorithm.options || {};
        var prng = options.prng || forge2.random;
        var rng = {
          // x is an array to fill with bytes
          nextBytes: function(x2) {
            var b = prng.getBytesSync(x2.length);
            for (var i2 = 0; i2 < x2.length; ++i2) {
              x2[i2] = b.charCodeAt(i2);
            }
          }
        };
        if (algorithm.name === "PRIMEINC") {
          return primeincFindPrime(bits, rng, algorithm.options, callback);
        }
        throw new Error("Invalid prime generation algorithm: " + algorithm.name);
      };
      function primeincFindPrime(bits, rng, options, callback) {
        if ("workers" in options) {
          return primeincFindPrimeWithWorkers(bits, rng, options, callback);
        }
        return primeincFindPrimeWithoutWorkers(bits, rng, options, callback);
      }
      function primeincFindPrimeWithoutWorkers(bits, rng, options, callback) {
        var num = generateRandom(bits, rng);
        var deltaIdx = 0;
        var mrTests = getMillerRabinTests(num.bitLength());
        if ("millerRabinTests" in options) {
          mrTests = options.millerRabinTests;
        }
        var maxBlockTime = 10;
        if ("maxBlockTime" in options) {
          maxBlockTime = options.maxBlockTime;
        }
        _primeinc(num, bits, rng, deltaIdx, mrTests, maxBlockTime, callback);
      }
      function _primeinc(num, bits, rng, deltaIdx, mrTests, maxBlockTime, callback) {
        var start = +/* @__PURE__ */ new Date();
        do {
          if (num.bitLength() > bits) {
            num = generateRandom(bits, rng);
          }
          if (num.isProbablePrime(mrTests)) {
            return callback(null, num);
          }
          num.dAddOffset(GCD_30_DELTA[deltaIdx++ % 8], 0);
        } while (maxBlockTime < 0 || +/* @__PURE__ */ new Date() - start < maxBlockTime);
        forge2.util.setImmediate(function() {
          _primeinc(num, bits, rng, deltaIdx, mrTests, maxBlockTime, callback);
        });
      }
      function primeincFindPrimeWithWorkers(bits, rng, options, callback) {
        if (typeof Worker === "undefined") {
          return primeincFindPrimeWithoutWorkers(bits, rng, options, callback);
        }
        var num = generateRandom(bits, rng);
        var numWorkers = options.workers;
        var workLoad = options.workLoad || 100;
        var range = workLoad * 30 / 8;
        var workerScript = options.workerScript || "forge/prime.worker.js";
        if (numWorkers === -1) {
          return forge2.util.estimateCores(function(err2, cores) {
            if (err2) {
              cores = 2;
            }
            numWorkers = cores - 1;
            generate();
          });
        }
        generate();
        function generate() {
          numWorkers = Math.max(1, numWorkers);
          var workers = [];
          for (var i2 = 0; i2 < numWorkers; ++i2) {
            workers[i2] = new Worker(workerScript);
          }
          var running = numWorkers;
          for (var i2 = 0; i2 < numWorkers; ++i2) {
            workers[i2].addEventListener("message", workerMessage);
          }
          var found = false;
          function workerMessage(e) {
            if (found) {
              return;
            }
            --running;
            var data = e.data;
            if (data.found) {
              for (var i3 = 0; i3 < workers.length; ++i3) {
                workers[i3].terminate();
              }
              found = true;
              return callback(null, new BigInteger(data.prime, 16));
            }
            if (num.bitLength() > bits) {
              num = generateRandom(bits, rng);
            }
            var hex = num.toString(16);
            e.target.postMessage({
              hex,
              workLoad
            });
            num.dAddOffset(range, 0);
          }
        }
      }
      function generateRandom(bits, rng) {
        var num = new BigInteger(bits, rng);
        var bits1 = bits - 1;
        if (!num.testBit(bits1)) {
          num.bitwiseTo(BigInteger.ONE.shiftLeft(bits1), op_or, num);
        }
        num.dAddOffset(31 - num.mod(THIRTY).byteValue(), 0);
        return num;
      }
      function getMillerRabinTests(bits) {
        if (bits <= 100) return 27;
        if (bits <= 150) return 18;
        if (bits <= 200) return 15;
        if (bits <= 250) return 12;
        if (bits <= 300) return 9;
        if (bits <= 350) return 8;
        if (bits <= 400) return 7;
        if (bits <= 500) return 6;
        if (bits <= 600) return 5;
        if (bits <= 800) return 4;
        if (bits <= 1250) return 3;
        return 2;
      }
    })();
  }
});

// node_modules/node-forge/lib/rsa.js
var require_rsa = __commonJS({
  "node_modules/node-forge/lib/rsa.js"(exports, module) {
    var forge2 = require_forge();
    require_asn1();
    require_jsbn();
    require_oids();
    require_pkcs1();
    require_prime();
    require_random();
    require_util();
    if (typeof BigInteger === "undefined") {
      BigInteger = forge2.jsbn.BigInteger;
    }
    var BigInteger;
    var _crypto = forge2.util.isNodejs ? require_crypto() : null;
    var asn1 = forge2.asn1;
    var util = forge2.util;
    forge2.pki = forge2.pki || {};
    module.exports = forge2.pki.rsa = forge2.rsa = forge2.rsa || {};
    var pki = forge2.pki;
    var GCD_30_DELTA = [6, 4, 2, 4, 2, 4, 6, 2];
    var privateKeyValidator = {
      // PrivateKeyInfo
      name: "PrivateKeyInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        // Version (INTEGER)
        name: "PrivateKeyInfo.version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyVersion"
      }, {
        // privateKeyAlgorithm
        name: "PrivateKeyInfo.privateKeyAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "privateKeyOid"
        }]
      }, {
        // PrivateKey
        name: "PrivateKeyInfo",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "privateKey"
      }]
    };
    var rsaPrivateKeyValidator = {
      // RSAPrivateKey
      name: "RSAPrivateKey",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        // Version (INTEGER)
        name: "RSAPrivateKey.version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyVersion"
      }, {
        // modulus (n)
        name: "RSAPrivateKey.modulus",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyModulus"
      }, {
        // publicExponent (e)
        name: "RSAPrivateKey.publicExponent",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPublicExponent"
      }, {
        // privateExponent (d)
        name: "RSAPrivateKey.privateExponent",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrivateExponent"
      }, {
        // prime1 (p)
        name: "RSAPrivateKey.prime1",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrime1"
      }, {
        // prime2 (q)
        name: "RSAPrivateKey.prime2",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrime2"
      }, {
        // exponent1 (d mod (p-1))
        name: "RSAPrivateKey.exponent1",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyExponent1"
      }, {
        // exponent2 (d mod (q-1))
        name: "RSAPrivateKey.exponent2",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyExponent2"
      }, {
        // coefficient ((inverse of q) mod p)
        name: "RSAPrivateKey.coefficient",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyCoefficient"
      }]
    };
    var rsaPublicKeyValidator = {
      // RSAPublicKey
      name: "RSAPublicKey",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        // modulus (n)
        name: "RSAPublicKey.modulus",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "publicKeyModulus"
      }, {
        // publicExponent (e)
        name: "RSAPublicKey.exponent",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "publicKeyExponent"
      }]
    };
    var publicKeyValidator = forge2.pki.rsa.publicKeyValidator = {
      name: "SubjectPublicKeyInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "subjectPublicKeyInfo",
      value: [{
        name: "SubjectPublicKeyInfo.AlgorithmIdentifier",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "publicKeyOid"
        }]
      }, {
        // subjectPublicKey
        name: "SubjectPublicKeyInfo.subjectPublicKey",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.BITSTRING,
        constructed: false,
        value: [{
          // RSAPublicKey
          name: "SubjectPublicKeyInfo.subjectPublicKey.RSAPublicKey",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          optional: true,
          captureAsn1: "rsaPublicKey"
        }]
      }]
    };
    var digestInfoValidator = {
      name: "DigestInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "DigestInfo.DigestAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "DigestInfo.DigestAlgorithm.algorithmIdentifier",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "algorithmIdentifier"
        }, {
          // NULL paramters
          name: "DigestInfo.DigestAlgorithm.parameters",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.NULL,
          // captured only to check existence for md2 and md5
          capture: "parameters",
          optional: true,
          constructed: false
        }]
      }, {
        // digest
        name: "DigestInfo.digest",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "digest"
      }]
    };
    var emsaPkcs1v15encode = function(md) {
      var oid;
      if (md.algorithm in pki.oids) {
        oid = pki.oids[md.algorithm];
      } else {
        var error = new Error("Unknown message digest algorithm.");
        error.algorithm = md.algorithm;
        throw error;
      }
      var oidBytes = asn1.oidToDer(oid).getBytes();
      var digestInfo = asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.SEQUENCE,
        true,
        []
      );
      var digestAlgorithm = asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.SEQUENCE,
        true,
        []
      );
      digestAlgorithm.value.push(asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidBytes
      ));
      digestAlgorithm.value.push(asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.NULL,
        false,
        ""
      ));
      var digest = asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OCTETSTRING,
        false,
        md.digest().getBytes()
      );
      digestInfo.value.push(digestAlgorithm);
      digestInfo.value.push(digest);
      return asn1.toDer(digestInfo).getBytes();
    };
    var _modPow = function(x2, key, pub) {
      if (pub) {
        return x2.modPow(key.e, key.n);
      }
      if (!key.p || !key.q) {
        return x2.modPow(key.d, key.n);
      }
      if (!key.dP) {
        key.dP = key.d.mod(key.p.subtract(BigInteger.ONE));
      }
      if (!key.dQ) {
        key.dQ = key.d.mod(key.q.subtract(BigInteger.ONE));
      }
      if (!key.qInv) {
        key.qInv = key.q.modInverse(key.p);
      }
      var r;
      do {
        r = new BigInteger(
          forge2.util.bytesToHex(forge2.random.getBytes(key.n.bitLength() / 8)),
          16
        );
      } while (r.compareTo(key.n) >= 0 || !r.gcd(key.n).equals(BigInteger.ONE));
      x2 = x2.multiply(r.modPow(key.e, key.n)).mod(key.n);
      var xp = x2.mod(key.p).modPow(key.dP, key.p);
      var xq = x2.mod(key.q).modPow(key.dQ, key.q);
      while (xp.compareTo(xq) < 0) {
        xp = xp.add(key.p);
      }
      var y = xp.subtract(xq).multiply(key.qInv).mod(key.p).multiply(key.q).add(xq);
      y = y.multiply(r.modInverse(key.n)).mod(key.n);
      return y;
    };
    pki.rsa.encrypt = function(m, key, bt) {
      var pub = bt;
      var eb;
      var k = Math.ceil(key.n.bitLength() / 8);
      if (bt !== false && bt !== true) {
        pub = bt === 2;
        eb = _encodePkcs1_v1_5(m, key, bt);
      } else {
        eb = forge2.util.createBuffer();
        eb.putBytes(m);
      }
      var x2 = new BigInteger(eb.toHex(), 16);
      var y = _modPow(x2, key, pub);
      var yhex = y.toString(16);
      var ed = forge2.util.createBuffer();
      var zeros = k - Math.ceil(yhex.length / 2);
      while (zeros > 0) {
        ed.putByte(0);
        --zeros;
      }
      ed.putBytes(forge2.util.hexToBytes(yhex));
      return ed.getBytes();
    };
    pki.rsa.decrypt = function(ed, key, pub, ml) {
      var k = Math.ceil(key.n.bitLength() / 8);
      if (ed.length !== k) {
        var error = new Error("Encrypted message length is invalid.");
        error.length = ed.length;
        error.expected = k;
        throw error;
      }
      var y = new BigInteger(forge2.util.createBuffer(ed).toHex(), 16);
      if (y.compareTo(key.n) >= 0) {
        throw new Error("Encrypted message is invalid.");
      }
      var x2 = _modPow(y, key, pub);
      var xhex = x2.toString(16);
      var eb = forge2.util.createBuffer();
      var zeros = k - Math.ceil(xhex.length / 2);
      while (zeros > 0) {
        eb.putByte(0);
        --zeros;
      }
      eb.putBytes(forge2.util.hexToBytes(xhex));
      if (ml !== false) {
        return _decodePkcs1_v1_5(eb.getBytes(), key, pub);
      }
      return eb.getBytes();
    };
    pki.rsa.createKeyPairGenerationState = function(bits, e, options) {
      if (typeof bits === "string") {
        bits = parseInt(bits, 10);
      }
      bits = bits || 2048;
      options = options || {};
      var prng = options.prng || forge2.random;
      var rng = {
        // x is an array to fill with bytes
        nextBytes: function(x2) {
          var b = prng.getBytesSync(x2.length);
          for (var i2 = 0; i2 < x2.length; ++i2) {
            x2[i2] = b.charCodeAt(i2);
          }
        }
      };
      var algorithm = options.algorithm || "PRIMEINC";
      var rval;
      if (algorithm === "PRIMEINC") {
        rval = {
          algorithm,
          state: 0,
          bits,
          rng,
          eInt: e || 65537,
          e: new BigInteger(null),
          p: null,
          q: null,
          qBits: bits >> 1,
          pBits: bits - (bits >> 1),
          pqState: 0,
          num: null,
          keys: null
        };
        rval.e.fromInt(rval.eInt);
      } else {
        throw new Error("Invalid key generation algorithm: " + algorithm);
      }
      return rval;
    };
    pki.rsa.stepKeyPairGenerationState = function(state, n) {
      if (!("algorithm" in state)) {
        state.algorithm = "PRIMEINC";
      }
      var THIRTY = new BigInteger(null);
      THIRTY.fromInt(30);
      var deltaIdx = 0;
      var op_or = function(x2, y) {
        return x2 | y;
      };
      var t1 = +/* @__PURE__ */ new Date();
      var t2;
      var total = 0;
      while (state.keys === null && (n <= 0 || total < n)) {
        if (state.state === 0) {
          var bits = state.p === null ? state.pBits : state.qBits;
          var bits1 = bits - 1;
          if (state.pqState === 0) {
            state.num = new BigInteger(bits, state.rng);
            if (!state.num.testBit(bits1)) {
              state.num.bitwiseTo(
                BigInteger.ONE.shiftLeft(bits1),
                op_or,
                state.num
              );
            }
            state.num.dAddOffset(31 - state.num.mod(THIRTY).byteValue(), 0);
            deltaIdx = 0;
            ++state.pqState;
          } else if (state.pqState === 1) {
            if (state.num.bitLength() > bits) {
              state.pqState = 0;
            } else if (state.num.isProbablePrime(
              _getMillerRabinTests(state.num.bitLength())
            )) {
              ++state.pqState;
            } else {
              state.num.dAddOffset(GCD_30_DELTA[deltaIdx++ % 8], 0);
            }
          } else if (state.pqState === 2) {
            state.pqState = state.num.subtract(BigInteger.ONE).gcd(state.e).compareTo(BigInteger.ONE) === 0 ? 3 : 0;
          } else if (state.pqState === 3) {
            state.pqState = 0;
            if (state.p === null) {
              state.p = state.num;
            } else {
              state.q = state.num;
            }
            if (state.p !== null && state.q !== null) {
              ++state.state;
            }
            state.num = null;
          }
        } else if (state.state === 1) {
          if (state.p.compareTo(state.q) < 0) {
            state.num = state.p;
            state.p = state.q;
            state.q = state.num;
          }
          ++state.state;
        } else if (state.state === 2) {
          state.p1 = state.p.subtract(BigInteger.ONE);
          state.q1 = state.q.subtract(BigInteger.ONE);
          state.phi = state.p1.multiply(state.q1);
          ++state.state;
        } else if (state.state === 3) {
          if (state.phi.gcd(state.e).compareTo(BigInteger.ONE) === 0) {
            ++state.state;
          } else {
            state.p = null;
            state.q = null;
            state.state = 0;
          }
        } else if (state.state === 4) {
          state.n = state.p.multiply(state.q);
          if (state.n.bitLength() === state.bits) {
            ++state.state;
          } else {
            state.q = null;
            state.state = 0;
          }
        } else if (state.state === 5) {
          var d = state.e.modInverse(state.phi);
          state.keys = {
            privateKey: pki.rsa.setPrivateKey(
              state.n,
              state.e,
              d,
              state.p,
              state.q,
              d.mod(state.p1),
              d.mod(state.q1),
              state.q.modInverse(state.p)
            ),
            publicKey: pki.rsa.setPublicKey(state.n, state.e)
          };
        }
        t2 = +/* @__PURE__ */ new Date();
        total += t2 - t1;
        t1 = t2;
      }
      return state.keys !== null;
    };
    pki.rsa.generateKeyPair = function(bits, e, options, callback) {
      if (arguments.length === 1) {
        if (typeof bits === "object") {
          options = bits;
          bits = void 0;
        } else if (typeof bits === "function") {
          callback = bits;
          bits = void 0;
        }
      } else if (arguments.length === 2) {
        if (typeof bits === "number") {
          if (typeof e === "function") {
            callback = e;
            e = void 0;
          } else if (typeof e !== "number") {
            options = e;
            e = void 0;
          }
        } else {
          options = bits;
          callback = e;
          bits = void 0;
          e = void 0;
        }
      } else if (arguments.length === 3) {
        if (typeof e === "number") {
          if (typeof options === "function") {
            callback = options;
            options = void 0;
          }
        } else {
          callback = options;
          options = e;
          e = void 0;
        }
      }
      options = options || {};
      if (bits === void 0) {
        bits = options.bits || 2048;
      }
      if (e === void 0) {
        e = options.e || 65537;
      }
      if (!forge2.options.usePureJavaScript && !options.prng && bits >= 256 && bits <= 16384 && (e === 65537 || e === 3)) {
        if (callback) {
          if (_detectNodeCrypto("generateKeyPair")) {
            return _crypto.generateKeyPair("rsa", {
              modulusLength: bits,
              publicExponent: e,
              publicKeyEncoding: {
                type: "spki",
                format: "pem"
              },
              privateKeyEncoding: {
                type: "pkcs8",
                format: "pem"
              }
            }, function(err2, pub, priv) {
              if (err2) {
                return callback(err2);
              }
              callback(null, {
                privateKey: pki.privateKeyFromPem(priv),
                publicKey: pki.publicKeyFromPem(pub)
              });
            });
          }
          if (_detectSubtleCrypto("generateKey") && _detectSubtleCrypto("exportKey")) {
            return util.globalScope.crypto.subtle.generateKey({
              name: "RSASSA-PKCS1-v1_5",
              modulusLength: bits,
              publicExponent: _intToUint8Array(e),
              hash: { name: "SHA-256" }
            }, true, ["sign", "verify"]).then(function(pair) {
              return util.globalScope.crypto.subtle.exportKey(
                "pkcs8",
                pair.privateKey
              );
            }).then(void 0, function(err2) {
              callback(err2);
            }).then(function(pkcs8) {
              if (pkcs8) {
                var privateKey = pki.privateKeyFromAsn1(
                  asn1.fromDer(forge2.util.createBuffer(pkcs8))
                );
                callback(null, {
                  privateKey,
                  publicKey: pki.setRsaPublicKey(privateKey.n, privateKey.e)
                });
              }
            });
          }
          if (_detectSubtleMsCrypto("generateKey") && _detectSubtleMsCrypto("exportKey")) {
            var genOp = util.globalScope.msCrypto.subtle.generateKey({
              name: "RSASSA-PKCS1-v1_5",
              modulusLength: bits,
              publicExponent: _intToUint8Array(e),
              hash: { name: "SHA-256" }
            }, true, ["sign", "verify"]);
            genOp.oncomplete = function(e2) {
              var pair = e2.target.result;
              var exportOp = util.globalScope.msCrypto.subtle.exportKey(
                "pkcs8",
                pair.privateKey
              );
              exportOp.oncomplete = function(e3) {
                var pkcs8 = e3.target.result;
                var privateKey = pki.privateKeyFromAsn1(
                  asn1.fromDer(forge2.util.createBuffer(pkcs8))
                );
                callback(null, {
                  privateKey,
                  publicKey: pki.setRsaPublicKey(privateKey.n, privateKey.e)
                });
              };
              exportOp.onerror = function(err2) {
                callback(err2);
              };
            };
            genOp.onerror = function(err2) {
              callback(err2);
            };
            return;
          }
        } else {
          if (_detectNodeCrypto("generateKeyPairSync")) {
            var keypair = _crypto.generateKeyPairSync("rsa", {
              modulusLength: bits,
              publicExponent: e,
              publicKeyEncoding: {
                type: "spki",
                format: "pem"
              },
              privateKeyEncoding: {
                type: "pkcs8",
                format: "pem"
              }
            });
            return {
              privateKey: pki.privateKeyFromPem(keypair.privateKey),
              publicKey: pki.publicKeyFromPem(keypair.publicKey)
            };
          }
        }
      }
      var state = pki.rsa.createKeyPairGenerationState(bits, e, options);
      if (!callback) {
        pki.rsa.stepKeyPairGenerationState(state, 0);
        return state.keys;
      }
      _generateKeyPair(state, options, callback);
    };
    pki.setRsaPublicKey = pki.rsa.setPublicKey = function(n, e) {
      var key = {
        n,
        e
      };
      key.encrypt = function(data, scheme, schemeOptions) {
        if (typeof scheme === "string") {
          scheme = scheme.toUpperCase();
        } else if (scheme === void 0) {
          scheme = "RSAES-PKCS1-V1_5";
        }
        if (scheme === "RSAES-PKCS1-V1_5") {
          scheme = {
            encode: function(m, key2, pub) {
              return _encodePkcs1_v1_5(m, key2, 2).getBytes();
            }
          };
        } else if (scheme === "RSA-OAEP" || scheme === "RSAES-OAEP") {
          scheme = {
            encode: function(m, key2) {
              return forge2.pkcs1.encode_rsa_oaep(key2, m, schemeOptions);
            }
          };
        } else if (["RAW", "NONE", "NULL", null].indexOf(scheme) !== -1) {
          scheme = { encode: function(e3) {
            return e3;
          } };
        } else if (typeof scheme === "string") {
          throw new Error('Unsupported encryption scheme: "' + scheme + '".');
        }
        var e2 = scheme.encode(data, key, true);
        return pki.rsa.encrypt(e2, key, true);
      };
      key.verify = function(digest, signature, scheme, options) {
        if (typeof scheme === "string") {
          scheme = scheme.toUpperCase();
        } else if (scheme === void 0) {
          scheme = "RSASSA-PKCS1-V1_5";
        }
        if (options === void 0) {
          options = {
            _parseAllDigestBytes: true
          };
        }
        if (!("_parseAllDigestBytes" in options)) {
          options._parseAllDigestBytes = true;
        }
        if (scheme === "RSASSA-PKCS1-V1_5") {
          scheme = {
            verify: function(digest2, d2) {
              d2 = _decodePkcs1_v1_5(d2, key, true);
              var obj = asn1.fromDer(d2, {
                parseAllBytes: options._parseAllDigestBytes
              });
              var capture = {};
              var errors = [];
              if (!asn1.validate(obj, digestInfoValidator, capture, errors)) {
                var error = new Error(
                  "ASN.1 object does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo value."
                );
                error.errors = errors;
                throw error;
              }
              var oid = asn1.derToOid(capture.algorithmIdentifier);
              if (!(oid === forge2.oids.md2 || oid === forge2.oids.md5 || oid === forge2.oids.sha1 || oid === forge2.oids.sha224 || oid === forge2.oids.sha256 || oid === forge2.oids.sha384 || oid === forge2.oids.sha512 || oid === forge2.oids["sha512-224"] || oid === forge2.oids["sha512-256"])) {
                var error = new Error(
                  "Unknown RSASSA-PKCS1-v1_5 DigestAlgorithm identifier."
                );
                error.oid = oid;
                throw error;
              }
              if (oid === forge2.oids.md2 || oid === forge2.oids.md5) {
                if (!("parameters" in capture)) {
                  throw new Error(
                    "ASN.1 object does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo value. Missing algorithm identifer NULL parameters."
                  );
                }
              }
              return digest2 === capture.digest;
            }
          };
        } else if (scheme === "NONE" || scheme === "NULL" || scheme === null) {
          scheme = {
            verify: function(digest2, d2) {
              d2 = _decodePkcs1_v1_5(d2, key, true);
              return digest2 === d2;
            }
          };
        }
        var d = pki.rsa.decrypt(signature, key, true, false);
        return scheme.verify(digest, d, key.n.bitLength());
      };
      return key;
    };
    pki.setRsaPrivateKey = pki.rsa.setPrivateKey = function(n, e, d, p, q, dP, dQ, qInv) {
      var key = {
        n,
        e,
        d,
        p,
        q,
        dP,
        dQ,
        qInv
      };
      key.decrypt = function(data, scheme, schemeOptions) {
        if (typeof scheme === "string") {
          scheme = scheme.toUpperCase();
        } else if (scheme === void 0) {
          scheme = "RSAES-PKCS1-V1_5";
        }
        var d2 = pki.rsa.decrypt(data, key, false, false);
        if (scheme === "RSAES-PKCS1-V1_5") {
          scheme = { decode: _decodePkcs1_v1_5 };
        } else if (scheme === "RSA-OAEP" || scheme === "RSAES-OAEP") {
          scheme = {
            decode: function(d3, key2) {
              return forge2.pkcs1.decode_rsa_oaep(key2, d3, schemeOptions);
            }
          };
        } else if (["RAW", "NONE", "NULL", null].indexOf(scheme) !== -1) {
          scheme = { decode: function(d3) {
            return d3;
          } };
        } else {
          throw new Error('Unsupported encryption scheme: "' + scheme + '".');
        }
        return scheme.decode(d2, key, false);
      };
      key.sign = function(md, scheme) {
        var bt = false;
        if (typeof scheme === "string") {
          scheme = scheme.toUpperCase();
        }
        if (scheme === void 0 || scheme === "RSASSA-PKCS1-V1_5") {
          scheme = { encode: emsaPkcs1v15encode };
          bt = 1;
        } else if (scheme === "NONE" || scheme === "NULL" || scheme === null) {
          scheme = { encode: function() {
            return md;
          } };
          bt = 1;
        }
        var d2 = scheme.encode(md, key.n.bitLength());
        return pki.rsa.encrypt(d2, key, bt);
      };
      return key;
    };
    pki.wrapRsaPrivateKey = function(rsaKey) {
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version (0)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(0).getBytes()
        ),
        // privateKeyAlgorithm
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.rsaEncryption).getBytes()
          ),
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
        ]),
        // PrivateKey
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          asn1.toDer(rsaKey).getBytes()
        )
      ]);
    };
    pki.privateKeyFromAsn1 = function(obj) {
      var capture = {};
      var errors = [];
      if (asn1.validate(obj, privateKeyValidator, capture, errors)) {
        obj = asn1.fromDer(forge2.util.createBuffer(capture.privateKey));
      }
      capture = {};
      errors = [];
      if (!asn1.validate(obj, rsaPrivateKeyValidator, capture, errors)) {
        var error = new Error("Cannot read private key. ASN.1 object does not contain an RSAPrivateKey.");
        error.errors = errors;
        throw error;
      }
      var n, e, d, p, q, dP, dQ, qInv;
      n = forge2.util.createBuffer(capture.privateKeyModulus).toHex();
      e = forge2.util.createBuffer(capture.privateKeyPublicExponent).toHex();
      d = forge2.util.createBuffer(capture.privateKeyPrivateExponent).toHex();
      p = forge2.util.createBuffer(capture.privateKeyPrime1).toHex();
      q = forge2.util.createBuffer(capture.privateKeyPrime2).toHex();
      dP = forge2.util.createBuffer(capture.privateKeyExponent1).toHex();
      dQ = forge2.util.createBuffer(capture.privateKeyExponent2).toHex();
      qInv = forge2.util.createBuffer(capture.privateKeyCoefficient).toHex();
      return pki.setRsaPrivateKey(
        new BigInteger(n, 16),
        new BigInteger(e, 16),
        new BigInteger(d, 16),
        new BigInteger(p, 16),
        new BigInteger(q, 16),
        new BigInteger(dP, 16),
        new BigInteger(dQ, 16),
        new BigInteger(qInv, 16)
      );
    };
    pki.privateKeyToAsn1 = pki.privateKeyToRSAPrivateKey = function(key) {
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version (0 = only 2 primes, 1 multiple primes)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(0).getBytes()
        ),
        // modulus (n)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.n)
        ),
        // publicExponent (e)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.e)
        ),
        // privateExponent (d)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.d)
        ),
        // privateKeyPrime1 (p)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.p)
        ),
        // privateKeyPrime2 (q)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.q)
        ),
        // privateKeyExponent1 (dP)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.dP)
        ),
        // privateKeyExponent2 (dQ)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.dQ)
        ),
        // coefficient (qInv)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.qInv)
        )
      ]);
    };
    pki.publicKeyFromAsn1 = function(obj) {
      var capture = {};
      var errors = [];
      if (asn1.validate(obj, publicKeyValidator, capture, errors)) {
        var oid = asn1.derToOid(capture.publicKeyOid);
        if (oid !== pki.oids.rsaEncryption) {
          var error = new Error("Cannot read public key. Unknown OID.");
          error.oid = oid;
          throw error;
        }
        obj = capture.rsaPublicKey;
      }
      errors = [];
      if (!asn1.validate(obj, rsaPublicKeyValidator, capture, errors)) {
        var error = new Error("Cannot read public key. ASN.1 object does not contain an RSAPublicKey.");
        error.errors = errors;
        throw error;
      }
      var n = forge2.util.createBuffer(capture.publicKeyModulus).toHex();
      var e = forge2.util.createBuffer(capture.publicKeyExponent).toHex();
      return pki.setRsaPublicKey(
        new BigInteger(n, 16),
        new BigInteger(e, 16)
      );
    };
    pki.publicKeyToAsn1 = pki.publicKeyToSubjectPublicKeyInfo = function(key) {
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // AlgorithmIdentifier
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.rsaEncryption).getBytes()
          ),
          // parameters (null)
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
        ]),
        // subjectPublicKey
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false, [
          pki.publicKeyToRSAPublicKey(key)
        ])
      ]);
    };
    pki.publicKeyToRSAPublicKey = function(key) {
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // modulus (n)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.n)
        ),
        // publicExponent (e)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          _bnToBytes(key.e)
        )
      ]);
    };
    function _encodePkcs1_v1_5(m, key, bt) {
      var eb = forge2.util.createBuffer();
      var k = Math.ceil(key.n.bitLength() / 8);
      if (m.length > k - 11) {
        var error = new Error("Message is too long for PKCS#1 v1.5 padding.");
        error.length = m.length;
        error.max = k - 11;
        throw error;
      }
      eb.putByte(0);
      eb.putByte(bt);
      var padNum = k - 3 - m.length;
      var padByte;
      if (bt === 0 || bt === 1) {
        padByte = bt === 0 ? 0 : 255;
        for (var i2 = 0; i2 < padNum; ++i2) {
          eb.putByte(padByte);
        }
      } else {
        while (padNum > 0) {
          var numZeros = 0;
          var padBytes = forge2.random.getBytes(padNum);
          for (var i2 = 0; i2 < padNum; ++i2) {
            padByte = padBytes.charCodeAt(i2);
            if (padByte === 0) {
              ++numZeros;
            } else {
              eb.putByte(padByte);
            }
          }
          padNum = numZeros;
        }
      }
      eb.putByte(0);
      eb.putBytes(m);
      return eb;
    }
    function _decodePkcs1_v1_5(em, key, pub, ml) {
      var k = Math.ceil(key.n.bitLength() / 8);
      var eb = forge2.util.createBuffer(em);
      var first = eb.getByte();
      var bt = eb.getByte();
      if (first !== 0 || pub && bt !== 0 && bt !== 1 || !pub && bt != 2 || pub && bt === 0 && typeof ml === "undefined") {
        throw new Error("Encryption block is invalid.");
      }
      var padNum = 0;
      if (bt === 0) {
        padNum = k - 3 - ml;
        for (var i2 = 0; i2 < padNum; ++i2) {
          if (eb.getByte() !== 0) {
            throw new Error("Encryption block is invalid.");
          }
        }
      } else if (bt === 1) {
        padNum = 0;
        while (eb.length() > 1) {
          if (eb.getByte() !== 255) {
            --eb.read;
            break;
          }
          ++padNum;
        }
      } else if (bt === 2) {
        padNum = 0;
        while (eb.length() > 1) {
          if (eb.getByte() === 0) {
            --eb.read;
            break;
          }
          ++padNum;
        }
      }
      var zero = eb.getByte();
      if (zero !== 0 || padNum !== k - 3 - eb.length()) {
        throw new Error("Encryption block is invalid.");
      }
      return eb.getBytes();
    }
    function _generateKeyPair(state, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      options = options || {};
      var opts = {
        algorithm: {
          name: options.algorithm || "PRIMEINC",
          options: {
            workers: options.workers || 2,
            workLoad: options.workLoad || 100,
            workerScript: options.workerScript
          }
        }
      };
      if ("prng" in options) {
        opts.prng = options.prng;
      }
      generate();
      function generate() {
        getPrime(state.pBits, function(err2, num) {
          if (err2) {
            return callback(err2);
          }
          state.p = num;
          if (state.q !== null) {
            return finish(err2, state.q);
          }
          getPrime(state.qBits, finish);
        });
      }
      function getPrime(bits, callback2) {
        forge2.prime.generateProbablePrime(bits, opts, callback2);
      }
      function finish(err2, num) {
        if (err2) {
          return callback(err2);
        }
        state.q = num;
        if (state.p.compareTo(state.q) < 0) {
          var tmp = state.p;
          state.p = state.q;
          state.q = tmp;
        }
        if (state.p.subtract(BigInteger.ONE).gcd(state.e).compareTo(BigInteger.ONE) !== 0) {
          state.p = null;
          generate();
          return;
        }
        if (state.q.subtract(BigInteger.ONE).gcd(state.e).compareTo(BigInteger.ONE) !== 0) {
          state.q = null;
          getPrime(state.qBits, finish);
          return;
        }
        state.p1 = state.p.subtract(BigInteger.ONE);
        state.q1 = state.q.subtract(BigInteger.ONE);
        state.phi = state.p1.multiply(state.q1);
        if (state.phi.gcd(state.e).compareTo(BigInteger.ONE) !== 0) {
          state.p = state.q = null;
          generate();
          return;
        }
        state.n = state.p.multiply(state.q);
        if (state.n.bitLength() !== state.bits) {
          state.q = null;
          getPrime(state.qBits, finish);
          return;
        }
        var d = state.e.modInverse(state.phi);
        state.keys = {
          privateKey: pki.rsa.setPrivateKey(
            state.n,
            state.e,
            d,
            state.p,
            state.q,
            d.mod(state.p1),
            d.mod(state.q1),
            state.q.modInverse(state.p)
          ),
          publicKey: pki.rsa.setPublicKey(state.n, state.e)
        };
        callback(null, state.keys);
      }
    }
    function _bnToBytes(b) {
      var hex = b.toString(16);
      if (hex[0] >= "8") {
        hex = "00" + hex;
      }
      var bytes = forge2.util.hexToBytes(hex);
      if (bytes.length > 1 && // leading 0x00 for positive integer
      (bytes.charCodeAt(0) === 0 && (bytes.charCodeAt(1) & 128) === 0 || // leading 0xFF for negative integer
      bytes.charCodeAt(0) === 255 && (bytes.charCodeAt(1) & 128) === 128)) {
        return bytes.substr(1);
      }
      return bytes;
    }
    function _getMillerRabinTests(bits) {
      if (bits <= 100) return 27;
      if (bits <= 150) return 18;
      if (bits <= 200) return 15;
      if (bits <= 250) return 12;
      if (bits <= 300) return 9;
      if (bits <= 350) return 8;
      if (bits <= 400) return 7;
      if (bits <= 500) return 6;
      if (bits <= 600) return 5;
      if (bits <= 800) return 4;
      if (bits <= 1250) return 3;
      return 2;
    }
    function _detectNodeCrypto(fn) {
      return forge2.util.isNodejs && typeof _crypto[fn] === "function";
    }
    function _detectSubtleCrypto(fn) {
      return typeof util.globalScope !== "undefined" && typeof util.globalScope.crypto === "object" && typeof util.globalScope.crypto.subtle === "object" && typeof util.globalScope.crypto.subtle[fn] === "function";
    }
    function _detectSubtleMsCrypto(fn) {
      return typeof util.globalScope !== "undefined" && typeof util.globalScope.msCrypto === "object" && typeof util.globalScope.msCrypto.subtle === "object" && typeof util.globalScope.msCrypto.subtle[fn] === "function";
    }
    function _intToUint8Array(x2) {
      var bytes = forge2.util.hexToBytes(x2.toString(16));
      var buffer = new Uint8Array(bytes.length);
      for (var i2 = 0; i2 < bytes.length; ++i2) {
        buffer[i2] = bytes.charCodeAt(i2);
      }
      return buffer;
    }
  }
});

// node_modules/node-forge/lib/pbe.js
var require_pbe = __commonJS({
  "node_modules/node-forge/lib/pbe.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_asn1();
    require_des();
    require_md();
    require_oids();
    require_pbkdf2();
    require_pem();
    require_random();
    require_rc2();
    require_rsa();
    require_util();
    if (typeof BigInteger === "undefined") {
      BigInteger = forge2.jsbn.BigInteger;
    }
    var BigInteger;
    var asn1 = forge2.asn1;
    var pki = forge2.pki = forge2.pki || {};
    module.exports = pki.pbe = forge2.pbe = forge2.pbe || {};
    var oids = pki.oids;
    var encryptedPrivateKeyValidator = {
      name: "EncryptedPrivateKeyInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "EncryptedPrivateKeyInfo.encryptionAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "encryptionOid"
        }, {
          name: "AlgorithmIdentifier.parameters",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "encryptionParams"
        }]
      }, {
        // encryptedData
        name: "EncryptedPrivateKeyInfo.encryptedData",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "encryptedData"
      }]
    };
    var PBES2AlgorithmsValidator = {
      name: "PBES2Algorithms",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "PBES2Algorithms.keyDerivationFunc",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "PBES2Algorithms.keyDerivationFunc.oid",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "kdfOid"
        }, {
          name: "PBES2Algorithms.params",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "PBES2Algorithms.params.salt",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OCTETSTRING,
            constructed: false,
            capture: "kdfSalt"
          }, {
            name: "PBES2Algorithms.params.iterationCount",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.INTEGER,
            constructed: false,
            capture: "kdfIterationCount"
          }, {
            name: "PBES2Algorithms.params.keyLength",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.INTEGER,
            constructed: false,
            optional: true,
            capture: "keyLength"
          }, {
            // prf
            name: "PBES2Algorithms.params.prf",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            optional: true,
            value: [{
              name: "PBES2Algorithms.params.prf.algorithm",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.OID,
              constructed: false,
              capture: "prfOid"
            }]
          }]
        }]
      }, {
        name: "PBES2Algorithms.encryptionScheme",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "PBES2Algorithms.encryptionScheme.oid",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "encOid"
        }, {
          name: "PBES2Algorithms.encryptionScheme.iv",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OCTETSTRING,
          constructed: false,
          capture: "encIv"
        }]
      }]
    };
    var pkcs12PbeParamsValidator = {
      name: "pkcs-12PbeParams",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "pkcs-12PbeParams.salt",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "salt"
      }, {
        name: "pkcs-12PbeParams.iterations",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "iterations"
      }]
    };
    pki.encryptPrivateKeyInfo = function(obj, password, options) {
      options = options || {};
      options.saltSize = options.saltSize || 8;
      options.count = options.count || 2048;
      options.algorithm = options.algorithm || "aes128";
      options.prfAlgorithm = options.prfAlgorithm || "sha1";
      var salt = forge2.random.getBytesSync(options.saltSize);
      var count = options.count;
      var countBytes = asn1.integerToDer(count);
      var dkLen;
      var encryptionAlgorithm;
      var encryptedData;
      if (options.algorithm.indexOf("aes") === 0 || options.algorithm === "des") {
        var ivLen, encOid, cipherFn;
        switch (options.algorithm) {
          case "aes128":
            dkLen = 16;
            ivLen = 16;
            encOid = oids["aes128-CBC"];
            cipherFn = forge2.aes.createEncryptionCipher;
            break;
          case "aes192":
            dkLen = 24;
            ivLen = 16;
            encOid = oids["aes192-CBC"];
            cipherFn = forge2.aes.createEncryptionCipher;
            break;
          case "aes256":
            dkLen = 32;
            ivLen = 16;
            encOid = oids["aes256-CBC"];
            cipherFn = forge2.aes.createEncryptionCipher;
            break;
          case "des":
            dkLen = 8;
            ivLen = 8;
            encOid = oids["desCBC"];
            cipherFn = forge2.des.createEncryptionCipher;
            break;
          default:
            var error = new Error("Cannot encrypt private key. Unknown encryption algorithm.");
            error.algorithm = options.algorithm;
            throw error;
        }
        var prfAlgorithm = "hmacWith" + options.prfAlgorithm.toUpperCase();
        var md = prfAlgorithmToMessageDigest(prfAlgorithm);
        var dk = forge2.pkcs5.pbkdf2(password, salt, count, dkLen, md);
        var iv = forge2.random.getBytesSync(ivLen);
        var cipher = cipherFn(dk);
        cipher.start(iv);
        cipher.update(asn1.toDer(obj));
        cipher.finish();
        encryptedData = cipher.output.getBytes();
        var params = createPbkdf2Params(salt, countBytes, dkLen, prfAlgorithm);
        encryptionAlgorithm = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(oids["pkcs5PBES2"]).getBytes()
            ),
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // keyDerivationFunc
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(oids["pkcs5PBKDF2"]).getBytes()
                ),
                // PBKDF2-params
                params
              ]),
              // encryptionScheme
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(encOid).getBytes()
                ),
                // iv
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OCTETSTRING,
                  false,
                  iv
                )
              ])
            ])
          ]
        );
      } else if (options.algorithm === "3des") {
        dkLen = 24;
        var saltBytes = new forge2.util.ByteBuffer(salt);
        var dk = pki.pbe.generatePkcs12Key(password, saltBytes, 1, count, dkLen);
        var iv = pki.pbe.generatePkcs12Key(password, saltBytes, 2, count, dkLen);
        var cipher = forge2.des.createEncryptionCipher(dk);
        cipher.start(iv);
        cipher.update(asn1.toDer(obj));
        cipher.finish();
        encryptedData = cipher.output.getBytes();
        encryptionAlgorithm = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(oids["pbeWithSHAAnd3-KeyTripleDES-CBC"]).getBytes()
            ),
            // pkcs-12PbeParams
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // salt
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, salt),
              // iteration count
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.INTEGER,
                false,
                countBytes.getBytes()
              )
            ])
          ]
        );
      } else {
        var error = new Error("Cannot encrypt private key. Unknown encryption algorithm.");
        error.algorithm = options.algorithm;
        throw error;
      }
      var rval = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // encryptionAlgorithm
        encryptionAlgorithm,
        // encryptedData
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          encryptedData
        )
      ]);
      return rval;
    };
    pki.decryptPrivateKeyInfo = function(obj, password) {
      var rval = null;
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, encryptedPrivateKeyValidator, capture, errors)) {
        var error = new Error("Cannot read encrypted private key. ASN.1 object is not a supported EncryptedPrivateKeyInfo.");
        error.errors = errors;
        throw error;
      }
      var oid = asn1.derToOid(capture.encryptionOid);
      var cipher = pki.pbe.getCipher(oid, capture.encryptionParams, password);
      var encrypted = forge2.util.createBuffer(capture.encryptedData);
      cipher.update(encrypted);
      if (cipher.finish()) {
        rval = asn1.fromDer(cipher.output);
      }
      return rval;
    };
    pki.encryptedPrivateKeyToPem = function(epki, maxline) {
      var msg = {
        type: "ENCRYPTED PRIVATE KEY",
        body: asn1.toDer(epki).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.encryptedPrivateKeyFromPem = function(pem) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "ENCRYPTED PRIVATE KEY") {
        var error = new Error('Could not convert encrypted private key from PEM; PEM header type is "ENCRYPTED PRIVATE KEY".');
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert encrypted private key from PEM; PEM is encrypted.");
      }
      return asn1.fromDer(msg.body);
    };
    pki.encryptRsaPrivateKey = function(rsaKey, password, options) {
      options = options || {};
      if (!options.legacy) {
        var rval = pki.wrapRsaPrivateKey(pki.privateKeyToAsn1(rsaKey));
        rval = pki.encryptPrivateKeyInfo(rval, password, options);
        return pki.encryptedPrivateKeyToPem(rval);
      }
      var algorithm;
      var iv;
      var dkLen;
      var cipherFn;
      switch (options.algorithm) {
        case "aes128":
          algorithm = "AES-128-CBC";
          dkLen = 16;
          iv = forge2.random.getBytesSync(16);
          cipherFn = forge2.aes.createEncryptionCipher;
          break;
        case "aes192":
          algorithm = "AES-192-CBC";
          dkLen = 24;
          iv = forge2.random.getBytesSync(16);
          cipherFn = forge2.aes.createEncryptionCipher;
          break;
        case "aes256":
          algorithm = "AES-256-CBC";
          dkLen = 32;
          iv = forge2.random.getBytesSync(16);
          cipherFn = forge2.aes.createEncryptionCipher;
          break;
        case "3des":
          algorithm = "DES-EDE3-CBC";
          dkLen = 24;
          iv = forge2.random.getBytesSync(8);
          cipherFn = forge2.des.createEncryptionCipher;
          break;
        case "des":
          algorithm = "DES-CBC";
          dkLen = 8;
          iv = forge2.random.getBytesSync(8);
          cipherFn = forge2.des.createEncryptionCipher;
          break;
        default:
          var error = new Error('Could not encrypt RSA private key; unsupported encryption algorithm "' + options.algorithm + '".');
          error.algorithm = options.algorithm;
          throw error;
      }
      var dk = forge2.pbe.opensslDeriveBytes(password, iv.substr(0, 8), dkLen);
      var cipher = cipherFn(dk);
      cipher.start(iv);
      cipher.update(asn1.toDer(pki.privateKeyToAsn1(rsaKey)));
      cipher.finish();
      var msg = {
        type: "RSA PRIVATE KEY",
        procType: {
          version: "4",
          type: "ENCRYPTED"
        },
        dekInfo: {
          algorithm,
          parameters: forge2.util.bytesToHex(iv).toUpperCase()
        },
        body: cipher.output.getBytes()
      };
      return forge2.pem.encode(msg);
    };
    pki.decryptRsaPrivateKey = function(pem, password) {
      var rval = null;
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "ENCRYPTED PRIVATE KEY" && msg.type !== "PRIVATE KEY" && msg.type !== "RSA PRIVATE KEY") {
        var error = new Error('Could not convert private key from PEM; PEM header type is not "ENCRYPTED PRIVATE KEY", "PRIVATE KEY", or "RSA PRIVATE KEY".');
        error.headerType = error;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        var dkLen;
        var cipherFn;
        switch (msg.dekInfo.algorithm) {
          case "DES-CBC":
            dkLen = 8;
            cipherFn = forge2.des.createDecryptionCipher;
            break;
          case "DES-EDE3-CBC":
            dkLen = 24;
            cipherFn = forge2.des.createDecryptionCipher;
            break;
          case "AES-128-CBC":
            dkLen = 16;
            cipherFn = forge2.aes.createDecryptionCipher;
            break;
          case "AES-192-CBC":
            dkLen = 24;
            cipherFn = forge2.aes.createDecryptionCipher;
            break;
          case "AES-256-CBC":
            dkLen = 32;
            cipherFn = forge2.aes.createDecryptionCipher;
            break;
          case "RC2-40-CBC":
            dkLen = 5;
            cipherFn = function(key) {
              return forge2.rc2.createDecryptionCipher(key, 40);
            };
            break;
          case "RC2-64-CBC":
            dkLen = 8;
            cipherFn = function(key) {
              return forge2.rc2.createDecryptionCipher(key, 64);
            };
            break;
          case "RC2-128-CBC":
            dkLen = 16;
            cipherFn = function(key) {
              return forge2.rc2.createDecryptionCipher(key, 128);
            };
            break;
          default:
            var error = new Error('Could not decrypt private key; unsupported encryption algorithm "' + msg.dekInfo.algorithm + '".');
            error.algorithm = msg.dekInfo.algorithm;
            throw error;
        }
        var iv = forge2.util.hexToBytes(msg.dekInfo.parameters);
        var dk = forge2.pbe.opensslDeriveBytes(password, iv.substr(0, 8), dkLen);
        var cipher = cipherFn(dk);
        cipher.start(iv);
        cipher.update(forge2.util.createBuffer(msg.body));
        if (cipher.finish()) {
          rval = cipher.output.getBytes();
        } else {
          return rval;
        }
      } else {
        rval = msg.body;
      }
      if (msg.type === "ENCRYPTED PRIVATE KEY") {
        rval = pki.decryptPrivateKeyInfo(asn1.fromDer(rval), password);
      } else {
        rval = asn1.fromDer(rval);
      }
      if (rval !== null) {
        rval = pki.privateKeyFromAsn1(rval);
      }
      return rval;
    };
    pki.pbe.generatePkcs12Key = function(password, salt, id, iter, n, md) {
      var j, l;
      if (typeof md === "undefined" || md === null) {
        if (!("sha1" in forge2.md)) {
          throw new Error('"sha1" hash algorithm unavailable.');
        }
        md = forge2.md.sha1.create();
      }
      var u = md.digestLength;
      var v = md.blockLength;
      var result = new forge2.util.ByteBuffer();
      var passBuf = new forge2.util.ByteBuffer();
      if (password !== null && password !== void 0) {
        for (l = 0; l < password.length; l++) {
          passBuf.putInt16(password.charCodeAt(l));
        }
        passBuf.putInt16(0);
      }
      var p = passBuf.length();
      var s = salt.length();
      var D = new forge2.util.ByteBuffer();
      D.fillWithByte(id, v);
      var Slen = v * Math.ceil(s / v);
      var S = new forge2.util.ByteBuffer();
      for (l = 0; l < Slen; l++) {
        S.putByte(salt.at(l % s));
      }
      var Plen = v * Math.ceil(p / v);
      var P = new forge2.util.ByteBuffer();
      for (l = 0; l < Plen; l++) {
        P.putByte(passBuf.at(l % p));
      }
      var I = S;
      I.putBuffer(P);
      var c = Math.ceil(n / u);
      for (var i2 = 1; i2 <= c; i2++) {
        var buf = new forge2.util.ByteBuffer();
        buf.putBytes(D.bytes());
        buf.putBytes(I.bytes());
        for (var round = 0; round < iter; round++) {
          md.start();
          md.update(buf.getBytes());
          buf = md.digest();
        }
        var B = new forge2.util.ByteBuffer();
        for (l = 0; l < v; l++) {
          B.putByte(buf.at(l % u));
        }
        var k = Math.ceil(s / v) + Math.ceil(p / v);
        var Inew = new forge2.util.ByteBuffer();
        for (j = 0; j < k; j++) {
          var chunk = new forge2.util.ByteBuffer(I.getBytes(v));
          var x2 = 511;
          for (l = B.length() - 1; l >= 0; l--) {
            x2 = x2 >> 8;
            x2 += B.at(l) + chunk.at(l);
            chunk.setAt(l, x2 & 255);
          }
          Inew.putBuffer(chunk);
        }
        I = Inew;
        result.putBuffer(buf);
      }
      result.truncate(result.length() - n);
      return result;
    };
    pki.pbe.getCipher = function(oid, params, password) {
      switch (oid) {
        case pki.oids["pkcs5PBES2"]:
          return pki.pbe.getCipherForPBES2(oid, params, password);
        case pki.oids["pbeWithSHAAnd3-KeyTripleDES-CBC"]:
        case pki.oids["pbewithSHAAnd40BitRC2-CBC"]:
          return pki.pbe.getCipherForPKCS12PBE(oid, params, password);
        default:
          var error = new Error("Cannot read encrypted PBE data block. Unsupported OID.");
          error.oid = oid;
          error.supportedOids = [
            "pkcs5PBES2",
            "pbeWithSHAAnd3-KeyTripleDES-CBC",
            "pbewithSHAAnd40BitRC2-CBC"
          ];
          throw error;
      }
    };
    pki.pbe.getCipherForPBES2 = function(oid, params, password) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(params, PBES2AlgorithmsValidator, capture, errors)) {
        var error = new Error("Cannot read password-based-encryption algorithm parameters. ASN.1 object is not a supported EncryptedPrivateKeyInfo.");
        error.errors = errors;
        throw error;
      }
      oid = asn1.derToOid(capture.kdfOid);
      if (oid !== pki.oids["pkcs5PBKDF2"]) {
        var error = new Error("Cannot read encrypted private key. Unsupported key derivation function OID.");
        error.oid = oid;
        error.supportedOids = ["pkcs5PBKDF2"];
        throw error;
      }
      oid = asn1.derToOid(capture.encOid);
      if (oid !== pki.oids["aes128-CBC"] && oid !== pki.oids["aes192-CBC"] && oid !== pki.oids["aes256-CBC"] && oid !== pki.oids["des-EDE3-CBC"] && oid !== pki.oids["desCBC"]) {
        var error = new Error("Cannot read encrypted private key. Unsupported encryption scheme OID.");
        error.oid = oid;
        error.supportedOids = [
          "aes128-CBC",
          "aes192-CBC",
          "aes256-CBC",
          "des-EDE3-CBC",
          "desCBC"
        ];
        throw error;
      }
      var salt = capture.kdfSalt;
      var count = forge2.util.createBuffer(capture.kdfIterationCount);
      count = count.getInt(count.length() << 3);
      var dkLen;
      var cipherFn;
      switch (pki.oids[oid]) {
        case "aes128-CBC":
          dkLen = 16;
          cipherFn = forge2.aes.createDecryptionCipher;
          break;
        case "aes192-CBC":
          dkLen = 24;
          cipherFn = forge2.aes.createDecryptionCipher;
          break;
        case "aes256-CBC":
          dkLen = 32;
          cipherFn = forge2.aes.createDecryptionCipher;
          break;
        case "des-EDE3-CBC":
          dkLen = 24;
          cipherFn = forge2.des.createDecryptionCipher;
          break;
        case "desCBC":
          dkLen = 8;
          cipherFn = forge2.des.createDecryptionCipher;
          break;
      }
      var md = prfOidToMessageDigest(capture.prfOid);
      var dk = forge2.pkcs5.pbkdf2(password, salt, count, dkLen, md);
      var iv = capture.encIv;
      var cipher = cipherFn(dk);
      cipher.start(iv);
      return cipher;
    };
    pki.pbe.getCipherForPKCS12PBE = function(oid, params, password) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(params, pkcs12PbeParamsValidator, capture, errors)) {
        var error = new Error("Cannot read password-based-encryption algorithm parameters. ASN.1 object is not a supported EncryptedPrivateKeyInfo.");
        error.errors = errors;
        throw error;
      }
      var salt = forge2.util.createBuffer(capture.salt);
      var count = forge2.util.createBuffer(capture.iterations);
      count = count.getInt(count.length() << 3);
      var dkLen, dIvLen, cipherFn;
      switch (oid) {
        case pki.oids["pbeWithSHAAnd3-KeyTripleDES-CBC"]:
          dkLen = 24;
          dIvLen = 8;
          cipherFn = forge2.des.startDecrypting;
          break;
        case pki.oids["pbewithSHAAnd40BitRC2-CBC"]:
          dkLen = 5;
          dIvLen = 8;
          cipherFn = function(key2, iv2) {
            var cipher = forge2.rc2.createDecryptionCipher(key2, 40);
            cipher.start(iv2, null);
            return cipher;
          };
          break;
        default:
          var error = new Error("Cannot read PKCS #12 PBE data block. Unsupported OID.");
          error.oid = oid;
          throw error;
      }
      var md = prfOidToMessageDigest(capture.prfOid);
      var key = pki.pbe.generatePkcs12Key(password, salt, 1, count, dkLen, md);
      md.start();
      var iv = pki.pbe.generatePkcs12Key(password, salt, 2, count, dIvLen, md);
      return cipherFn(key, iv);
    };
    pki.pbe.opensslDeriveBytes = function(password, salt, dkLen, md) {
      if (typeof md === "undefined" || md === null) {
        if (!("md5" in forge2.md)) {
          throw new Error('"md5" hash algorithm unavailable.');
        }
        md = forge2.md.md5.create();
      }
      if (salt === null) {
        salt = "";
      }
      var digests = [hash(md, password + salt)];
      for (var length = 16, i2 = 1; length < dkLen; ++i2, length += 16) {
        digests.push(hash(md, digests[i2 - 1] + password + salt));
      }
      return digests.join("").substr(0, dkLen);
    };
    function hash(md, bytes) {
      return md.start().update(bytes).digest().getBytes();
    }
    function prfOidToMessageDigest(prfOid) {
      var prfAlgorithm;
      if (!prfOid) {
        prfAlgorithm = "hmacWithSHA1";
      } else {
        prfAlgorithm = pki.oids[asn1.derToOid(prfOid)];
        if (!prfAlgorithm) {
          var error = new Error("Unsupported PRF OID.");
          error.oid = prfOid;
          error.supported = [
            "hmacWithSHA1",
            "hmacWithSHA224",
            "hmacWithSHA256",
            "hmacWithSHA384",
            "hmacWithSHA512"
          ];
          throw error;
        }
      }
      return prfAlgorithmToMessageDigest(prfAlgorithm);
    }
    function prfAlgorithmToMessageDigest(prfAlgorithm) {
      var factory = forge2.md;
      switch (prfAlgorithm) {
        case "hmacWithSHA224":
          factory = forge2.md.sha512;
        case "hmacWithSHA1":
        case "hmacWithSHA256":
        case "hmacWithSHA384":
        case "hmacWithSHA512":
          prfAlgorithm = prfAlgorithm.substr(8).toLowerCase();
          break;
        default:
          var error = new Error("Unsupported PRF algorithm.");
          error.algorithm = prfAlgorithm;
          error.supported = [
            "hmacWithSHA1",
            "hmacWithSHA224",
            "hmacWithSHA256",
            "hmacWithSHA384",
            "hmacWithSHA512"
          ];
          throw error;
      }
      if (!factory || !(prfAlgorithm in factory)) {
        throw new Error("Unknown hash algorithm: " + prfAlgorithm);
      }
      return factory[prfAlgorithm].create();
    }
    function createPbkdf2Params(salt, countBytes, dkLen, prfAlgorithm) {
      var params = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // salt
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          salt
        ),
        // iteration count
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          countBytes.getBytes()
        )
      ]);
      if (prfAlgorithm !== "hmacWithSHA1") {
        params.value.push(
          // key length
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            forge2.util.hexToBytes(dkLen.toString(16))
          ),
          // AlgorithmIdentifier
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // algorithm
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(pki.oids[prfAlgorithm]).getBytes()
            ),
            // parameters (null)
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
          ])
        );
      }
      return params;
    }
  }
});

// node_modules/node-forge/lib/pkcs7asn1.js
var require_pkcs7asn1 = __commonJS({
  "node_modules/node-forge/lib/pkcs7asn1.js"(exports, module) {
    var forge2 = require_forge();
    require_asn1();
    require_util();
    var asn1 = forge2.asn1;
    var p7v = module.exports = forge2.pkcs7asn1 = forge2.pkcs7asn1 || {};
    forge2.pkcs7 = forge2.pkcs7 || {};
    forge2.pkcs7.asn1 = p7v;
    var contentInfoValidator = {
      name: "ContentInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "ContentInfo.ContentType",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "contentType"
      }, {
        name: "ContentInfo.content",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 0,
        constructed: true,
        optional: true,
        captureAsn1: "content"
      }]
    };
    p7v.contentInfoValidator = contentInfoValidator;
    var encryptedContentInfoValidator = {
      name: "EncryptedContentInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "EncryptedContentInfo.contentType",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "contentType"
      }, {
        name: "EncryptedContentInfo.contentEncryptionAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "EncryptedContentInfo.contentEncryptionAlgorithm.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "encAlgorithm"
        }, {
          name: "EncryptedContentInfo.contentEncryptionAlgorithm.parameter",
          tagClass: asn1.Class.UNIVERSAL,
          captureAsn1: "encParameter"
        }]
      }, {
        name: "EncryptedContentInfo.encryptedContent",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 0,
        /* The PKCS#7 structure output by OpenSSL somewhat differs from what
         * other implementations do generate.
         *
         * OpenSSL generates a structure like this:
         * SEQUENCE {
         *    ...
         *    [0]
         *       26 DA 67 D2 17 9C 45 3C B1 2A A8 59 2F 29 33 38
         *       C3 C3 DF 86 71 74 7A 19 9F 40 D0 29 BE 85 90 45
         *       ...
         * }
         *
         * Whereas other implementations (and this PKCS#7 module) generate:
         * SEQUENCE {
         *    ...
         *    [0] {
         *       OCTET STRING
         *          26 DA 67 D2 17 9C 45 3C B1 2A A8 59 2F 29 33 38
         *          C3 C3 DF 86 71 74 7A 19 9F 40 D0 29 BE 85 90 45
         *          ...
         *    }
         * }
         *
         * In order to support both, we just capture the context specific
         * field here.  The OCTET STRING bit is removed below.
         */
        capture: "encryptedContent",
        captureAsn1: "encryptedContentAsn1"
      }]
    };
    p7v.envelopedDataValidator = {
      name: "EnvelopedData",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "EnvelopedData.Version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "version"
      }, {
        name: "EnvelopedData.RecipientInfos",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SET,
        constructed: true,
        captureAsn1: "recipientInfos"
      }].concat(encryptedContentInfoValidator)
    };
    p7v.encryptedDataValidator = {
      name: "EncryptedData",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "EncryptedData.Version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "version"
      }].concat(encryptedContentInfoValidator)
    };
    var signerValidator = {
      name: "SignerInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "SignerInfo.version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false
      }, {
        name: "SignerInfo.issuerAndSerialNumber",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "SignerInfo.issuerAndSerialNumber.issuer",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "issuer"
        }, {
          name: "SignerInfo.issuerAndSerialNumber.serialNumber",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.INTEGER,
          constructed: false,
          capture: "serial"
        }]
      }, {
        name: "SignerInfo.digestAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "SignerInfo.digestAlgorithm.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "digestAlgorithm"
        }, {
          name: "SignerInfo.digestAlgorithm.parameter",
          tagClass: asn1.Class.UNIVERSAL,
          constructed: false,
          captureAsn1: "digestParameter",
          optional: true
        }]
      }, {
        name: "SignerInfo.authenticatedAttributes",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 0,
        constructed: true,
        optional: true,
        capture: "authenticatedAttributes"
      }, {
        name: "SignerInfo.digestEncryptionAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        capture: "signatureAlgorithm"
      }, {
        name: "SignerInfo.encryptedDigest",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "signature"
      }, {
        name: "SignerInfo.unauthenticatedAttributes",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 1,
        constructed: true,
        optional: true,
        capture: "unauthenticatedAttributes"
      }]
    };
    p7v.signedDataValidator = {
      name: "SignedData",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [
        {
          name: "SignedData.Version",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.INTEGER,
          constructed: false,
          capture: "version"
        },
        {
          name: "SignedData.DigestAlgorithms",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SET,
          constructed: true,
          captureAsn1: "digestAlgorithms"
        },
        contentInfoValidator,
        {
          name: "SignedData.Certificates",
          tagClass: asn1.Class.CONTEXT_SPECIFIC,
          type: 0,
          optional: true,
          captureAsn1: "certificates"
        },
        {
          name: "SignedData.CertificateRevocationLists",
          tagClass: asn1.Class.CONTEXT_SPECIFIC,
          type: 1,
          optional: true,
          captureAsn1: "crls"
        },
        {
          name: "SignedData.SignerInfos",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SET,
          capture: "signerInfos",
          optional: true,
          value: [signerValidator]
        }
      ]
    };
    p7v.recipientInfoValidator = {
      name: "RecipientInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "RecipientInfo.version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "version"
      }, {
        name: "RecipientInfo.issuerAndSerial",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "RecipientInfo.issuerAndSerial.issuer",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "issuer"
        }, {
          name: "RecipientInfo.issuerAndSerial.serialNumber",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.INTEGER,
          constructed: false,
          capture: "serial"
        }]
      }, {
        name: "RecipientInfo.keyEncryptionAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "RecipientInfo.keyEncryptionAlgorithm.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "encAlgorithm"
        }, {
          name: "RecipientInfo.keyEncryptionAlgorithm.parameter",
          tagClass: asn1.Class.UNIVERSAL,
          constructed: false,
          captureAsn1: "encParameter",
          optional: true
        }]
      }, {
        name: "RecipientInfo.encryptedKey",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "encKey"
      }]
    };
  }
});

// node_modules/node-forge/lib/mgf1.js
var require_mgf1 = __commonJS({
  "node_modules/node-forge/lib/mgf1.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    forge2.mgf = forge2.mgf || {};
    var mgf1 = module.exports = forge2.mgf.mgf1 = forge2.mgf1 = forge2.mgf1 || {};
    mgf1.create = function(md) {
      var mgf = {
        /**
         * Generate mask of specified length.
         *
         * @param {String} seed The seed for mask generation.
         * @param maskLen Number of bytes to generate.
         * @return {String} The generated mask.
         */
        generate: function(seed, maskLen) {
          var t = new forge2.util.ByteBuffer();
          var len = Math.ceil(maskLen / md.digestLength);
          for (var i2 = 0; i2 < len; i2++) {
            var c = new forge2.util.ByteBuffer();
            c.putInt32(i2);
            md.start();
            md.update(seed + c.getBytes());
            t.putBuffer(md.digest());
          }
          t.truncate(t.length() - maskLen);
          return t.getBytes();
        }
      };
      return mgf;
    };
  }
});

// node_modules/node-forge/lib/mgf.js
var require_mgf = __commonJS({
  "node_modules/node-forge/lib/mgf.js"(exports, module) {
    var forge2 = require_forge();
    require_mgf1();
    module.exports = forge2.mgf = forge2.mgf || {};
    forge2.mgf.mgf1 = forge2.mgf1;
  }
});

// node_modules/node-forge/lib/pss.js
var require_pss = __commonJS({
  "node_modules/node-forge/lib/pss.js"(exports, module) {
    var forge2 = require_forge();
    require_random();
    require_util();
    var pss = module.exports = forge2.pss = forge2.pss || {};
    pss.create = function(options) {
      if (arguments.length === 3) {
        options = {
          md: arguments[0],
          mgf: arguments[1],
          saltLength: arguments[2]
        };
      }
      var hash = options.md;
      var mgf = options.mgf;
      var hLen = hash.digestLength;
      var salt_ = options.salt || null;
      if (typeof salt_ === "string") {
        salt_ = forge2.util.createBuffer(salt_);
      }
      var sLen;
      if ("saltLength" in options) {
        sLen = options.saltLength;
      } else if (salt_ !== null) {
        sLen = salt_.length();
      } else {
        throw new Error("Salt length not specified or specific salt not given.");
      }
      if (salt_ !== null && salt_.length() !== sLen) {
        throw new Error("Given salt length does not match length of given salt.");
      }
      var prng = options.prng || forge2.random;
      var pssobj = {};
      pssobj.encode = function(md, modBits) {
        var i2;
        var emBits = modBits - 1;
        var emLen = Math.ceil(emBits / 8);
        var mHash = md.digest().getBytes();
        if (emLen < hLen + sLen + 2) {
          throw new Error("Message is too long to encrypt.");
        }
        var salt;
        if (salt_ === null) {
          salt = prng.getBytesSync(sLen);
        } else {
          salt = salt_.bytes();
        }
        var m_ = new forge2.util.ByteBuffer();
        m_.fillWithByte(0, 8);
        m_.putBytes(mHash);
        m_.putBytes(salt);
        hash.start();
        hash.update(m_.getBytes());
        var h = hash.digest().getBytes();
        var ps = new forge2.util.ByteBuffer();
        ps.fillWithByte(0, emLen - sLen - hLen - 2);
        ps.putByte(1);
        ps.putBytes(salt);
        var db = ps.getBytes();
        var maskLen = emLen - hLen - 1;
        var dbMask = mgf.generate(h, maskLen);
        var maskedDB = "";
        for (i2 = 0; i2 < maskLen; i2++) {
          maskedDB += String.fromCharCode(db.charCodeAt(i2) ^ dbMask.charCodeAt(i2));
        }
        var mask = 65280 >> 8 * emLen - emBits & 255;
        maskedDB = String.fromCharCode(maskedDB.charCodeAt(0) & ~mask) + maskedDB.substr(1);
        return maskedDB + h + String.fromCharCode(188);
      };
      pssobj.verify = function(mHash, em, modBits) {
        var i2;
        var emBits = modBits - 1;
        var emLen = Math.ceil(emBits / 8);
        em = em.substr(-emLen);
        if (emLen < hLen + sLen + 2) {
          throw new Error("Inconsistent parameters to PSS signature verification.");
        }
        if (em.charCodeAt(emLen - 1) !== 188) {
          throw new Error("Encoded message does not end in 0xBC.");
        }
        var maskLen = emLen - hLen - 1;
        var maskedDB = em.substr(0, maskLen);
        var h = em.substr(maskLen, hLen);
        var mask = 65280 >> 8 * emLen - emBits & 255;
        if ((maskedDB.charCodeAt(0) & mask) !== 0) {
          throw new Error("Bits beyond keysize not zero as expected.");
        }
        var dbMask = mgf.generate(h, maskLen);
        var db = "";
        for (i2 = 0; i2 < maskLen; i2++) {
          db += String.fromCharCode(maskedDB.charCodeAt(i2) ^ dbMask.charCodeAt(i2));
        }
        db = String.fromCharCode(db.charCodeAt(0) & ~mask) + db.substr(1);
        var checkLen = emLen - hLen - sLen - 2;
        for (i2 = 0; i2 < checkLen; i2++) {
          if (db.charCodeAt(i2) !== 0) {
            throw new Error("Leftmost octets not zero as expected");
          }
        }
        if (db.charCodeAt(checkLen) !== 1) {
          throw new Error("Inconsistent PSS signature, 0x01 marker not found");
        }
        var salt = db.substr(-sLen);
        var m_ = new forge2.util.ByteBuffer();
        m_.fillWithByte(0, 8);
        m_.putBytes(mHash);
        m_.putBytes(salt);
        hash.start();
        hash.update(m_.getBytes());
        var h_ = hash.digest().getBytes();
        return h === h_;
      };
      return pssobj;
    };
  }
});

// node_modules/node-forge/lib/x509.js
var require_x509 = __commonJS({
  "node_modules/node-forge/lib/x509.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_asn1();
    require_des();
    require_md();
    require_mgf();
    require_oids();
    require_pem();
    require_pss();
    require_rsa();
    require_util();
    var asn1 = forge2.asn1;
    var pki = module.exports = forge2.pki = forge2.pki || {};
    var oids = pki.oids;
    var _shortNames = {};
    _shortNames["CN"] = oids["commonName"];
    _shortNames["commonName"] = "CN";
    _shortNames["C"] = oids["countryName"];
    _shortNames["countryName"] = "C";
    _shortNames["L"] = oids["localityName"];
    _shortNames["localityName"] = "L";
    _shortNames["ST"] = oids["stateOrProvinceName"];
    _shortNames["stateOrProvinceName"] = "ST";
    _shortNames["O"] = oids["organizationName"];
    _shortNames["organizationName"] = "O";
    _shortNames["OU"] = oids["organizationalUnitName"];
    _shortNames["organizationalUnitName"] = "OU";
    _shortNames["E"] = oids["emailAddress"];
    _shortNames["emailAddress"] = "E";
    var publicKeyValidator = forge2.pki.rsa.publicKeyValidator;
    var x509CertificateValidator = {
      name: "Certificate",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "Certificate.TBSCertificate",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        captureAsn1: "tbsCertificate",
        value: [
          {
            name: "Certificate.TBSCertificate.version",
            tagClass: asn1.Class.CONTEXT_SPECIFIC,
            type: 0,
            constructed: true,
            optional: true,
            value: [{
              name: "Certificate.TBSCertificate.version.integer",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.INTEGER,
              constructed: false,
              capture: "certVersion"
            }]
          },
          {
            name: "Certificate.TBSCertificate.serialNumber",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.INTEGER,
            constructed: false,
            capture: "certSerialNumber"
          },
          {
            name: "Certificate.TBSCertificate.signature",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            value: [{
              name: "Certificate.TBSCertificate.signature.algorithm",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.OID,
              constructed: false,
              capture: "certinfoSignatureOid"
            }, {
              name: "Certificate.TBSCertificate.signature.parameters",
              tagClass: asn1.Class.UNIVERSAL,
              optional: true,
              captureAsn1: "certinfoSignatureParams"
            }]
          },
          {
            name: "Certificate.TBSCertificate.issuer",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            captureAsn1: "certIssuer"
          },
          {
            name: "Certificate.TBSCertificate.validity",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            // Note: UTC and generalized times may both appear so the capture
            // names are based on their detected order, the names used below
            // are only for the common case, which validity time really means
            // "notBefore" and which means "notAfter" will be determined by order
            value: [{
              // notBefore (Time) (UTC time case)
              name: "Certificate.TBSCertificate.validity.notBefore (utc)",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.UTCTIME,
              constructed: false,
              optional: true,
              capture: "certValidity1UTCTime"
            }, {
              // notBefore (Time) (generalized time case)
              name: "Certificate.TBSCertificate.validity.notBefore (generalized)",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.GENERALIZEDTIME,
              constructed: false,
              optional: true,
              capture: "certValidity2GeneralizedTime"
            }, {
              // notAfter (Time) (only UTC time is supported)
              name: "Certificate.TBSCertificate.validity.notAfter (utc)",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.UTCTIME,
              constructed: false,
              optional: true,
              capture: "certValidity3UTCTime"
            }, {
              // notAfter (Time) (only UTC time is supported)
              name: "Certificate.TBSCertificate.validity.notAfter (generalized)",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.GENERALIZEDTIME,
              constructed: false,
              optional: true,
              capture: "certValidity4GeneralizedTime"
            }]
          },
          {
            // Name (subject) (RDNSequence)
            name: "Certificate.TBSCertificate.subject",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            captureAsn1: "certSubject"
          },
          // SubjectPublicKeyInfo
          publicKeyValidator,
          {
            // issuerUniqueID (optional)
            name: "Certificate.TBSCertificate.issuerUniqueID",
            tagClass: asn1.Class.CONTEXT_SPECIFIC,
            type: 1,
            constructed: true,
            optional: true,
            value: [{
              name: "Certificate.TBSCertificate.issuerUniqueID.id",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.BITSTRING,
              constructed: false,
              // TODO: support arbitrary bit length ids
              captureBitStringValue: "certIssuerUniqueId"
            }]
          },
          {
            // subjectUniqueID (optional)
            name: "Certificate.TBSCertificate.subjectUniqueID",
            tagClass: asn1.Class.CONTEXT_SPECIFIC,
            type: 2,
            constructed: true,
            optional: true,
            value: [{
              name: "Certificate.TBSCertificate.subjectUniqueID.id",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.BITSTRING,
              constructed: false,
              // TODO: support arbitrary bit length ids
              captureBitStringValue: "certSubjectUniqueId"
            }]
          },
          {
            // Extensions (optional)
            name: "Certificate.TBSCertificate.extensions",
            tagClass: asn1.Class.CONTEXT_SPECIFIC,
            type: 3,
            constructed: true,
            captureAsn1: "certExtensions",
            optional: true
          }
        ]
      }, {
        // AlgorithmIdentifier (signature algorithm)
        name: "Certificate.signatureAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          // algorithm
          name: "Certificate.signatureAlgorithm.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "certSignatureOid"
        }, {
          name: "Certificate.TBSCertificate.signature.parameters",
          tagClass: asn1.Class.UNIVERSAL,
          optional: true,
          captureAsn1: "certSignatureParams"
        }]
      }, {
        // SignatureValue
        name: "Certificate.signatureValue",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.BITSTRING,
        constructed: false,
        captureBitStringValue: "certSignature"
      }]
    };
    var rsassaPssParameterValidator = {
      name: "rsapss",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "rsapss.hashAlgorithm",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 0,
        constructed: true,
        value: [{
          name: "rsapss.hashAlgorithm.AlgorithmIdentifier",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Class.SEQUENCE,
          constructed: true,
          optional: true,
          value: [{
            name: "rsapss.hashAlgorithm.AlgorithmIdentifier.algorithm",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OID,
            constructed: false,
            capture: "hashOid"
            /* parameter block omitted, for SHA1 NULL anyhow. */
          }]
        }]
      }, {
        name: "rsapss.maskGenAlgorithm",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 1,
        constructed: true,
        value: [{
          name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Class.SEQUENCE,
          constructed: true,
          optional: true,
          value: [{
            name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.algorithm",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OID,
            constructed: false,
            capture: "maskGenOid"
          }, {
            name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.params",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            value: [{
              name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.params.algorithm",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.OID,
              constructed: false,
              capture: "maskGenHashOid"
              /* parameter block omitted, for SHA1 NULL anyhow. */
            }]
          }]
        }]
      }, {
        name: "rsapss.saltLength",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 2,
        optional: true,
        value: [{
          name: "rsapss.saltLength.saltLength",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Class.INTEGER,
          constructed: false,
          capture: "saltLength"
        }]
      }, {
        name: "rsapss.trailerField",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        type: 3,
        optional: true,
        value: [{
          name: "rsapss.trailer.trailer",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Class.INTEGER,
          constructed: false,
          capture: "trailer"
        }]
      }]
    };
    var certificationRequestInfoValidator = {
      name: "CertificationRequestInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "certificationRequestInfo",
      value: [
        {
          name: "CertificationRequestInfo.integer",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.INTEGER,
          constructed: false,
          capture: "certificationRequestInfoVersion"
        },
        {
          // Name (subject) (RDNSequence)
          name: "CertificationRequestInfo.subject",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "certificationRequestInfoSubject"
        },
        // SubjectPublicKeyInfo
        publicKeyValidator,
        {
          name: "CertificationRequestInfo.attributes",
          tagClass: asn1.Class.CONTEXT_SPECIFIC,
          type: 0,
          constructed: true,
          optional: true,
          capture: "certificationRequestInfoAttributes",
          value: [{
            name: "CertificationRequestInfo.attributes",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            value: [{
              name: "CertificationRequestInfo.attributes.type",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.OID,
              constructed: false
            }, {
              name: "CertificationRequestInfo.attributes.value",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.SET,
              constructed: true
            }]
          }]
        }
      ]
    };
    var certificationRequestValidator = {
      name: "CertificationRequest",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "csr",
      value: [
        certificationRequestInfoValidator,
        {
          // AlgorithmIdentifier (signature algorithm)
          name: "CertificationRequest.signatureAlgorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          value: [{
            // algorithm
            name: "CertificationRequest.signatureAlgorithm.algorithm",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OID,
            constructed: false,
            capture: "csrSignatureOid"
          }, {
            name: "CertificationRequest.signatureAlgorithm.parameters",
            tagClass: asn1.Class.UNIVERSAL,
            optional: true,
            captureAsn1: "csrSignatureParams"
          }]
        },
        {
          // signature
          name: "CertificationRequest.signature",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.BITSTRING,
          constructed: false,
          captureBitStringValue: "csrSignature"
        }
      ]
    };
    pki.RDNAttributesAsArray = function(rdn, md) {
      var rval = [];
      var set, attr, obj;
      for (var si = 0; si < rdn.value.length; ++si) {
        set = rdn.value[si];
        for (var i2 = 0; i2 < set.value.length; ++i2) {
          obj = {};
          attr = set.value[i2];
          obj.type = asn1.derToOid(attr.value[0].value);
          obj.value = attr.value[1].value;
          obj.valueTagClass = attr.value[1].type;
          if (obj.type in oids) {
            obj.name = oids[obj.type];
            if (obj.name in _shortNames) {
              obj.shortName = _shortNames[obj.name];
            }
          }
          if (md) {
            md.update(obj.type);
            md.update(obj.value);
          }
          rval.push(obj);
        }
      }
      return rval;
    };
    pki.CRIAttributesAsArray = function(attributes) {
      var rval = [];
      for (var si = 0; si < attributes.length; ++si) {
        var seq = attributes[si];
        var type = asn1.derToOid(seq.value[0].value);
        var values = seq.value[1].value;
        for (var vi = 0; vi < values.length; ++vi) {
          var obj = {};
          obj.type = type;
          obj.value = values[vi].value;
          obj.valueTagClass = values[vi].type;
          if (obj.type in oids) {
            obj.name = oids[obj.type];
            if (obj.name in _shortNames) {
              obj.shortName = _shortNames[obj.name];
            }
          }
          if (obj.type === oids.extensionRequest) {
            obj.extensions = [];
            for (var ei = 0; ei < obj.value.length; ++ei) {
              obj.extensions.push(pki.certificateExtensionFromAsn1(obj.value[ei]));
            }
          }
          rval.push(obj);
        }
      }
      return rval;
    };
    function _getAttribute(obj, options) {
      if (typeof options === "string") {
        options = { shortName: options };
      }
      var rval = null;
      var attr;
      for (var i2 = 0; rval === null && i2 < obj.attributes.length; ++i2) {
        attr = obj.attributes[i2];
        if (options.type && options.type === attr.type) {
          rval = attr;
        } else if (options.name && options.name === attr.name) {
          rval = attr;
        } else if (options.shortName && options.shortName === attr.shortName) {
          rval = attr;
        }
      }
      return rval;
    }
    var _readSignatureParameters = function(oid, obj, fillDefaults) {
      var params = {};
      if (oid !== oids["RSASSA-PSS"]) {
        return params;
      }
      if (fillDefaults) {
        params = {
          hash: {
            algorithmOid: oids["sha1"]
          },
          mgf: {
            algorithmOid: oids["mgf1"],
            hash: {
              algorithmOid: oids["sha1"]
            }
          },
          saltLength: 20
        };
      }
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, rsassaPssParameterValidator, capture, errors)) {
        var error = new Error("Cannot read RSASSA-PSS parameter block.");
        error.errors = errors;
        throw error;
      }
      if (capture.hashOid !== void 0) {
        params.hash = params.hash || {};
        params.hash.algorithmOid = asn1.derToOid(capture.hashOid);
      }
      if (capture.maskGenOid !== void 0) {
        params.mgf = params.mgf || {};
        params.mgf.algorithmOid = asn1.derToOid(capture.maskGenOid);
        params.mgf.hash = params.mgf.hash || {};
        params.mgf.hash.algorithmOid = asn1.derToOid(capture.maskGenHashOid);
      }
      if (capture.saltLength !== void 0) {
        params.saltLength = capture.saltLength.charCodeAt(0);
      }
      return params;
    };
    var _createSignatureDigest = function(options) {
      switch (oids[options.signatureOid]) {
        case "sha1WithRSAEncryption":
        // deprecated alias
        case "sha1WithRSASignature":
          return forge2.md.sha1.create();
        case "md5WithRSAEncryption":
          return forge2.md.md5.create();
        case "sha256WithRSAEncryption":
          return forge2.md.sha256.create();
        case "sha384WithRSAEncryption":
          return forge2.md.sha384.create();
        case "sha512WithRSAEncryption":
          return forge2.md.sha512.create();
        case "RSASSA-PSS":
          return forge2.md.sha256.create();
        default:
          var error = new Error(
            "Could not compute " + options.type + " digest. Unknown signature OID."
          );
          error.signatureOid = options.signatureOid;
          throw error;
      }
    };
    var _verifySignature = function(options) {
      var cert = options.certificate;
      var scheme;
      switch (cert.signatureOid) {
        case oids.sha1WithRSAEncryption:
        // deprecated alias
        case oids.sha1WithRSASignature:
          break;
        case oids["RSASSA-PSS"]:
          var hash, mgf;
          hash = oids[cert.signatureParameters.mgf.hash.algorithmOid];
          if (hash === void 0 || forge2.md[hash] === void 0) {
            var error = new Error("Unsupported MGF hash function.");
            error.oid = cert.signatureParameters.mgf.hash.algorithmOid;
            error.name = hash;
            throw error;
          }
          mgf = oids[cert.signatureParameters.mgf.algorithmOid];
          if (mgf === void 0 || forge2.mgf[mgf] === void 0) {
            var error = new Error("Unsupported MGF function.");
            error.oid = cert.signatureParameters.mgf.algorithmOid;
            error.name = mgf;
            throw error;
          }
          mgf = forge2.mgf[mgf].create(forge2.md[hash].create());
          hash = oids[cert.signatureParameters.hash.algorithmOid];
          if (hash === void 0 || forge2.md[hash] === void 0) {
            var error = new Error("Unsupported RSASSA-PSS hash function.");
            error.oid = cert.signatureParameters.hash.algorithmOid;
            error.name = hash;
            throw error;
          }
          scheme = forge2.pss.create(
            forge2.md[hash].create(),
            mgf,
            cert.signatureParameters.saltLength
          );
          break;
      }
      return cert.publicKey.verify(
        options.md.digest().getBytes(),
        options.signature,
        scheme
      );
    };
    pki.certificateFromPem = function(pem, computeHash, strict) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "CERTIFICATE" && msg.type !== "X509 CERTIFICATE" && msg.type !== "TRUSTED CERTIFICATE") {
        var error = new Error(
          'Could not convert certificate from PEM; PEM header type is not "CERTIFICATE", "X509 CERTIFICATE", or "TRUSTED CERTIFICATE".'
        );
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error(
          "Could not convert certificate from PEM; PEM is encrypted."
        );
      }
      var obj = asn1.fromDer(msg.body, strict);
      return pki.certificateFromAsn1(obj, computeHash);
    };
    pki.certificateToPem = function(cert, maxline) {
      var msg = {
        type: "CERTIFICATE",
        body: asn1.toDer(pki.certificateToAsn1(cert)).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.publicKeyFromPem = function(pem) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "PUBLIC KEY" && msg.type !== "RSA PUBLIC KEY") {
        var error = new Error('Could not convert public key from PEM; PEM header type is not "PUBLIC KEY" or "RSA PUBLIC KEY".');
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert public key from PEM; PEM is encrypted.");
      }
      var obj = asn1.fromDer(msg.body);
      return pki.publicKeyFromAsn1(obj);
    };
    pki.publicKeyToPem = function(key, maxline) {
      var msg = {
        type: "PUBLIC KEY",
        body: asn1.toDer(pki.publicKeyToAsn1(key)).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.publicKeyToRSAPublicKeyPem = function(key, maxline) {
      var msg = {
        type: "RSA PUBLIC KEY",
        body: asn1.toDer(pki.publicKeyToRSAPublicKey(key)).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.getPublicKeyFingerprint = function(key, options) {
      options = options || {};
      var md = options.md || forge2.md.sha1.create();
      var type = options.type || "RSAPublicKey";
      var bytes;
      switch (type) {
        case "RSAPublicKey":
          bytes = asn1.toDer(pki.publicKeyToRSAPublicKey(key)).getBytes();
          break;
        case "SubjectPublicKeyInfo":
          bytes = asn1.toDer(pki.publicKeyToAsn1(key)).getBytes();
          break;
        default:
          throw new Error('Unknown fingerprint type "' + options.type + '".');
      }
      md.start();
      md.update(bytes);
      var digest = md.digest();
      if (options.encoding === "hex") {
        var hex = digest.toHex();
        if (options.delimiter) {
          return hex.match(/.{2}/g).join(options.delimiter);
        }
        return hex;
      } else if (options.encoding === "binary") {
        return digest.getBytes();
      } else if (options.encoding) {
        throw new Error('Unknown encoding "' + options.encoding + '".');
      }
      return digest;
    };
    pki.certificationRequestFromPem = function(pem, computeHash, strict) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "CERTIFICATE REQUEST") {
        var error = new Error('Could not convert certification request from PEM; PEM header type is not "CERTIFICATE REQUEST".');
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert certification request from PEM; PEM is encrypted.");
      }
      var obj = asn1.fromDer(msg.body, strict);
      return pki.certificationRequestFromAsn1(obj, computeHash);
    };
    pki.certificationRequestToPem = function(csr, maxline) {
      var msg = {
        type: "CERTIFICATE REQUEST",
        body: asn1.toDer(pki.certificationRequestToAsn1(csr)).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.createCertificate = function() {
      var cert = {};
      cert.version = 2;
      cert.serialNumber = "00";
      cert.signatureOid = null;
      cert.signature = null;
      cert.siginfo = {};
      cert.siginfo.algorithmOid = null;
      cert.validity = {};
      cert.validity.notBefore = /* @__PURE__ */ new Date();
      cert.validity.notAfter = /* @__PURE__ */ new Date();
      cert.issuer = {};
      cert.issuer.getField = function(sn) {
        return _getAttribute(cert.issuer, sn);
      };
      cert.issuer.addField = function(attr) {
        _fillMissingFields([attr]);
        cert.issuer.attributes.push(attr);
      };
      cert.issuer.attributes = [];
      cert.issuer.hash = null;
      cert.subject = {};
      cert.subject.getField = function(sn) {
        return _getAttribute(cert.subject, sn);
      };
      cert.subject.addField = function(attr) {
        _fillMissingFields([attr]);
        cert.subject.attributes.push(attr);
      };
      cert.subject.attributes = [];
      cert.subject.hash = null;
      cert.extensions = [];
      cert.publicKey = null;
      cert.md = null;
      cert.setSubject = function(attrs, uniqueId) {
        _fillMissingFields(attrs);
        cert.subject.attributes = attrs;
        delete cert.subject.uniqueId;
        if (uniqueId) {
          cert.subject.uniqueId = uniqueId;
        }
        cert.subject.hash = null;
      };
      cert.setIssuer = function(attrs, uniqueId) {
        _fillMissingFields(attrs);
        cert.issuer.attributes = attrs;
        delete cert.issuer.uniqueId;
        if (uniqueId) {
          cert.issuer.uniqueId = uniqueId;
        }
        cert.issuer.hash = null;
      };
      cert.setExtensions = function(exts) {
        for (var i2 = 0; i2 < exts.length; ++i2) {
          _fillMissingExtensionFields(exts[i2], { cert });
        }
        cert.extensions = exts;
      };
      cert.getExtension = function(options) {
        if (typeof options === "string") {
          options = { name: options };
        }
        var rval = null;
        var ext;
        for (var i2 = 0; rval === null && i2 < cert.extensions.length; ++i2) {
          ext = cert.extensions[i2];
          if (options.id && ext.id === options.id) {
            rval = ext;
          } else if (options.name && ext.name === options.name) {
            rval = ext;
          }
        }
        return rval;
      };
      cert.sign = function(key, md) {
        cert.md = md || forge2.md.sha1.create();
        var algorithmOid = oids[cert.md.algorithm + "WithRSAEncryption"];
        if (!algorithmOid) {
          var error = new Error("Could not compute certificate digest. Unknown message digest algorithm OID.");
          error.algorithm = cert.md.algorithm;
          throw error;
        }
        cert.signatureOid = cert.siginfo.algorithmOid = algorithmOid;
        cert.tbsCertificate = pki.getTBSCertificate(cert);
        var bytes = asn1.toDer(cert.tbsCertificate);
        cert.md.update(bytes.getBytes());
        cert.signature = key.sign(cert.md);
      };
      cert.verify = function(child) {
        var rval = false;
        if (!cert.issued(child)) {
          var issuer = child.issuer;
          var subject = cert.subject;
          var error = new Error(
            "The parent certificate did not issue the given child certificate; the child certificate's issuer does not match the parent's subject."
          );
          error.expectedIssuer = subject.attributes;
          error.actualIssuer = issuer.attributes;
          throw error;
        }
        var md = child.md;
        if (md === null) {
          md = _createSignatureDigest({
            signatureOid: child.signatureOid,
            type: "certificate"
          });
          var tbsCertificate = child.tbsCertificate || pki.getTBSCertificate(child);
          var bytes = asn1.toDer(tbsCertificate);
          md.update(bytes.getBytes());
        }
        if (md !== null) {
          rval = _verifySignature({
            certificate: cert,
            md,
            signature: child.signature
          });
        }
        return rval;
      };
      cert.isIssuer = function(parent) {
        var rval = false;
        var i2 = cert.issuer;
        var s = parent.subject;
        if (i2.hash && s.hash) {
          rval = i2.hash === s.hash;
        } else if (i2.attributes.length === s.attributes.length) {
          rval = true;
          var iattr, sattr;
          for (var n = 0; rval && n < i2.attributes.length; ++n) {
            iattr = i2.attributes[n];
            sattr = s.attributes[n];
            if (iattr.type !== sattr.type || iattr.value !== sattr.value) {
              rval = false;
            }
          }
        }
        return rval;
      };
      cert.issued = function(child) {
        return child.isIssuer(cert);
      };
      cert.generateSubjectKeyIdentifier = function() {
        return pki.getPublicKeyFingerprint(cert.publicKey, { type: "RSAPublicKey" });
      };
      cert.verifySubjectKeyIdentifier = function() {
        var oid = oids["subjectKeyIdentifier"];
        for (var i2 = 0; i2 < cert.extensions.length; ++i2) {
          var ext = cert.extensions[i2];
          if (ext.id === oid) {
            var ski = cert.generateSubjectKeyIdentifier().getBytes();
            return forge2.util.hexToBytes(ext.subjectKeyIdentifier) === ski;
          }
        }
        return false;
      };
      return cert;
    };
    pki.certificateFromAsn1 = function(obj, computeHash) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, x509CertificateValidator, capture, errors)) {
        var error = new Error("Cannot read X.509 certificate. ASN.1 object is not an X509v3 Certificate.");
        error.errors = errors;
        throw error;
      }
      var oid = asn1.derToOid(capture.publicKeyOid);
      if (oid !== pki.oids.rsaEncryption) {
        throw new Error("Cannot read public key. OID is not RSA.");
      }
      var cert = pki.createCertificate();
      cert.version = capture.certVersion ? capture.certVersion.charCodeAt(0) : 0;
      var serial = forge2.util.createBuffer(capture.certSerialNumber);
      cert.serialNumber = serial.toHex();
      cert.signatureOid = forge2.asn1.derToOid(capture.certSignatureOid);
      cert.signatureParameters = _readSignatureParameters(
        cert.signatureOid,
        capture.certSignatureParams,
        true
      );
      cert.siginfo.algorithmOid = forge2.asn1.derToOid(capture.certinfoSignatureOid);
      cert.siginfo.parameters = _readSignatureParameters(
        cert.siginfo.algorithmOid,
        capture.certinfoSignatureParams,
        false
      );
      cert.signature = capture.certSignature;
      var validity = [];
      if (capture.certValidity1UTCTime !== void 0) {
        validity.push(asn1.utcTimeToDate(capture.certValidity1UTCTime));
      }
      if (capture.certValidity2GeneralizedTime !== void 0) {
        validity.push(asn1.generalizedTimeToDate(
          capture.certValidity2GeneralizedTime
        ));
      }
      if (capture.certValidity3UTCTime !== void 0) {
        validity.push(asn1.utcTimeToDate(capture.certValidity3UTCTime));
      }
      if (capture.certValidity4GeneralizedTime !== void 0) {
        validity.push(asn1.generalizedTimeToDate(
          capture.certValidity4GeneralizedTime
        ));
      }
      if (validity.length > 2) {
        throw new Error("Cannot read notBefore/notAfter validity times; more than two times were provided in the certificate.");
      }
      if (validity.length < 2) {
        throw new Error("Cannot read notBefore/notAfter validity times; they were not provided as either UTCTime or GeneralizedTime.");
      }
      cert.validity.notBefore = validity[0];
      cert.validity.notAfter = validity[1];
      cert.tbsCertificate = capture.tbsCertificate;
      if (computeHash) {
        cert.md = _createSignatureDigest({
          signatureOid: cert.signatureOid,
          type: "certificate"
        });
        var bytes = asn1.toDer(cert.tbsCertificate);
        cert.md.update(bytes.getBytes());
      }
      var imd = forge2.md.sha1.create();
      var ibytes = asn1.toDer(capture.certIssuer);
      imd.update(ibytes.getBytes());
      cert.issuer.getField = function(sn) {
        return _getAttribute(cert.issuer, sn);
      };
      cert.issuer.addField = function(attr) {
        _fillMissingFields([attr]);
        cert.issuer.attributes.push(attr);
      };
      cert.issuer.attributes = pki.RDNAttributesAsArray(capture.certIssuer);
      if (capture.certIssuerUniqueId) {
        cert.issuer.uniqueId = capture.certIssuerUniqueId;
      }
      cert.issuer.hash = imd.digest().toHex();
      var smd = forge2.md.sha1.create();
      var sbytes = asn1.toDer(capture.certSubject);
      smd.update(sbytes.getBytes());
      cert.subject.getField = function(sn) {
        return _getAttribute(cert.subject, sn);
      };
      cert.subject.addField = function(attr) {
        _fillMissingFields([attr]);
        cert.subject.attributes.push(attr);
      };
      cert.subject.attributes = pki.RDNAttributesAsArray(capture.certSubject);
      if (capture.certSubjectUniqueId) {
        cert.subject.uniqueId = capture.certSubjectUniqueId;
      }
      cert.subject.hash = smd.digest().toHex();
      if (capture.certExtensions) {
        cert.extensions = pki.certificateExtensionsFromAsn1(capture.certExtensions);
      } else {
        cert.extensions = [];
      }
      cert.publicKey = pki.publicKeyFromAsn1(capture.subjectPublicKeyInfo);
      return cert;
    };
    pki.certificateExtensionsFromAsn1 = function(exts) {
      var rval = [];
      for (var i2 = 0; i2 < exts.value.length; ++i2) {
        var extseq = exts.value[i2];
        for (var ei = 0; ei < extseq.value.length; ++ei) {
          rval.push(pki.certificateExtensionFromAsn1(extseq.value[ei]));
        }
      }
      return rval;
    };
    pki.certificateExtensionFromAsn1 = function(ext) {
      var e = {};
      e.id = asn1.derToOid(ext.value[0].value);
      e.critical = false;
      if (ext.value[1].type === asn1.Type.BOOLEAN) {
        e.critical = ext.value[1].value.charCodeAt(0) !== 0;
        e.value = ext.value[2].value;
      } else {
        e.value = ext.value[1].value;
      }
      if (e.id in oids) {
        e.name = oids[e.id];
        if (e.name === "keyUsage") {
          var ev = asn1.fromDer(e.value);
          var b2 = 0;
          var b3 = 0;
          if (ev.value.length > 1) {
            b2 = ev.value.charCodeAt(1);
            b3 = ev.value.length > 2 ? ev.value.charCodeAt(2) : 0;
          }
          e.digitalSignature = (b2 & 128) === 128;
          e.nonRepudiation = (b2 & 64) === 64;
          e.keyEncipherment = (b2 & 32) === 32;
          e.dataEncipherment = (b2 & 16) === 16;
          e.keyAgreement = (b2 & 8) === 8;
          e.keyCertSign = (b2 & 4) === 4;
          e.cRLSign = (b2 & 2) === 2;
          e.encipherOnly = (b2 & 1) === 1;
          e.decipherOnly = (b3 & 128) === 128;
        } else if (e.name === "basicConstraints") {
          var ev = asn1.fromDer(e.value);
          if (ev.value.length > 0 && ev.value[0].type === asn1.Type.BOOLEAN) {
            e.cA = ev.value[0].value.charCodeAt(0) !== 0;
          } else {
            e.cA = false;
          }
          var value = null;
          if (ev.value.length > 0 && ev.value[0].type === asn1.Type.INTEGER) {
            value = ev.value[0].value;
          } else if (ev.value.length > 1) {
            value = ev.value[1].value;
          }
          if (value !== null) {
            e.pathLenConstraint = asn1.derToInteger(value);
          }
        } else if (e.name === "extKeyUsage") {
          var ev = asn1.fromDer(e.value);
          for (var vi = 0; vi < ev.value.length; ++vi) {
            var oid = asn1.derToOid(ev.value[vi].value);
            if (oid in oids) {
              e[oids[oid]] = true;
            } else {
              e[oid] = true;
            }
          }
        } else if (e.name === "nsCertType") {
          var ev = asn1.fromDer(e.value);
          var b2 = 0;
          if (ev.value.length > 1) {
            b2 = ev.value.charCodeAt(1);
          }
          e.client = (b2 & 128) === 128;
          e.server = (b2 & 64) === 64;
          e.email = (b2 & 32) === 32;
          e.objsign = (b2 & 16) === 16;
          e.reserved = (b2 & 8) === 8;
          e.sslCA = (b2 & 4) === 4;
          e.emailCA = (b2 & 2) === 2;
          e.objCA = (b2 & 1) === 1;
        } else if (e.name === "subjectAltName" || e.name === "issuerAltName") {
          e.altNames = [];
          var gn;
          var ev = asn1.fromDer(e.value);
          for (var n = 0; n < ev.value.length; ++n) {
            gn = ev.value[n];
            var altName = {
              type: gn.type,
              value: gn.value
            };
            e.altNames.push(altName);
            switch (gn.type) {
              // rfc822Name
              case 1:
              // dNSName
              case 2:
              // uniformResourceIdentifier (URI)
              case 6:
                break;
              // IPAddress
              case 7:
                altName.ip = forge2.util.bytesToIP(gn.value);
                break;
              // registeredID
              case 8:
                altName.oid = asn1.derToOid(gn.value);
                break;
              default:
            }
          }
        } else if (e.name === "subjectKeyIdentifier") {
          var ev = asn1.fromDer(e.value);
          e.subjectKeyIdentifier = forge2.util.bytesToHex(ev.value);
        }
      }
      return e;
    };
    pki.certificationRequestFromAsn1 = function(obj, computeHash) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, certificationRequestValidator, capture, errors)) {
        var error = new Error("Cannot read PKCS#10 certificate request. ASN.1 object is not a PKCS#10 CertificationRequest.");
        error.errors = errors;
        throw error;
      }
      var oid = asn1.derToOid(capture.publicKeyOid);
      if (oid !== pki.oids.rsaEncryption) {
        throw new Error("Cannot read public key. OID is not RSA.");
      }
      var csr = pki.createCertificationRequest();
      csr.version = capture.csrVersion ? capture.csrVersion.charCodeAt(0) : 0;
      csr.signatureOid = forge2.asn1.derToOid(capture.csrSignatureOid);
      csr.signatureParameters = _readSignatureParameters(
        csr.signatureOid,
        capture.csrSignatureParams,
        true
      );
      csr.siginfo.algorithmOid = forge2.asn1.derToOid(capture.csrSignatureOid);
      csr.siginfo.parameters = _readSignatureParameters(
        csr.siginfo.algorithmOid,
        capture.csrSignatureParams,
        false
      );
      csr.signature = capture.csrSignature;
      csr.certificationRequestInfo = capture.certificationRequestInfo;
      if (computeHash) {
        csr.md = _createSignatureDigest({
          signatureOid: csr.signatureOid,
          type: "certification request"
        });
        var bytes = asn1.toDer(csr.certificationRequestInfo);
        csr.md.update(bytes.getBytes());
      }
      var smd = forge2.md.sha1.create();
      csr.subject.getField = function(sn) {
        return _getAttribute(csr.subject, sn);
      };
      csr.subject.addField = function(attr) {
        _fillMissingFields([attr]);
        csr.subject.attributes.push(attr);
      };
      csr.subject.attributes = pki.RDNAttributesAsArray(
        capture.certificationRequestInfoSubject,
        smd
      );
      csr.subject.hash = smd.digest().toHex();
      csr.publicKey = pki.publicKeyFromAsn1(capture.subjectPublicKeyInfo);
      csr.getAttribute = function(sn) {
        return _getAttribute(csr, sn);
      };
      csr.addAttribute = function(attr) {
        _fillMissingFields([attr]);
        csr.attributes.push(attr);
      };
      csr.attributes = pki.CRIAttributesAsArray(
        capture.certificationRequestInfoAttributes || []
      );
      return csr;
    };
    pki.createCertificationRequest = function() {
      var csr = {};
      csr.version = 0;
      csr.signatureOid = null;
      csr.signature = null;
      csr.siginfo = {};
      csr.siginfo.algorithmOid = null;
      csr.subject = {};
      csr.subject.getField = function(sn) {
        return _getAttribute(csr.subject, sn);
      };
      csr.subject.addField = function(attr) {
        _fillMissingFields([attr]);
        csr.subject.attributes.push(attr);
      };
      csr.subject.attributes = [];
      csr.subject.hash = null;
      csr.publicKey = null;
      csr.attributes = [];
      csr.getAttribute = function(sn) {
        return _getAttribute(csr, sn);
      };
      csr.addAttribute = function(attr) {
        _fillMissingFields([attr]);
        csr.attributes.push(attr);
      };
      csr.md = null;
      csr.setSubject = function(attrs) {
        _fillMissingFields(attrs);
        csr.subject.attributes = attrs;
        csr.subject.hash = null;
      };
      csr.setAttributes = function(attrs) {
        _fillMissingFields(attrs);
        csr.attributes = attrs;
      };
      csr.sign = function(key, md) {
        csr.md = md || forge2.md.sha1.create();
        var algorithmOid = oids[csr.md.algorithm + "WithRSAEncryption"];
        if (!algorithmOid) {
          var error = new Error("Could not compute certification request digest. Unknown message digest algorithm OID.");
          error.algorithm = csr.md.algorithm;
          throw error;
        }
        csr.signatureOid = csr.siginfo.algorithmOid = algorithmOid;
        csr.certificationRequestInfo = pki.getCertificationRequestInfo(csr);
        var bytes = asn1.toDer(csr.certificationRequestInfo);
        csr.md.update(bytes.getBytes());
        csr.signature = key.sign(csr.md);
      };
      csr.verify = function() {
        var rval = false;
        var md = csr.md;
        if (md === null) {
          md = _createSignatureDigest({
            signatureOid: csr.signatureOid,
            type: "certification request"
          });
          var cri = csr.certificationRequestInfo || pki.getCertificationRequestInfo(csr);
          var bytes = asn1.toDer(cri);
          md.update(bytes.getBytes());
        }
        if (md !== null) {
          rval = _verifySignature({
            certificate: csr,
            md,
            signature: csr.signature
          });
        }
        return rval;
      };
      return csr;
    };
    function _dnToAsn1(obj) {
      var rval = asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.SEQUENCE,
        true,
        []
      );
      var attr, set;
      var attrs = obj.attributes;
      for (var i2 = 0; i2 < attrs.length; ++i2) {
        attr = attrs[i2];
        var value = attr.value;
        var valueTagClass = asn1.Type.PRINTABLESTRING;
        if ("valueTagClass" in attr) {
          valueTagClass = attr.valueTagClass;
          if (valueTagClass === asn1.Type.UTF8) {
            value = forge2.util.encodeUtf8(value);
          }
        }
        set = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // AttributeType
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(attr.type).getBytes()
            ),
            // AttributeValue
            asn1.create(asn1.Class.UNIVERSAL, valueTagClass, false, value)
          ])
        ]);
        rval.value.push(set);
      }
      return rval;
    }
    function _fillMissingFields(attrs) {
      var attr;
      for (var i2 = 0; i2 < attrs.length; ++i2) {
        attr = attrs[i2];
        if (typeof attr.name === "undefined") {
          if (attr.type && attr.type in pki.oids) {
            attr.name = pki.oids[attr.type];
          } else if (attr.shortName && attr.shortName in _shortNames) {
            attr.name = pki.oids[_shortNames[attr.shortName]];
          }
        }
        if (typeof attr.type === "undefined") {
          if (attr.name && attr.name in pki.oids) {
            attr.type = pki.oids[attr.name];
          } else {
            var error = new Error("Attribute type not specified.");
            error.attribute = attr;
            throw error;
          }
        }
        if (typeof attr.shortName === "undefined") {
          if (attr.name && attr.name in _shortNames) {
            attr.shortName = _shortNames[attr.name];
          }
        }
        if (attr.type === oids.extensionRequest) {
          attr.valueConstructed = true;
          attr.valueTagClass = asn1.Type.SEQUENCE;
          if (!attr.value && attr.extensions) {
            attr.value = [];
            for (var ei = 0; ei < attr.extensions.length; ++ei) {
              attr.value.push(pki.certificateExtensionToAsn1(
                _fillMissingExtensionFields(attr.extensions[ei])
              ));
            }
          }
        }
        if (typeof attr.value === "undefined") {
          var error = new Error("Attribute value not specified.");
          error.attribute = attr;
          throw error;
        }
      }
    }
    function _fillMissingExtensionFields(e, options) {
      options = options || {};
      if (typeof e.name === "undefined") {
        if (e.id && e.id in pki.oids) {
          e.name = pki.oids[e.id];
        }
      }
      if (typeof e.id === "undefined") {
        if (e.name && e.name in pki.oids) {
          e.id = pki.oids[e.name];
        } else {
          var error = new Error("Extension ID not specified.");
          error.extension = e;
          throw error;
        }
      }
      if (typeof e.value !== "undefined") {
        return e;
      }
      if (e.name === "keyUsage") {
        var unused = 0;
        var b2 = 0;
        var b3 = 0;
        if (e.digitalSignature) {
          b2 |= 128;
          unused = 7;
        }
        if (e.nonRepudiation) {
          b2 |= 64;
          unused = 6;
        }
        if (e.keyEncipherment) {
          b2 |= 32;
          unused = 5;
        }
        if (e.dataEncipherment) {
          b2 |= 16;
          unused = 4;
        }
        if (e.keyAgreement) {
          b2 |= 8;
          unused = 3;
        }
        if (e.keyCertSign) {
          b2 |= 4;
          unused = 2;
        }
        if (e.cRLSign) {
          b2 |= 2;
          unused = 1;
        }
        if (e.encipherOnly) {
          b2 |= 1;
          unused = 0;
        }
        if (e.decipherOnly) {
          b3 |= 128;
          unused = 7;
        }
        var value = String.fromCharCode(unused);
        if (b3 !== 0) {
          value += String.fromCharCode(b2) + String.fromCharCode(b3);
        } else if (b2 !== 0) {
          value += String.fromCharCode(b2);
        }
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          value
        );
      } else if (e.name === "basicConstraints") {
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          []
        );
        if (e.cA) {
          e.value.value.push(asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.BOOLEAN,
            false,
            String.fromCharCode(255)
          ));
        }
        if ("pathLenConstraint" in e) {
          e.value.value.push(asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            asn1.integerToDer(e.pathLenConstraint).getBytes()
          ));
        }
      } else if (e.name === "extKeyUsage") {
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          []
        );
        var seq = e.value.value;
        for (var key in e) {
          if (e[key] !== true) {
            continue;
          }
          if (key in oids) {
            seq.push(asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(oids[key]).getBytes()
            ));
          } else if (key.indexOf(".") !== -1) {
            seq.push(asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(key).getBytes()
            ));
          }
        }
      } else if (e.name === "nsCertType") {
        var unused = 0;
        var b2 = 0;
        if (e.client) {
          b2 |= 128;
          unused = 7;
        }
        if (e.server) {
          b2 |= 64;
          unused = 6;
        }
        if (e.email) {
          b2 |= 32;
          unused = 5;
        }
        if (e.objsign) {
          b2 |= 16;
          unused = 4;
        }
        if (e.reserved) {
          b2 |= 8;
          unused = 3;
        }
        if (e.sslCA) {
          b2 |= 4;
          unused = 2;
        }
        if (e.emailCA) {
          b2 |= 2;
          unused = 1;
        }
        if (e.objCA) {
          b2 |= 1;
          unused = 0;
        }
        var value = String.fromCharCode(unused);
        if (b2 !== 0) {
          value += String.fromCharCode(b2);
        }
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          value
        );
      } else if (e.name === "subjectAltName" || e.name === "issuerAltName") {
        e.value = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []);
        var altName;
        for (var n = 0; n < e.altNames.length; ++n) {
          altName = e.altNames[n];
          var value = altName.value;
          if (altName.type === 7 && altName.ip) {
            value = forge2.util.bytesFromIP(altName.ip);
            if (value === null) {
              var error = new Error(
                'Extension "ip" value is not a valid IPv4 or IPv6 address.'
              );
              error.extension = e;
              throw error;
            }
          } else if (altName.type === 8) {
            if (altName.oid) {
              value = asn1.oidToDer(asn1.oidToDer(altName.oid));
            } else {
              value = asn1.oidToDer(value);
            }
          }
          e.value.value.push(asn1.create(
            asn1.Class.CONTEXT_SPECIFIC,
            altName.type,
            false,
            value
          ));
        }
      } else if (e.name === "nsComment" && options.cert) {
        if (!/^[\x00-\x7F]*$/.test(e.comment) || e.comment.length < 1 || e.comment.length > 128) {
          throw new Error('Invalid "nsComment" content.');
        }
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.IA5STRING,
          false,
          e.comment
        );
      } else if (e.name === "subjectKeyIdentifier" && options.cert) {
        var ski = options.cert.generateSubjectKeyIdentifier();
        e.subjectKeyIdentifier = ski.toHex();
        e.value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          ski.getBytes()
        );
      } else if (e.name === "authorityKeyIdentifier" && options.cert) {
        e.value = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []);
        var seq = e.value.value;
        if (e.keyIdentifier) {
          var keyIdentifier = e.keyIdentifier === true ? options.cert.generateSubjectKeyIdentifier().getBytes() : e.keyIdentifier;
          seq.push(
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, false, keyIdentifier)
          );
        }
        if (e.authorityCertIssuer) {
          var authorityCertIssuer = [
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 4, true, [
              _dnToAsn1(e.authorityCertIssuer === true ? options.cert.issuer : e.authorityCertIssuer)
            ])
          ];
          seq.push(
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, authorityCertIssuer)
          );
        }
        if (e.serialNumber) {
          var serialNumber = forge2.util.hexToBytes(e.serialNumber === true ? options.cert.serialNumber : e.serialNumber);
          seq.push(
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 2, false, serialNumber)
          );
        }
      } else if (e.name === "cRLDistributionPoints") {
        e.value = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []);
        var seq = e.value.value;
        var subSeq = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          []
        );
        var fullNameGeneralNames = asn1.create(
          asn1.Class.CONTEXT_SPECIFIC,
          0,
          true,
          []
        );
        var altName;
        for (var n = 0; n < e.altNames.length; ++n) {
          altName = e.altNames[n];
          var value = altName.value;
          if (altName.type === 7 && altName.ip) {
            value = forge2.util.bytesFromIP(altName.ip);
            if (value === null) {
              var error = new Error(
                'Extension "ip" value is not a valid IPv4 or IPv6 address.'
              );
              error.extension = e;
              throw error;
            }
          } else if (altName.type === 8) {
            if (altName.oid) {
              value = asn1.oidToDer(asn1.oidToDer(altName.oid));
            } else {
              value = asn1.oidToDer(value);
            }
          }
          fullNameGeneralNames.value.push(asn1.create(
            asn1.Class.CONTEXT_SPECIFIC,
            altName.type,
            false,
            value
          ));
        }
        subSeq.value.push(asn1.create(
          asn1.Class.CONTEXT_SPECIFIC,
          0,
          true,
          [fullNameGeneralNames]
        ));
        seq.push(subSeq);
      }
      if (typeof e.value === "undefined") {
        var error = new Error("Extension value not specified.");
        error.extension = e;
        throw error;
      }
      return e;
    }
    function _signatureParametersToAsn1(oid, params) {
      switch (oid) {
        case oids["RSASSA-PSS"]:
          var parts = [];
          if (params.hash.algorithmOid !== void 0) {
            parts.push(asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(params.hash.algorithmOid).getBytes()
                ),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
              ])
            ]));
          }
          if (params.mgf.algorithmOid !== void 0) {
            parts.push(asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(params.mgf.algorithmOid).getBytes()
                ),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                  asn1.create(
                    asn1.Class.UNIVERSAL,
                    asn1.Type.OID,
                    false,
                    asn1.oidToDer(params.mgf.hash.algorithmOid).getBytes()
                  ),
                  asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
                ])
              ])
            ]));
          }
          if (params.saltLength !== void 0) {
            parts.push(asn1.create(asn1.Class.CONTEXT_SPECIFIC, 2, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.INTEGER,
                false,
                asn1.integerToDer(params.saltLength).getBytes()
              )
            ]));
          }
          return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, parts);
        default:
          return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "");
      }
    }
    function _CRIAttributesToAsn1(csr) {
      var rval = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, []);
      if (csr.attributes.length === 0) {
        return rval;
      }
      var attrs = csr.attributes;
      for (var i2 = 0; i2 < attrs.length; ++i2) {
        var attr = attrs[i2];
        var value = attr.value;
        var valueTagClass = asn1.Type.UTF8;
        if ("valueTagClass" in attr) {
          valueTagClass = attr.valueTagClass;
        }
        if (valueTagClass === asn1.Type.UTF8) {
          value = forge2.util.encodeUtf8(value);
        }
        var valueConstructed = false;
        if ("valueConstructed" in attr) {
          valueConstructed = attr.valueConstructed;
        }
        var seq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // AttributeType
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(attr.type).getBytes()
          ),
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
            // AttributeValue
            asn1.create(
              asn1.Class.UNIVERSAL,
              valueTagClass,
              valueConstructed,
              value
            )
          ])
        ]);
        rval.value.push(seq);
      }
      return rval;
    }
    var jan_1_1950 = /* @__PURE__ */ new Date("1950-01-01T00:00:00Z");
    var jan_1_2050 = /* @__PURE__ */ new Date("2050-01-01T00:00:00Z");
    function _dateToAsn1(date) {
      if (date >= jan_1_1950 && date < jan_1_2050) {
        return asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.UTCTIME,
          false,
          asn1.dateToUtcTime(date)
        );
      } else {
        return asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.GENERALIZEDTIME,
          false,
          asn1.dateToGeneralizedTime(date)
        );
      }
    }
    pki.getTBSCertificate = function(cert) {
      var notBefore = _dateToAsn1(cert.validity.notBefore);
      var notAfter = _dateToAsn1(cert.validity.notAfter);
      var tbs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
          // integer
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            asn1.integerToDer(cert.version).getBytes()
          )
        ]),
        // serialNumber
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          forge2.util.hexToBytes(cert.serialNumber)
        ),
        // signature
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(cert.siginfo.algorithmOid).getBytes()
          ),
          // parameters
          _signatureParametersToAsn1(
            cert.siginfo.algorithmOid,
            cert.siginfo.parameters
          )
        ]),
        // issuer
        _dnToAsn1(cert.issuer),
        // validity
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          notBefore,
          notAfter
        ]),
        // subject
        _dnToAsn1(cert.subject),
        // SubjectPublicKeyInfo
        pki.publicKeyToAsn1(cert.publicKey)
      ]);
      if (cert.issuer.uniqueId) {
        tbs.value.push(
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.BITSTRING,
              false,
              // TODO: support arbitrary bit length ids
              String.fromCharCode(0) + cert.issuer.uniqueId
            )
          ])
        );
      }
      if (cert.subject.uniqueId) {
        tbs.value.push(
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 2, true, [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.BITSTRING,
              false,
              // TODO: support arbitrary bit length ids
              String.fromCharCode(0) + cert.subject.uniqueId
            )
          ])
        );
      }
      if (cert.extensions.length > 0) {
        tbs.value.push(pki.certificateExtensionsToAsn1(cert.extensions));
      }
      return tbs;
    };
    pki.getCertificationRequestInfo = function(csr) {
      var cri = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(csr.version).getBytes()
        ),
        // subject
        _dnToAsn1(csr.subject),
        // SubjectPublicKeyInfo
        pki.publicKeyToAsn1(csr.publicKey),
        // attributes
        _CRIAttributesToAsn1(csr)
      ]);
      return cri;
    };
    pki.distinguishedNameToAsn1 = function(dn) {
      return _dnToAsn1(dn);
    };
    pki.certificateToAsn1 = function(cert) {
      var tbsCertificate = cert.tbsCertificate || pki.getTBSCertificate(cert);
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // TBSCertificate
        tbsCertificate,
        // AlgorithmIdentifier (signature algorithm)
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(cert.signatureOid).getBytes()
          ),
          // parameters
          _signatureParametersToAsn1(cert.signatureOid, cert.signatureParameters)
        ]),
        // SignatureValue
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          String.fromCharCode(0) + cert.signature
        )
      ]);
    };
    pki.certificateExtensionsToAsn1 = function(exts) {
      var rval = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 3, true, []);
      var seq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []);
      rval.value.push(seq);
      for (var i2 = 0; i2 < exts.length; ++i2) {
        seq.value.push(pki.certificateExtensionToAsn1(exts[i2]));
      }
      return rval;
    };
    pki.certificateExtensionToAsn1 = function(ext) {
      var extseq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []);
      extseq.value.push(asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer(ext.id).getBytes()
      ));
      if (ext.critical) {
        extseq.value.push(asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BOOLEAN,
          false,
          String.fromCharCode(255)
        ));
      }
      var value = ext.value;
      if (typeof ext.value !== "string") {
        value = asn1.toDer(value).getBytes();
      }
      extseq.value.push(asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OCTETSTRING,
        false,
        value
      ));
      return extseq;
    };
    pki.certificationRequestToAsn1 = function(csr) {
      var cri = csr.certificationRequestInfo || pki.getCertificationRequestInfo(csr);
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // CertificationRequestInfo
        cri,
        // AlgorithmIdentifier (signature algorithm)
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(csr.signatureOid).getBytes()
          ),
          // parameters
          _signatureParametersToAsn1(csr.signatureOid, csr.signatureParameters)
        ]),
        // signature
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          String.fromCharCode(0) + csr.signature
        )
      ]);
    };
    pki.createCaStore = function(certs) {
      var caStore = {
        // stored certificates
        certs: {}
      };
      caStore.getIssuer = function(cert2) {
        var rval = getBySubject(cert2.issuer);
        return rval;
      };
      caStore.addCertificate = function(cert2) {
        if (typeof cert2 === "string") {
          cert2 = forge2.pki.certificateFromPem(cert2);
        }
        ensureSubjectHasHash(cert2.subject);
        if (!caStore.hasCertificate(cert2)) {
          if (cert2.subject.hash in caStore.certs) {
            var tmp = caStore.certs[cert2.subject.hash];
            if (!forge2.util.isArray(tmp)) {
              tmp = [tmp];
            }
            tmp.push(cert2);
            caStore.certs[cert2.subject.hash] = tmp;
          } else {
            caStore.certs[cert2.subject.hash] = cert2;
          }
        }
      };
      caStore.hasCertificate = function(cert2) {
        if (typeof cert2 === "string") {
          cert2 = forge2.pki.certificateFromPem(cert2);
        }
        var match = getBySubject(cert2.subject);
        if (!match) {
          return false;
        }
        if (!forge2.util.isArray(match)) {
          match = [match];
        }
        var der1 = asn1.toDer(pki.certificateToAsn1(cert2)).getBytes();
        for (var i3 = 0; i3 < match.length; ++i3) {
          var der2 = asn1.toDer(pki.certificateToAsn1(match[i3])).getBytes();
          if (der1 === der2) {
            return true;
          }
        }
        return false;
      };
      caStore.listAllCertificates = function() {
        var certList = [];
        for (var hash in caStore.certs) {
          if (caStore.certs.hasOwnProperty(hash)) {
            var value = caStore.certs[hash];
            if (!forge2.util.isArray(value)) {
              certList.push(value);
            } else {
              for (var i3 = 0; i3 < value.length; ++i3) {
                certList.push(value[i3]);
              }
            }
          }
        }
        return certList;
      };
      caStore.removeCertificate = function(cert2) {
        var result;
        if (typeof cert2 === "string") {
          cert2 = forge2.pki.certificateFromPem(cert2);
        }
        ensureSubjectHasHash(cert2.subject);
        if (!caStore.hasCertificate(cert2)) {
          return null;
        }
        var match = getBySubject(cert2.subject);
        if (!forge2.util.isArray(match)) {
          result = caStore.certs[cert2.subject.hash];
          delete caStore.certs[cert2.subject.hash];
          return result;
        }
        var der1 = asn1.toDer(pki.certificateToAsn1(cert2)).getBytes();
        for (var i3 = 0; i3 < match.length; ++i3) {
          var der2 = asn1.toDer(pki.certificateToAsn1(match[i3])).getBytes();
          if (der1 === der2) {
            result = match[i3];
            match.splice(i3, 1);
          }
        }
        if (match.length === 0) {
          delete caStore.certs[cert2.subject.hash];
        }
        return result;
      };
      function getBySubject(subject) {
        ensureSubjectHasHash(subject);
        return caStore.certs[subject.hash] || null;
      }
      function ensureSubjectHasHash(subject) {
        if (!subject.hash) {
          var md = forge2.md.sha1.create();
          subject.attributes = pki.RDNAttributesAsArray(_dnToAsn1(subject), md);
          subject.hash = md.digest().toHex();
        }
      }
      if (certs) {
        for (var i2 = 0; i2 < certs.length; ++i2) {
          var cert = certs[i2];
          caStore.addCertificate(cert);
        }
      }
      return caStore;
    };
    pki.certificateError = {
      bad_certificate: "forge.pki.BadCertificate",
      unsupported_certificate: "forge.pki.UnsupportedCertificate",
      certificate_revoked: "forge.pki.CertificateRevoked",
      certificate_expired: "forge.pki.CertificateExpired",
      certificate_unknown: "forge.pki.CertificateUnknown",
      unknown_ca: "forge.pki.UnknownCertificateAuthority"
    };
    pki.verifyCertificateChain = function(caStore, chain, options) {
      if (typeof options === "function") {
        options = { verify: options };
      }
      options = options || {};
      chain = chain.slice(0);
      var certs = chain.slice(0);
      var validityCheckDate = options.validityCheckDate;
      if (typeof validityCheckDate === "undefined") {
        validityCheckDate = /* @__PURE__ */ new Date();
      }
      var first = true;
      var error = null;
      var depth = 0;
      do {
        var cert = chain.shift();
        var parent = null;
        var selfSigned = false;
        if (validityCheckDate) {
          if (validityCheckDate < cert.validity.notBefore || validityCheckDate > cert.validity.notAfter) {
            error = {
              message: "Certificate is not valid yet or has expired.",
              error: pki.certificateError.certificate_expired,
              notBefore: cert.validity.notBefore,
              notAfter: cert.validity.notAfter,
              // TODO: we might want to reconsider renaming 'now' to
              // 'validityCheckDate' should this API be changed in the future.
              now: validityCheckDate
            };
          }
        }
        if (error === null) {
          parent = chain[0] || caStore.getIssuer(cert);
          if (parent === null) {
            if (cert.isIssuer(cert)) {
              selfSigned = true;
              parent = cert;
            }
          }
          if (parent) {
            var parents = parent;
            if (!forge2.util.isArray(parents)) {
              parents = [parents];
            }
            var verified = false;
            while (!verified && parents.length > 0) {
              parent = parents.shift();
              try {
                verified = parent.verify(cert);
              } catch (ex) {
              }
            }
            if (!verified) {
              error = {
                message: "Certificate signature is invalid.",
                error: pki.certificateError.bad_certificate
              };
            }
          }
          if (error === null && (!parent || selfSigned) && !caStore.hasCertificate(cert)) {
            error = {
              message: "Certificate is not trusted.",
              error: pki.certificateError.unknown_ca
            };
          }
        }
        if (error === null && parent && !cert.isIssuer(parent)) {
          error = {
            message: "Certificate issuer is invalid.",
            error: pki.certificateError.bad_certificate
          };
        }
        if (error === null) {
          var se = {
            keyUsage: true,
            basicConstraints: true
          };
          for (var i2 = 0; error === null && i2 < cert.extensions.length; ++i2) {
            var ext = cert.extensions[i2];
            if (ext.critical && !(ext.name in se)) {
              error = {
                message: "Certificate has an unsupported critical extension.",
                error: pki.certificateError.unsupported_certificate
              };
            }
          }
        }
        if (error === null && (!first || chain.length === 0 && (!parent || selfSigned))) {
          var bcExt = cert.getExtension("basicConstraints");
          var keyUsageExt = cert.getExtension("keyUsage");
          if (keyUsageExt !== null) {
            if (!keyUsageExt.keyCertSign || bcExt === null) {
              error = {
                message: "Certificate keyUsage or basicConstraints conflict or indicate that the certificate is not a CA. If the certificate is the only one in the chain or isn't the first then the certificate must be a valid CA.",
                error: pki.certificateError.bad_certificate
              };
            }
          }
          if (error === null && bcExt !== null && !bcExt.cA) {
            error = {
              message: "Certificate basicConstraints indicates the certificate is not a CA.",
              error: pki.certificateError.bad_certificate
            };
          }
          if (error === null && keyUsageExt !== null && "pathLenConstraint" in bcExt) {
            var pathLen = depth - 1;
            if (pathLen > bcExt.pathLenConstraint) {
              error = {
                message: "Certificate basicConstraints pathLenConstraint violated.",
                error: pki.certificateError.bad_certificate
              };
            }
          }
        }
        var vfd = error === null ? true : error.error;
        var ret = options.verify ? options.verify(vfd, depth, certs) : vfd;
        if (ret === true) {
          error = null;
        } else {
          if (vfd === true) {
            error = {
              message: "The application rejected the certificate.",
              error: pki.certificateError.bad_certificate
            };
          }
          if (ret || ret === 0) {
            if (typeof ret === "object" && !forge2.util.isArray(ret)) {
              if (ret.message) {
                error.message = ret.message;
              }
              if (ret.error) {
                error.error = ret.error;
              }
            } else if (typeof ret === "string") {
              error.error = ret;
            }
          }
          throw error;
        }
        first = false;
        ++depth;
      } while (chain.length > 0);
      return true;
    };
  }
});

// node_modules/node-forge/lib/pkcs12.js
var require_pkcs12 = __commonJS({
  "node_modules/node-forge/lib/pkcs12.js"(exports, module) {
    var forge2 = require_forge();
    require_asn1();
    require_hmac();
    require_oids();
    require_pkcs7asn1();
    require_pbe();
    require_random();
    require_rsa();
    require_sha1();
    require_util();
    require_x509();
    var asn1 = forge2.asn1;
    var pki = forge2.pki;
    var p12 = module.exports = forge2.pkcs12 = forge2.pkcs12 || {};
    var contentInfoValidator = {
      name: "ContentInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      // a ContentInfo
      constructed: true,
      value: [{
        name: "ContentInfo.contentType",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "contentType"
      }, {
        name: "ContentInfo.content",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        constructed: true,
        captureAsn1: "content"
      }]
    };
    var pfxValidator = {
      name: "PFX",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [
        {
          name: "PFX.version",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.INTEGER,
          constructed: false,
          capture: "version"
        },
        contentInfoValidator,
        {
          name: "PFX.macData",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          optional: true,
          captureAsn1: "mac",
          value: [{
            name: "PFX.macData.mac",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            // DigestInfo
            constructed: true,
            value: [{
              name: "PFX.macData.mac.digestAlgorithm",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.SEQUENCE,
              // DigestAlgorithmIdentifier
              constructed: true,
              value: [{
                name: "PFX.macData.mac.digestAlgorithm.algorithm",
                tagClass: asn1.Class.UNIVERSAL,
                type: asn1.Type.OID,
                constructed: false,
                capture: "macAlgorithm"
              }, {
                name: "PFX.macData.mac.digestAlgorithm.parameters",
                tagClass: asn1.Class.UNIVERSAL,
                captureAsn1: "macAlgorithmParameters"
              }]
            }, {
              name: "PFX.macData.mac.digest",
              tagClass: asn1.Class.UNIVERSAL,
              type: asn1.Type.OCTETSTRING,
              constructed: false,
              capture: "macDigest"
            }]
          }, {
            name: "PFX.macData.macSalt",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OCTETSTRING,
            constructed: false,
            capture: "macSalt"
          }, {
            name: "PFX.macData.iterations",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.INTEGER,
            constructed: false,
            optional: true,
            capture: "macIterations"
          }]
        }
      ]
    };
    var safeBagValidator = {
      name: "SafeBag",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "SafeBag.bagId",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "bagId"
      }, {
        name: "SafeBag.bagValue",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        constructed: true,
        captureAsn1: "bagValue"
      }, {
        name: "SafeBag.bagAttributes",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SET,
        constructed: true,
        optional: true,
        capture: "bagAttributes"
      }]
    };
    var attributeValidator = {
      name: "Attribute",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "Attribute.attrId",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "oid"
      }, {
        name: "Attribute.attrValues",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SET,
        constructed: true,
        capture: "values"
      }]
    };
    var certBagValidator = {
      name: "CertBag",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "CertBag.certId",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OID,
        constructed: false,
        capture: "certId"
      }, {
        name: "CertBag.certValue",
        tagClass: asn1.Class.CONTEXT_SPECIFIC,
        constructed: true,
        /* So far we only support X.509 certificates (which are wrapped in
           an OCTET STRING, hence hard code that here). */
        value: [{
          name: "CertBag.certValue[0]",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Class.OCTETSTRING,
          constructed: false,
          capture: "cert"
        }]
      }]
    };
    function _getBagsByAttribute(safeContents, attrName, attrValue, bagType) {
      var result = [];
      for (var i2 = 0; i2 < safeContents.length; i2++) {
        for (var j = 0; j < safeContents[i2].safeBags.length; j++) {
          var bag = safeContents[i2].safeBags[j];
          if (bagType !== void 0 && bag.type !== bagType) {
            continue;
          }
          if (attrName === null) {
            result.push(bag);
            continue;
          }
          if (bag.attributes[attrName] !== void 0 && bag.attributes[attrName].indexOf(attrValue) >= 0) {
            result.push(bag);
          }
        }
      }
      return result;
    }
    p12.pkcs12FromAsn1 = function(obj, strict, password) {
      if (typeof strict === "string") {
        password = strict;
        strict = true;
      } else if (strict === void 0) {
        strict = true;
      }
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, pfxValidator, capture, errors)) {
        var error = new Error("Cannot read PKCS#12 PFX. ASN.1 object is not an PKCS#12 PFX.");
        error.errors = error;
        throw error;
      }
      var pfx = {
        version: capture.version.charCodeAt(0),
        safeContents: [],
        /**
         * Gets bags with matching attributes.
         *
         * @param filter the attributes to filter by:
         *          [localKeyId] the localKeyId to search for.
         *          [localKeyIdHex] the localKeyId in hex to search for.
         *          [friendlyName] the friendly name to search for.
         *          [bagType] bag type to narrow each attribute search by.
         *
         * @return a map of attribute type to an array of matching bags or, if no
         *           attribute was given but a bag type, the map key will be the
         *           bag type.
         */
        getBags: function(filter) {
          var rval = {};
          var localKeyId;
          if ("localKeyId" in filter) {
            localKeyId = filter.localKeyId;
          } else if ("localKeyIdHex" in filter) {
            localKeyId = forge2.util.hexToBytes(filter.localKeyIdHex);
          }
          if (localKeyId === void 0 && !("friendlyName" in filter) && "bagType" in filter) {
            rval[filter.bagType] = _getBagsByAttribute(
              pfx.safeContents,
              null,
              null,
              filter.bagType
            );
          }
          if (localKeyId !== void 0) {
            rval.localKeyId = _getBagsByAttribute(
              pfx.safeContents,
              "localKeyId",
              localKeyId,
              filter.bagType
            );
          }
          if ("friendlyName" in filter) {
            rval.friendlyName = _getBagsByAttribute(
              pfx.safeContents,
              "friendlyName",
              filter.friendlyName,
              filter.bagType
            );
          }
          return rval;
        },
        /**
         * DEPRECATED: use getBags() instead.
         *
         * Get bags with matching friendlyName attribute.
         *
         * @param friendlyName the friendly name to search for.
         * @param [bagType] bag type to narrow search by.
         *
         * @return an array of bags with matching friendlyName attribute.
         */
        getBagsByFriendlyName: function(friendlyName, bagType) {
          return _getBagsByAttribute(
            pfx.safeContents,
            "friendlyName",
            friendlyName,
            bagType
          );
        },
        /**
         * DEPRECATED: use getBags() instead.
         *
         * Get bags with matching localKeyId attribute.
         *
         * @param localKeyId the localKeyId to search for.
         * @param [bagType] bag type to narrow search by.
         *
         * @return an array of bags with matching localKeyId attribute.
         */
        getBagsByLocalKeyId: function(localKeyId, bagType) {
          return _getBagsByAttribute(
            pfx.safeContents,
            "localKeyId",
            localKeyId,
            bagType
          );
        }
      };
      if (capture.version.charCodeAt(0) !== 3) {
        var error = new Error("PKCS#12 PFX of version other than 3 not supported.");
        error.version = capture.version.charCodeAt(0);
        throw error;
      }
      if (asn1.derToOid(capture.contentType) !== pki.oids.data) {
        var error = new Error("Only PKCS#12 PFX in password integrity mode supported.");
        error.oid = asn1.derToOid(capture.contentType);
        throw error;
      }
      var data = capture.content.value[0];
      if (data.tagClass !== asn1.Class.UNIVERSAL || data.type !== asn1.Type.OCTETSTRING) {
        throw new Error("PKCS#12 authSafe content data is not an OCTET STRING.");
      }
      data = _decodePkcs7Data(data);
      if (capture.mac) {
        var md = null;
        var macKeyBytes = 0;
        var macAlgorithm = asn1.derToOid(capture.macAlgorithm);
        switch (macAlgorithm) {
          case pki.oids.sha1:
            md = forge2.md.sha1.create();
            macKeyBytes = 20;
            break;
          case pki.oids.sha256:
            md = forge2.md.sha256.create();
            macKeyBytes = 32;
            break;
          case pki.oids.sha384:
            md = forge2.md.sha384.create();
            macKeyBytes = 48;
            break;
          case pki.oids.sha512:
            md = forge2.md.sha512.create();
            macKeyBytes = 64;
            break;
          case pki.oids.md5:
            md = forge2.md.md5.create();
            macKeyBytes = 16;
            break;
        }
        if (md === null) {
          throw new Error("PKCS#12 uses unsupported MAC algorithm: " + macAlgorithm);
        }
        var macSalt = new forge2.util.ByteBuffer(capture.macSalt);
        var macIterations = "macIterations" in capture ? parseInt(forge2.util.bytesToHex(capture.macIterations), 16) : 1;
        var macKey = p12.generateKey(
          password,
          macSalt,
          3,
          macIterations,
          macKeyBytes,
          md
        );
        var mac = forge2.hmac.create();
        mac.start(md, macKey);
        mac.update(data.value);
        var macValue = mac.getMac();
        if (macValue.getBytes() !== capture.macDigest) {
          throw new Error("PKCS#12 MAC could not be verified. Invalid password?");
        }
      }
      _decodeAuthenticatedSafe(pfx, data.value, strict, password);
      return pfx;
    };
    function _decodePkcs7Data(data) {
      if (data.composed || data.constructed) {
        var value = forge2.util.createBuffer();
        for (var i2 = 0; i2 < data.value.length; ++i2) {
          value.putBytes(data.value[i2].value);
        }
        data.composed = data.constructed = false;
        data.value = value.getBytes();
      }
      return data;
    }
    function _decodeAuthenticatedSafe(pfx, authSafe, strict, password) {
      authSafe = asn1.fromDer(authSafe, strict);
      if (authSafe.tagClass !== asn1.Class.UNIVERSAL || authSafe.type !== asn1.Type.SEQUENCE || authSafe.constructed !== true) {
        throw new Error("PKCS#12 AuthenticatedSafe expected to be a SEQUENCE OF ContentInfo");
      }
      for (var i2 = 0; i2 < authSafe.value.length; i2++) {
        var contentInfo = authSafe.value[i2];
        var capture = {};
        var errors = [];
        if (!asn1.validate(contentInfo, contentInfoValidator, capture, errors)) {
          var error = new Error("Cannot read ContentInfo.");
          error.errors = errors;
          throw error;
        }
        var obj = {
          encrypted: false
        };
        var safeContents = null;
        var data = capture.content.value[0];
        switch (asn1.derToOid(capture.contentType)) {
          case pki.oids.data:
            if (data.tagClass !== asn1.Class.UNIVERSAL || data.type !== asn1.Type.OCTETSTRING) {
              throw new Error("PKCS#12 SafeContents Data is not an OCTET STRING.");
            }
            safeContents = _decodePkcs7Data(data).value;
            break;
          case pki.oids.encryptedData:
            safeContents = _decryptSafeContents(data, password);
            obj.encrypted = true;
            break;
          default:
            var error = new Error("Unsupported PKCS#12 contentType.");
            error.contentType = asn1.derToOid(capture.contentType);
            throw error;
        }
        obj.safeBags = _decodeSafeContents(safeContents, strict, password);
        pfx.safeContents.push(obj);
      }
    }
    function _decryptSafeContents(data, password) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(
        data,
        forge2.pkcs7.asn1.encryptedDataValidator,
        capture,
        errors
      )) {
        var error = new Error("Cannot read EncryptedContentInfo.");
        error.errors = errors;
        throw error;
      }
      var oid = asn1.derToOid(capture.contentType);
      if (oid !== pki.oids.data) {
        var error = new Error(
          "PKCS#12 EncryptedContentInfo ContentType is not Data."
        );
        error.oid = oid;
        throw error;
      }
      oid = asn1.derToOid(capture.encAlgorithm);
      var cipher = pki.pbe.getCipher(oid, capture.encParameter, password);
      var encryptedContentAsn1 = _decodePkcs7Data(capture.encryptedContentAsn1);
      var encrypted = forge2.util.createBuffer(encryptedContentAsn1.value);
      cipher.update(encrypted);
      if (!cipher.finish()) {
        throw new Error("Failed to decrypt PKCS#12 SafeContents.");
      }
      return cipher.output.getBytes();
    }
    function _decodeSafeContents(safeContents, strict, password) {
      if (!strict && safeContents.length === 0) {
        return [];
      }
      safeContents = asn1.fromDer(safeContents, strict);
      if (safeContents.tagClass !== asn1.Class.UNIVERSAL || safeContents.type !== asn1.Type.SEQUENCE || safeContents.constructed !== true) {
        throw new Error(
          "PKCS#12 SafeContents expected to be a SEQUENCE OF SafeBag."
        );
      }
      var res = [];
      for (var i2 = 0; i2 < safeContents.value.length; i2++) {
        var safeBag = safeContents.value[i2];
        var capture = {};
        var errors = [];
        if (!asn1.validate(safeBag, safeBagValidator, capture, errors)) {
          var error = new Error("Cannot read SafeBag.");
          error.errors = errors;
          throw error;
        }
        var bag = {
          type: asn1.derToOid(capture.bagId),
          attributes: _decodeBagAttributes(capture.bagAttributes)
        };
        res.push(bag);
        var validator, decoder;
        var bagAsn1 = capture.bagValue.value[0];
        switch (bag.type) {
          case pki.oids.pkcs8ShroudedKeyBag:
            bagAsn1 = pki.decryptPrivateKeyInfo(bagAsn1, password);
            if (bagAsn1 === null) {
              throw new Error(
                "Unable to decrypt PKCS#8 ShroudedKeyBag, wrong password?"
              );
            }
          /* fall through */
          case pki.oids.keyBag:
            try {
              bag.key = pki.privateKeyFromAsn1(bagAsn1);
            } catch (e) {
              bag.key = null;
              bag.asn1 = bagAsn1;
            }
            continue;
          /* Nothing more to do. */
          case pki.oids.certBag:
            validator = certBagValidator;
            decoder = function() {
              if (asn1.derToOid(capture.certId) !== pki.oids.x509Certificate) {
                var error2 = new Error(
                  "Unsupported certificate type, only X.509 supported."
                );
                error2.oid = asn1.derToOid(capture.certId);
                throw error2;
              }
              var certAsn1 = asn1.fromDer(capture.cert, strict);
              try {
                bag.cert = pki.certificateFromAsn1(certAsn1, true);
              } catch (e) {
                bag.cert = null;
                bag.asn1 = certAsn1;
              }
            };
            break;
          default:
            var error = new Error("Unsupported PKCS#12 SafeBag type.");
            error.oid = bag.type;
            throw error;
        }
        if (validator !== void 0 && !asn1.validate(bagAsn1, validator, capture, errors)) {
          var error = new Error("Cannot read PKCS#12 " + validator.name);
          error.errors = errors;
          throw error;
        }
        decoder();
      }
      return res;
    }
    function _decodeBagAttributes(attributes) {
      var decodedAttrs = {};
      if (attributes !== void 0) {
        for (var i2 = 0; i2 < attributes.length; ++i2) {
          var capture = {};
          var errors = [];
          if (!asn1.validate(attributes[i2], attributeValidator, capture, errors)) {
            var error = new Error("Cannot read PKCS#12 BagAttribute.");
            error.errors = errors;
            throw error;
          }
          var oid = asn1.derToOid(capture.oid);
          if (pki.oids[oid] === void 0) {
            continue;
          }
          decodedAttrs[pki.oids[oid]] = [];
          for (var j = 0; j < capture.values.length; ++j) {
            decodedAttrs[pki.oids[oid]].push(capture.values[j].value);
          }
        }
      }
      return decodedAttrs;
    }
    p12.toPkcs12Asn1 = function(key, cert, password, options) {
      options = options || {};
      options.saltSize = options.saltSize || 8;
      options.count = options.count || 2048;
      options.algorithm = options.algorithm || options.encAlgorithm || "aes128";
      if (!("useMac" in options)) {
        options.useMac = true;
      }
      if (!("localKeyId" in options)) {
        options.localKeyId = null;
      }
      if (!("generateLocalKeyId" in options)) {
        options.generateLocalKeyId = true;
      }
      var localKeyId = options.localKeyId;
      var bagAttrs;
      if (localKeyId !== null) {
        localKeyId = forge2.util.hexToBytes(localKeyId);
      } else if (options.generateLocalKeyId) {
        if (cert) {
          var pairedCert = forge2.util.isArray(cert) ? cert[0] : cert;
          if (typeof pairedCert === "string") {
            pairedCert = pki.certificateFromPem(pairedCert);
          }
          var sha1 = forge2.md.sha1.create();
          sha1.update(asn1.toDer(pki.certificateToAsn1(pairedCert)).getBytes());
          localKeyId = sha1.digest().getBytes();
        } else {
          localKeyId = forge2.random.getBytes(20);
        }
      }
      var attrs = [];
      if (localKeyId !== null) {
        attrs.push(
          // localKeyID
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // attrId
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(pki.oids.localKeyId).getBytes()
            ),
            // attrValues
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OCTETSTRING,
                false,
                localKeyId
              )
            ])
          ])
        );
      }
      if ("friendlyName" in options) {
        attrs.push(
          // friendlyName
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // attrId
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(pki.oids.friendlyName).getBytes()
            ),
            // attrValues
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.BMPSTRING,
                false,
                options.friendlyName
              )
            ])
          ])
        );
      }
      if (attrs.length > 0) {
        bagAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, attrs);
      }
      var contents = [];
      var chain = [];
      if (cert !== null) {
        if (forge2.util.isArray(cert)) {
          chain = cert;
        } else {
          chain = [cert];
        }
      }
      var certSafeBags = [];
      for (var i2 = 0; i2 < chain.length; ++i2) {
        cert = chain[i2];
        if (typeof cert === "string") {
          cert = pki.certificateFromPem(cert);
        }
        var certBagAttrs = i2 === 0 ? bagAttrs : void 0;
        var certAsn1 = pki.certificateToAsn1(cert);
        var certSafeBag = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // bagId
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.certBag).getBytes()
          ),
          // bagValue
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            // CertBag
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // certId
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(pki.oids.x509Certificate).getBytes()
              ),
              // certValue (x509Certificate)
              asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OCTETSTRING,
                  false,
                  asn1.toDer(certAsn1).getBytes()
                )
              ])
            ])
          ]),
          // bagAttributes (OPTIONAL)
          certBagAttrs
        ]);
        certSafeBags.push(certSafeBag);
      }
      if (certSafeBags.length > 0) {
        var certSafeContents = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.SEQUENCE,
          true,
          certSafeBags
        );
        var certCI = (
          // PKCS#7 ContentInfo
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // contentType
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              // OID for the content type is 'data'
              asn1.oidToDer(pki.oids.data).getBytes()
            ),
            // content
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OCTETSTRING,
                false,
                asn1.toDer(certSafeContents).getBytes()
              )
            ])
          ])
        );
        contents.push(certCI);
      }
      var keyBag = null;
      if (key !== null) {
        var pkAsn1 = pki.wrapRsaPrivateKey(pki.privateKeyToAsn1(key));
        if (password === null) {
          keyBag = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // bagId
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(pki.oids.keyBag).getBytes()
            ),
            // bagValue
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              // PrivateKeyInfo
              pkAsn1
            ]),
            // bagAttributes (OPTIONAL)
            bagAttrs
          ]);
        } else {
          keyBag = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // bagId
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(pki.oids.pkcs8ShroudedKeyBag).getBytes()
            ),
            // bagValue
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              // EncryptedPrivateKeyInfo
              pki.encryptPrivateKeyInfo(pkAsn1, password, options)
            ]),
            // bagAttributes (OPTIONAL)
            bagAttrs
          ]);
        }
        var keySafeContents = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [keyBag]);
        var keyCI = (
          // PKCS#7 ContentInfo
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // contentType
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              // OID for the content type is 'data'
              asn1.oidToDer(pki.oids.data).getBytes()
            ),
            // content
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OCTETSTRING,
                false,
                asn1.toDer(keySafeContents).getBytes()
              )
            ])
          ])
        );
        contents.push(keyCI);
      }
      var safe = asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.SEQUENCE,
        true,
        contents
      );
      var macData;
      if (options.useMac) {
        var sha1 = forge2.md.sha1.create();
        var macSalt = new forge2.util.ByteBuffer(
          forge2.random.getBytes(options.saltSize)
        );
        var count = options.count;
        var key = p12.generateKey(password, macSalt, 3, count, 20);
        var mac = forge2.hmac.create();
        mac.start(sha1, key);
        mac.update(asn1.toDer(safe).getBytes());
        var macValue = mac.getMac();
        macData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // mac DigestInfo
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // digestAlgorithm
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // algorithm = SHA-1
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(pki.oids.sha1).getBytes()
              ),
              // parameters = Null
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
            ]),
            // digest
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OCTETSTRING,
              false,
              macValue.getBytes()
            )
          ]),
          // macSalt OCTET STRING
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OCTETSTRING,
            false,
            macSalt.getBytes()
          ),
          // iterations INTEGER (XXX: Only support count < 65536)
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            asn1.integerToDer(count).getBytes()
          )
        ]);
      }
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version (3)
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(3).getBytes()
        ),
        // PKCS#7 ContentInfo
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // contentType
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            // OID for the content type is 'data'
            asn1.oidToDer(pki.oids.data).getBytes()
          ),
          // content
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OCTETSTRING,
              false,
              asn1.toDer(safe).getBytes()
            )
          ])
        ]),
        macData
      ]);
    };
    p12.generateKey = forge2.pbe.generatePkcs12Key;
  }
});

// node_modules/node-forge/lib/pki.js
var require_pki = __commonJS({
  "node_modules/node-forge/lib/pki.js"(exports, module) {
    var forge2 = require_forge();
    require_asn1();
    require_oids();
    require_pbe();
    require_pem();
    require_pbkdf2();
    require_pkcs12();
    require_pss();
    require_rsa();
    require_util();
    require_x509();
    var asn1 = forge2.asn1;
    var pki = module.exports = forge2.pki = forge2.pki || {};
    pki.pemToDer = function(pem) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert PEM to DER; PEM is encrypted.");
      }
      return forge2.util.createBuffer(msg.body);
    };
    pki.privateKeyFromPem = function(pem) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "PRIVATE KEY" && msg.type !== "RSA PRIVATE KEY") {
        var error = new Error('Could not convert private key from PEM; PEM header type is not "PRIVATE KEY" or "RSA PRIVATE KEY".');
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert private key from PEM; PEM is encrypted.");
      }
      var obj = asn1.fromDer(msg.body);
      return pki.privateKeyFromAsn1(obj);
    };
    pki.privateKeyToPem = function(key, maxline) {
      var msg = {
        type: "RSA PRIVATE KEY",
        body: asn1.toDer(pki.privateKeyToAsn1(key)).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
    pki.privateKeyInfoToPem = function(pki2, maxline) {
      var msg = {
        type: "PRIVATE KEY",
        body: asn1.toDer(pki2).getBytes()
      };
      return forge2.pem.encode(msg, { maxline });
    };
  }
});

// node_modules/node-forge/lib/tls.js
var require_tls = __commonJS({
  "node_modules/node-forge/lib/tls.js"(exports, module) {
    var forge2 = require_forge();
    require_asn1();
    require_hmac();
    require_md5();
    require_pem();
    require_pki();
    require_random();
    require_sha1();
    require_util();
    var prf_TLS1 = function(secret, label, seed, length) {
      var rval = forge2.util.createBuffer();
      var idx = secret.length >> 1;
      var slen = idx + (secret.length & 1);
      var s1 = secret.substr(0, slen);
      var s2 = secret.substr(idx, slen);
      var ai = forge2.util.createBuffer();
      var hmac = forge2.hmac.create();
      seed = label + seed;
      var md5itr = Math.ceil(length / 16);
      var sha1itr = Math.ceil(length / 20);
      hmac.start("MD5", s1);
      var md5bytes = forge2.util.createBuffer();
      ai.putBytes(seed);
      for (var i2 = 0; i2 < md5itr; ++i2) {
        hmac.start(null, null);
        hmac.update(ai.getBytes());
        ai.putBuffer(hmac.digest());
        hmac.start(null, null);
        hmac.update(ai.bytes() + seed);
        md5bytes.putBuffer(hmac.digest());
      }
      hmac.start("SHA1", s2);
      var sha1bytes = forge2.util.createBuffer();
      ai.clear();
      ai.putBytes(seed);
      for (var i2 = 0; i2 < sha1itr; ++i2) {
        hmac.start(null, null);
        hmac.update(ai.getBytes());
        ai.putBuffer(hmac.digest());
        hmac.start(null, null);
        hmac.update(ai.bytes() + seed);
        sha1bytes.putBuffer(hmac.digest());
      }
      rval.putBytes(forge2.util.xorBytes(
        md5bytes.getBytes(),
        sha1bytes.getBytes(),
        length
      ));
      return rval;
    };
    var hmac_sha1 = function(key2, seqNum, record) {
      var hmac = forge2.hmac.create();
      hmac.start("SHA1", key2);
      var b = forge2.util.createBuffer();
      b.putInt32(seqNum[0]);
      b.putInt32(seqNum[1]);
      b.putByte(record.type);
      b.putByte(record.version.major);
      b.putByte(record.version.minor);
      b.putInt16(record.length);
      b.putBytes(record.fragment.bytes());
      hmac.update(b.getBytes());
      return hmac.digest().getBytes();
    };
    var deflate = function(c, record, s) {
      var rval = false;
      try {
        var bytes = c.deflate(record.fragment.getBytes());
        record.fragment = forge2.util.createBuffer(bytes);
        record.length = bytes.length;
        rval = true;
      } catch (ex) {
      }
      return rval;
    };
    var inflate = function(c, record, s) {
      var rval = false;
      try {
        var bytes = c.inflate(record.fragment.getBytes());
        record.fragment = forge2.util.createBuffer(bytes);
        record.length = bytes.length;
        rval = true;
      } catch (ex) {
      }
      return rval;
    };
    var readVector = function(b, lenBytes) {
      var len = 0;
      switch (lenBytes) {
        case 1:
          len = b.getByte();
          break;
        case 2:
          len = b.getInt16();
          break;
        case 3:
          len = b.getInt24();
          break;
        case 4:
          len = b.getInt32();
          break;
      }
      return forge2.util.createBuffer(b.getBytes(len));
    };
    var writeVector = function(b, lenBytes, v) {
      b.putInt(v.length(), lenBytes << 3);
      b.putBuffer(v);
    };
    var tls = {};
    tls.Versions = {
      TLS_1_0: { major: 3, minor: 1 },
      TLS_1_1: { major: 3, minor: 2 },
      TLS_1_2: { major: 3, minor: 3 }
    };
    tls.SupportedVersions = [
      tls.Versions.TLS_1_1,
      tls.Versions.TLS_1_0
    ];
    tls.Version = tls.SupportedVersions[0];
    tls.MaxFragment = 16384 - 1024;
    tls.ConnectionEnd = {
      server: 0,
      client: 1
    };
    tls.PRFAlgorithm = {
      tls_prf_sha256: 0
    };
    tls.BulkCipherAlgorithm = {
      none: null,
      rc4: 0,
      des3: 1,
      aes: 2
    };
    tls.CipherType = {
      stream: 0,
      block: 1,
      aead: 2
    };
    tls.MACAlgorithm = {
      none: null,
      hmac_md5: 0,
      hmac_sha1: 1,
      hmac_sha256: 2,
      hmac_sha384: 3,
      hmac_sha512: 4
    };
    tls.CompressionMethod = {
      none: 0,
      deflate: 1
    };
    tls.ContentType = {
      change_cipher_spec: 20,
      alert: 21,
      handshake: 22,
      application_data: 23,
      heartbeat: 24
    };
    tls.HandshakeType = {
      hello_request: 0,
      client_hello: 1,
      server_hello: 2,
      certificate: 11,
      server_key_exchange: 12,
      certificate_request: 13,
      server_hello_done: 14,
      certificate_verify: 15,
      client_key_exchange: 16,
      finished: 20
    };
    tls.Alert = {};
    tls.Alert.Level = {
      warning: 1,
      fatal: 2
    };
    tls.Alert.Description = {
      close_notify: 0,
      unexpected_message: 10,
      bad_record_mac: 20,
      decryption_failed: 21,
      record_overflow: 22,
      decompression_failure: 30,
      handshake_failure: 40,
      bad_certificate: 42,
      unsupported_certificate: 43,
      certificate_revoked: 44,
      certificate_expired: 45,
      certificate_unknown: 46,
      illegal_parameter: 47,
      unknown_ca: 48,
      access_denied: 49,
      decode_error: 50,
      decrypt_error: 51,
      export_restriction: 60,
      protocol_version: 70,
      insufficient_security: 71,
      internal_error: 80,
      user_canceled: 90,
      no_renegotiation: 100
    };
    tls.HeartbeatMessageType = {
      heartbeat_request: 1,
      heartbeat_response: 2
    };
    tls.CipherSuites = {};
    tls.getCipherSuite = function(twoBytes) {
      var rval = null;
      for (var key2 in tls.CipherSuites) {
        var cs = tls.CipherSuites[key2];
        if (cs.id[0] === twoBytes.charCodeAt(0) && cs.id[1] === twoBytes.charCodeAt(1)) {
          rval = cs;
          break;
        }
      }
      return rval;
    };
    tls.handleUnexpected = function(c, record) {
      var ignore = !c.open && c.entity === tls.ConnectionEnd.client;
      if (!ignore) {
        c.error(c, {
          message: "Unexpected message. Received TLS record out of order.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.unexpected_message
          }
        });
      }
    };
    tls.handleHelloRequest = function(c, record, length) {
      if (!c.handshaking && c.handshakes > 0) {
        tls.queue(c, tls.createAlert(c, {
          level: tls.Alert.Level.warning,
          description: tls.Alert.Description.no_renegotiation
        }));
        tls.flush(c);
      }
      c.process();
    };
    tls.parseHelloMessage = function(c, record, length) {
      var msg = null;
      var client = c.entity === tls.ConnectionEnd.client;
      if (length < 38) {
        c.error(c, {
          message: client ? "Invalid ServerHello message. Message too short." : "Invalid ClientHello message. Message too short.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      } else {
        var b = record.fragment;
        var remaining = b.length();
        msg = {
          version: {
            major: b.getByte(),
            minor: b.getByte()
          },
          random: forge2.util.createBuffer(b.getBytes(32)),
          session_id: readVector(b, 1),
          extensions: []
        };
        if (client) {
          msg.cipher_suite = b.getBytes(2);
          msg.compression_method = b.getByte();
        } else {
          msg.cipher_suites = readVector(b, 2);
          msg.compression_methods = readVector(b, 1);
        }
        remaining = length - (remaining - b.length());
        if (remaining > 0) {
          var exts = readVector(b, 2);
          while (exts.length() > 0) {
            msg.extensions.push({
              type: [exts.getByte(), exts.getByte()],
              data: readVector(exts, 2)
            });
          }
          if (!client) {
            for (var i2 = 0; i2 < msg.extensions.length; ++i2) {
              var ext = msg.extensions[i2];
              if (ext.type[0] === 0 && ext.type[1] === 0) {
                var snl = readVector(ext.data, 2);
                while (snl.length() > 0) {
                  var snType = snl.getByte();
                  if (snType !== 0) {
                    break;
                  }
                  c.session.extensions.server_name.serverNameList.push(
                    readVector(snl, 2).getBytes()
                  );
                }
              }
            }
          }
        }
        if (c.session.version) {
          if (msg.version.major !== c.session.version.major || msg.version.minor !== c.session.version.minor) {
            return c.error(c, {
              message: "TLS version change is disallowed during renegotiation.",
              send: true,
              alert: {
                level: tls.Alert.Level.fatal,
                description: tls.Alert.Description.protocol_version
              }
            });
          }
        }
        if (client) {
          c.session.cipherSuite = tls.getCipherSuite(msg.cipher_suite);
        } else {
          var tmp = forge2.util.createBuffer(msg.cipher_suites.bytes());
          while (tmp.length() > 0) {
            c.session.cipherSuite = tls.getCipherSuite(tmp.getBytes(2));
            if (c.session.cipherSuite !== null) {
              break;
            }
          }
        }
        if (c.session.cipherSuite === null) {
          return c.error(c, {
            message: "No cipher suites in common.",
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.handshake_failure
            },
            cipherSuite: forge2.util.bytesToHex(msg.cipher_suite)
          });
        }
        if (client) {
          c.session.compressionMethod = msg.compression_method;
        } else {
          c.session.compressionMethod = tls.CompressionMethod.none;
        }
      }
      return msg;
    };
    tls.createSecurityParameters = function(c, msg) {
      var client = c.entity === tls.ConnectionEnd.client;
      var msgRandom = msg.random.bytes();
      var cRandom = client ? c.session.sp.client_random : msgRandom;
      var sRandom = client ? msgRandom : tls.createRandom().getBytes();
      c.session.sp = {
        entity: c.entity,
        prf_algorithm: tls.PRFAlgorithm.tls_prf_sha256,
        bulk_cipher_algorithm: null,
        cipher_type: null,
        enc_key_length: null,
        block_length: null,
        fixed_iv_length: null,
        record_iv_length: null,
        mac_algorithm: null,
        mac_length: null,
        mac_key_length: null,
        compression_algorithm: c.session.compressionMethod,
        pre_master_secret: null,
        master_secret: null,
        client_random: cRandom,
        server_random: sRandom
      };
    };
    tls.handleServerHello = function(c, record, length) {
      var msg = tls.parseHelloMessage(c, record, length);
      if (c.fail) {
        return;
      }
      if (msg.version.minor <= c.version.minor) {
        c.version.minor = msg.version.minor;
      } else {
        return c.error(c, {
          message: "Incompatible TLS version.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.protocol_version
          }
        });
      }
      c.session.version = c.version;
      var sessionId = msg.session_id.bytes();
      if (sessionId.length > 0 && sessionId === c.session.id) {
        c.expect = SCC;
        c.session.resuming = true;
        c.session.sp.server_random = msg.random.bytes();
      } else {
        c.expect = SCE;
        c.session.resuming = false;
        tls.createSecurityParameters(c, msg);
      }
      c.session.id = sessionId;
      c.process();
    };
    tls.handleClientHello = function(c, record, length) {
      var msg = tls.parseHelloMessage(c, record, length);
      if (c.fail) {
        return;
      }
      var sessionId = msg.session_id.bytes();
      var session = null;
      if (c.sessionCache) {
        session = c.sessionCache.getSession(sessionId);
        if (session === null) {
          sessionId = "";
        } else if (session.version.major !== msg.version.major || session.version.minor > msg.version.minor) {
          session = null;
          sessionId = "";
        }
      }
      if (sessionId.length === 0) {
        sessionId = forge2.random.getBytes(32);
      }
      c.session.id = sessionId;
      c.session.clientHelloVersion = msg.version;
      c.session.sp = {};
      if (session) {
        c.version = c.session.version = session.version;
        c.session.sp = session.sp;
      } else {
        var version;
        for (var i2 = 1; i2 < tls.SupportedVersions.length; ++i2) {
          version = tls.SupportedVersions[i2];
          if (version.minor <= msg.version.minor) {
            break;
          }
        }
        c.version = { major: version.major, minor: version.minor };
        c.session.version = c.version;
      }
      if (session !== null) {
        c.expect = CCC;
        c.session.resuming = true;
        c.session.sp.client_random = msg.random.bytes();
      } else {
        c.expect = c.verifyClient !== false ? CCE : CKE;
        c.session.resuming = false;
        tls.createSecurityParameters(c, msg);
      }
      c.open = true;
      tls.queue(c, tls.createRecord(c, {
        type: tls.ContentType.handshake,
        data: tls.createServerHello(c)
      }));
      if (c.session.resuming) {
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.change_cipher_spec,
          data: tls.createChangeCipherSpec()
        }));
        c.state.pending = tls.createConnectionState(c);
        c.state.current.write = c.state.pending.write;
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.handshake,
          data: tls.createFinished(c)
        }));
      } else {
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.handshake,
          data: tls.createCertificate(c)
        }));
        if (!c.fail) {
          tls.queue(c, tls.createRecord(c, {
            type: tls.ContentType.handshake,
            data: tls.createServerKeyExchange(c)
          }));
          if (c.verifyClient !== false) {
            tls.queue(c, tls.createRecord(c, {
              type: tls.ContentType.handshake,
              data: tls.createCertificateRequest(c)
            }));
          }
          tls.queue(c, tls.createRecord(c, {
            type: tls.ContentType.handshake,
            data: tls.createServerHelloDone(c)
          }));
        }
      }
      tls.flush(c);
      c.process();
    };
    tls.handleCertificate = function(c, record, length) {
      if (length < 3) {
        return c.error(c, {
          message: "Invalid Certificate message. Message too short.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      }
      var b = record.fragment;
      var msg = {
        certificate_list: readVector(b, 3)
      };
      var cert, asn1;
      var certs = [];
      try {
        while (msg.certificate_list.length() > 0) {
          cert = readVector(msg.certificate_list, 3);
          asn1 = forge2.asn1.fromDer(cert);
          cert = forge2.pki.certificateFromAsn1(asn1, true);
          certs.push(cert);
        }
      } catch (ex) {
        return c.error(c, {
          message: "Could not parse certificate list.",
          cause: ex,
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.bad_certificate
          }
        });
      }
      var client = c.entity === tls.ConnectionEnd.client;
      if ((client || c.verifyClient === true) && certs.length === 0) {
        c.error(c, {
          message: client ? "No server certificate provided." : "No client certificate provided.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      } else if (certs.length === 0) {
        c.expect = client ? SKE : CKE;
      } else {
        if (client) {
          c.session.serverCertificate = certs[0];
        } else {
          c.session.clientCertificate = certs[0];
        }
        if (tls.verifyCertificateChain(c, certs)) {
          c.expect = client ? SKE : CKE;
        }
      }
      c.process();
    };
    tls.handleServerKeyExchange = function(c, record, length) {
      if (length > 0) {
        return c.error(c, {
          message: "Invalid key parameters. Only RSA is supported.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.unsupported_certificate
          }
        });
      }
      c.expect = SCR;
      c.process();
    };
    tls.handleClientKeyExchange = function(c, record, length) {
      if (length < 48) {
        return c.error(c, {
          message: "Invalid key parameters. Only RSA is supported.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.unsupported_certificate
          }
        });
      }
      var b = record.fragment;
      var msg = {
        enc_pre_master_secret: readVector(b, 2).getBytes()
      };
      var privateKey = null;
      if (c.getPrivateKey) {
        try {
          privateKey = c.getPrivateKey(c, c.session.serverCertificate);
          privateKey = forge2.pki.privateKeyFromPem(privateKey);
        } catch (ex) {
          c.error(c, {
            message: "Could not get private key.",
            cause: ex,
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.internal_error
            }
          });
        }
      }
      if (privateKey === null) {
        return c.error(c, {
          message: "No private key set.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.internal_error
          }
        });
      }
      try {
        var sp = c.session.sp;
        sp.pre_master_secret = privateKey.decrypt(msg.enc_pre_master_secret);
        var version = c.session.clientHelloVersion;
        if (version.major !== sp.pre_master_secret.charCodeAt(0) || version.minor !== sp.pre_master_secret.charCodeAt(1)) {
          throw new Error("TLS version rollback attack detected.");
        }
      } catch (ex) {
        sp.pre_master_secret = forge2.random.getBytes(48);
      }
      c.expect = CCC;
      if (c.session.clientCertificate !== null) {
        c.expect = CCV;
      }
      c.process();
    };
    tls.handleCertificateRequest = function(c, record, length) {
      if (length < 3) {
        return c.error(c, {
          message: "Invalid CertificateRequest. Message too short.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      }
      var b = record.fragment;
      var msg = {
        certificate_types: readVector(b, 1),
        certificate_authorities: readVector(b, 2)
      };
      c.session.certificateRequest = msg;
      c.expect = SHD;
      c.process();
    };
    tls.handleCertificateVerify = function(c, record, length) {
      if (length < 2) {
        return c.error(c, {
          message: "Invalid CertificateVerify. Message too short.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      }
      var b = record.fragment;
      b.read -= 4;
      var msgBytes = b.bytes();
      b.read += 4;
      var msg = {
        signature: readVector(b, 2).getBytes()
      };
      var verify = forge2.util.createBuffer();
      verify.putBuffer(c.session.md5.digest());
      verify.putBuffer(c.session.sha1.digest());
      verify = verify.getBytes();
      try {
        var cert = c.session.clientCertificate;
        if (!cert.publicKey.verify(verify, msg.signature, "NONE")) {
          throw new Error("CertificateVerify signature does not match.");
        }
        c.session.md5.update(msgBytes);
        c.session.sha1.update(msgBytes);
      } catch (ex) {
        return c.error(c, {
          message: "Bad signature in CertificateVerify.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.handshake_failure
          }
        });
      }
      c.expect = CCC;
      c.process();
    };
    tls.handleServerHelloDone = function(c, record, length) {
      if (length > 0) {
        return c.error(c, {
          message: "Invalid ServerHelloDone message. Invalid length.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.record_overflow
          }
        });
      }
      if (c.serverCertificate === null) {
        var error = {
          message: "No server certificate provided. Not enough security.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.insufficient_security
          }
        };
        var depth = 0;
        var ret = c.verify(c, error.alert.description, depth, []);
        if (ret !== true) {
          if (ret || ret === 0) {
            if (typeof ret === "object" && !forge2.util.isArray(ret)) {
              if (ret.message) {
                error.message = ret.message;
              }
              if (ret.alert) {
                error.alert.description = ret.alert;
              }
            } else if (typeof ret === "number") {
              error.alert.description = ret;
            }
          }
          return c.error(c, error);
        }
      }
      if (c.session.certificateRequest !== null) {
        record = tls.createRecord(c, {
          type: tls.ContentType.handshake,
          data: tls.createCertificate(c)
        });
        tls.queue(c, record);
      }
      record = tls.createRecord(c, {
        type: tls.ContentType.handshake,
        data: tls.createClientKeyExchange(c)
      });
      tls.queue(c, record);
      c.expect = SER;
      var callback = function(c2, signature) {
        if (c2.session.certificateRequest !== null && c2.session.clientCertificate !== null) {
          tls.queue(c2, tls.createRecord(c2, {
            type: tls.ContentType.handshake,
            data: tls.createCertificateVerify(c2, signature)
          }));
        }
        tls.queue(c2, tls.createRecord(c2, {
          type: tls.ContentType.change_cipher_spec,
          data: tls.createChangeCipherSpec()
        }));
        c2.state.pending = tls.createConnectionState(c2);
        c2.state.current.write = c2.state.pending.write;
        tls.queue(c2, tls.createRecord(c2, {
          type: tls.ContentType.handshake,
          data: tls.createFinished(c2)
        }));
        c2.expect = SCC;
        tls.flush(c2);
        c2.process();
      };
      if (c.session.certificateRequest === null || c.session.clientCertificate === null) {
        return callback(c, null);
      }
      tls.getClientSignature(c, callback);
    };
    tls.handleChangeCipherSpec = function(c, record) {
      if (record.fragment.getByte() !== 1) {
        return c.error(c, {
          message: "Invalid ChangeCipherSpec message received.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.illegal_parameter
          }
        });
      }
      var client = c.entity === tls.ConnectionEnd.client;
      if (c.session.resuming && client || !c.session.resuming && !client) {
        c.state.pending = tls.createConnectionState(c);
      }
      c.state.current.read = c.state.pending.read;
      if (!c.session.resuming && client || c.session.resuming && !client) {
        c.state.pending = null;
      }
      c.expect = client ? SFI : CFI;
      c.process();
    };
    tls.handleFinished = function(c, record, length) {
      var b = record.fragment;
      b.read -= 4;
      var msgBytes = b.bytes();
      b.read += 4;
      var vd = record.fragment.getBytes();
      b = forge2.util.createBuffer();
      b.putBuffer(c.session.md5.digest());
      b.putBuffer(c.session.sha1.digest());
      var client = c.entity === tls.ConnectionEnd.client;
      var label = client ? "server finished" : "client finished";
      var sp = c.session.sp;
      var vdl = 12;
      var prf = prf_TLS1;
      b = prf(sp.master_secret, label, b.getBytes(), vdl);
      if (b.getBytes() !== vd) {
        return c.error(c, {
          message: "Invalid verify_data in Finished message.",
          send: true,
          alert: {
            level: tls.Alert.Level.fatal,
            description: tls.Alert.Description.decrypt_error
          }
        });
      }
      c.session.md5.update(msgBytes);
      c.session.sha1.update(msgBytes);
      if (c.session.resuming && client || !c.session.resuming && !client) {
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.change_cipher_spec,
          data: tls.createChangeCipherSpec()
        }));
        c.state.current.write = c.state.pending.write;
        c.state.pending = null;
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.handshake,
          data: tls.createFinished(c)
        }));
      }
      c.expect = client ? SAD : CAD;
      c.handshaking = false;
      ++c.handshakes;
      c.peerCertificate = client ? c.session.serverCertificate : c.session.clientCertificate;
      tls.flush(c);
      c.isConnected = true;
      c.connected(c);
      c.process();
    };
    tls.handleAlert = function(c, record) {
      var b = record.fragment;
      var alert = {
        level: b.getByte(),
        description: b.getByte()
      };
      var msg;
      switch (alert.description) {
        case tls.Alert.Description.close_notify:
          msg = "Connection closed.";
          break;
        case tls.Alert.Description.unexpected_message:
          msg = "Unexpected message.";
          break;
        case tls.Alert.Description.bad_record_mac:
          msg = "Bad record MAC.";
          break;
        case tls.Alert.Description.decryption_failed:
          msg = "Decryption failed.";
          break;
        case tls.Alert.Description.record_overflow:
          msg = "Record overflow.";
          break;
        case tls.Alert.Description.decompression_failure:
          msg = "Decompression failed.";
          break;
        case tls.Alert.Description.handshake_failure:
          msg = "Handshake failure.";
          break;
        case tls.Alert.Description.bad_certificate:
          msg = "Bad certificate.";
          break;
        case tls.Alert.Description.unsupported_certificate:
          msg = "Unsupported certificate.";
          break;
        case tls.Alert.Description.certificate_revoked:
          msg = "Certificate revoked.";
          break;
        case tls.Alert.Description.certificate_expired:
          msg = "Certificate expired.";
          break;
        case tls.Alert.Description.certificate_unknown:
          msg = "Certificate unknown.";
          break;
        case tls.Alert.Description.illegal_parameter:
          msg = "Illegal parameter.";
          break;
        case tls.Alert.Description.unknown_ca:
          msg = "Unknown certificate authority.";
          break;
        case tls.Alert.Description.access_denied:
          msg = "Access denied.";
          break;
        case tls.Alert.Description.decode_error:
          msg = "Decode error.";
          break;
        case tls.Alert.Description.decrypt_error:
          msg = "Decrypt error.";
          break;
        case tls.Alert.Description.export_restriction:
          msg = "Export restriction.";
          break;
        case tls.Alert.Description.protocol_version:
          msg = "Unsupported protocol version.";
          break;
        case tls.Alert.Description.insufficient_security:
          msg = "Insufficient security.";
          break;
        case tls.Alert.Description.internal_error:
          msg = "Internal error.";
          break;
        case tls.Alert.Description.user_canceled:
          msg = "User canceled.";
          break;
        case tls.Alert.Description.no_renegotiation:
          msg = "Renegotiation not supported.";
          break;
        default:
          msg = "Unknown error.";
          break;
      }
      if (alert.description === tls.Alert.Description.close_notify) {
        return c.close();
      }
      c.error(c, {
        message: msg,
        send: false,
        // origin is the opposite end
        origin: c.entity === tls.ConnectionEnd.client ? "server" : "client",
        alert
      });
      c.process();
    };
    tls.handleHandshake = function(c, record) {
      var b = record.fragment;
      var type = b.getByte();
      var length = b.getInt24();
      if (length > b.length()) {
        c.fragmented = record;
        record.fragment = forge2.util.createBuffer();
        b.read -= 4;
        return c.process();
      }
      c.fragmented = null;
      b.read -= 4;
      var bytes = b.bytes(length + 4);
      b.read += 4;
      if (type in hsTable[c.entity][c.expect]) {
        if (c.entity === tls.ConnectionEnd.server && !c.open && !c.fail) {
          c.handshaking = true;
          c.session = {
            version: null,
            extensions: {
              server_name: {
                serverNameList: []
              }
            },
            cipherSuite: null,
            compressionMethod: null,
            serverCertificate: null,
            clientCertificate: null,
            md5: forge2.md.md5.create(),
            sha1: forge2.md.sha1.create()
          };
        }
        if (type !== tls.HandshakeType.hello_request && type !== tls.HandshakeType.certificate_verify && type !== tls.HandshakeType.finished) {
          c.session.md5.update(bytes);
          c.session.sha1.update(bytes);
        }
        hsTable[c.entity][c.expect][type](c, record, length);
      } else {
        tls.handleUnexpected(c, record);
      }
    };
    tls.handleApplicationData = function(c, record) {
      c.data.putBuffer(record.fragment);
      c.dataReady(c);
      c.process();
    };
    tls.handleHeartbeat = function(c, record) {
      var b = record.fragment;
      var type = b.getByte();
      var length = b.getInt16();
      var payload = b.getBytes(length);
      if (type === tls.HeartbeatMessageType.heartbeat_request) {
        if (c.handshaking || length > payload.length) {
          return c.process();
        }
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.heartbeat,
          data: tls.createHeartbeat(
            tls.HeartbeatMessageType.heartbeat_response,
            payload
          )
        }));
        tls.flush(c);
      } else if (type === tls.HeartbeatMessageType.heartbeat_response) {
        if (payload !== c.expectedHeartbeatPayload) {
          return c.process();
        }
        if (c.heartbeatReceived) {
          c.heartbeatReceived(c, forge2.util.createBuffer(payload));
        }
      }
      c.process();
    };
    var SHE = 0;
    var SCE = 1;
    var SKE = 2;
    var SCR = 3;
    var SHD = 4;
    var SCC = 5;
    var SFI = 6;
    var SAD = 7;
    var SER = 8;
    var CHE = 0;
    var CCE = 1;
    var CKE = 2;
    var CCV = 3;
    var CCC = 4;
    var CFI = 5;
    var CAD = 6;
    var __ = tls.handleUnexpected;
    var R0 = tls.handleChangeCipherSpec;
    var R1 = tls.handleAlert;
    var R2 = tls.handleHandshake;
    var R3 = tls.handleApplicationData;
    var R4 = tls.handleHeartbeat;
    var ctTable = [];
    ctTable[tls.ConnectionEnd.client] = [
      //      CC,AL,HS,AD,HB
      /*SHE*/
      [__, R1, R2, __, R4],
      /*SCE*/
      [__, R1, R2, __, R4],
      /*SKE*/
      [__, R1, R2, __, R4],
      /*SCR*/
      [__, R1, R2, __, R4],
      /*SHD*/
      [__, R1, R2, __, R4],
      /*SCC*/
      [R0, R1, __, __, R4],
      /*SFI*/
      [__, R1, R2, __, R4],
      /*SAD*/
      [__, R1, R2, R3, R4],
      /*SER*/
      [__, R1, R2, __, R4]
    ];
    ctTable[tls.ConnectionEnd.server] = [
      //      CC,AL,HS,AD
      /*CHE*/
      [__, R1, R2, __, R4],
      /*CCE*/
      [__, R1, R2, __, R4],
      /*CKE*/
      [__, R1, R2, __, R4],
      /*CCV*/
      [__, R1, R2, __, R4],
      /*CCC*/
      [R0, R1, __, __, R4],
      /*CFI*/
      [__, R1, R2, __, R4],
      /*CAD*/
      [__, R1, R2, R3, R4],
      /*CER*/
      [__, R1, R2, __, R4]
    ];
    var H0 = tls.handleHelloRequest;
    var H1 = tls.handleServerHello;
    var H2 = tls.handleCertificate;
    var H3 = tls.handleServerKeyExchange;
    var H4 = tls.handleCertificateRequest;
    var H5 = tls.handleServerHelloDone;
    var H6 = tls.handleFinished;
    var hsTable = [];
    hsTable[tls.ConnectionEnd.client] = [
      //      HR,01,SH,03,04,05,06,07,08,09,10,SC,SK,CR,HD,15,CK,17,18,19,FI
      /*SHE*/
      [__, __, H1, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*SCE*/
      [H0, __, __, __, __, __, __, __, __, __, __, H2, H3, H4, H5, __, __, __, __, __, __],
      /*SKE*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, H3, H4, H5, __, __, __, __, __, __],
      /*SCR*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, H4, H5, __, __, __, __, __, __],
      /*SHD*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, __, H5, __, __, __, __, __, __],
      /*SCC*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*SFI*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, H6],
      /*SAD*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*SER*/
      [H0, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __]
    ];
    var H7 = tls.handleClientHello;
    var H8 = tls.handleClientKeyExchange;
    var H9 = tls.handleCertificateVerify;
    hsTable[tls.ConnectionEnd.server] = [
      //      01,CH,02,03,04,05,06,07,08,09,10,CC,12,13,14,CV,CK,17,18,19,FI
      /*CHE*/
      [__, H7, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*CCE*/
      [__, __, __, __, __, __, __, __, __, __, __, H2, __, __, __, __, __, __, __, __, __],
      /*CKE*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, H8, __, __, __, __],
      /*CCV*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, H9, __, __, __, __, __],
      /*CCC*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*CFI*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, H6],
      /*CAD*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
      /*CER*/
      [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __]
    ];
    tls.generateKeys = function(c, sp) {
      var prf = prf_TLS1;
      var random = sp.client_random + sp.server_random;
      if (!c.session.resuming) {
        sp.master_secret = prf(
          sp.pre_master_secret,
          "master secret",
          random,
          48
        ).bytes();
        sp.pre_master_secret = null;
      }
      random = sp.server_random + sp.client_random;
      var length = 2 * sp.mac_key_length + 2 * sp.enc_key_length;
      var tls10 = c.version.major === tls.Versions.TLS_1_0.major && c.version.minor === tls.Versions.TLS_1_0.minor;
      if (tls10) {
        length += 2 * sp.fixed_iv_length;
      }
      var km = prf(sp.master_secret, "key expansion", random, length);
      var rval = {
        client_write_MAC_key: km.getBytes(sp.mac_key_length),
        server_write_MAC_key: km.getBytes(sp.mac_key_length),
        client_write_key: km.getBytes(sp.enc_key_length),
        server_write_key: km.getBytes(sp.enc_key_length)
      };
      if (tls10) {
        rval.client_write_IV = km.getBytes(sp.fixed_iv_length);
        rval.server_write_IV = km.getBytes(sp.fixed_iv_length);
      }
      return rval;
    };
    tls.createConnectionState = function(c) {
      var client = c.entity === tls.ConnectionEnd.client;
      var createMode = function() {
        var mode = {
          // two 32-bit numbers, first is most significant
          sequenceNumber: [0, 0],
          macKey: null,
          macLength: 0,
          macFunction: null,
          cipherState: null,
          cipherFunction: function(record) {
            return true;
          },
          compressionState: null,
          compressFunction: function(record) {
            return true;
          },
          updateSequenceNumber: function() {
            if (mode.sequenceNumber[1] === 4294967295) {
              mode.sequenceNumber[1] = 0;
              ++mode.sequenceNumber[0];
            } else {
              ++mode.sequenceNumber[1];
            }
          }
        };
        return mode;
      };
      var state = {
        read: createMode(),
        write: createMode()
      };
      state.read.update = function(c2, record) {
        if (!state.read.cipherFunction(record, state.read)) {
          c2.error(c2, {
            message: "Could not decrypt record or bad MAC.",
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              // doesn't matter if decryption failed or MAC was
              // invalid, return the same error so as not to reveal
              // which one occurred
              description: tls.Alert.Description.bad_record_mac
            }
          });
        } else if (!state.read.compressFunction(c2, record, state.read)) {
          c2.error(c2, {
            message: "Could not decompress record.",
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.decompression_failure
            }
          });
        }
        return !c2.fail;
      };
      state.write.update = function(c2, record) {
        if (!state.write.compressFunction(c2, record, state.write)) {
          c2.error(c2, {
            message: "Could not compress record.",
            send: false,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.internal_error
            }
          });
        } else if (!state.write.cipherFunction(record, state.write)) {
          c2.error(c2, {
            message: "Could not encrypt record.",
            send: false,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.internal_error
            }
          });
        }
        return !c2.fail;
      };
      if (c.session) {
        var sp = c.session.sp;
        c.session.cipherSuite.initSecurityParameters(sp);
        sp.keys = tls.generateKeys(c, sp);
        state.read.macKey = client ? sp.keys.server_write_MAC_key : sp.keys.client_write_MAC_key;
        state.write.macKey = client ? sp.keys.client_write_MAC_key : sp.keys.server_write_MAC_key;
        c.session.cipherSuite.initConnectionState(state, c, sp);
        switch (sp.compression_algorithm) {
          case tls.CompressionMethod.none:
            break;
          case tls.CompressionMethod.deflate:
            state.read.compressFunction = inflate;
            state.write.compressFunction = deflate;
            break;
          default:
            throw new Error("Unsupported compression algorithm.");
        }
      }
      return state;
    };
    tls.createRandom = function() {
      var d = /* @__PURE__ */ new Date();
      var utc = +d + d.getTimezoneOffset() * 6e4;
      var rval = forge2.util.createBuffer();
      rval.putInt32(utc);
      rval.putBytes(forge2.random.getBytes(28));
      return rval;
    };
    tls.createRecord = function(c, options) {
      if (!options.data) {
        return null;
      }
      var record = {
        type: options.type,
        version: {
          major: c.version.major,
          minor: c.version.minor
        },
        length: options.data.length(),
        fragment: options.data
      };
      return record;
    };
    tls.createAlert = function(c, alert) {
      var b = forge2.util.createBuffer();
      b.putByte(alert.level);
      b.putByte(alert.description);
      return tls.createRecord(c, {
        type: tls.ContentType.alert,
        data: b
      });
    };
    tls.createClientHello = function(c) {
      c.session.clientHelloVersion = {
        major: c.version.major,
        minor: c.version.minor
      };
      var cipherSuites = forge2.util.createBuffer();
      for (var i2 = 0; i2 < c.cipherSuites.length; ++i2) {
        var cs = c.cipherSuites[i2];
        cipherSuites.putByte(cs.id[0]);
        cipherSuites.putByte(cs.id[1]);
      }
      var cSuites = cipherSuites.length();
      var compressionMethods = forge2.util.createBuffer();
      compressionMethods.putByte(tls.CompressionMethod.none);
      var cMethods = compressionMethods.length();
      var extensions = forge2.util.createBuffer();
      if (c.virtualHost) {
        var ext = forge2.util.createBuffer();
        ext.putByte(0);
        ext.putByte(0);
        var serverName = forge2.util.createBuffer();
        serverName.putByte(0);
        writeVector(serverName, 2, forge2.util.createBuffer(c.virtualHost));
        var snList = forge2.util.createBuffer();
        writeVector(snList, 2, serverName);
        writeVector(ext, 2, snList);
        extensions.putBuffer(ext);
      }
      var extLength = extensions.length();
      if (extLength > 0) {
        extLength += 2;
      }
      var sessionId = c.session.id;
      var length = sessionId.length + 1 + // session ID vector
      2 + // version (major + minor)
      4 + 28 + // random time and random bytes
      2 + cSuites + // cipher suites vector
      1 + cMethods + // compression methods vector
      extLength;
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.client_hello);
      rval.putInt24(length);
      rval.putByte(c.version.major);
      rval.putByte(c.version.minor);
      rval.putBytes(c.session.sp.client_random);
      writeVector(rval, 1, forge2.util.createBuffer(sessionId));
      writeVector(rval, 2, cipherSuites);
      writeVector(rval, 1, compressionMethods);
      if (extLength > 0) {
        writeVector(rval, 2, extensions);
      }
      return rval;
    };
    tls.createServerHello = function(c) {
      var sessionId = c.session.id;
      var length = sessionId.length + 1 + // session ID vector
      2 + // version (major + minor)
      4 + 28 + // random time and random bytes
      2 + // chosen cipher suite
      1;
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.server_hello);
      rval.putInt24(length);
      rval.putByte(c.version.major);
      rval.putByte(c.version.minor);
      rval.putBytes(c.session.sp.server_random);
      writeVector(rval, 1, forge2.util.createBuffer(sessionId));
      rval.putByte(c.session.cipherSuite.id[0]);
      rval.putByte(c.session.cipherSuite.id[1]);
      rval.putByte(c.session.compressionMethod);
      return rval;
    };
    tls.createCertificate = function(c) {
      var client = c.entity === tls.ConnectionEnd.client;
      var cert = null;
      if (c.getCertificate) {
        var hint;
        if (client) {
          hint = c.session.certificateRequest;
        } else {
          hint = c.session.extensions.server_name.serverNameList;
        }
        cert = c.getCertificate(c, hint);
      }
      var certList = forge2.util.createBuffer();
      if (cert !== null) {
        try {
          if (!forge2.util.isArray(cert)) {
            cert = [cert];
          }
          var asn1 = null;
          for (var i2 = 0; i2 < cert.length; ++i2) {
            var msg = forge2.pem.decode(cert[i2])[0];
            if (msg.type !== "CERTIFICATE" && msg.type !== "X509 CERTIFICATE" && msg.type !== "TRUSTED CERTIFICATE") {
              var error = new Error('Could not convert certificate from PEM; PEM header type is not "CERTIFICATE", "X509 CERTIFICATE", or "TRUSTED CERTIFICATE".');
              error.headerType = msg.type;
              throw error;
            }
            if (msg.procType && msg.procType.type === "ENCRYPTED") {
              throw new Error("Could not convert certificate from PEM; PEM is encrypted.");
            }
            var der = forge2.util.createBuffer(msg.body);
            if (asn1 === null) {
              asn1 = forge2.asn1.fromDer(der.bytes(), false);
            }
            var certBuffer = forge2.util.createBuffer();
            writeVector(certBuffer, 3, der);
            certList.putBuffer(certBuffer);
          }
          cert = forge2.pki.certificateFromAsn1(asn1);
          if (client) {
            c.session.clientCertificate = cert;
          } else {
            c.session.serverCertificate = cert;
          }
        } catch (ex) {
          return c.error(c, {
            message: "Could not send certificate list.",
            cause: ex,
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.bad_certificate
            }
          });
        }
      }
      var length = 3 + certList.length();
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.certificate);
      rval.putInt24(length);
      writeVector(rval, 3, certList);
      return rval;
    };
    tls.createClientKeyExchange = function(c) {
      var b = forge2.util.createBuffer();
      b.putByte(c.session.clientHelloVersion.major);
      b.putByte(c.session.clientHelloVersion.minor);
      b.putBytes(forge2.random.getBytes(46));
      var sp = c.session.sp;
      sp.pre_master_secret = b.getBytes();
      var key2 = c.session.serverCertificate.publicKey;
      b = key2.encrypt(sp.pre_master_secret);
      var length = b.length + 2;
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.client_key_exchange);
      rval.putInt24(length);
      rval.putInt16(b.length);
      rval.putBytes(b);
      return rval;
    };
    tls.createServerKeyExchange = function(c) {
      var length = 0;
      var rval = forge2.util.createBuffer();
      if (length > 0) {
        rval.putByte(tls.HandshakeType.server_key_exchange);
        rval.putInt24(length);
      }
      return rval;
    };
    tls.getClientSignature = function(c, callback) {
      var b = forge2.util.createBuffer();
      b.putBuffer(c.session.md5.digest());
      b.putBuffer(c.session.sha1.digest());
      b = b.getBytes();
      c.getSignature = c.getSignature || function(c2, b2, callback2) {
        var privateKey = null;
        if (c2.getPrivateKey) {
          try {
            privateKey = c2.getPrivateKey(c2, c2.session.clientCertificate);
            privateKey = forge2.pki.privateKeyFromPem(privateKey);
          } catch (ex) {
            c2.error(c2, {
              message: "Could not get private key.",
              cause: ex,
              send: true,
              alert: {
                level: tls.Alert.Level.fatal,
                description: tls.Alert.Description.internal_error
              }
            });
          }
        }
        if (privateKey === null) {
          c2.error(c2, {
            message: "No private key set.",
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: tls.Alert.Description.internal_error
            }
          });
        } else {
          b2 = privateKey.sign(b2, null);
        }
        callback2(c2, b2);
      };
      c.getSignature(c, b, callback);
    };
    tls.createCertificateVerify = function(c, signature) {
      var length = signature.length + 2;
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.certificate_verify);
      rval.putInt24(length);
      rval.putInt16(signature.length);
      rval.putBytes(signature);
      return rval;
    };
    tls.createCertificateRequest = function(c) {
      var certTypes = forge2.util.createBuffer();
      certTypes.putByte(1);
      var cAs = forge2.util.createBuffer();
      for (var key2 in c.caStore.certs) {
        var cert = c.caStore.certs[key2];
        var dn = forge2.pki.distinguishedNameToAsn1(cert.subject);
        var byteBuffer = forge2.asn1.toDer(dn);
        cAs.putInt16(byteBuffer.length());
        cAs.putBuffer(byteBuffer);
      }
      var length = 1 + certTypes.length() + 2 + cAs.length();
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.certificate_request);
      rval.putInt24(length);
      writeVector(rval, 1, certTypes);
      writeVector(rval, 2, cAs);
      return rval;
    };
    tls.createServerHelloDone = function(c) {
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.server_hello_done);
      rval.putInt24(0);
      return rval;
    };
    tls.createChangeCipherSpec = function() {
      var rval = forge2.util.createBuffer();
      rval.putByte(1);
      return rval;
    };
    tls.createFinished = function(c) {
      var b = forge2.util.createBuffer();
      b.putBuffer(c.session.md5.digest());
      b.putBuffer(c.session.sha1.digest());
      var client = c.entity === tls.ConnectionEnd.client;
      var sp = c.session.sp;
      var vdl = 12;
      var prf = prf_TLS1;
      var label = client ? "client finished" : "server finished";
      b = prf(sp.master_secret, label, b.getBytes(), vdl);
      var rval = forge2.util.createBuffer();
      rval.putByte(tls.HandshakeType.finished);
      rval.putInt24(b.length());
      rval.putBuffer(b);
      return rval;
    };
    tls.createHeartbeat = function(type, payload, payloadLength) {
      if (typeof payloadLength === "undefined") {
        payloadLength = payload.length;
      }
      var rval = forge2.util.createBuffer();
      rval.putByte(type);
      rval.putInt16(payloadLength);
      rval.putBytes(payload);
      var plaintextLength = rval.length();
      var paddingLength = Math.max(16, plaintextLength - payloadLength - 3);
      rval.putBytes(forge2.random.getBytes(paddingLength));
      return rval;
    };
    tls.queue = function(c, record) {
      if (!record) {
        return;
      }
      if (record.fragment.length() === 0) {
        if (record.type === tls.ContentType.handshake || record.type === tls.ContentType.alert || record.type === tls.ContentType.change_cipher_spec) {
          return;
        }
      }
      if (record.type === tls.ContentType.handshake) {
        var bytes = record.fragment.bytes();
        c.session.md5.update(bytes);
        c.session.sha1.update(bytes);
        bytes = null;
      }
      var records;
      if (record.fragment.length() <= tls.MaxFragment) {
        records = [record];
      } else {
        records = [];
        var data = record.fragment.bytes();
        while (data.length > tls.MaxFragment) {
          records.push(tls.createRecord(c, {
            type: record.type,
            data: forge2.util.createBuffer(data.slice(0, tls.MaxFragment))
          }));
          data = data.slice(tls.MaxFragment);
        }
        if (data.length > 0) {
          records.push(tls.createRecord(c, {
            type: record.type,
            data: forge2.util.createBuffer(data)
          }));
        }
      }
      for (var i2 = 0; i2 < records.length && !c.fail; ++i2) {
        var rec = records[i2];
        var s = c.state.current.write;
        if (s.update(c, rec)) {
          c.records.push(rec);
        }
      }
    };
    tls.flush = function(c) {
      for (var i2 = 0; i2 < c.records.length; ++i2) {
        var record = c.records[i2];
        c.tlsData.putByte(record.type);
        c.tlsData.putByte(record.version.major);
        c.tlsData.putByte(record.version.minor);
        c.tlsData.putInt16(record.fragment.length());
        c.tlsData.putBuffer(c.records[i2].fragment);
      }
      c.records = [];
      return c.tlsDataReady(c);
    };
    var _certErrorToAlertDesc = function(error) {
      switch (error) {
        case true:
          return true;
        case forge2.pki.certificateError.bad_certificate:
          return tls.Alert.Description.bad_certificate;
        case forge2.pki.certificateError.unsupported_certificate:
          return tls.Alert.Description.unsupported_certificate;
        case forge2.pki.certificateError.certificate_revoked:
          return tls.Alert.Description.certificate_revoked;
        case forge2.pki.certificateError.certificate_expired:
          return tls.Alert.Description.certificate_expired;
        case forge2.pki.certificateError.certificate_unknown:
          return tls.Alert.Description.certificate_unknown;
        case forge2.pki.certificateError.unknown_ca:
          return tls.Alert.Description.unknown_ca;
        default:
          return tls.Alert.Description.bad_certificate;
      }
    };
    var _alertDescToCertError = function(desc) {
      switch (desc) {
        case true:
          return true;
        case tls.Alert.Description.bad_certificate:
          return forge2.pki.certificateError.bad_certificate;
        case tls.Alert.Description.unsupported_certificate:
          return forge2.pki.certificateError.unsupported_certificate;
        case tls.Alert.Description.certificate_revoked:
          return forge2.pki.certificateError.certificate_revoked;
        case tls.Alert.Description.certificate_expired:
          return forge2.pki.certificateError.certificate_expired;
        case tls.Alert.Description.certificate_unknown:
          return forge2.pki.certificateError.certificate_unknown;
        case tls.Alert.Description.unknown_ca:
          return forge2.pki.certificateError.unknown_ca;
        default:
          return forge2.pki.certificateError.bad_certificate;
      }
    };
    tls.verifyCertificateChain = function(c, chain) {
      try {
        var options = {};
        for (var key2 in c.verifyOptions) {
          options[key2] = c.verifyOptions[key2];
        }
        options.verify = function(vfd, depth, chain2) {
          var desc = _certErrorToAlertDesc(vfd);
          var ret = c.verify(c, vfd, depth, chain2);
          if (ret !== true) {
            if (typeof ret === "object" && !forge2.util.isArray(ret)) {
              var error = new Error("The application rejected the certificate.");
              error.send = true;
              error.alert = {
                level: tls.Alert.Level.fatal,
                description: tls.Alert.Description.bad_certificate
              };
              if (ret.message) {
                error.message = ret.message;
              }
              if (ret.alert) {
                error.alert.description = ret.alert;
              }
              throw error;
            }
            if (ret !== vfd) {
              ret = _alertDescToCertError(ret);
            }
          }
          return ret;
        };
        forge2.pki.verifyCertificateChain(c.caStore, chain, options);
      } catch (ex) {
        var err2 = ex;
        if (typeof err2 !== "object" || forge2.util.isArray(err2)) {
          err2 = {
            send: true,
            alert: {
              level: tls.Alert.Level.fatal,
              description: _certErrorToAlertDesc(ex)
            }
          };
        }
        if (!("send" in err2)) {
          err2.send = true;
        }
        if (!("alert" in err2)) {
          err2.alert = {
            level: tls.Alert.Level.fatal,
            description: _certErrorToAlertDesc(err2.error)
          };
        }
        c.error(c, err2);
      }
      return !c.fail;
    };
    tls.createSessionCache = function(cache, capacity) {
      var rval = null;
      if (cache && cache.getSession && cache.setSession && cache.order) {
        rval = cache;
      } else {
        rval = {};
        rval.cache = cache || {};
        rval.capacity = Math.max(capacity || 100, 1);
        rval.order = [];
        for (var key2 in cache) {
          if (rval.order.length <= capacity) {
            rval.order.push(key2);
          } else {
            delete cache[key2];
          }
        }
        rval.getSession = function(sessionId) {
          var session = null;
          var key3 = null;
          if (sessionId) {
            key3 = forge2.util.bytesToHex(sessionId);
          } else if (rval.order.length > 0) {
            key3 = rval.order[0];
          }
          if (key3 !== null && key3 in rval.cache) {
            session = rval.cache[key3];
            delete rval.cache[key3];
            for (var i2 in rval.order) {
              if (rval.order[i2] === key3) {
                rval.order.splice(i2, 1);
                break;
              }
            }
          }
          return session;
        };
        rval.setSession = function(sessionId, session) {
          if (rval.order.length === rval.capacity) {
            var key3 = rval.order.shift();
            delete rval.cache[key3];
          }
          var key3 = forge2.util.bytesToHex(sessionId);
          rval.order.push(key3);
          rval.cache[key3] = session;
        };
      }
      return rval;
    };
    tls.createConnection = function(options) {
      var caStore = null;
      if (options.caStore) {
        if (forge2.util.isArray(options.caStore)) {
          caStore = forge2.pki.createCaStore(options.caStore);
        } else {
          caStore = options.caStore;
        }
      } else {
        caStore = forge2.pki.createCaStore();
      }
      var cipherSuites = options.cipherSuites || null;
      if (cipherSuites === null) {
        cipherSuites = [];
        for (var key2 in tls.CipherSuites) {
          cipherSuites.push(tls.CipherSuites[key2]);
        }
      }
      var entity = options.server || false ? tls.ConnectionEnd.server : tls.ConnectionEnd.client;
      var sessionCache = options.sessionCache ? tls.createSessionCache(options.sessionCache) : null;
      var c = {
        version: { major: tls.Version.major, minor: tls.Version.minor },
        entity,
        sessionId: options.sessionId,
        caStore,
        sessionCache,
        cipherSuites,
        connected: options.connected,
        virtualHost: options.virtualHost || null,
        verifyClient: options.verifyClient || false,
        verify: options.verify || function(cn, vfd, dpth, cts) {
          return vfd;
        },
        verifyOptions: options.verifyOptions || {},
        getCertificate: options.getCertificate || null,
        getPrivateKey: options.getPrivateKey || null,
        getSignature: options.getSignature || null,
        input: forge2.util.createBuffer(),
        tlsData: forge2.util.createBuffer(),
        data: forge2.util.createBuffer(),
        tlsDataReady: options.tlsDataReady,
        dataReady: options.dataReady,
        heartbeatReceived: options.heartbeatReceived,
        closed: options.closed,
        error: function(c2, ex) {
          ex.origin = ex.origin || (c2.entity === tls.ConnectionEnd.client ? "client" : "server");
          if (ex.send) {
            tls.queue(c2, tls.createAlert(c2, ex.alert));
            tls.flush(c2);
          }
          var fatal = ex.fatal !== false;
          if (fatal) {
            c2.fail = true;
          }
          options.error(c2, ex);
          if (fatal) {
            c2.close(false);
          }
        },
        deflate: options.deflate || null,
        inflate: options.inflate || null
      };
      c.reset = function(clearFail) {
        c.version = { major: tls.Version.major, minor: tls.Version.minor };
        c.record = null;
        c.session = null;
        c.peerCertificate = null;
        c.state = {
          pending: null,
          current: null
        };
        c.expect = c.entity === tls.ConnectionEnd.client ? SHE : CHE;
        c.fragmented = null;
        c.records = [];
        c.open = false;
        c.handshakes = 0;
        c.handshaking = false;
        c.isConnected = false;
        c.fail = !(clearFail || typeof clearFail === "undefined");
        c.input.clear();
        c.tlsData.clear();
        c.data.clear();
        c.state.current = tls.createConnectionState(c);
      };
      c.reset();
      var _update = function(c2, record) {
        var aligned = record.type - tls.ContentType.change_cipher_spec;
        var handlers = ctTable[c2.entity][c2.expect];
        if (aligned in handlers) {
          handlers[aligned](c2, record);
        } else {
          tls.handleUnexpected(c2, record);
        }
      };
      var _readRecordHeader = function(c2) {
        var rval = 0;
        var b = c2.input;
        var len = b.length();
        if (len < 5) {
          rval = 5 - len;
        } else {
          c2.record = {
            type: b.getByte(),
            version: {
              major: b.getByte(),
              minor: b.getByte()
            },
            length: b.getInt16(),
            fragment: forge2.util.createBuffer(),
            ready: false
          };
          var compatibleVersion = c2.record.version.major === c2.version.major;
          if (compatibleVersion && c2.session && c2.session.version) {
            compatibleVersion = c2.record.version.minor === c2.version.minor;
          }
          if (!compatibleVersion) {
            c2.error(c2, {
              message: "Incompatible TLS version.",
              send: true,
              alert: {
                level: tls.Alert.Level.fatal,
                description: tls.Alert.Description.protocol_version
              }
            });
          }
        }
        return rval;
      };
      var _readRecord = function(c2) {
        var rval = 0;
        var b = c2.input;
        var len = b.length();
        if (len < c2.record.length) {
          rval = c2.record.length - len;
        } else {
          c2.record.fragment.putBytes(b.getBytes(c2.record.length));
          b.compact();
          var s = c2.state.current.read;
          if (s.update(c2, c2.record)) {
            if (c2.fragmented !== null) {
              if (c2.fragmented.type === c2.record.type) {
                c2.fragmented.fragment.putBuffer(c2.record.fragment);
                c2.record = c2.fragmented;
              } else {
                c2.error(c2, {
                  message: "Invalid fragmented record.",
                  send: true,
                  alert: {
                    level: tls.Alert.Level.fatal,
                    description: tls.Alert.Description.unexpected_message
                  }
                });
              }
            }
            c2.record.ready = true;
          }
        }
        return rval;
      };
      c.handshake = function(sessionId) {
        if (c.entity !== tls.ConnectionEnd.client) {
          c.error(c, {
            message: "Cannot initiate handshake as a server.",
            fatal: false
          });
        } else if (c.handshaking) {
          c.error(c, {
            message: "Handshake already in progress.",
            fatal: false
          });
        } else {
          if (c.fail && !c.open && c.handshakes === 0) {
            c.fail = false;
          }
          c.handshaking = true;
          sessionId = sessionId || "";
          var session = null;
          if (sessionId.length > 0) {
            if (c.sessionCache) {
              session = c.sessionCache.getSession(sessionId);
            }
            if (session === null) {
              sessionId = "";
            }
          }
          if (sessionId.length === 0 && c.sessionCache) {
            session = c.sessionCache.getSession();
            if (session !== null) {
              sessionId = session.id;
            }
          }
          c.session = {
            id: sessionId,
            version: null,
            cipherSuite: null,
            compressionMethod: null,
            serverCertificate: null,
            certificateRequest: null,
            clientCertificate: null,
            sp: {},
            md5: forge2.md.md5.create(),
            sha1: forge2.md.sha1.create()
          };
          if (session) {
            c.version = session.version;
            c.session.sp = session.sp;
          }
          c.session.sp.client_random = tls.createRandom().getBytes();
          c.open = true;
          tls.queue(c, tls.createRecord(c, {
            type: tls.ContentType.handshake,
            data: tls.createClientHello(c)
          }));
          tls.flush(c);
        }
      };
      c.process = function(data) {
        var rval = 0;
        if (data) {
          c.input.putBytes(data);
        }
        if (!c.fail) {
          if (c.record !== null && c.record.ready && c.record.fragment.isEmpty()) {
            c.record = null;
          }
          if (c.record === null) {
            rval = _readRecordHeader(c);
          }
          if (!c.fail && c.record !== null && !c.record.ready) {
            rval = _readRecord(c);
          }
          if (!c.fail && c.record !== null && c.record.ready) {
            _update(c, c.record);
          }
        }
        return rval;
      };
      c.prepare = function(data) {
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.application_data,
          data: forge2.util.createBuffer(data)
        }));
        return tls.flush(c);
      };
      c.prepareHeartbeatRequest = function(payload, payloadLength) {
        if (payload instanceof forge2.util.ByteBuffer) {
          payload = payload.bytes();
        }
        if (typeof payloadLength === "undefined") {
          payloadLength = payload.length;
        }
        c.expectedHeartbeatPayload = payload;
        tls.queue(c, tls.createRecord(c, {
          type: tls.ContentType.heartbeat,
          data: tls.createHeartbeat(
            tls.HeartbeatMessageType.heartbeat_request,
            payload,
            payloadLength
          )
        }));
        return tls.flush(c);
      };
      c.close = function(clearFail) {
        if (!c.fail && c.sessionCache && c.session) {
          var session = {
            id: c.session.id,
            version: c.session.version,
            sp: c.session.sp
          };
          session.sp.keys = null;
          c.sessionCache.setSession(session.id, session);
        }
        if (c.open) {
          c.open = false;
          c.input.clear();
          if (c.isConnected || c.handshaking) {
            c.isConnected = c.handshaking = false;
            tls.queue(c, tls.createAlert(c, {
              level: tls.Alert.Level.warning,
              description: tls.Alert.Description.close_notify
            }));
            tls.flush(c);
          }
          c.closed(c);
        }
        c.reset(clearFail);
      };
      return c;
    };
    module.exports = forge2.tls = forge2.tls || {};
    for (key in tls) {
      if (typeof tls[key] !== "function") {
        forge2.tls[key] = tls[key];
      }
    }
    var key;
    forge2.tls.prf_tls1 = prf_TLS1;
    forge2.tls.hmac_sha1 = hmac_sha1;
    forge2.tls.createSessionCache = tls.createSessionCache;
    forge2.tls.createConnection = tls.createConnection;
  }
});

// node_modules/node-forge/lib/aesCipherSuites.js
var require_aesCipherSuites = __commonJS({
  "node_modules/node-forge/lib/aesCipherSuites.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_tls();
    var tls = module.exports = forge2.tls;
    tls.CipherSuites["TLS_RSA_WITH_AES_128_CBC_SHA"] = {
      id: [0, 47],
      name: "TLS_RSA_WITH_AES_128_CBC_SHA",
      initSecurityParameters: function(sp) {
        sp.bulk_cipher_algorithm = tls.BulkCipherAlgorithm.aes;
        sp.cipher_type = tls.CipherType.block;
        sp.enc_key_length = 16;
        sp.block_length = 16;
        sp.fixed_iv_length = 16;
        sp.record_iv_length = 16;
        sp.mac_algorithm = tls.MACAlgorithm.hmac_sha1;
        sp.mac_length = 20;
        sp.mac_key_length = 20;
      },
      initConnectionState
    };
    tls.CipherSuites["TLS_RSA_WITH_AES_256_CBC_SHA"] = {
      id: [0, 53],
      name: "TLS_RSA_WITH_AES_256_CBC_SHA",
      initSecurityParameters: function(sp) {
        sp.bulk_cipher_algorithm = tls.BulkCipherAlgorithm.aes;
        sp.cipher_type = tls.CipherType.block;
        sp.enc_key_length = 32;
        sp.block_length = 16;
        sp.fixed_iv_length = 16;
        sp.record_iv_length = 16;
        sp.mac_algorithm = tls.MACAlgorithm.hmac_sha1;
        sp.mac_length = 20;
        sp.mac_key_length = 20;
      },
      initConnectionState
    };
    function initConnectionState(state, c, sp) {
      var client = c.entity === forge2.tls.ConnectionEnd.client;
      state.read.cipherState = {
        init: false,
        cipher: forge2.cipher.createDecipher("AES-CBC", client ? sp.keys.server_write_key : sp.keys.client_write_key),
        iv: client ? sp.keys.server_write_IV : sp.keys.client_write_IV
      };
      state.write.cipherState = {
        init: false,
        cipher: forge2.cipher.createCipher("AES-CBC", client ? sp.keys.client_write_key : sp.keys.server_write_key),
        iv: client ? sp.keys.client_write_IV : sp.keys.server_write_IV
      };
      state.read.cipherFunction = decrypt_aes_cbc_sha1;
      state.write.cipherFunction = encrypt_aes_cbc_sha1;
      state.read.macLength = state.write.macLength = sp.mac_length;
      state.read.macFunction = state.write.macFunction = tls.hmac_sha1;
    }
    function encrypt_aes_cbc_sha1(record, s) {
      var rval = false;
      var mac = s.macFunction(s.macKey, s.sequenceNumber, record);
      record.fragment.putBytes(mac);
      s.updateSequenceNumber();
      var iv;
      if (record.version.minor === tls.Versions.TLS_1_0.minor) {
        iv = s.cipherState.init ? null : s.cipherState.iv;
      } else {
        iv = forge2.random.getBytesSync(16);
      }
      s.cipherState.init = true;
      var cipher = s.cipherState.cipher;
      cipher.start({ iv });
      if (record.version.minor >= tls.Versions.TLS_1_1.minor) {
        cipher.output.putBytes(iv);
      }
      cipher.update(record.fragment);
      if (cipher.finish(encrypt_aes_cbc_sha1_padding)) {
        record.fragment = cipher.output;
        record.length = record.fragment.length();
        rval = true;
      }
      return rval;
    }
    function encrypt_aes_cbc_sha1_padding(blockSize, input, decrypt) {
      if (!decrypt) {
        var padding = blockSize - input.length() % blockSize;
        input.fillWithByte(padding - 1, padding);
      }
      return true;
    }
    function decrypt_aes_cbc_sha1_padding(blockSize, output, decrypt) {
      var rval = true;
      if (decrypt) {
        var len = output.length();
        var paddingLength = output.last();
        for (var i2 = len - 1 - paddingLength; i2 < len - 1; ++i2) {
          rval = rval && output.at(i2) == paddingLength;
        }
        if (rval) {
          output.truncate(paddingLength + 1);
        }
      }
      return rval;
    }
    function decrypt_aes_cbc_sha1(record, s) {
      var rval = false;
      var iv;
      if (record.version.minor === tls.Versions.TLS_1_0.minor) {
        iv = s.cipherState.init ? null : s.cipherState.iv;
      } else {
        iv = record.fragment.getBytes(16);
      }
      s.cipherState.init = true;
      var cipher = s.cipherState.cipher;
      cipher.start({ iv });
      cipher.update(record.fragment);
      rval = cipher.finish(decrypt_aes_cbc_sha1_padding);
      var macLen = s.macLength;
      var mac = forge2.random.getBytesSync(macLen);
      var len = cipher.output.length();
      if (len >= macLen) {
        record.fragment = cipher.output.getBytes(len - macLen);
        mac = cipher.output.getBytes(macLen);
      } else {
        record.fragment = cipher.output.getBytes();
      }
      record.fragment = forge2.util.createBuffer(record.fragment);
      record.length = record.fragment.length();
      var mac2 = s.macFunction(s.macKey, s.sequenceNumber, record);
      s.updateSequenceNumber();
      rval = compareMacs(s.macKey, mac, mac2) && rval;
      return rval;
    }
    function compareMacs(key, mac1, mac2) {
      var hmac = forge2.hmac.create();
      hmac.start("SHA1", key);
      hmac.update(mac1);
      mac1 = hmac.digest().getBytes();
      hmac.start(null, null);
      hmac.update(mac2);
      mac2 = hmac.digest().getBytes();
      return mac1 === mac2;
    }
  }
});

// node_modules/node-forge/lib/sha512.js
var require_sha512 = __commonJS({
  "node_modules/node-forge/lib/sha512.js"(exports, module) {
    var forge2 = require_forge();
    require_md();
    require_util();
    var sha512 = module.exports = forge2.sha512 = forge2.sha512 || {};
    forge2.md.sha512 = forge2.md.algorithms.sha512 = sha512;
    var sha384 = forge2.sha384 = forge2.sha512.sha384 = forge2.sha512.sha384 || {};
    sha384.create = function() {
      return sha512.create("SHA-384");
    };
    forge2.md.sha384 = forge2.md.algorithms.sha384 = sha384;
    forge2.sha512.sha256 = forge2.sha512.sha256 || {
      create: function() {
        return sha512.create("SHA-512/256");
      }
    };
    forge2.md["sha512/256"] = forge2.md.algorithms["sha512/256"] = forge2.sha512.sha256;
    forge2.sha512.sha224 = forge2.sha512.sha224 || {
      create: function() {
        return sha512.create("SHA-512/224");
      }
    };
    forge2.md["sha512/224"] = forge2.md.algorithms["sha512/224"] = forge2.sha512.sha224;
    sha512.create = function(algorithm) {
      if (!_initialized) {
        _init();
      }
      if (typeof algorithm === "undefined") {
        algorithm = "SHA-512";
      }
      if (!(algorithm in _states)) {
        throw new Error("Invalid SHA-512 algorithm: " + algorithm);
      }
      var _state = _states[algorithm];
      var _h = null;
      var _input = forge2.util.createBuffer();
      var _w = new Array(80);
      for (var wi = 0; wi < 80; ++wi) {
        _w[wi] = new Array(2);
      }
      var digestLength = 64;
      switch (algorithm) {
        case "SHA-384":
          digestLength = 48;
          break;
        case "SHA-512/256":
          digestLength = 32;
          break;
        case "SHA-512/224":
          digestLength = 28;
          break;
      }
      var md = {
        // SHA-512 => sha512
        algorithm: algorithm.replace("-", "").toLowerCase(),
        blockLength: 128,
        digestLength,
        // 56-bit length of message so far (does not including padding)
        messageLength: 0,
        // true message length
        fullMessageLength: null,
        // size of message length in bytes
        messageLengthSize: 16
      };
      md.start = function() {
        md.messageLength = 0;
        md.fullMessageLength = md.messageLength128 = [];
        var int32s = md.messageLengthSize / 4;
        for (var i2 = 0; i2 < int32s; ++i2) {
          md.fullMessageLength.push(0);
        }
        _input = forge2.util.createBuffer();
        _h = new Array(_state.length);
        for (var i2 = 0; i2 < _state.length; ++i2) {
          _h[i2] = _state[i2].slice(0);
        }
        return md;
      };
      md.start();
      md.update = function(msg, encoding) {
        if (encoding === "utf8") {
          msg = forge2.util.encodeUtf8(msg);
        }
        var len = msg.length;
        md.messageLength += len;
        len = [len / 4294967296 >>> 0, len >>> 0];
        for (var i2 = md.fullMessageLength.length - 1; i2 >= 0; --i2) {
          md.fullMessageLength[i2] += len[1];
          len[1] = len[0] + (md.fullMessageLength[i2] / 4294967296 >>> 0);
          md.fullMessageLength[i2] = md.fullMessageLength[i2] >>> 0;
          len[0] = len[1] / 4294967296 >>> 0;
        }
        _input.putBytes(msg);
        _update(_h, _w, _input);
        if (_input.read > 2048 || _input.length() === 0) {
          _input.compact();
        }
        return md;
      };
      md.digest = function() {
        var finalBlock = forge2.util.createBuffer();
        finalBlock.putBytes(_input.bytes());
        var remaining = md.fullMessageLength[md.fullMessageLength.length - 1] + md.messageLengthSize;
        var overflow = remaining & md.blockLength - 1;
        finalBlock.putBytes(_padding.substr(0, md.blockLength - overflow));
        var next, carry;
        var bits = md.fullMessageLength[0] * 8;
        for (var i2 = 0; i2 < md.fullMessageLength.length - 1; ++i2) {
          next = md.fullMessageLength[i2 + 1] * 8;
          carry = next / 4294967296 >>> 0;
          bits += carry;
          finalBlock.putInt32(bits >>> 0);
          bits = next >>> 0;
        }
        finalBlock.putInt32(bits);
        var h = new Array(_h.length);
        for (var i2 = 0; i2 < _h.length; ++i2) {
          h[i2] = _h[i2].slice(0);
        }
        _update(h, _w, finalBlock);
        var rval = forge2.util.createBuffer();
        var hlen;
        if (algorithm === "SHA-512") {
          hlen = h.length;
        } else if (algorithm === "SHA-384") {
          hlen = h.length - 2;
        } else {
          hlen = h.length - 4;
        }
        for (var i2 = 0; i2 < hlen; ++i2) {
          rval.putInt32(h[i2][0]);
          if (i2 !== hlen - 1 || algorithm !== "SHA-512/224") {
            rval.putInt32(h[i2][1]);
          }
        }
        return rval;
      };
      return md;
    };
    var _padding = null;
    var _initialized = false;
    var _k = null;
    var _states = null;
    function _init() {
      _padding = String.fromCharCode(128);
      _padding += forge2.util.fillString(String.fromCharCode(0), 128);
      _k = [
        [1116352408, 3609767458],
        [1899447441, 602891725],
        [3049323471, 3964484399],
        [3921009573, 2173295548],
        [961987163, 4081628472],
        [1508970993, 3053834265],
        [2453635748, 2937671579],
        [2870763221, 3664609560],
        [3624381080, 2734883394],
        [310598401, 1164996542],
        [607225278, 1323610764],
        [1426881987, 3590304994],
        [1925078388, 4068182383],
        [2162078206, 991336113],
        [2614888103, 633803317],
        [3248222580, 3479774868],
        [3835390401, 2666613458],
        [4022224774, 944711139],
        [264347078, 2341262773],
        [604807628, 2007800933],
        [770255983, 1495990901],
        [1249150122, 1856431235],
        [1555081692, 3175218132],
        [1996064986, 2198950837],
        [2554220882, 3999719339],
        [2821834349, 766784016],
        [2952996808, 2566594879],
        [3210313671, 3203337956],
        [3336571891, 1034457026],
        [3584528711, 2466948901],
        [113926993, 3758326383],
        [338241895, 168717936],
        [666307205, 1188179964],
        [773529912, 1546045734],
        [1294757372, 1522805485],
        [1396182291, 2643833823],
        [1695183700, 2343527390],
        [1986661051, 1014477480],
        [2177026350, 1206759142],
        [2456956037, 344077627],
        [2730485921, 1290863460],
        [2820302411, 3158454273],
        [3259730800, 3505952657],
        [3345764771, 106217008],
        [3516065817, 3606008344],
        [3600352804, 1432725776],
        [4094571909, 1467031594],
        [275423344, 851169720],
        [430227734, 3100823752],
        [506948616, 1363258195],
        [659060556, 3750685593],
        [883997877, 3785050280],
        [958139571, 3318307427],
        [1322822218, 3812723403],
        [1537002063, 2003034995],
        [1747873779, 3602036899],
        [1955562222, 1575990012],
        [2024104815, 1125592928],
        [2227730452, 2716904306],
        [2361852424, 442776044],
        [2428436474, 593698344],
        [2756734187, 3733110249],
        [3204031479, 2999351573],
        [3329325298, 3815920427],
        [3391569614, 3928383900],
        [3515267271, 566280711],
        [3940187606, 3454069534],
        [4118630271, 4000239992],
        [116418474, 1914138554],
        [174292421, 2731055270],
        [289380356, 3203993006],
        [460393269, 320620315],
        [685471733, 587496836],
        [852142971, 1086792851],
        [1017036298, 365543100],
        [1126000580, 2618297676],
        [1288033470, 3409855158],
        [1501505948, 4234509866],
        [1607167915, 987167468],
        [1816402316, 1246189591]
      ];
      _states = {};
      _states["SHA-512"] = [
        [1779033703, 4089235720],
        [3144134277, 2227873595],
        [1013904242, 4271175723],
        [2773480762, 1595750129],
        [1359893119, 2917565137],
        [2600822924, 725511199],
        [528734635, 4215389547],
        [1541459225, 327033209]
      ];
      _states["SHA-384"] = [
        [3418070365, 3238371032],
        [1654270250, 914150663],
        [2438529370, 812702999],
        [355462360, 4144912697],
        [1731405415, 4290775857],
        [2394180231, 1750603025],
        [3675008525, 1694076839],
        [1203062813, 3204075428]
      ];
      _states["SHA-512/256"] = [
        [573645204, 4230739756],
        [2673172387, 3360449730],
        [596883563, 1867755857],
        [2520282905, 1497426621],
        [2519219938, 2827943907],
        [3193839141, 1401305490],
        [721525244, 746961066],
        [246885852, 2177182882]
      ];
      _states["SHA-512/224"] = [
        [2352822216, 424955298],
        [1944164710, 2312950998],
        [502970286, 855612546],
        [1738396948, 1479516111],
        [258812777, 2077511080],
        [2011393907, 79989058],
        [1067287976, 1780299464],
        [286451373, 2446758561]
      ];
      _initialized = true;
    }
    function _update(s, w, bytes) {
      var t1_hi, t1_lo;
      var t2_hi, t2_lo;
      var s0_hi, s0_lo;
      var s1_hi, s1_lo;
      var ch_hi, ch_lo;
      var maj_hi, maj_lo;
      var a_hi, a_lo;
      var b_hi, b_lo;
      var c_hi, c_lo;
      var d_hi, d_lo;
      var e_hi, e_lo;
      var f_hi, f_lo;
      var g_hi, g_lo;
      var h_hi, h_lo;
      var i2, hi, lo, w2, w7, w15, w16;
      var len = bytes.length();
      while (len >= 128) {
        for (i2 = 0; i2 < 16; ++i2) {
          w[i2][0] = bytes.getInt32() >>> 0;
          w[i2][1] = bytes.getInt32() >>> 0;
        }
        for (; i2 < 80; ++i2) {
          w2 = w[i2 - 2];
          hi = w2[0];
          lo = w2[1];
          t1_hi = ((hi >>> 19 | lo << 13) ^ // ROTR 19
          (lo >>> 29 | hi << 3) ^ // ROTR 61/(swap + ROTR 29)
          hi >>> 6) >>> 0;
          t1_lo = ((hi << 13 | lo >>> 19) ^ // ROTR 19
          (lo << 3 | hi >>> 29) ^ // ROTR 61/(swap + ROTR 29)
          (hi << 26 | lo >>> 6)) >>> 0;
          w15 = w[i2 - 15];
          hi = w15[0];
          lo = w15[1];
          t2_hi = ((hi >>> 1 | lo << 31) ^ // ROTR 1
          (hi >>> 8 | lo << 24) ^ // ROTR 8
          hi >>> 7) >>> 0;
          t2_lo = ((hi << 31 | lo >>> 1) ^ // ROTR 1
          (hi << 24 | lo >>> 8) ^ // ROTR 8
          (hi << 25 | lo >>> 7)) >>> 0;
          w7 = w[i2 - 7];
          w16 = w[i2 - 16];
          lo = t1_lo + w7[1] + t2_lo + w16[1];
          w[i2][0] = t1_hi + w7[0] + t2_hi + w16[0] + (lo / 4294967296 >>> 0) >>> 0;
          w[i2][1] = lo >>> 0;
        }
        a_hi = s[0][0];
        a_lo = s[0][1];
        b_hi = s[1][0];
        b_lo = s[1][1];
        c_hi = s[2][0];
        c_lo = s[2][1];
        d_hi = s[3][0];
        d_lo = s[3][1];
        e_hi = s[4][0];
        e_lo = s[4][1];
        f_hi = s[5][0];
        f_lo = s[5][1];
        g_hi = s[6][0];
        g_lo = s[6][1];
        h_hi = s[7][0];
        h_lo = s[7][1];
        for (i2 = 0; i2 < 80; ++i2) {
          s1_hi = ((e_hi >>> 14 | e_lo << 18) ^ // ROTR 14
          (e_hi >>> 18 | e_lo << 14) ^ // ROTR 18
          (e_lo >>> 9 | e_hi << 23)) >>> 0;
          s1_lo = ((e_hi << 18 | e_lo >>> 14) ^ // ROTR 14
          (e_hi << 14 | e_lo >>> 18) ^ // ROTR 18
          (e_lo << 23 | e_hi >>> 9)) >>> 0;
          ch_hi = (g_hi ^ e_hi & (f_hi ^ g_hi)) >>> 0;
          ch_lo = (g_lo ^ e_lo & (f_lo ^ g_lo)) >>> 0;
          s0_hi = ((a_hi >>> 28 | a_lo << 4) ^ // ROTR 28
          (a_lo >>> 2 | a_hi << 30) ^ // ROTR 34/(swap + ROTR 2)
          (a_lo >>> 7 | a_hi << 25)) >>> 0;
          s0_lo = ((a_hi << 4 | a_lo >>> 28) ^ // ROTR 28
          (a_lo << 30 | a_hi >>> 2) ^ // ROTR 34/(swap + ROTR 2)
          (a_lo << 25 | a_hi >>> 7)) >>> 0;
          maj_hi = (a_hi & b_hi | c_hi & (a_hi ^ b_hi)) >>> 0;
          maj_lo = (a_lo & b_lo | c_lo & (a_lo ^ b_lo)) >>> 0;
          lo = h_lo + s1_lo + ch_lo + _k[i2][1] + w[i2][1];
          t1_hi = h_hi + s1_hi + ch_hi + _k[i2][0] + w[i2][0] + (lo / 4294967296 >>> 0) >>> 0;
          t1_lo = lo >>> 0;
          lo = s0_lo + maj_lo;
          t2_hi = s0_hi + maj_hi + (lo / 4294967296 >>> 0) >>> 0;
          t2_lo = lo >>> 0;
          h_hi = g_hi;
          h_lo = g_lo;
          g_hi = f_hi;
          g_lo = f_lo;
          f_hi = e_hi;
          f_lo = e_lo;
          lo = d_lo + t1_lo;
          e_hi = d_hi + t1_hi + (lo / 4294967296 >>> 0) >>> 0;
          e_lo = lo >>> 0;
          d_hi = c_hi;
          d_lo = c_lo;
          c_hi = b_hi;
          c_lo = b_lo;
          b_hi = a_hi;
          b_lo = a_lo;
          lo = t1_lo + t2_lo;
          a_hi = t1_hi + t2_hi + (lo / 4294967296 >>> 0) >>> 0;
          a_lo = lo >>> 0;
        }
        lo = s[0][1] + a_lo;
        s[0][0] = s[0][0] + a_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[0][1] = lo >>> 0;
        lo = s[1][1] + b_lo;
        s[1][0] = s[1][0] + b_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[1][1] = lo >>> 0;
        lo = s[2][1] + c_lo;
        s[2][0] = s[2][0] + c_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[2][1] = lo >>> 0;
        lo = s[3][1] + d_lo;
        s[3][0] = s[3][0] + d_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[3][1] = lo >>> 0;
        lo = s[4][1] + e_lo;
        s[4][0] = s[4][0] + e_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[4][1] = lo >>> 0;
        lo = s[5][1] + f_lo;
        s[5][0] = s[5][0] + f_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[5][1] = lo >>> 0;
        lo = s[6][1] + g_lo;
        s[6][0] = s[6][0] + g_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[6][1] = lo >>> 0;
        lo = s[7][1] + h_lo;
        s[7][0] = s[7][0] + h_hi + (lo / 4294967296 >>> 0) >>> 0;
        s[7][1] = lo >>> 0;
        len -= 128;
      }
    }
  }
});

// node_modules/node-forge/lib/asn1-validator.js
var require_asn1_validator = __commonJS({
  "node_modules/node-forge/lib/asn1-validator.js"(exports) {
    var forge2 = require_forge();
    require_asn1();
    var asn1 = forge2.asn1;
    exports.privateKeyValidator = {
      // PrivateKeyInfo
      name: "PrivateKeyInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      value: [{
        // Version (INTEGER)
        name: "PrivateKeyInfo.version",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.INTEGER,
        constructed: false,
        capture: "privateKeyVersion"
      }, {
        // privateKeyAlgorithm
        name: "PrivateKeyInfo.privateKeyAlgorithm",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.OID,
          constructed: false,
          capture: "privateKeyOid"
        }]
      }, {
        // PrivateKey
        name: "PrivateKeyInfo",
        tagClass: asn1.Class.UNIVERSAL,
        type: asn1.Type.OCTETSTRING,
        constructed: false,
        capture: "privateKey"
      }]
    };
    exports.publicKeyValidator = {
      name: "SubjectPublicKeyInfo",
      tagClass: asn1.Class.UNIVERSAL,
      type: asn1.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "subjectPublicKeyInfo",
      value: [
        {
          name: "SubjectPublicKeyInfo.AlgorithmIdentifier",
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "AlgorithmIdentifier.algorithm",
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.OID,
            constructed: false,
            capture: "publicKeyOid"
          }]
        },
        // capture group for ed25519PublicKey
        {
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.BITSTRING,
          constructed: false,
          composed: true,
          captureBitStringValue: "ed25519PublicKey"
        }
        // FIXME: this is capture group for rsaPublicKey, use it in this API or
        // discard?
        /* {
          // subjectPublicKey
          name: 'SubjectPublicKeyInfo.subjectPublicKey',
          tagClass: asn1.Class.UNIVERSAL,
          type: asn1.Type.BITSTRING,
          constructed: false,
          value: [{
            // RSAPublicKey
            name: 'SubjectPublicKeyInfo.subjectPublicKey.RSAPublicKey',
            tagClass: asn1.Class.UNIVERSAL,
            type: asn1.Type.SEQUENCE,
            constructed: true,
            optional: true,
            captureAsn1: 'rsaPublicKey'
          }]
        } */
      ]
    };
  }
});

// node_modules/node-forge/lib/ed25519.js
var require_ed25519 = __commonJS({
  "node_modules/node-forge/lib/ed25519.js"(exports, module) {
    var forge2 = require_forge();
    require_jsbn();
    require_random();
    require_sha512();
    require_util();
    var asn1Validator = require_asn1_validator();
    var publicKeyValidator = asn1Validator.publicKeyValidator;
    var privateKeyValidator = asn1Validator.privateKeyValidator;
    if (typeof BigInteger === "undefined") {
      BigInteger = forge2.jsbn.BigInteger;
    }
    var BigInteger;
    var ByteBuffer = forge2.util.ByteBuffer;
    var NativeBuffer = typeof Buffer === "undefined" ? Uint8Array : Buffer;
    forge2.pki = forge2.pki || {};
    module.exports = forge2.pki.ed25519 = forge2.ed25519 = forge2.ed25519 || {};
    var ed25519 = forge2.ed25519;
    ed25519.constants = {};
    ed25519.constants.PUBLIC_KEY_BYTE_LENGTH = 32;
    ed25519.constants.PRIVATE_KEY_BYTE_LENGTH = 64;
    ed25519.constants.SEED_BYTE_LENGTH = 32;
    ed25519.constants.SIGN_BYTE_LENGTH = 64;
    ed25519.constants.HASH_BYTE_LENGTH = 64;
    ed25519.generateKeyPair = function(options) {
      options = options || {};
      var seed = options.seed;
      if (seed === void 0) {
        seed = forge2.random.getBytesSync(ed25519.constants.SEED_BYTE_LENGTH);
      } else if (typeof seed === "string") {
        if (seed.length !== ed25519.constants.SEED_BYTE_LENGTH) {
          throw new TypeError(
            '"seed" must be ' + ed25519.constants.SEED_BYTE_LENGTH + " bytes in length."
          );
        }
      } else if (!(seed instanceof Uint8Array)) {
        throw new TypeError(
          '"seed" must be a node.js Buffer, Uint8Array, or a binary string.'
        );
      }
      seed = messageToNativeBuffer({ message: seed, encoding: "binary" });
      var pk = new NativeBuffer(ed25519.constants.PUBLIC_KEY_BYTE_LENGTH);
      var sk = new NativeBuffer(ed25519.constants.PRIVATE_KEY_BYTE_LENGTH);
      for (var i2 = 0; i2 < 32; ++i2) {
        sk[i2] = seed[i2];
      }
      crypto_sign_keypair(pk, sk);
      return { publicKey: pk, privateKey: sk };
    };
    ed25519.privateKeyFromAsn1 = function(obj) {
      var capture = {};
      var errors = [];
      var valid = forge2.asn1.validate(obj, privateKeyValidator, capture, errors);
      if (!valid) {
        var error = new Error("Invalid Key.");
        error.errors = errors;
        throw error;
      }
      var oid = forge2.asn1.derToOid(capture.privateKeyOid);
      var ed25519Oid = forge2.oids.EdDSA25519;
      if (oid !== ed25519Oid) {
        throw new Error('Invalid OID "' + oid + '"; OID must be "' + ed25519Oid + '".');
      }
      var privateKey = capture.privateKey;
      var privateKeyBytes = messageToNativeBuffer({
        message: forge2.asn1.fromDer(privateKey).value,
        encoding: "binary"
      });
      return { privateKeyBytes };
    };
    ed25519.publicKeyFromAsn1 = function(obj) {
      var capture = {};
      var errors = [];
      var valid = forge2.asn1.validate(obj, publicKeyValidator, capture, errors);
      if (!valid) {
        var error = new Error("Invalid Key.");
        error.errors = errors;
        throw error;
      }
      var oid = forge2.asn1.derToOid(capture.publicKeyOid);
      var ed25519Oid = forge2.oids.EdDSA25519;
      if (oid !== ed25519Oid) {
        throw new Error('Invalid OID "' + oid + '"; OID must be "' + ed25519Oid + '".');
      }
      var publicKeyBytes = capture.ed25519PublicKey;
      if (publicKeyBytes.length !== ed25519.constants.PUBLIC_KEY_BYTE_LENGTH) {
        throw new Error("Key length is invalid.");
      }
      return messageToNativeBuffer({
        message: publicKeyBytes,
        encoding: "binary"
      });
    };
    ed25519.publicKeyFromPrivateKey = function(options) {
      options = options || {};
      var privateKey = messageToNativeBuffer({
        message: options.privateKey,
        encoding: "binary"
      });
      if (privateKey.length !== ed25519.constants.PRIVATE_KEY_BYTE_LENGTH) {
        throw new TypeError(
          '"options.privateKey" must have a byte length of ' + ed25519.constants.PRIVATE_KEY_BYTE_LENGTH
        );
      }
      var pk = new NativeBuffer(ed25519.constants.PUBLIC_KEY_BYTE_LENGTH);
      for (var i2 = 0; i2 < pk.length; ++i2) {
        pk[i2] = privateKey[32 + i2];
      }
      return pk;
    };
    ed25519.sign = function(options) {
      options = options || {};
      var msg = messageToNativeBuffer(options);
      var privateKey = messageToNativeBuffer({
        message: options.privateKey,
        encoding: "binary"
      });
      if (privateKey.length === ed25519.constants.SEED_BYTE_LENGTH) {
        var keyPair = ed25519.generateKeyPair({ seed: privateKey });
        privateKey = keyPair.privateKey;
      } else if (privateKey.length !== ed25519.constants.PRIVATE_KEY_BYTE_LENGTH) {
        throw new TypeError(
          '"options.privateKey" must have a byte length of ' + ed25519.constants.SEED_BYTE_LENGTH + " or " + ed25519.constants.PRIVATE_KEY_BYTE_LENGTH
        );
      }
      var signedMsg = new NativeBuffer(
        ed25519.constants.SIGN_BYTE_LENGTH + msg.length
      );
      crypto_sign(signedMsg, msg, msg.length, privateKey);
      var sig = new NativeBuffer(ed25519.constants.SIGN_BYTE_LENGTH);
      for (var i2 = 0; i2 < sig.length; ++i2) {
        sig[i2] = signedMsg[i2];
      }
      return sig;
    };
    ed25519.verify = function(options) {
      options = options || {};
      var msg = messageToNativeBuffer(options);
      if (options.signature === void 0) {
        throw new TypeError(
          '"options.signature" must be a node.js Buffer, a Uint8Array, a forge ByteBuffer, or a binary string.'
        );
      }
      var sig = messageToNativeBuffer({
        message: options.signature,
        encoding: "binary"
      });
      if (sig.length !== ed25519.constants.SIGN_BYTE_LENGTH) {
        throw new TypeError(
          '"options.signature" must have a byte length of ' + ed25519.constants.SIGN_BYTE_LENGTH
        );
      }
      var publicKey = messageToNativeBuffer({
        message: options.publicKey,
        encoding: "binary"
      });
      if (publicKey.length !== ed25519.constants.PUBLIC_KEY_BYTE_LENGTH) {
        throw new TypeError(
          '"options.publicKey" must have a byte length of ' + ed25519.constants.PUBLIC_KEY_BYTE_LENGTH
        );
      }
      var sm = new NativeBuffer(ed25519.constants.SIGN_BYTE_LENGTH + msg.length);
      var m = new NativeBuffer(ed25519.constants.SIGN_BYTE_LENGTH + msg.length);
      var i2;
      for (i2 = 0; i2 < ed25519.constants.SIGN_BYTE_LENGTH; ++i2) {
        sm[i2] = sig[i2];
      }
      for (i2 = 0; i2 < msg.length; ++i2) {
        sm[i2 + ed25519.constants.SIGN_BYTE_LENGTH] = msg[i2];
      }
      return crypto_sign_open(m, sm, sm.length, publicKey) >= 0;
    };
    function messageToNativeBuffer(options) {
      var message = options.message;
      if (message instanceof Uint8Array || message instanceof NativeBuffer) {
        return message;
      }
      var encoding = options.encoding;
      if (message === void 0) {
        if (options.md) {
          message = options.md.digest().getBytes();
          encoding = "binary";
        } else {
          throw new TypeError('"options.message" or "options.md" not specified.');
        }
      }
      if (typeof message === "string" && !encoding) {
        throw new TypeError('"options.encoding" must be "binary" or "utf8".');
      }
      if (typeof message === "string") {
        if (typeof Buffer !== "undefined") {
          return Buffer.from(message, encoding);
        }
        message = new ByteBuffer(message, encoding);
      } else if (!(message instanceof ByteBuffer)) {
        throw new TypeError(
          '"options.message" must be a node.js Buffer, a Uint8Array, a forge ByteBuffer, or a string with "options.encoding" specifying its encoding.'
        );
      }
      var buffer = new NativeBuffer(message.length());
      for (var i2 = 0; i2 < buffer.length; ++i2) {
        buffer[i2] = message.at(i2);
      }
      return buffer;
    }
    var gf0 = gf();
    var gf1 = gf([1]);
    var D = gf([
      30883,
      4953,
      19914,
      30187,
      55467,
      16705,
      2637,
      112,
      59544,
      30585,
      16505,
      36039,
      65139,
      11119,
      27886,
      20995
    ]);
    var D2 = gf([
      61785,
      9906,
      39828,
      60374,
      45398,
      33411,
      5274,
      224,
      53552,
      61171,
      33010,
      6542,
      64743,
      22239,
      55772,
      9222
    ]);
    var X = gf([
      54554,
      36645,
      11616,
      51542,
      42930,
      38181,
      51040,
      26924,
      56412,
      64982,
      57905,
      49316,
      21502,
      52590,
      14035,
      8553
    ]);
    var Y = gf([
      26200,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214,
      26214
    ]);
    var L = new Float64Array([
      237,
      211,
      245,
      92,
      26,
      99,
      18,
      88,
      214,
      156,
      247,
      162,
      222,
      249,
      222,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16
    ]);
    var I = gf([
      41136,
      18958,
      6951,
      50414,
      58488,
      44335,
      6150,
      12099,
      55207,
      15867,
      153,
      11085,
      57099,
      20417,
      9344,
      11139
    ]);
    function sha512(msg, msgLen) {
      var md = forge2.md.sha512.create();
      var buffer = new ByteBuffer(msg);
      md.update(buffer.getBytes(msgLen), "binary");
      var hash = md.digest().getBytes();
      if (typeof Buffer !== "undefined") {
        return Buffer.from(hash, "binary");
      }
      var out = new NativeBuffer(ed25519.constants.HASH_BYTE_LENGTH);
      for (var i2 = 0; i2 < 64; ++i2) {
        out[i2] = hash.charCodeAt(i2);
      }
      return out;
    }
    function crypto_sign_keypair(pk, sk) {
      var p = [gf(), gf(), gf(), gf()];
      var i2;
      var d = sha512(sk, 32);
      d[0] &= 248;
      d[31] &= 127;
      d[31] |= 64;
      scalarbase(p, d);
      pack(pk, p);
      for (i2 = 0; i2 < 32; ++i2) {
        sk[i2 + 32] = pk[i2];
      }
      return 0;
    }
    function crypto_sign(sm, m, n, sk) {
      var i2, j, x2 = new Float64Array(64);
      var p = [gf(), gf(), gf(), gf()];
      var d = sha512(sk, 32);
      d[0] &= 248;
      d[31] &= 127;
      d[31] |= 64;
      var smlen = n + 64;
      for (i2 = 0; i2 < n; ++i2) {
        sm[64 + i2] = m[i2];
      }
      for (i2 = 0; i2 < 32; ++i2) {
        sm[32 + i2] = d[32 + i2];
      }
      var r = sha512(sm.subarray(32), n + 32);
      reduce(r);
      scalarbase(p, r);
      pack(sm, p);
      for (i2 = 32; i2 < 64; ++i2) {
        sm[i2] = sk[i2];
      }
      var h = sha512(sm, n + 64);
      reduce(h);
      for (i2 = 32; i2 < 64; ++i2) {
        x2[i2] = 0;
      }
      for (i2 = 0; i2 < 32; ++i2) {
        x2[i2] = r[i2];
      }
      for (i2 = 0; i2 < 32; ++i2) {
        for (j = 0; j < 32; j++) {
          x2[i2 + j] += h[i2] * d[j];
        }
      }
      modL(sm.subarray(32), x2);
      return smlen;
    }
    function crypto_sign_open(m, sm, n, pk) {
      var i2, mlen;
      var t = new NativeBuffer(32);
      var p = [gf(), gf(), gf(), gf()], q = [gf(), gf(), gf(), gf()];
      mlen = -1;
      if (n < 64) {
        return -1;
      }
      if (unpackneg(q, pk)) {
        return -1;
      }
      for (i2 = 0; i2 < n; ++i2) {
        m[i2] = sm[i2];
      }
      for (i2 = 0; i2 < 32; ++i2) {
        m[i2 + 32] = pk[i2];
      }
      var h = sha512(m, n);
      reduce(h);
      scalarmult(p, q, h);
      scalarbase(q, sm.subarray(32));
      add(p, q);
      pack(t, p);
      n -= 64;
      if (crypto_verify_32(sm, 0, t, 0)) {
        for (i2 = 0; i2 < n; ++i2) {
          m[i2] = 0;
        }
        return -1;
      }
      for (i2 = 0; i2 < n; ++i2) {
        m[i2] = sm[i2 + 64];
      }
      mlen = n;
      return mlen;
    }
    function modL(r, x2) {
      var carry, i2, j, k;
      for (i2 = 63; i2 >= 32; --i2) {
        carry = 0;
        for (j = i2 - 32, k = i2 - 12; j < k; ++j) {
          x2[j] += carry - 16 * x2[i2] * L[j - (i2 - 32)];
          carry = x2[j] + 128 >> 8;
          x2[j] -= carry * 256;
        }
        x2[j] += carry;
        x2[i2] = 0;
      }
      carry = 0;
      for (j = 0; j < 32; ++j) {
        x2[j] += carry - (x2[31] >> 4) * L[j];
        carry = x2[j] >> 8;
        x2[j] &= 255;
      }
      for (j = 0; j < 32; ++j) {
        x2[j] -= carry * L[j];
      }
      for (i2 = 0; i2 < 32; ++i2) {
        x2[i2 + 1] += x2[i2] >> 8;
        r[i2] = x2[i2] & 255;
      }
    }
    function reduce(r) {
      var x2 = new Float64Array(64);
      for (var i2 = 0; i2 < 64; ++i2) {
        x2[i2] = r[i2];
        r[i2] = 0;
      }
      modL(r, x2);
    }
    function add(p, q) {
      var a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf(), g = gf(), h = gf(), t = gf();
      Z(a, p[1], p[0]);
      Z(t, q[1], q[0]);
      M(a, a, t);
      A(b, p[0], p[1]);
      A(t, q[0], q[1]);
      M(b, b, t);
      M(c, p[3], q[3]);
      M(c, c, D2);
      M(d, p[2], q[2]);
      A(d, d, d);
      Z(e, b, a);
      Z(f, d, c);
      A(g, d, c);
      A(h, b, a);
      M(p[0], e, f);
      M(p[1], h, g);
      M(p[2], g, f);
      M(p[3], e, h);
    }
    function cswap(p, q, b) {
      for (var i2 = 0; i2 < 4; ++i2) {
        sel25519(p[i2], q[i2], b);
      }
    }
    function pack(r, p) {
      var tx = gf(), ty = gf(), zi = gf();
      inv25519(zi, p[2]);
      M(tx, p[0], zi);
      M(ty, p[1], zi);
      pack25519(r, ty);
      r[31] ^= par25519(tx) << 7;
    }
    function pack25519(o, n) {
      var i2, j, b;
      var m = gf(), t = gf();
      for (i2 = 0; i2 < 16; ++i2) {
        t[i2] = n[i2];
      }
      car25519(t);
      car25519(t);
      car25519(t);
      for (j = 0; j < 2; ++j) {
        m[0] = t[0] - 65517;
        for (i2 = 1; i2 < 15; ++i2) {
          m[i2] = t[i2] - 65535 - (m[i2 - 1] >> 16 & 1);
          m[i2 - 1] &= 65535;
        }
        m[15] = t[15] - 32767 - (m[14] >> 16 & 1);
        b = m[15] >> 16 & 1;
        m[14] &= 65535;
        sel25519(t, m, 1 - b);
      }
      for (i2 = 0; i2 < 16; i2++) {
        o[2 * i2] = t[i2] & 255;
        o[2 * i2 + 1] = t[i2] >> 8;
      }
    }
    function unpackneg(r, p) {
      var t = gf(), chk = gf(), num = gf(), den = gf(), den2 = gf(), den4 = gf(), den6 = gf();
      set25519(r[2], gf1);
      unpack25519(r[1], p);
      S(num, r[1]);
      M(den, num, D);
      Z(num, num, r[2]);
      A(den, r[2], den);
      S(den2, den);
      S(den4, den2);
      M(den6, den4, den2);
      M(t, den6, num);
      M(t, t, den);
      pow2523(t, t);
      M(t, t, num);
      M(t, t, den);
      M(t, t, den);
      M(r[0], t, den);
      S(chk, r[0]);
      M(chk, chk, den);
      if (neq25519(chk, num)) {
        M(r[0], r[0], I);
      }
      S(chk, r[0]);
      M(chk, chk, den);
      if (neq25519(chk, num)) {
        return -1;
      }
      if (par25519(r[0]) === p[31] >> 7) {
        Z(r[0], gf0, r[0]);
      }
      M(r[3], r[0], r[1]);
      return 0;
    }
    function unpack25519(o, n) {
      var i2;
      for (i2 = 0; i2 < 16; ++i2) {
        o[i2] = n[2 * i2] + (n[2 * i2 + 1] << 8);
      }
      o[15] &= 32767;
    }
    function pow2523(o, i2) {
      var c = gf();
      var a;
      for (a = 0; a < 16; ++a) {
        c[a] = i2[a];
      }
      for (a = 250; a >= 0; --a) {
        S(c, c);
        if (a !== 1) {
          M(c, c, i2);
        }
      }
      for (a = 0; a < 16; ++a) {
        o[a] = c[a];
      }
    }
    function neq25519(a, b) {
      var c = new NativeBuffer(32);
      var d = new NativeBuffer(32);
      pack25519(c, a);
      pack25519(d, b);
      return crypto_verify_32(c, 0, d, 0);
    }
    function crypto_verify_32(x2, xi, y, yi) {
      return vn(x2, xi, y, yi, 32);
    }
    function vn(x2, xi, y, yi, n) {
      var i2, d = 0;
      for (i2 = 0; i2 < n; ++i2) {
        d |= x2[xi + i2] ^ y[yi + i2];
      }
      return (1 & d - 1 >>> 8) - 1;
    }
    function par25519(a) {
      var d = new NativeBuffer(32);
      pack25519(d, a);
      return d[0] & 1;
    }
    function scalarmult(p, q, s) {
      var b, i2;
      set25519(p[0], gf0);
      set25519(p[1], gf1);
      set25519(p[2], gf1);
      set25519(p[3], gf0);
      for (i2 = 255; i2 >= 0; --i2) {
        b = s[i2 / 8 | 0] >> (i2 & 7) & 1;
        cswap(p, q, b);
        add(q, p);
        add(p, p);
        cswap(p, q, b);
      }
    }
    function scalarbase(p, s) {
      var q = [gf(), gf(), gf(), gf()];
      set25519(q[0], X);
      set25519(q[1], Y);
      set25519(q[2], gf1);
      M(q[3], X, Y);
      scalarmult(p, q, s);
    }
    function set25519(r, a) {
      var i2;
      for (i2 = 0; i2 < 16; i2++) {
        r[i2] = a[i2] | 0;
      }
    }
    function inv25519(o, i2) {
      var c = gf();
      var a;
      for (a = 0; a < 16; ++a) {
        c[a] = i2[a];
      }
      for (a = 253; a >= 0; --a) {
        S(c, c);
        if (a !== 2 && a !== 4) {
          M(c, c, i2);
        }
      }
      for (a = 0; a < 16; ++a) {
        o[a] = c[a];
      }
    }
    function car25519(o) {
      var i2, v, c = 1;
      for (i2 = 0; i2 < 16; ++i2) {
        v = o[i2] + c + 65535;
        c = Math.floor(v / 65536);
        o[i2] = v - c * 65536;
      }
      o[0] += c - 1 + 37 * (c - 1);
    }
    function sel25519(p, q, b) {
      var t, c = ~(b - 1);
      for (var i2 = 0; i2 < 16; ++i2) {
        t = c & (p[i2] ^ q[i2]);
        p[i2] ^= t;
        q[i2] ^= t;
      }
    }
    function gf(init) {
      var i2, r = new Float64Array(16);
      if (init) {
        for (i2 = 0; i2 < init.length; ++i2) {
          r[i2] = init[i2];
        }
      }
      return r;
    }
    function A(o, a, b) {
      for (var i2 = 0; i2 < 16; ++i2) {
        o[i2] = a[i2] + b[i2];
      }
    }
    function Z(o, a, b) {
      for (var i2 = 0; i2 < 16; ++i2) {
        o[i2] = a[i2] - b[i2];
      }
    }
    function S(o, a) {
      M(o, a, a);
    }
    function M(o, a, b) {
      var v, c, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11], b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
      v = a[0];
      t0 += v * b0;
      t1 += v * b1;
      t2 += v * b2;
      t3 += v * b3;
      t4 += v * b4;
      t5 += v * b5;
      t6 += v * b6;
      t7 += v * b7;
      t8 += v * b8;
      t9 += v * b9;
      t10 += v * b10;
      t11 += v * b11;
      t12 += v * b12;
      t13 += v * b13;
      t14 += v * b14;
      t15 += v * b15;
      v = a[1];
      t1 += v * b0;
      t2 += v * b1;
      t3 += v * b2;
      t4 += v * b3;
      t5 += v * b4;
      t6 += v * b5;
      t7 += v * b6;
      t8 += v * b7;
      t9 += v * b8;
      t10 += v * b9;
      t11 += v * b10;
      t12 += v * b11;
      t13 += v * b12;
      t14 += v * b13;
      t15 += v * b14;
      t16 += v * b15;
      v = a[2];
      t2 += v * b0;
      t3 += v * b1;
      t4 += v * b2;
      t5 += v * b3;
      t6 += v * b4;
      t7 += v * b5;
      t8 += v * b6;
      t9 += v * b7;
      t10 += v * b8;
      t11 += v * b9;
      t12 += v * b10;
      t13 += v * b11;
      t14 += v * b12;
      t15 += v * b13;
      t16 += v * b14;
      t17 += v * b15;
      v = a[3];
      t3 += v * b0;
      t4 += v * b1;
      t5 += v * b2;
      t6 += v * b3;
      t7 += v * b4;
      t8 += v * b5;
      t9 += v * b6;
      t10 += v * b7;
      t11 += v * b8;
      t12 += v * b9;
      t13 += v * b10;
      t14 += v * b11;
      t15 += v * b12;
      t16 += v * b13;
      t17 += v * b14;
      t18 += v * b15;
      v = a[4];
      t4 += v * b0;
      t5 += v * b1;
      t6 += v * b2;
      t7 += v * b3;
      t8 += v * b4;
      t9 += v * b5;
      t10 += v * b6;
      t11 += v * b7;
      t12 += v * b8;
      t13 += v * b9;
      t14 += v * b10;
      t15 += v * b11;
      t16 += v * b12;
      t17 += v * b13;
      t18 += v * b14;
      t19 += v * b15;
      v = a[5];
      t5 += v * b0;
      t6 += v * b1;
      t7 += v * b2;
      t8 += v * b3;
      t9 += v * b4;
      t10 += v * b5;
      t11 += v * b6;
      t12 += v * b7;
      t13 += v * b8;
      t14 += v * b9;
      t15 += v * b10;
      t16 += v * b11;
      t17 += v * b12;
      t18 += v * b13;
      t19 += v * b14;
      t20 += v * b15;
      v = a[6];
      t6 += v * b0;
      t7 += v * b1;
      t8 += v * b2;
      t9 += v * b3;
      t10 += v * b4;
      t11 += v * b5;
      t12 += v * b6;
      t13 += v * b7;
      t14 += v * b8;
      t15 += v * b9;
      t16 += v * b10;
      t17 += v * b11;
      t18 += v * b12;
      t19 += v * b13;
      t20 += v * b14;
      t21 += v * b15;
      v = a[7];
      t7 += v * b0;
      t8 += v * b1;
      t9 += v * b2;
      t10 += v * b3;
      t11 += v * b4;
      t12 += v * b5;
      t13 += v * b6;
      t14 += v * b7;
      t15 += v * b8;
      t16 += v * b9;
      t17 += v * b10;
      t18 += v * b11;
      t19 += v * b12;
      t20 += v * b13;
      t21 += v * b14;
      t22 += v * b15;
      v = a[8];
      t8 += v * b0;
      t9 += v * b1;
      t10 += v * b2;
      t11 += v * b3;
      t12 += v * b4;
      t13 += v * b5;
      t14 += v * b6;
      t15 += v * b7;
      t16 += v * b8;
      t17 += v * b9;
      t18 += v * b10;
      t19 += v * b11;
      t20 += v * b12;
      t21 += v * b13;
      t22 += v * b14;
      t23 += v * b15;
      v = a[9];
      t9 += v * b0;
      t10 += v * b1;
      t11 += v * b2;
      t12 += v * b3;
      t13 += v * b4;
      t14 += v * b5;
      t15 += v * b6;
      t16 += v * b7;
      t17 += v * b8;
      t18 += v * b9;
      t19 += v * b10;
      t20 += v * b11;
      t21 += v * b12;
      t22 += v * b13;
      t23 += v * b14;
      t24 += v * b15;
      v = a[10];
      t10 += v * b0;
      t11 += v * b1;
      t12 += v * b2;
      t13 += v * b3;
      t14 += v * b4;
      t15 += v * b5;
      t16 += v * b6;
      t17 += v * b7;
      t18 += v * b8;
      t19 += v * b9;
      t20 += v * b10;
      t21 += v * b11;
      t22 += v * b12;
      t23 += v * b13;
      t24 += v * b14;
      t25 += v * b15;
      v = a[11];
      t11 += v * b0;
      t12 += v * b1;
      t13 += v * b2;
      t14 += v * b3;
      t15 += v * b4;
      t16 += v * b5;
      t17 += v * b6;
      t18 += v * b7;
      t19 += v * b8;
      t20 += v * b9;
      t21 += v * b10;
      t22 += v * b11;
      t23 += v * b12;
      t24 += v * b13;
      t25 += v * b14;
      t26 += v * b15;
      v = a[12];
      t12 += v * b0;
      t13 += v * b1;
      t14 += v * b2;
      t15 += v * b3;
      t16 += v * b4;
      t17 += v * b5;
      t18 += v * b6;
      t19 += v * b7;
      t20 += v * b8;
      t21 += v * b9;
      t22 += v * b10;
      t23 += v * b11;
      t24 += v * b12;
      t25 += v * b13;
      t26 += v * b14;
      t27 += v * b15;
      v = a[13];
      t13 += v * b0;
      t14 += v * b1;
      t15 += v * b2;
      t16 += v * b3;
      t17 += v * b4;
      t18 += v * b5;
      t19 += v * b6;
      t20 += v * b7;
      t21 += v * b8;
      t22 += v * b9;
      t23 += v * b10;
      t24 += v * b11;
      t25 += v * b12;
      t26 += v * b13;
      t27 += v * b14;
      t28 += v * b15;
      v = a[14];
      t14 += v * b0;
      t15 += v * b1;
      t16 += v * b2;
      t17 += v * b3;
      t18 += v * b4;
      t19 += v * b5;
      t20 += v * b6;
      t21 += v * b7;
      t22 += v * b8;
      t23 += v * b9;
      t24 += v * b10;
      t25 += v * b11;
      t26 += v * b12;
      t27 += v * b13;
      t28 += v * b14;
      t29 += v * b15;
      v = a[15];
      t15 += v * b0;
      t16 += v * b1;
      t17 += v * b2;
      t18 += v * b3;
      t19 += v * b4;
      t20 += v * b5;
      t21 += v * b6;
      t22 += v * b7;
      t23 += v * b8;
      t24 += v * b9;
      t25 += v * b10;
      t26 += v * b11;
      t27 += v * b12;
      t28 += v * b13;
      t29 += v * b14;
      t30 += v * b15;
      t0 += 38 * t16;
      t1 += 38 * t17;
      t2 += 38 * t18;
      t3 += 38 * t19;
      t4 += 38 * t20;
      t5 += 38 * t21;
      t6 += 38 * t22;
      t7 += 38 * t23;
      t8 += 38 * t24;
      t9 += 38 * t25;
      t10 += 38 * t26;
      t11 += 38 * t27;
      t12 += 38 * t28;
      t13 += 38 * t29;
      t14 += 38 * t30;
      c = 1;
      v = t0 + c + 65535;
      c = Math.floor(v / 65536);
      t0 = v - c * 65536;
      v = t1 + c + 65535;
      c = Math.floor(v / 65536);
      t1 = v - c * 65536;
      v = t2 + c + 65535;
      c = Math.floor(v / 65536);
      t2 = v - c * 65536;
      v = t3 + c + 65535;
      c = Math.floor(v / 65536);
      t3 = v - c * 65536;
      v = t4 + c + 65535;
      c = Math.floor(v / 65536);
      t4 = v - c * 65536;
      v = t5 + c + 65535;
      c = Math.floor(v / 65536);
      t5 = v - c * 65536;
      v = t6 + c + 65535;
      c = Math.floor(v / 65536);
      t6 = v - c * 65536;
      v = t7 + c + 65535;
      c = Math.floor(v / 65536);
      t7 = v - c * 65536;
      v = t8 + c + 65535;
      c = Math.floor(v / 65536);
      t8 = v - c * 65536;
      v = t9 + c + 65535;
      c = Math.floor(v / 65536);
      t9 = v - c * 65536;
      v = t10 + c + 65535;
      c = Math.floor(v / 65536);
      t10 = v - c * 65536;
      v = t11 + c + 65535;
      c = Math.floor(v / 65536);
      t11 = v - c * 65536;
      v = t12 + c + 65535;
      c = Math.floor(v / 65536);
      t12 = v - c * 65536;
      v = t13 + c + 65535;
      c = Math.floor(v / 65536);
      t13 = v - c * 65536;
      v = t14 + c + 65535;
      c = Math.floor(v / 65536);
      t14 = v - c * 65536;
      v = t15 + c + 65535;
      c = Math.floor(v / 65536);
      t15 = v - c * 65536;
      t0 += c - 1 + 37 * (c - 1);
      c = 1;
      v = t0 + c + 65535;
      c = Math.floor(v / 65536);
      t0 = v - c * 65536;
      v = t1 + c + 65535;
      c = Math.floor(v / 65536);
      t1 = v - c * 65536;
      v = t2 + c + 65535;
      c = Math.floor(v / 65536);
      t2 = v - c * 65536;
      v = t3 + c + 65535;
      c = Math.floor(v / 65536);
      t3 = v - c * 65536;
      v = t4 + c + 65535;
      c = Math.floor(v / 65536);
      t4 = v - c * 65536;
      v = t5 + c + 65535;
      c = Math.floor(v / 65536);
      t5 = v - c * 65536;
      v = t6 + c + 65535;
      c = Math.floor(v / 65536);
      t6 = v - c * 65536;
      v = t7 + c + 65535;
      c = Math.floor(v / 65536);
      t7 = v - c * 65536;
      v = t8 + c + 65535;
      c = Math.floor(v / 65536);
      t8 = v - c * 65536;
      v = t9 + c + 65535;
      c = Math.floor(v / 65536);
      t9 = v - c * 65536;
      v = t10 + c + 65535;
      c = Math.floor(v / 65536);
      t10 = v - c * 65536;
      v = t11 + c + 65535;
      c = Math.floor(v / 65536);
      t11 = v - c * 65536;
      v = t12 + c + 65535;
      c = Math.floor(v / 65536);
      t12 = v - c * 65536;
      v = t13 + c + 65535;
      c = Math.floor(v / 65536);
      t13 = v - c * 65536;
      v = t14 + c + 65535;
      c = Math.floor(v / 65536);
      t14 = v - c * 65536;
      v = t15 + c + 65535;
      c = Math.floor(v / 65536);
      t15 = v - c * 65536;
      t0 += c - 1 + 37 * (c - 1);
      o[0] = t0;
      o[1] = t1;
      o[2] = t2;
      o[3] = t3;
      o[4] = t4;
      o[5] = t5;
      o[6] = t6;
      o[7] = t7;
      o[8] = t8;
      o[9] = t9;
      o[10] = t10;
      o[11] = t11;
      o[12] = t12;
      o[13] = t13;
      o[14] = t14;
      o[15] = t15;
    }
  }
});

// node_modules/node-forge/lib/kem.js
var require_kem = __commonJS({
  "node_modules/node-forge/lib/kem.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    require_random();
    require_jsbn();
    module.exports = forge2.kem = forge2.kem || {};
    var BigInteger = forge2.jsbn.BigInteger;
    forge2.kem.rsa = {};
    forge2.kem.rsa.create = function(kdf, options) {
      options = options || {};
      var prng = options.prng || forge2.random;
      var kem = {};
      kem.encrypt = function(publicKey, keyLength) {
        var byteLength = Math.ceil(publicKey.n.bitLength() / 8);
        var r;
        do {
          r = new BigInteger(
            forge2.util.bytesToHex(prng.getBytesSync(byteLength)),
            16
          ).mod(publicKey.n);
        } while (r.compareTo(BigInteger.ONE) <= 0);
        r = forge2.util.hexToBytes(r.toString(16));
        var zeros = byteLength - r.length;
        if (zeros > 0) {
          r = forge2.util.fillString(String.fromCharCode(0), zeros) + r;
        }
        var encapsulation = publicKey.encrypt(r, "NONE");
        var key = kdf.generate(r, keyLength);
        return { encapsulation, key };
      };
      kem.decrypt = function(privateKey, encapsulation, keyLength) {
        var r = privateKey.decrypt(encapsulation, "NONE");
        return kdf.generate(r, keyLength);
      };
      return kem;
    };
    forge2.kem.kdf1 = function(md, digestLength) {
      _createKDF(this, md, 0, digestLength || md.digestLength);
    };
    forge2.kem.kdf2 = function(md, digestLength) {
      _createKDF(this, md, 1, digestLength || md.digestLength);
    };
    function _createKDF(kdf, md, counterStart, digestLength) {
      kdf.generate = function(x2, length) {
        var key = new forge2.util.ByteBuffer();
        var k = Math.ceil(length / digestLength) + counterStart;
        var c = new forge2.util.ByteBuffer();
        for (var i2 = counterStart; i2 < k; ++i2) {
          c.putInt32(i2);
          md.start();
          md.update(x2 + c.getBytes());
          var hash = md.digest();
          key.putBytes(hash.getBytes(digestLength));
        }
        key.truncate(key.length() - length);
        return key.getBytes();
      };
    }
  }
});

// node_modules/node-forge/lib/log.js
var require_log = __commonJS({
  "node_modules/node-forge/lib/log.js"(exports, module) {
    var forge2 = require_forge();
    require_util();
    module.exports = forge2.log = forge2.log || {};
    forge2.log.levels = [
      "none",
      "error",
      "warning",
      "info",
      "debug",
      "verbose",
      "max"
    ];
    var sLevelInfo = {};
    var sLoggers = [];
    var sConsoleLogger = null;
    forge2.log.LEVEL_LOCKED = 1 << 1;
    forge2.log.NO_LEVEL_CHECK = 1 << 2;
    forge2.log.INTERPOLATE = 1 << 3;
    for (i2 = 0; i2 < forge2.log.levels.length; ++i2) {
      level = forge2.log.levels[i2];
      sLevelInfo[level] = {
        index: i2,
        name: level.toUpperCase()
      };
    }
    var level;
    var i2;
    forge2.log.logMessage = function(message) {
      var messageLevelIndex = sLevelInfo[message.level].index;
      for (var i3 = 0; i3 < sLoggers.length; ++i3) {
        var logger2 = sLoggers[i3];
        if (logger2.flags & forge2.log.NO_LEVEL_CHECK) {
          logger2.f(message);
        } else {
          var loggerLevelIndex = sLevelInfo[logger2.level].index;
          if (messageLevelIndex <= loggerLevelIndex) {
            logger2.f(logger2, message);
          }
        }
      }
    };
    forge2.log.prepareStandard = function(message) {
      if (!("standard" in message)) {
        message.standard = sLevelInfo[message.level].name + //' ' + +message.timestamp +
        " [" + message.category + "] " + message.message;
      }
    };
    forge2.log.prepareFull = function(message) {
      if (!("full" in message)) {
        var args = [message.message];
        args = args.concat([]);
        message.full = forge2.util.format.apply(this, args);
      }
    };
    forge2.log.prepareStandardFull = function(message) {
      if (!("standardFull" in message)) {
        forge2.log.prepareStandard(message);
        message.standardFull = message.standard;
      }
    };
    if (true) {
      levels = ["error", "warning", "info", "debug", "verbose"];
      for (i2 = 0; i2 < levels.length; ++i2) {
        (function(level2) {
          forge2.log[level2] = function(category, message) {
            var args = Array.prototype.slice.call(arguments).slice(2);
            var msg = {
              timestamp: /* @__PURE__ */ new Date(),
              level: level2,
              category,
              message,
              "arguments": args
              /*standard*/
              /*full*/
              /*fullMessage*/
            };
            forge2.log.logMessage(msg);
          };
        })(levels[i2]);
      }
    }
    var levels;
    var i2;
    forge2.log.makeLogger = function(logFunction) {
      var logger2 = {
        flags: 0,
        f: logFunction
      };
      forge2.log.setLevel(logger2, "none");
      return logger2;
    };
    forge2.log.setLevel = function(logger2, level2) {
      var rval = false;
      if (logger2 && !(logger2.flags & forge2.log.LEVEL_LOCKED)) {
        for (var i3 = 0; i3 < forge2.log.levels.length; ++i3) {
          var aValidLevel = forge2.log.levels[i3];
          if (level2 == aValidLevel) {
            logger2.level = level2;
            rval = true;
            break;
          }
        }
      }
      return rval;
    };
    forge2.log.lock = function(logger2, lock2) {
      if (typeof lock2 === "undefined" || lock2) {
        logger2.flags |= forge2.log.LEVEL_LOCKED;
      } else {
        logger2.flags &= ~forge2.log.LEVEL_LOCKED;
      }
    };
    forge2.log.addLogger = function(logger2) {
      sLoggers.push(logger2);
    };
    if (typeof console !== "undefined" && "log" in console) {
      if (console.error && console.warn && console.info && console.debug) {
        levelHandlers = {
          error: console.error,
          warning: console.warn,
          info: console.info,
          debug: console.debug,
          verbose: console.debug
        };
        f = function(logger2, message) {
          forge2.log.prepareStandard(message);
          var handler = levelHandlers[message.level];
          var args = [message.standard];
          args = args.concat(message["arguments"].slice());
          handler.apply(console, args);
        };
        logger = forge2.log.makeLogger(f);
      } else {
        f = function(logger2, message) {
          forge2.log.prepareStandardFull(message);
          console.log(message.standardFull);
        };
        logger = forge2.log.makeLogger(f);
      }
      forge2.log.setLevel(logger, "debug");
      forge2.log.addLogger(logger);
      sConsoleLogger = logger;
    } else {
      console = {
        log: function() {
        }
      };
    }
    var logger;
    var levelHandlers;
    var f;
    if (sConsoleLogger !== null && typeof window !== "undefined" && window.location) {
      query = new URL(window.location.href).searchParams;
      if (query.has("console.level")) {
        forge2.log.setLevel(
          sConsoleLogger,
          query.get("console.level").slice(-1)[0]
        );
      }
      if (query.has("console.lock")) {
        lock = query.get("console.lock").slice(-1)[0];
        if (lock == "true") {
          forge2.log.lock(sConsoleLogger);
        }
      }
    }
    var query;
    var lock;
    forge2.log.consoleLogger = sConsoleLogger;
  }
});

// node_modules/node-forge/lib/md.all.js
var require_md_all = __commonJS({
  "node_modules/node-forge/lib/md.all.js"(exports, module) {
    module.exports = require_md();
    require_md5();
    require_sha1();
    require_sha256();
    require_sha512();
  }
});

// node_modules/node-forge/lib/pkcs7.js
var require_pkcs7 = __commonJS({
  "node_modules/node-forge/lib/pkcs7.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_asn1();
    require_des();
    require_oids();
    require_pem();
    require_pkcs7asn1();
    require_random();
    require_util();
    require_x509();
    var asn1 = forge2.asn1;
    var p7 = module.exports = forge2.pkcs7 = forge2.pkcs7 || {};
    p7.messageFromPem = function(pem) {
      var msg = forge2.pem.decode(pem)[0];
      if (msg.type !== "PKCS7") {
        var error = new Error('Could not convert PKCS#7 message from PEM; PEM header type is not "PKCS#7".');
        error.headerType = msg.type;
        throw error;
      }
      if (msg.procType && msg.procType.type === "ENCRYPTED") {
        throw new Error("Could not convert PKCS#7 message from PEM; PEM is encrypted.");
      }
      var obj = asn1.fromDer(msg.body);
      return p7.messageFromAsn1(obj);
    };
    p7.messageToPem = function(msg, maxline) {
      var pemObj = {
        type: "PKCS7",
        body: asn1.toDer(msg.toAsn1()).getBytes()
      };
      return forge2.pem.encode(pemObj, { maxline });
    };
    p7.messageFromAsn1 = function(obj) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, p7.asn1.contentInfoValidator, capture, errors)) {
        var error = new Error("Cannot read PKCS#7 message. ASN.1 object is not an PKCS#7 ContentInfo.");
        error.errors = errors;
        throw error;
      }
      var contentType = asn1.derToOid(capture.contentType);
      var msg;
      switch (contentType) {
        case forge2.pki.oids.envelopedData:
          msg = p7.createEnvelopedData();
          break;
        case forge2.pki.oids.encryptedData:
          msg = p7.createEncryptedData();
          break;
        case forge2.pki.oids.signedData:
          msg = p7.createSignedData();
          break;
        default:
          throw new Error("Cannot read PKCS#7 message. ContentType with OID " + contentType + " is not (yet) supported.");
      }
      msg.fromAsn1(capture.content.value[0]);
      return msg;
    };
    p7.createSignedData = function() {
      var msg = null;
      msg = {
        type: forge2.pki.oids.signedData,
        version: 1,
        certificates: [],
        crls: [],
        // TODO: add json-formatted signer stuff here?
        signers: [],
        // populated during sign()
        digestAlgorithmIdentifiers: [],
        contentInfo: null,
        signerInfos: [],
        fromAsn1: function(obj) {
          _fromAsn1(msg, obj, p7.asn1.signedDataValidator);
          msg.certificates = [];
          msg.crls = [];
          msg.digestAlgorithmIdentifiers = [];
          msg.contentInfo = null;
          msg.signerInfos = [];
          if (msg.rawCapture.certificates) {
            var certs = msg.rawCapture.certificates.value;
            for (var i2 = 0; i2 < certs.length; ++i2) {
              msg.certificates.push(forge2.pki.certificateFromAsn1(certs[i2]));
            }
          }
        },
        toAsn1: function() {
          if (!msg.contentInfo) {
            msg.sign();
          }
          var certs = [];
          for (var i2 = 0; i2 < msg.certificates.length; ++i2) {
            certs.push(forge2.pki.certificateToAsn1(msg.certificates[i2]));
          }
          var crls = [];
          var signedData = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // Version
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.INTEGER,
                false,
                asn1.integerToDer(msg.version).getBytes()
              ),
              // DigestAlgorithmIdentifiers
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.SET,
                true,
                msg.digestAlgorithmIdentifiers
              ),
              // ContentInfo
              msg.contentInfo
            ])
          ]);
          if (certs.length > 0) {
            signedData.value[0].value.push(
              asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, certs)
            );
          }
          if (crls.length > 0) {
            signedData.value[0].value.push(
              asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, crls)
            );
          }
          signedData.value[0].value.push(
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.SET,
              true,
              msg.signerInfos
            )
          );
          return asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.SEQUENCE,
            true,
            [
              // ContentType
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(msg.type).getBytes()
              ),
              // [0] SignedData
              signedData
            ]
          );
        },
        /**
         * Add (another) entity to list of signers.
         *
         * Note: If authenticatedAttributes are provided, then, per RFC 2315,
         * they must include at least two attributes: content type and
         * message digest. The message digest attribute value will be
         * auto-calculated during signing and will be ignored if provided.
         *
         * Here's an example of providing these two attributes:
         *
         * forge.pkcs7.createSignedData();
         * p7.addSigner({
         *   issuer: cert.issuer.attributes,
         *   serialNumber: cert.serialNumber,
         *   key: privateKey,
         *   digestAlgorithm: forge.pki.oids.sha1,
         *   authenticatedAttributes: [{
         *     type: forge.pki.oids.contentType,
         *     value: forge.pki.oids.data
         *   }, {
         *     type: forge.pki.oids.messageDigest
         *   }]
         * });
         *
         * TODO: Support [subjectKeyIdentifier] as signer's ID.
         *
         * @param signer the signer information:
         *          key the signer's private key.
         *          [certificate] a certificate containing the public key
         *            associated with the signer's private key; use this option as
         *            an alternative to specifying signer.issuer and
         *            signer.serialNumber.
         *          [issuer] the issuer attributes (eg: cert.issuer.attributes).
         *          [serialNumber] the signer's certificate's serial number in
         *           hexadecimal (eg: cert.serialNumber).
         *          [digestAlgorithm] the message digest OID, as a string, to use
         *            (eg: forge.pki.oids.sha1).
         *          [authenticatedAttributes] an optional array of attributes
         *            to also sign along with the content.
         */
        addSigner: function(signer) {
          var issuer = signer.issuer;
          var serialNumber = signer.serialNumber;
          if (signer.certificate) {
            var cert = signer.certificate;
            if (typeof cert === "string") {
              cert = forge2.pki.certificateFromPem(cert);
            }
            issuer = cert.issuer.attributes;
            serialNumber = cert.serialNumber;
          }
          var key = signer.key;
          if (!key) {
            throw new Error(
              "Could not add PKCS#7 signer; no private key specified."
            );
          }
          if (typeof key === "string") {
            key = forge2.pki.privateKeyFromPem(key);
          }
          var digestAlgorithm = signer.digestAlgorithm || forge2.pki.oids.sha1;
          switch (digestAlgorithm) {
            case forge2.pki.oids.sha1:
            case forge2.pki.oids.sha256:
            case forge2.pki.oids.sha384:
            case forge2.pki.oids.sha512:
            case forge2.pki.oids.md5:
              break;
            default:
              throw new Error(
                "Could not add PKCS#7 signer; unknown message digest algorithm: " + digestAlgorithm
              );
          }
          var authenticatedAttributes = signer.authenticatedAttributes || [];
          if (authenticatedAttributes.length > 0) {
            var contentType = false;
            var messageDigest = false;
            for (var i2 = 0; i2 < authenticatedAttributes.length; ++i2) {
              var attr = authenticatedAttributes[i2];
              if (!contentType && attr.type === forge2.pki.oids.contentType) {
                contentType = true;
                if (messageDigest) {
                  break;
                }
                continue;
              }
              if (!messageDigest && attr.type === forge2.pki.oids.messageDigest) {
                messageDigest = true;
                if (contentType) {
                  break;
                }
                continue;
              }
            }
            if (!contentType || !messageDigest) {
              throw new Error("Invalid signer.authenticatedAttributes. If signer.authenticatedAttributes is specified, then it must contain at least two attributes, PKCS #9 content-type and PKCS #9 message-digest.");
            }
          }
          msg.signers.push({
            key,
            version: 1,
            issuer,
            serialNumber,
            digestAlgorithm,
            signatureAlgorithm: forge2.pki.oids.rsaEncryption,
            signature: null,
            authenticatedAttributes,
            unauthenticatedAttributes: []
          });
        },
        /**
         * Signs the content.
         * @param options Options to apply when signing:
         *    [detached] boolean. If signing should be done in detached mode. Defaults to false.
         */
        sign: function(options) {
          options = options || {};
          if (typeof msg.content !== "object" || msg.contentInfo === null) {
            msg.contentInfo = asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.SEQUENCE,
              true,
              [
                // ContentType
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(forge2.pki.oids.data).getBytes()
                )
              ]
            );
            if ("content" in msg) {
              var content;
              if (msg.content instanceof forge2.util.ByteBuffer) {
                content = msg.content.bytes();
              } else if (typeof msg.content === "string") {
                content = forge2.util.encodeUtf8(msg.content);
              }
              if (options.detached) {
                msg.detachedContent = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, content);
              } else {
                msg.contentInfo.value.push(
                  // [0] EXPLICIT content
                  asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
                    asn1.create(
                      asn1.Class.UNIVERSAL,
                      asn1.Type.OCTETSTRING,
                      false,
                      content
                    )
                  ])
                );
              }
            }
          }
          if (msg.signers.length === 0) {
            return;
          }
          var mds = addDigestAlgorithmIds();
          addSignerInfos(mds);
        },
        verify: function() {
          throw new Error("PKCS#7 signature verification not yet implemented.");
        },
        /**
         * Add a certificate.
         *
         * @param cert the certificate to add.
         */
        addCertificate: function(cert) {
          if (typeof cert === "string") {
            cert = forge2.pki.certificateFromPem(cert);
          }
          msg.certificates.push(cert);
        },
        /**
         * Add a certificate revokation list.
         *
         * @param crl the certificate revokation list to add.
         */
        addCertificateRevokationList: function(crl) {
          throw new Error("PKCS#7 CRL support not yet implemented.");
        }
      };
      return msg;
      function addDigestAlgorithmIds() {
        var mds = {};
        for (var i2 = 0; i2 < msg.signers.length; ++i2) {
          var signer = msg.signers[i2];
          var oid = signer.digestAlgorithm;
          if (!(oid in mds)) {
            mds[oid] = forge2.md[forge2.pki.oids[oid]].create();
          }
          if (signer.authenticatedAttributes.length === 0) {
            signer.md = mds[oid];
          } else {
            signer.md = forge2.md[forge2.pki.oids[oid]].create();
          }
        }
        msg.digestAlgorithmIdentifiers = [];
        for (var oid in mds) {
          msg.digestAlgorithmIdentifiers.push(
            // AlgorithmIdentifier
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              // algorithm
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(oid).getBytes()
              ),
              // parameters (null)
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
            ])
          );
        }
        return mds;
      }
      function addSignerInfos(mds) {
        var content;
        if (msg.detachedContent) {
          content = msg.detachedContent;
        } else {
          content = msg.contentInfo.value[1];
          content = content.value[0];
        }
        if (!content) {
          throw new Error(
            "Could not sign PKCS#7 message; there is no content to sign."
          );
        }
        var contentType = asn1.derToOid(msg.contentInfo.value[0].value);
        var bytes = asn1.toDer(content);
        bytes.getByte();
        asn1.getBerValueLength(bytes);
        bytes = bytes.getBytes();
        for (var oid in mds) {
          mds[oid].start().update(bytes);
        }
        var signingTime = /* @__PURE__ */ new Date();
        for (var i2 = 0; i2 < msg.signers.length; ++i2) {
          var signer = msg.signers[i2];
          if (signer.authenticatedAttributes.length === 0) {
            if (contentType !== forge2.pki.oids.data) {
              throw new Error(
                "Invalid signer; authenticatedAttributes must be present when the ContentInfo content type is not PKCS#7 Data."
              );
            }
          } else {
            signer.authenticatedAttributesAsn1 = asn1.create(
              asn1.Class.CONTEXT_SPECIFIC,
              0,
              true,
              []
            );
            var attrsAsn1 = asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.SET,
              true,
              []
            );
            for (var ai = 0; ai < signer.authenticatedAttributes.length; ++ai) {
              var attr = signer.authenticatedAttributes[ai];
              if (attr.type === forge2.pki.oids.messageDigest) {
                attr.value = mds[signer.digestAlgorithm].digest();
              } else if (attr.type === forge2.pki.oids.signingTime) {
                if (!attr.value) {
                  attr.value = signingTime;
                }
              }
              attrsAsn1.value.push(_attributeToAsn1(attr));
              signer.authenticatedAttributesAsn1.value.push(_attributeToAsn1(attr));
            }
            bytes = asn1.toDer(attrsAsn1).getBytes();
            signer.md.start().update(bytes);
          }
          signer.signature = signer.key.sign(signer.md, "RSASSA-PKCS1-V1_5");
        }
        msg.signerInfos = _signersToAsn1(msg.signers);
      }
    };
    p7.createEncryptedData = function() {
      var msg = null;
      msg = {
        type: forge2.pki.oids.encryptedData,
        version: 0,
        encryptedContent: {
          algorithm: forge2.pki.oids["aes256-CBC"]
        },
        /**
         * Reads an EncryptedData content block (in ASN.1 format)
         *
         * @param obj The ASN.1 representation of the EncryptedData content block
         */
        fromAsn1: function(obj) {
          _fromAsn1(msg, obj, p7.asn1.encryptedDataValidator);
        },
        /**
         * Decrypt encrypted content
         *
         * @param key The (symmetric) key as a byte buffer
         */
        decrypt: function(key) {
          if (key !== void 0) {
            msg.encryptedContent.key = key;
          }
          _decryptContent(msg);
        }
      };
      return msg;
    };
    p7.createEnvelopedData = function() {
      var msg = null;
      msg = {
        type: forge2.pki.oids.envelopedData,
        version: 0,
        recipients: [],
        encryptedContent: {
          algorithm: forge2.pki.oids["aes256-CBC"]
        },
        /**
         * Reads an EnvelopedData content block (in ASN.1 format)
         *
         * @param obj the ASN.1 representation of the EnvelopedData content block.
         */
        fromAsn1: function(obj) {
          var capture = _fromAsn1(msg, obj, p7.asn1.envelopedDataValidator);
          msg.recipients = _recipientsFromAsn1(capture.recipientInfos.value);
        },
        toAsn1: function() {
          return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // ContentType
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.OID,
              false,
              asn1.oidToDer(msg.type).getBytes()
            ),
            // [0] EnvelopedData
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                // Version
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.INTEGER,
                  false,
                  asn1.integerToDer(msg.version).getBytes()
                ),
                // RecipientInfos
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.SET,
                  true,
                  _recipientsToAsn1(msg.recipients)
                ),
                // EncryptedContentInfo
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.SEQUENCE,
                  true,
                  _encryptedContentToAsn1(msg.encryptedContent)
                )
              ])
            ])
          ]);
        },
        /**
         * Find recipient by X.509 certificate's issuer.
         *
         * @param cert the certificate with the issuer to look for.
         *
         * @return the recipient object.
         */
        findRecipient: function(cert) {
          var sAttr = cert.issuer.attributes;
          for (var i2 = 0; i2 < msg.recipients.length; ++i2) {
            var r = msg.recipients[i2];
            var rAttr = r.issuer;
            if (r.serialNumber !== cert.serialNumber) {
              continue;
            }
            if (rAttr.length !== sAttr.length) {
              continue;
            }
            var match = true;
            for (var j = 0; j < sAttr.length; ++j) {
              if (rAttr[j].type !== sAttr[j].type || rAttr[j].value !== sAttr[j].value) {
                match = false;
                break;
              }
            }
            if (match) {
              return r;
            }
          }
          return null;
        },
        /**
         * Decrypt enveloped content
         *
         * @param recipient The recipient object related to the private key
         * @param privKey The (RSA) private key object
         */
        decrypt: function(recipient, privKey) {
          if (msg.encryptedContent.key === void 0 && recipient !== void 0 && privKey !== void 0) {
            switch (recipient.encryptedContent.algorithm) {
              case forge2.pki.oids.rsaEncryption:
              case forge2.pki.oids.desCBC:
                var key = privKey.decrypt(recipient.encryptedContent.content);
                msg.encryptedContent.key = forge2.util.createBuffer(key);
                break;
              default:
                throw new Error("Unsupported asymmetric cipher, OID " + recipient.encryptedContent.algorithm);
            }
          }
          _decryptContent(msg);
        },
        /**
         * Add (another) entity to list of recipients.
         *
         * @param cert The certificate of the entity to add.
         */
        addRecipient: function(cert) {
          msg.recipients.push({
            version: 0,
            issuer: cert.issuer.attributes,
            serialNumber: cert.serialNumber,
            encryptedContent: {
              // We simply assume rsaEncryption here, since forge.pki only
              // supports RSA so far.  If the PKI module supports other
              // ciphers one day, we need to modify this one as well.
              algorithm: forge2.pki.oids.rsaEncryption,
              key: cert.publicKey
            }
          });
        },
        /**
         * Encrypt enveloped content.
         *
         * This function supports two optional arguments, cipher and key, which
         * can be used to influence symmetric encryption.  Unless cipher is
         * provided, the cipher specified in encryptedContent.algorithm is used
         * (defaults to AES-256-CBC).  If no key is provided, encryptedContent.key
         * is (re-)used.  If that one's not set, a random key will be generated
         * automatically.
         *
         * @param [key] The key to be used for symmetric encryption.
         * @param [cipher] The OID of the symmetric cipher to use.
         */
        encrypt: function(key, cipher) {
          if (msg.encryptedContent.content === void 0) {
            cipher = cipher || msg.encryptedContent.algorithm;
            key = key || msg.encryptedContent.key;
            var keyLen, ivLen, ciphFn;
            switch (cipher) {
              case forge2.pki.oids["aes128-CBC"]:
                keyLen = 16;
                ivLen = 16;
                ciphFn = forge2.aes.createEncryptionCipher;
                break;
              case forge2.pki.oids["aes192-CBC"]:
                keyLen = 24;
                ivLen = 16;
                ciphFn = forge2.aes.createEncryptionCipher;
                break;
              case forge2.pki.oids["aes256-CBC"]:
                keyLen = 32;
                ivLen = 16;
                ciphFn = forge2.aes.createEncryptionCipher;
                break;
              case forge2.pki.oids["des-EDE3-CBC"]:
                keyLen = 24;
                ivLen = 8;
                ciphFn = forge2.des.createEncryptionCipher;
                break;
              default:
                throw new Error("Unsupported symmetric cipher, OID " + cipher);
            }
            if (key === void 0) {
              key = forge2.util.createBuffer(forge2.random.getBytes(keyLen));
            } else if (key.length() != keyLen) {
              throw new Error("Symmetric key has wrong length; got " + key.length() + " bytes, expected " + keyLen + ".");
            }
            msg.encryptedContent.algorithm = cipher;
            msg.encryptedContent.key = key;
            msg.encryptedContent.parameter = forge2.util.createBuffer(
              forge2.random.getBytes(ivLen)
            );
            var ciph = ciphFn(key);
            ciph.start(msg.encryptedContent.parameter.copy());
            ciph.update(msg.content);
            if (!ciph.finish()) {
              throw new Error("Symmetric encryption failed.");
            }
            msg.encryptedContent.content = ciph.output;
          }
          for (var i2 = 0; i2 < msg.recipients.length; ++i2) {
            var recipient = msg.recipients[i2];
            if (recipient.encryptedContent.content !== void 0) {
              continue;
            }
            switch (recipient.encryptedContent.algorithm) {
              case forge2.pki.oids.rsaEncryption:
                recipient.encryptedContent.content = recipient.encryptedContent.key.encrypt(
                  msg.encryptedContent.key.data
                );
                break;
              default:
                throw new Error("Unsupported asymmetric cipher, OID " + recipient.encryptedContent.algorithm);
            }
          }
        }
      };
      return msg;
    };
    function _recipientFromAsn1(obj) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, p7.asn1.recipientInfoValidator, capture, errors)) {
        var error = new Error("Cannot read PKCS#7 RecipientInfo. ASN.1 object is not an PKCS#7 RecipientInfo.");
        error.errors = errors;
        throw error;
      }
      return {
        version: capture.version.charCodeAt(0),
        issuer: forge2.pki.RDNAttributesAsArray(capture.issuer),
        serialNumber: forge2.util.createBuffer(capture.serial).toHex(),
        encryptedContent: {
          algorithm: asn1.derToOid(capture.encAlgorithm),
          parameter: capture.encParameter ? capture.encParameter.value : void 0,
          content: capture.encKey
        }
      };
    }
    function _recipientToAsn1(obj) {
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // Version
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(obj.version).getBytes()
        ),
        // IssuerAndSerialNumber
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // Name
          forge2.pki.distinguishedNameToAsn1({ attributes: obj.issuer }),
          // Serial
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            forge2.util.hexToBytes(obj.serialNumber)
          )
        ]),
        // KeyEncryptionAlgorithmIdentifier
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // Algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(obj.encryptedContent.algorithm).getBytes()
          ),
          // Parameter, force NULL, only RSA supported for now.
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
        ]),
        // EncryptedKey
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          obj.encryptedContent.content
        )
      ]);
    }
    function _recipientsFromAsn1(infos) {
      var ret = [];
      for (var i2 = 0; i2 < infos.length; ++i2) {
        ret.push(_recipientFromAsn1(infos[i2]));
      }
      return ret;
    }
    function _recipientsToAsn1(recipients) {
      var ret = [];
      for (var i2 = 0; i2 < recipients.length; ++i2) {
        ret.push(_recipientToAsn1(recipients[i2]));
      }
      return ret;
    }
    function _signerToAsn1(obj) {
      var rval = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // version
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.INTEGER,
          false,
          asn1.integerToDer(obj.version).getBytes()
        ),
        // issuerAndSerialNumber
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // name
          forge2.pki.distinguishedNameToAsn1({ attributes: obj.issuer }),
          // serial
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.INTEGER,
            false,
            forge2.util.hexToBytes(obj.serialNumber)
          )
        ]),
        // digestAlgorithm
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(obj.digestAlgorithm).getBytes()
          ),
          // parameters (null)
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
        ])
      ]);
      if (obj.authenticatedAttributesAsn1) {
        rval.value.push(obj.authenticatedAttributesAsn1);
      }
      rval.value.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // algorithm
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer(obj.signatureAlgorithm).getBytes()
        ),
        // parameters (null)
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")
      ]));
      rval.value.push(asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OCTETSTRING,
        false,
        obj.signature
      ));
      if (obj.unauthenticatedAttributes.length > 0) {
        var attrsAsn1 = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, []);
        for (var i2 = 0; i2 < obj.unauthenticatedAttributes.length; ++i2) {
          var attr = obj.unauthenticatedAttributes[i2];
          attrsAsn1.values.push(_attributeToAsn1(attr));
        }
        rval.value.push(attrsAsn1);
      }
      return rval;
    }
    function _signersToAsn1(signers) {
      var ret = [];
      for (var i2 = 0; i2 < signers.length; ++i2) {
        ret.push(_signerToAsn1(signers[i2]));
      }
      return ret;
    }
    function _attributeToAsn1(attr) {
      var value;
      if (attr.type === forge2.pki.oids.contentType) {
        value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer(attr.value).getBytes()
        );
      } else if (attr.type === forge2.pki.oids.messageDigest) {
        value = asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          attr.value.bytes()
        );
      } else if (attr.type === forge2.pki.oids.signingTime) {
        var jan_1_1950 = /* @__PURE__ */ new Date("1950-01-01T00:00:00Z");
        var jan_1_2050 = /* @__PURE__ */ new Date("2050-01-01T00:00:00Z");
        var date = attr.value;
        if (typeof date === "string") {
          var timestamp = Date.parse(date);
          if (!isNaN(timestamp)) {
            date = new Date(timestamp);
          } else if (date.length === 13) {
            date = asn1.utcTimeToDate(date);
          } else {
            date = asn1.generalizedTimeToDate(date);
          }
        }
        if (date >= jan_1_1950 && date < jan_1_2050) {
          value = asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.UTCTIME,
            false,
            asn1.dateToUtcTime(date)
          );
        } else {
          value = asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.GENERALIZEDTIME,
            false,
            asn1.dateToGeneralizedTime(date)
          );
        }
      }
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // AttributeType
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer(attr.type).getBytes()
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
          // AttributeValue
          value
        ])
      ]);
    }
    function _encryptedContentToAsn1(ec2) {
      return [
        // ContentType, always Data for the moment
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer(forge2.pki.oids.data).getBytes()
        ),
        // ContentEncryptionAlgorithmIdentifier
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          // Algorithm
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(ec2.algorithm).getBytes()
          ),
          // Parameters (IV)
          !ec2.parameter ? void 0 : asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OCTETSTRING,
            false,
            ec2.parameter.getBytes()
          )
        ]),
        // [0] EncryptedContent
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OCTETSTRING,
            false,
            ec2.content.getBytes()
          )
        ])
      ];
    }
    function _fromAsn1(msg, obj, validator) {
      var capture = {};
      var errors = [];
      if (!asn1.validate(obj, validator, capture, errors)) {
        var error = new Error("Cannot read PKCS#7 message. ASN.1 object is not a supported PKCS#7 message.");
        error.errors = error;
        throw error;
      }
      var contentType = asn1.derToOid(capture.contentType);
      if (contentType !== forge2.pki.oids.data) {
        throw new Error("Unsupported PKCS#7 message. Only wrapped ContentType Data supported.");
      }
      if (capture.encryptedContent) {
        var content = "";
        if (forge2.util.isArray(capture.encryptedContent)) {
          for (var i2 = 0; i2 < capture.encryptedContent.length; ++i2) {
            if (capture.encryptedContent[i2].type !== asn1.Type.OCTETSTRING) {
              throw new Error("Malformed PKCS#7 message, expecting encrypted content constructed of only OCTET STRING objects.");
            }
            content += capture.encryptedContent[i2].value;
          }
        } else {
          content = capture.encryptedContent;
        }
        msg.encryptedContent = {
          algorithm: asn1.derToOid(capture.encAlgorithm),
          parameter: forge2.util.createBuffer(capture.encParameter.value),
          content: forge2.util.createBuffer(content)
        };
      }
      if (capture.content) {
        var content = "";
        if (forge2.util.isArray(capture.content)) {
          for (var i2 = 0; i2 < capture.content.length; ++i2) {
            if (capture.content[i2].type !== asn1.Type.OCTETSTRING) {
              throw new Error("Malformed PKCS#7 message, expecting content constructed of only OCTET STRING objects.");
            }
            content += capture.content[i2].value;
          }
        } else {
          content = capture.content;
        }
        msg.content = forge2.util.createBuffer(content);
      }
      msg.version = capture.version.charCodeAt(0);
      msg.rawCapture = capture;
      return capture;
    }
    function _decryptContent(msg) {
      if (msg.encryptedContent.key === void 0) {
        throw new Error("Symmetric key not available.");
      }
      if (msg.content === void 0) {
        var ciph;
        switch (msg.encryptedContent.algorithm) {
          case forge2.pki.oids["aes128-CBC"]:
          case forge2.pki.oids["aes192-CBC"]:
          case forge2.pki.oids["aes256-CBC"]:
            ciph = forge2.aes.createDecryptionCipher(msg.encryptedContent.key);
            break;
          case forge2.pki.oids["desCBC"]:
          case forge2.pki.oids["des-EDE3-CBC"]:
            ciph = forge2.des.createDecryptionCipher(msg.encryptedContent.key);
            break;
          default:
            throw new Error("Unsupported symmetric cipher, OID " + msg.encryptedContent.algorithm);
        }
        ciph.start(msg.encryptedContent.parameter);
        ciph.update(msg.encryptedContent.content);
        if (!ciph.finish()) {
          throw new Error("Symmetric decryption failed.");
        }
        msg.content = ciph.output;
      }
    }
  }
});

// node_modules/node-forge/lib/ssh.js
var require_ssh = __commonJS({
  "node_modules/node-forge/lib/ssh.js"(exports, module) {
    var forge2 = require_forge();
    require_aes();
    require_hmac();
    require_md5();
    require_sha1();
    require_util();
    var ssh = module.exports = forge2.ssh = forge2.ssh || {};
    ssh.privateKeyToPutty = function(privateKey, passphrase, comment) {
      comment = comment || "";
      passphrase = passphrase || "";
      var algorithm = "ssh-rsa";
      var encryptionAlgorithm = passphrase === "" ? "none" : "aes256-cbc";
      var ppk = "PuTTY-User-Key-File-2: " + algorithm + "\r\n";
      ppk += "Encryption: " + encryptionAlgorithm + "\r\n";
      ppk += "Comment: " + comment + "\r\n";
      var pubbuffer = forge2.util.createBuffer();
      _addStringToBuffer(pubbuffer, algorithm);
      _addBigIntegerToBuffer(pubbuffer, privateKey.e);
      _addBigIntegerToBuffer(pubbuffer, privateKey.n);
      var pub = forge2.util.encode64(pubbuffer.bytes(), 64);
      var length = Math.floor(pub.length / 66) + 1;
      ppk += "Public-Lines: " + length + "\r\n";
      ppk += pub;
      var privbuffer = forge2.util.createBuffer();
      _addBigIntegerToBuffer(privbuffer, privateKey.d);
      _addBigIntegerToBuffer(privbuffer, privateKey.p);
      _addBigIntegerToBuffer(privbuffer, privateKey.q);
      _addBigIntegerToBuffer(privbuffer, privateKey.qInv);
      var priv;
      if (!passphrase) {
        priv = forge2.util.encode64(privbuffer.bytes(), 64);
      } else {
        var encLen = privbuffer.length() + 16 - 1;
        encLen -= encLen % 16;
        var padding = _sha1(privbuffer.bytes());
        padding.truncate(padding.length() - encLen + privbuffer.length());
        privbuffer.putBuffer(padding);
        var aeskey = forge2.util.createBuffer();
        aeskey.putBuffer(_sha1("\0\0\0\0", passphrase));
        aeskey.putBuffer(_sha1("\0\0\0", passphrase));
        var cipher = forge2.aes.createEncryptionCipher(aeskey.truncate(8), "CBC");
        cipher.start(forge2.util.createBuffer().fillWithByte(0, 16));
        cipher.update(privbuffer.copy());
        cipher.finish();
        var encrypted = cipher.output;
        encrypted.truncate(16);
        priv = forge2.util.encode64(encrypted.bytes(), 64);
      }
      length = Math.floor(priv.length / 66) + 1;
      ppk += "\r\nPrivate-Lines: " + length + "\r\n";
      ppk += priv;
      var mackey = _sha1("putty-private-key-file-mac-key", passphrase);
      var macbuffer = forge2.util.createBuffer();
      _addStringToBuffer(macbuffer, algorithm);
      _addStringToBuffer(macbuffer, encryptionAlgorithm);
      _addStringToBuffer(macbuffer, comment);
      macbuffer.putInt32(pubbuffer.length());
      macbuffer.putBuffer(pubbuffer);
      macbuffer.putInt32(privbuffer.length());
      macbuffer.putBuffer(privbuffer);
      var hmac = forge2.hmac.create();
      hmac.start("sha1", mackey);
      hmac.update(macbuffer.bytes());
      ppk += "\r\nPrivate-MAC: " + hmac.digest().toHex() + "\r\n";
      return ppk;
    };
    ssh.publicKeyToOpenSSH = function(key, comment) {
      var type = "ssh-rsa";
      comment = comment || "";
      var buffer = forge2.util.createBuffer();
      _addStringToBuffer(buffer, type);
      _addBigIntegerToBuffer(buffer, key.e);
      _addBigIntegerToBuffer(buffer, key.n);
      return type + " " + forge2.util.encode64(buffer.bytes()) + " " + comment;
    };
    ssh.privateKeyToOpenSSH = function(privateKey, passphrase) {
      if (!passphrase) {
        return forge2.pki.privateKeyToPem(privateKey);
      }
      return forge2.pki.encryptRsaPrivateKey(
        privateKey,
        passphrase,
        { legacy: true, algorithm: "aes128" }
      );
    };
    ssh.getPublicKeyFingerprint = function(key, options) {
      options = options || {};
      var md = options.md || forge2.md.md5.create();
      var type = "ssh-rsa";
      var buffer = forge2.util.createBuffer();
      _addStringToBuffer(buffer, type);
      _addBigIntegerToBuffer(buffer, key.e);
      _addBigIntegerToBuffer(buffer, key.n);
      md.start();
      md.update(buffer.getBytes());
      var digest = md.digest();
      if (options.encoding === "hex") {
        var hex = digest.toHex();
        if (options.delimiter) {
          return hex.match(/.{2}/g).join(options.delimiter);
        }
        return hex;
      } else if (options.encoding === "binary") {
        return digest.getBytes();
      } else if (options.encoding) {
        throw new Error('Unknown encoding "' + options.encoding + '".');
      }
      return digest;
    };
    function _addBigIntegerToBuffer(buffer, val) {
      var hexVal = val.toString(16);
      if (hexVal[0] >= "8") {
        hexVal = "00" + hexVal;
      }
      var bytes = forge2.util.hexToBytes(hexVal);
      buffer.putInt32(bytes.length);
      buffer.putBytes(bytes);
    }
    function _addStringToBuffer(buffer, val) {
      buffer.putInt32(val.length);
      buffer.putString(val);
    }
    function _sha1() {
      var sha = forge2.md.sha1.create();
      var num = arguments.length;
      for (var i2 = 0; i2 < num; ++i2) {
        sha.update(arguments[i2]);
      }
      return sha.digest();
    }
  }
});

// node_modules/node-forge/lib/index.js
var require_lib = __commonJS({
  "node_modules/node-forge/lib/index.js"(exports, module) {
    module.exports = require_forge();
    require_aes();
    require_aesCipherSuites();
    require_asn1();
    require_cipher();
    require_des();
    require_ed25519();
    require_hmac();
    require_kem();
    require_log();
    require_md_all();
    require_mgf1();
    require_pbkdf2();
    require_pem();
    require_pkcs1();
    require_pkcs12();
    require_pkcs7();
    require_pki();
    require_prime();
    require_prng();
    require_pss();
    require_random();
    require_rc2();
    require_ssh();
    require_tls();
    require_util();
  }
});

// scripts/wallet/wallet-pass.src.js
var import_node_forge = __toESM(require_lib());

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i2 = 0; i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0; i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (val instanceof u8)
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i2 = 0; i2 < files.length; ++i2) {
    var f = files[i2];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}

// scripts/wallet/pass-images.js
var PASS_IMAGES = {
  "icon.png": "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAHaADAAQAAAABAAAAHQAAAADeexZRAAAEoElEQVRIDeVWTYgcRRR+VV3dM7szu2PW7BpD4hoUNCarQsRTDhIISMTgTRM85eIhJy8RBCWeRD0EEZXcBEEP4iWI4FH0tAQUD8LGuFk1rGji7Gzmt//q+b3q7dnu2ZjZBHKyoLrrvXr1fe+9elXdRP+XpkYDPbR6fvLPeuclMt5jOkou1eL086XZ19pi90Drox2J1z9Jnn7QxOlPutn5YmXf2cEoxji5RPrItXemWkZ9yVPVo4qY3GQ7+r7aMs9X/b7Xqgdf26ngaWImzUS6HV6gQePE6u5XeuOIivOmKHS192I0HRylTki+ZcuKtJquHo7S6GTKQYVByO1QnLFW5urBcS+98QIwPivijBvrsgEvgIx8priSqjcVUw/UpDQ/nmpeSDH2iNaqMb+FRDCcIvboYBljvFQitUpgyEXisVrGMM0gWClS6CAhig3pX+GQE6iEkFmPe5aWWLHGfgmaVQpBZbIloWDWMof4ELBxVuKGdQuc6XYfJdJcEMC8SXS5PqusfCZ7O0fLqrHSEM9Z5giONRdcxjeAkOQRSJ2bjehvJZZJIbmdKyEj1UBw6UQmZay0bH6WD1tGuBXXcK60JBM2zufQBOl1dbqpkMPkrIr7sDk9dlQidZkCUFYahSmlWAszCmeoddm4M9bS5eBcdIcjc1YgZRddSkHHxUIV58bGdHODoePF6SzBOChQZicXA6RUTkhxu7PxTSGKcFvGW1cgGlckG9eCgiyZlfQKpUSXF49cGXfSSqRuTwHksoirIU8fLgpmPEQjNPmi4vh2yPP1m2sco4jaEThi6BjHJI8UXoVwwVJqMbT7Nxdvb1QidUKeMgDmTSmdgDKRQkJ0pqr178jHGscppYF+bs/1917ObbfzLlWvkKYABh1uXtUDcGIBbMkeERXHGGGLp/vhUmvCXKCaf4p7URD59Mmu5rsn4NwSErDpLfDY95UZxJf/2Hnm49yhEqko3fcEXzfc6L+FRN/pqn8cKPtlg1XVkOkn3y7uef0ffPDfuNGND9l68AQPEs9W9DHl6WN5Hch+S2NjiMN4EcMhaSm9+I4k+ISkWJBYz8R1y6d1O/oGuj5uob7qRF9NDvi0gOEXZnVmzT7rteMPUdhX1SCOuBMm+AFIqBsmbtyNEtUP5Ry43x1ZJy13yAnz187dryfUbNwZ4DP+1+Wre8/1JcCH1t9/mMKQlufO/OIMRx4Lrbd3rMTJXMOrBRRF1OLI1ioTKoCdIV/7MXcu3ffq8siyrSJfZH+r9r81fHF1p8wyPWN48coupvM+HzgrvFtaKdI4jo/g2pmDVRuVmuAtW9SF7h68xVZAYszFRqkGynnNGNNLkgQFrQ9qbX9Ow9Qo33sU94lEVsHcj1ivgiC4ghfKRKIvNKUsCD0Bn9Wa5rFwBeOubIpRdrfW/g82SQ7jemqhylu4MvaiWCcA1oFJNU3Vvcr39+HOgkiz0MvcU3CsQXT9U+gcaSlSRDCNCW5Ry1PrCKXREFkibqJPoM+j/42+3mw29czMDDLRqxNNet1uN6nVzCSCE9sKuvyW1hDpAQTwpNbmAzgQQXf3GwIJ0G+rPu6KV/8Csgj2JAoTRNYAAAAASUVORK5CYII=",
  "icon@2x.png": "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",
  "icon@3x.png": "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",
  "logo.png": "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",
  "logo@2x.png": "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",
  "logo@3x.png": "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"
};

// scripts/wallet/wallet-pass.src.js
var SUPA_DEFAULT = "https://amyqxovbnlreassrqihr.supabase.co";
var DIRECTIONS = "https://maps.app.goo.gl/zJLjmiaJgfJDKQwY7";
async function onRequestPost(context) {
  const { request, env } = context;
  const p12b64 = env.APPLE_PASS_P12_BASE64;
  const p12pw = env.APPLE_PASS_P12_PASSWORD || "";
  const passTypeId = env.APPLE_PASS_TYPE_ID;
  const teamId = env.APPLE_TEAM_ID;
  if (!p12b64 || !passTypeId || !teamId) {
    return json({ ok: false, skipped: "wallet not configured" }, 501);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad body" }, 400);
  }
  const { customerId, token, bookingId } = body || {};
  if (!customerId || !token || !bookingId) return json({ ok: false, error: "missing fields" }, 400);
  const SUPA = env.SUPABASE_URL || SUPA_DEFAULT;
  const ANON = env.SUPABASE_ANON_KEY;
  if (!ANON) return json({ ok: false, error: "no anon key" }, 500);
  const rpc = await fetch(`${SUPA}/rest/v1/rpc/my_bookings`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: customerId, p_token: token })
  });
  if (!rpc.ok) return json({ ok: false, error: "lookup failed" }, 502);
  const rows = await rpc.json();
  const b = Array.isArray(rows) ? rows.find((r) => r.id === bookingId) : null;
  if (!b) return json({ ok: false, error: "not found" }, 404);
  try {
    const pkpass = await buildPkpass(b, { p12b64, p12pw, passTypeId, teamId });
    return new Response(pkpass, {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="booking-${b.queue_num}.pkpass"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return json({ ok: false, error: "sign failed: " + (e && e.message) }, 500);
  }
}
async function buildPkpass(b, cfg) {
  const num = b.queue_num != null ? String(b.queue_num) : "";
  const ref6 = b.id ? String(b.id).slice(0, 6) : "";
  const barcodeMsg = ["MMC", num, ref6].filter(Boolean).join("-");
  const when = `${b.session_day || ""} ${b.session_date || ""}`.trim();
  const time = b.session_time || "";
  const rider = b.name || "";
  const bikeType = _bikeLabel(b.type_preference);
  const priceStr = b.price != null && b.price !== "" && !isNaN(+b.price) ? `SAR ${+b.price}` : "";
  const secondary = [{ key: "session", label: "SESSION", value: when || "Jeddah Corniche Circuit" }];
  if (time) secondary.push({ key: "time", label: "TIME", value: time });
  const auxiliary = [];
  if (rider) auxiliary.push({ key: "rider", label: "RIDER", value: rider });
  if (bikeType) auxiliary.push({ key: "bike", label: "BIKE", value: bikeType });
  if (priceStr) auxiliary.push({ key: "total", label: "TOTAL", value: priceStr });
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: String(b.id),
    organizationName: "MicroMobility Rentals",
    description: `Booking #${num} \u2014 Jeddah Corniche Circuit`,
    foregroundColor: "rgb(242,245,242)",
    backgroundColor: "rgb(7,9,11)",
    labelColor: "rgb(0,229,133)",
    sharingProhibited: true,
    barcodes: [{ format: "PKBarcodeFormatQR", message: barcodeMsg, messageEncoding: "iso-8859-1", altText: `#${num}` }],
    // keep the legacy single-barcode field too for older iOS
    barcode: { format: "PKBarcodeFormatQR", message: barcodeMsg, messageEncoding: "iso-8859-1", altText: `#${num}` },
    locations: [{ latitude: 21.6266, longitude: 39.1099, relevantText: "Your ride is nearby \u2014 head to Gate A" }],
    eventTicket: {
      headerFields: [],
      primaryFields: [{ key: "queue", label: "QUEUE", value: `#${num}` }],
      secondaryFields: secondary,
      auxiliaryFields: auxiliary,
      backFields: [
        { key: "gate", label: "Gate", value: "Gate A \u2014 Jeddah Corniche Circuit" },
        { key: "venue", label: "Venue", value: "Jeddah Corniche Circuit" },
        { key: "directions", label: "Directions", value: `<a href="${DIRECTIONS}">Open in Maps</a>` },
        { key: "pay", label: "Payment", value: "Pay at the booth \u2014 cash, mada or STC Pay." },
        { key: "help", label: "Good to know", value: "Show this pass at Gate A. Bikes are assigned first come, first served, so arrive a little early to get the type you picked." },
        { key: "ref", label: "Reference", value: barcodeMsg }
      ]
    }
  };
  const files = {};
  files["pass.json"] = strBytes(JSON.stringify(pass));
  for (const [name, b64] of Object.entries(PASS_IMAGES)) files[name] = b64Bytes(b64);
  const manifest = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1hex(bytes);
  const manifestStr = JSON.stringify(manifest);
  files["manifest.json"] = strBytes(manifestStr);
  const wwdrPem = await getWWDR();
  files["signature"] = signManifest(manifestStr, cfg.p12b64, cfg.p12pw, wwdrPem);
  return zipSync(files, { level: 6 });
}
function _bikeLabel(t) {
  const k = String(t || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const map = {
    road: "Road",
    hybrid: "Hybrid",
    mountain: "Mountain",
    gravel: "Gravel",
    any: "Any",
    roadcarbon: "Road Carbon"
  };
  if (map[k]) return map[k];
  const s = String(t || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function sha1hex(bytes) {
  const md = import_node_forge.default.md.sha1.create();
  md.update(import_node_forge.default.util.createBuffer(bytes).getBytes());
  return md.digest().toHex();
}
function _seedForge() {
  try {
    const src = typeof globalThis !== "undefined" && globalThis.crypto ? globalThis.crypto : typeof crypto !== "undefined" ? crypto : null;
    if (!src || !src.getRandomValues) return;
    const seedSync = (needed) => {
      const b = new Uint8Array(needed || 32);
      src.getRandomValues(b);
      let out = "";
      for (let i2 = 0; i2 < b.length; i2++) out += String.fromCharCode(b[i2]);
      return out;
    };
    import_node_forge.default.random.seedFileSync = seedSync;
    import_node_forge.default.random.seedFile = (needed, cb) => cb(null, seedSync(needed));
    import_node_forge.default.random.collect(seedSync(32));
  } catch (e) {
  }
}
function signManifest(manifestStr, p12b64, pw, wwdrPem) {
  _seedForge();
  const der = import_node_forge.default.util.decode64(p12b64);
  const p12 = import_node_forge.default.pkcs12.pkcs12FromAsn1(import_node_forge.default.asn1.fromDer(der), false, pw);
  let key = null, cert = null;
  for (const sc of p12.safeContents) for (const bag of sc.safeBags) {
    if (bag.key) key = bag.key;
    if (bag.cert && !cert) cert = bag.cert;
  }
  if (!key || !cert) throw new Error("p12 missing key or cert");
  const wwdr = import_node_forge.default.pki.certificateFromPem(wwdrPem);
  const p7 = import_node_forge.default.pkcs7.createSignedData();
  p7.content = import_node_forge.default.util.createBuffer(manifestStr, "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: import_node_forge.default.pki.oids.sha256,
    authenticatedAttributes: [
      { type: import_node_forge.default.pki.oids.contentType, value: import_node_forge.default.pki.oids.data },
      { type: import_node_forge.default.pki.oids.messageDigest },
      { type: import_node_forge.default.pki.oids.signingTime }
    ]
  });
  p7.sign({ detached: true });
  const derSig = import_node_forge.default.asn1.toDer(p7.toAsn1()).getBytes();
  return binStrToBytes(derSig);
}
var _wwdrPem = null;
async function getWWDR() {
  if (_wwdrPem) return _wwdrPem;
  const res = await fetch("https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer");
  if (!res.ok) throw new Error("WWDR fetch failed");
  const der = new Uint8Array(await res.arrayBuffer());
  const asn1 = import_node_forge.default.asn1.fromDer(import_node_forge.default.util.createBuffer(binFromBytes(der)));
  const cert = import_node_forge.default.pki.certificateFromAsn1(asn1);
  _wwdrPem = import_node_forge.default.pki.certificateToPem(cert);
  return _wwdrPem;
}
function strBytes(s) {
  return new TextEncoder().encode(s);
}
function b64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i2 = 0; i2 < bin.length; i2++) out[i2] = bin.charCodeAt(i2);
  return out;
}
function binStrToBytes(bin) {
  const out = new Uint8Array(bin.length);
  for (let i2 = 0; i2 < bin.length; i2++) out[i2] = bin.charCodeAt(i2) & 255;
  return out;
}
function binFromBytes(bytes) {
  let s = "";
  for (let i2 = 0; i2 < bytes.length; i2++) s += String.fromCharCode(bytes[i2]);
  return s;
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
export {
  onRequestPost
};

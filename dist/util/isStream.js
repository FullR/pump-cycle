"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = isStream;

function isStream(v) {
  return v && typeof v.subscribe === "function";
}

;
module.exports = exports["default"];
"use strict";
((() => {
  try {
    return this;
  } catch (t) {
    return Function("return this")();
  }
})().webpackChunkplugin =
  (() => {
    try {
      return this;
    } catch (t) {
      return Function("return this")();
    }
  })().webpackChunkplugin || []).push([
  [591],
  {
    591: (t) => {
      t.exports = function () {
        throw new Error(
          "ws does not work in the browser. Browser clients must use the native WebSocket object"
        );
      };
    },
  },
]);

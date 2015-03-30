var evt = document.createEvent("CustomEvent");

evt.initCustomEvent("polymer-ready", false, false);
window.dispatchEvent(evt);

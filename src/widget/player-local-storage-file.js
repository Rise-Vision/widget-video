/* global localMessaging, playerLocalStorage */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerLocalStorageFile = function() {
  "use strict";

  var messaging = new localMessaging.default(),
    storage = null; // eslint-disable-line no-unused-vars

  function _handleEvents( data ) {
    if ( !data || !data.event || typeof data.event !== "string" ) {
      return;
    }

    switch ( data.event.toUpperCase() ) {
    case "NO-CONNECTION":
      RiseVision.Video.logEvent( {
        "event": "no connection",
        "event_details": "use rise cache"
      } );
      break;
    case "REQUIRED-MODULES-UNAVAILABLE":
      RiseVision.Video.logEvent( {
        "event": "required modules unavailable"
      } );
      break;
    case "AUTHORIZED":
      RiseVision.Video.logEvent( {
        "event": "authorized"
      } );
      break;
    case "UNAUTHORIZED":
      RiseVision.Video.logEvent( {
        "event": "unauthorized"
      } );
      break;
    }
  }

  function init() {
    storage = new playerLocalStorage.default( messaging, _handleEvents );
  }

  return {
    "init": init
  };
};

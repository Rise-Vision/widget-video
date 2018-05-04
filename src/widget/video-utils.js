/* global gadgets */

var RiseVision = RiseVision || {};

RiseVision.VideoUtils = ( function() {
  "use strict";

  var ERROR_TIMER_DELAY = 5000,
    _prefs = new gadgets.Prefs(),
    _errorTimer = null;

  /*
   *  Public  Methods
   */

  function clearErrorTimer() {
    clearTimeout( _errorTimer );
    _errorTimer = null;
  }

  function startErrorTimer() {
    clearErrorTimer();

    _errorTimer = setTimeout( function() {
      RiseVision.VideoUtils.sendDoneToViewer();
    }, ERROR_TIMER_DELAY );
  }

  function getTableName() {
    return "image_events";
  }

  function logEvent( params ) {
    RiseVision.Common.LoggerUtils.logEvent( getTableName(), params );
  }

  function sendDoneToViewer() {
    gadgets.rpc.call( "", "rsevent_done", null, _prefs.getString( "id" ) );
  }

  function sendReadyToViewer() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, true );
  }

  return {
    "clearErrorTimer": clearErrorTimer,
    "startErrorTimer": startErrorTimer,
    "getTableName": getTableName,
    "logEvent": logEvent,
    "sendDoneToViewer": sendDoneToViewer,
    "sendReadyToViewer": sendReadyToViewer
  };

} )();

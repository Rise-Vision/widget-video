/* global gadgets */

var RiseVision = RiseVision || {};

RiseVision.VideoUtils = ( function() {
  "use strict";

  var ERROR_TIMER_DELAY = 5000,
    _prefs = new gadgets.Prefs(),
    _currentFiles = [],
    _mode = null,
    _errorTimer = null;

  function _getCurrentFile() {
    if ( _currentFiles && _currentFiles.length > 0 ) {
      if ( _mode === "file" ) {
        return _currentFiles[ 0 ];
      }
    }

    return null;
  }

  /*
   *  Public  Methods
   */

  function clearErrorTimer() {
    clearTimeout( _errorTimer );
    _errorTimer = null;
  }

  function getCurrentFiles() {
    return _currentFiles;
  }

  function getMode() {
    return _mode;
  }

  function startErrorTimer() {
    clearErrorTimer();

    _errorTimer = setTimeout( function() {
      RiseVision.VideoUtils.sendDoneToViewer();
    }, ERROR_TIMER_DELAY );
  }

  function getTableName() {
    return "video_v2_events";
  }

  function logEvent( params ) {
    if ( !params.file_url ) {
      params.file_url = _getCurrentFile();
    }

    RiseVision.Common.LoggerUtils.logEvent( getTableName(), params );
  }

  function playerEnded() {
    RiseVision.VideoUtils.sendDoneToViewer();
  }

  function sendDoneToViewer() {
    gadgets.rpc.call( "", "rsevent_done", null, _prefs.getString( "id" ) );
  }

  function sendReadyToViewer() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, true );
  }

  function setCurrentFiles( urls ) {
    if ( !urls ) {
      return;
    }

    if ( typeof urls === "string" ) {
      _currentFiles[ 0 ] = urls;
    } else if ( Array.isArray( urls ) && urls.length > 0 ) {
      _currentFiles = urls;
    }
  }

  function setMode( mode ) {
    _mode = mode;
  }

  return {
    "clearErrorTimer": clearErrorTimer,
    "getCurrentFiles": getCurrentFiles,
    "getMode": getMode,
    "getTableName": getTableName,
    "logEvent": logEvent,
    "playerEnded": playerEnded,
    "sendDoneToViewer": sendDoneToViewer,
    "sendReadyToViewer": sendReadyToViewer,
    "setCurrentFiles": setCurrentFiles,
    "setMode": setMode,
    "startErrorTimer": startErrorTimer,
  };

} )();

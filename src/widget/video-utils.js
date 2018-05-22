/* global gadgets */

var RiseVision = RiseVision || {};

RiseVision.VideoUtils = ( function() {
  "use strict";

  var ERROR_TIMER_DELAY = 5000,
    _prefs = new gadgets.Prefs(),
    _currentFiles = [],
    _useRLSSingleFile = false,
    _displayId = null,
    _params = null,
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

  function getDisplayId() {
    return _displayId;
  }

  function getMode() {
    return _mode;
  }

  function getParams() {
    return _params;
  }

  function getStorageSingleFilePath() {
    var path = "";

    if ( _params.storage.folder ) {
      path += _params.storage.folder + ( _params.storage.folder.slice( -1 ) !== "/" ? "/" : "" );
    }

    path += _params.storage.fileName;

    return "risemedialibrary-" + _params.storage.companyId + "/" + path;
  }

  function isValidDisplayId() {
    return _displayId && _displayId !== "preview" && _displayId !== "display_id" && _displayId.indexOf( "displayId" ) === -1;
  }

  function isRLSSingleFile() {
    return _mode === "file" && _useRLSSingleFile;
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

  function logEvent( data ) {
    if ( RiseVision.VideoUtils.isRLSSingleFile() ) {
      data.file_url = RiseVision.VideoUtils.getStorageSingleFilePath();
      data.local_url = _getCurrentFile();
    } else {
      if ( !data.file_url ) {
        data.file_url = _getCurrentFile();
      }
    }

    RiseVision.Common.LoggerUtils.logEvent( getTableName(), data );
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

  function setDisplayId( displayId ) {
    _displayId = displayId;
  }

  function setMode( mode ) {
    _mode = mode;
  }

  function setParams( params ) {
    _params = params;
  }

  function setUseRLSSingleFile() {
    _useRLSSingleFile = true;
  }

  return {
    "clearErrorTimer": clearErrorTimer,
    "getCurrentFiles": getCurrentFiles,
    "getDisplayId": getDisplayId,
    "getMode": getMode,
    "getParams": getParams,
    "getTableName": getTableName,
    "getStorageSingleFilePath": getStorageSingleFilePath,
    "isValidDisplayId": isValidDisplayId,
    "isRLSSingleFile": isRLSSingleFile,
    "logEvent": logEvent,
    "playerEnded": playerEnded,
    "sendDoneToViewer": sendDoneToViewer,
    "sendReadyToViewer": sendReadyToViewer,
    "setCurrentFiles": setCurrentFiles,
    "setDisplayId": setDisplayId,
    "setMode": setMode,
    "setParams": setParams,
    "setUseRLSSingleFile": setUseRLSSingleFile,
    "startErrorTimer": startErrorTimer,
  };

} )();

/* global gadgets */

var RiseVision = RiseVision || {};

RiseVision.VideoUtils = ( function() {
  "use strict";

  var _prefs = new gadgets.Prefs(),
    _currentFiles = [],
    _companyId = null,
    _displayId = null,
    _configurationType = null,
    _usingRLS = false,
    _params = null,
    _mode = null;

  /*
   *  Public  Methods
   */

  function getStorageFileName( filePath ) {
    if ( !filePath || typeof filePath !== "string" ) {
      return "";
    }

    return filePath.split( "risemedialibrary-" ).pop().split( "/" ).pop();
  }

  function getCurrentFiles() {
    return _currentFiles;
  }

  function getCompanyId() {
    return _companyId;
  }

  function getConfigurationType() {
    return _configurationType;
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

  function getStorageFolderPath() {
    var path = "";

    path += _params.storage.folder + ( _params.storage.folder.slice( -1 ) !== "/" ? "/" : "" );

    return "risemedialibrary-" + _params.storage.companyId + "/" + path;
  }

  function getUsingRLS() {
    return _usingRLS;
  }

  function isValidDisplayId() {
    return _displayId && _displayId !== "preview" && _displayId !== "display_id" && _displayId.indexOf( "displayId" ) === -1;
  }

  function getTableName() {
    return "video_v2_events";
  }

  function logEvent( data ) {
    data.configuration = getConfigurationType() || "";
    RiseVision.Common.LoggerUtils.logEvent( getTableName(), data );
  }

  function playerEnded() {
    RiseVision.VideoUtils.sendDoneToViewer();
  }

  function resetVideoElement() {
    var container = document.getElementById( "container" ),
      fragment = document.createDocumentFragment(),
      el = document.createElement( "video" );

    el.setAttribute( "id", "player" );
    el.setAttribute( "preload", "auto" );
    el.className = "video-js";

    fragment.appendChild( el );
    container.appendChild( fragment );
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

    if ( Array.isArray( urls ) ) {
      _currentFiles = urls;
    } else {
      _currentFiles[ 0 ] = urls;
    }
  }

  function setCompanyId( companyId ) {
    _companyId = companyId;
  }

  function setConfigurationType( type ) {
    _configurationType = type;
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

  function setUsingRLS() {
    _usingRLS = true;
  }

  return {
    "getCurrentFiles": getCurrentFiles,
    "getCompanyId": getCompanyId,
    "getConfigurationType": getConfigurationType,
    "getDisplayId": getDisplayId,
    "getMode": getMode,
    "getParams": getParams,
    "getTableName": getTableName,
    "getStorageFileName": getStorageFileName,
    "getStorageSingleFilePath": getStorageSingleFilePath,
    "getStorageFolderPath": getStorageFolderPath,
    "getUsingRLS": getUsingRLS,
    "isValidDisplayId": isValidDisplayId,
    "logEvent": logEvent,
    "playerEnded": playerEnded,
    "resetVideoElement": resetVideoElement,
    "sendDoneToViewer": sendDoneToViewer,
    "sendReadyToViewer": sendReadyToViewer,
    "setConfigurationType": setConfigurationType,
    "setCurrentFiles": setCurrentFiles,
    "setDisplayId": setDisplayId,
    "setCompanyId": setCompanyId,
    "setMode": setMode,
    "setParams": setParams,
    "setUsingRLS": setUsingRLS
  };

} )();

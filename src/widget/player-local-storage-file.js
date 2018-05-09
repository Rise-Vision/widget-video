/* global localMessaging, playerLocalStorage */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoRLS = RiseVision.VideoRLS || {};

RiseVision.VideoRLS.PlayerLocalStorageFile = function( params ) {
  "use strict";

  var INITIAL_PROCESSING_DELAY = 10000,
    videoUtils = RiseVision.VideoUtils,
    messaging = new localMessaging.default(),
    filePath = "",
    storage = null,
    initialProcessingTimer = null,
    watchInitiated = false,
    initialLoad = true;

  function _clearInitialProcessingTimer() {
    clearTimeout( initialProcessingTimer );
    initialProcessingTimer = null;
  }

  function _startInitialProcessingTimer() {
    initialProcessingTimer = setTimeout( function() {
      // file is still processing/downloading
      RiseVision.VideoRLS.onFileUnavailable( "File is downloading" );
    }, INITIAL_PROCESSING_DELAY );
  }

  function _getFilePath() {
    var path = "";

    if ( params.storage.folder ) {
      path += params.storage.folder + ( params.storage.folder.slice( -1 ) !== "/" ? "/" : "" );
    }

    path += params.storage.fileName;

    return "risemedialibrary-" + params.storage.companyId + "/" + path;
  }

  function _handleNoConnection() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "no connection",
      "file_url": filePath
    }, true );

    RiseVision.VideoRLS.showError( "There was a problem retrieving the file." );
  }

  function _handleRequiredModulesUnavailable() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "required modules unavailable",
      "file_url": filePath
    }, true );

    RiseVision.VideoRLS.showError( "There was a problem retrieving the file." );
  }

  function _handleLicensingUnavailable() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "licensing unavailable",
      "file_url": filePath
    }, true );

    RiseVision.VideoRLS.showError( "There was a problem retrieving the file." );
  }

  function _handleUnauthorized() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "unauthorized",
      "file_url": filePath
    }, true );

    RiseVision.VideoRLS.showError( "Rise Storage subscription is not active." );
  }

  function _handleAuthorized() {
    if ( !watchInitiated ) {
      // start watching the file
      storage.watchFiles( filePath );
      watchInitiated = true;
    }
  }

  function _handleFileProcessing() {
    if ( initialLoad && !initialProcessingTimer ) {
      _startInitialProcessingTimer();
    }
  }

  function _handleFileAvailable( data ) {
    _clearInitialProcessingTimer();

    if ( initialLoad ) {
      initialLoad = false;
      RiseVision.VideoRLS.onFileInit( data.fileUrl );

      return;
    }

    RiseVision.VideoRLS.onFileRefresh( data.fileUrl );
  }

  function _handleFileNoExist() {
    var params = {
      "event": "error",
      "event_details": "file does not exist",
      "file_url": filePath
    };

    videoUtils.logEvent( params, true );

    RiseVision.VideoRLS.showError( "The selected video does not exist or has been moved to Trash." );
  }

  function _handleFileDeleted() {
    videoUtils.logEvent( {
      "event": "file deleted",
      "file_url": filePath
    } );
  }

  function _handleFileError( data ) {
    var msg = data.msg || "",
      detail = data.detail || "",
      params = {
        "event": "error",
        "event_details": msg,
        "error_details": detail,
        "file_url": filePath
      };

    videoUtils.logEvent( params, true );

    /*** Possible error messages from Local Storage ***/
    /*
      "File's host server could not be reached"

      "File I/O Error"

      "Could not retrieve signed URL"

      "Insufficient disk space"

      "Invalid response with status code [CODE]"
     */

    // Widget will display generic message
    RiseVision.VideoRLS.showError( "Unable to download the file." );
  }

  function _handleEvents( data ) {
    if ( !data || !data.event || typeof data.event !== "string" ) {
      return;
    }

    switch ( data.event.toUpperCase() ) {
    case "NO-CONNECTION":
      _handleNoConnection();
      break;
    case "REQUIRED-MODULES-UNAVAILABLE":
      _handleRequiredModulesUnavailable();
      break;
    case "LICENSING-UNAVAILABLE":
      _handleLicensingUnavailable();
      break;
    case "AUTHORIZED":
      _handleAuthorized();
      break;
    case "UNAUTHORIZED":
      _handleUnauthorized();
      break;
    case "FILE-AVAILABLE":
      _handleFileAvailable( data );
      break;
    case "FILE-PROCESSING":
      _handleFileProcessing();
      break;
    case "FILE-NO-EXIST":
      _handleFileNoExist();
      break;
    case "FILE-DELETED":
      _handleFileDeleted();
      break;
    case "FILE-ERROR":
      _handleFileError( data );
      break;
    }
  }

  function init() {
    filePath = _getFilePath();
    storage = new playerLocalStorage.default( messaging, _handleEvents );
  }

  function retry() {
    _handleFileProcessing();
  }

  return {
    "init": init,
    "retry": retry
  };
};

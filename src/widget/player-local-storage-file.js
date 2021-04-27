/* global localMessaging, playerLocalStorage, playerLocalStorageLicensing, config, _ */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoWatch = RiseVision.VideoWatch || {};

RiseVision.VideoWatch.PlayerLocalStorageFile = function() {
  "use strict";

  var INITIAL_PROCESSING_DELAY = 10000,
    videoUtils = RiseVision.VideoUtils,
    messaging = new localMessaging.default(),
    filePath = "",
    licensing = null,
    storage = null,
    initialProcessingTimer = null,
    watchInitiated = false,
    initialLoad = true,
    fileErrorLogParams = null;

  function _clearInitialProcessingTimer() {
    clearTimeout( initialProcessingTimer );
    initialProcessingTimer = null;
  }

  function _startInitialProcessingTimer() {
    initialProcessingTimer = setTimeout( function() {
      // file is still processing/downloading
      RiseVision.VideoWatch.onFileUnavailable( "File is downloading." );
    }, INITIAL_PROCESSING_DELAY );
  }

  function _resetFileErrorLogParams() {
    fileErrorLogParams = null;
  }

  function _handleNoConnection() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "no connection",
      "file_url": filePath
    }, { severity: "error", errorCode: "E000000025", debugInfo: JSON.stringify( { file_url: filePath } ) } );

    RiseVision.VideoWatch.handleError();
  }

  function _handleRequiredModulesUnavailable() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "required modules unavailable",
      "file_url": filePath
    }, { severity: "error", errorCode: "E000000025", debugInfo: JSON.stringify( { file_url: filePath } ) } );

    RiseVision.VideoWatch.handleError();
  }

  function _handleUnauthorized() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "unauthorized",
      "file_url": filePath
    }, { severity: "error", errorCode: "E000000016", debugInfo: JSON.stringify( { file_url: filePath } ) } );

    RiseVision.VideoWatch.handleError();
  }

  function _handleAuthorized() {
    if ( !watchInitiated ) {
      // start watching the file
      storage.watchFiles( filePath );
      watchInitiated = true;
    }
  }

  function _handleAuthorizationError( data ) {
    var detail = data.detail || "";

    videoUtils.logEvent( {
      "event": "error",
      "event_details": "authorization error - " + ( ( typeof detail === "string" ) ? detail : JSON.stringify( detail ) ),
      "file_url": filePath
    }, { severity: "error", errorCode: "E000000016", debugInfo: JSON.stringify( { file_url: filePath } ) } );
  }

  function _handleFileProcessing() {
    _resetFileErrorLogParams();

    if ( initialLoad && !initialProcessingTimer ) {
      _startInitialProcessingTimer();
    }
  }

  function _handleFileAvailable( data ) {
    _clearInitialProcessingTimer();
    _resetFileErrorLogParams();

    if ( initialLoad ) {
      initialLoad = false;

      RiseVision.VideoWatch.onFileInit( {
        filePath: filePath,
        url: data.fileUrl,
        name: videoUtils.getStorageFileName( filePath )
      } );

      return;
    }

    RiseVision.VideoWatch.onFileRefresh( {
      filePath: filePath,
      url: data.fileUrl,
      name: videoUtils.getStorageFileName( filePath )
    } );
  }

  function _handleFileNoExist( data ) {
    var params = {
      "event": "error",
      "event_details": "file does not exist",
      "file_url": data.filePath
    };

    videoUtils.logEvent( params, { severity: "error", errorCode: "E000000014", debugInfo: JSON.stringify( { file_url: params.file_url } ) } );

    RiseVision.VideoWatch.handleError();
  }

  function _handleFileDeleted( data ) {
    videoUtils.logEvent( {
      "event": "info",
      "event_details": "file deleted",
      "file_url": data.filePath
    }, { severity: "info", debugInfo: JSON.stringify( { file_url: data.filePath } ) } );

    RiseVision.VideoWatch.onFileDeleted( data.filePath );
  }

  function _handleFileError( data ) {
    var msg = data.msg || "",
      detail = data.detail || "",
      params = {
        "event": "error",
        "event_details": msg + ( detail ? " | " + detail : "" ),
        "file_url": data.filePath
      },
      errorCode = msg && msg.toLowerCase().includes( "insufficient disk space" ) ? "E000000040" : "E000000027";

    // prevent repetitive logging when widget is receiving messages from other potential widget instances watching same file
    if ( _.isEqual( params, fileErrorLogParams ) ) {
      return;
    }

    fileErrorLogParams = _.clone( params );
    videoUtils.logEvent( params, { severity: "error", errorCode: errorCode, debugInfo: JSON.stringify( { watchType: "rise-local-storage", file_url: params.file_url } ) } );

    /*** Possible error messages from Local Storage ***/
    /*
      "File's host server could not be reached"

      "File I/O Error"

      "Could not retrieve signed URL"

      "Insufficient disk space"

      "Invalid response with status code [CODE]"
     */

    // Widget will display generic message
    RiseVision.VideoWatch.handleError();
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
    case "AUTHORIZED":
      _handleAuthorized();
      break;
    case "UNAUTHORIZED":
      _handleUnauthorized();
      break;
    case "AUTHORIZATION-ERROR":
      _handleAuthorizationError;
      break;
    case "FILE-AVAILABLE":
      _handleFileAvailable( data );
      break;
    case "FILE-PROCESSING":
      _handleFileProcessing();
      break;
    case "FILE-NO-EXIST":
      _handleFileNoExist( data );
      break;
    case "FILE-DELETED":
      _handleFileDeleted( data );
      break;
    case "FILE-ERROR":
      _handleFileError( data );
      break;
    }
  }

  function init() {
    var params = videoUtils.getParams(),
      companyId = ( params.storage.companyId !== videoUtils.getCompanyId() ) ? params.storage.companyId : "";

    filePath = videoUtils.getStorageSingleFilePath();
    licensing = new playerLocalStorageLicensing.default( messaging, _handleEvents, companyId, config.STORAGE_ENV );
    storage = new playerLocalStorage.default( messaging, licensing, _handleEvents );
  }

  function retry() {
    _handleFileProcessing();
  }

  return {
    "init": init,
    "retry": retry
  };
};

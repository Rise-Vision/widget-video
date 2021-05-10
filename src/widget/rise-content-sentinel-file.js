/* global riseContentSentinel, _ */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoWatch = RiseVision.VideoWatch || {};

RiseVision.VideoWatch.RiseContentSentinelFile = function() {
  "use strict";

  var INITIAL_PROCESSING_DELAY = 10000,
    videoUtils = RiseVision.VideoUtils,
    filePath = "",
    contentSentinel = null,
    initialProcessingTimer = null,
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
      isInsufficientDiskSpace = msg && msg.toLowerCase().includes( "insufficient disk space" ),
      isInsufficientQuota = msg && msg.toLowerCase().includes( "insufficient quota" ),
      errorCode = isInsufficientDiskSpace || isInsufficientQuota ? "E000000040" : "E000000215";

    // prevent repetitive logging when widget is receiving messages from other potential widget instances watching same file
    if ( _.isEqual( params, fileErrorLogParams ) ) {
      return;
    }

    fileErrorLogParams = _.clone( params );
    videoUtils.logEvent( params, { severity: "error", errorCode: errorCode, debugInfo: JSON.stringify( { watchType: "rise-content-sentinel", file_url: params.file_url } ) } );

    RiseVision.VideoWatch.handleError();
  }

  function _handleEvents( data ) {
    if ( !data || !data.event || typeof data.event !== "string" ) {
      return;
    }

    switch ( data.event.toUpperCase() ) {
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
    filePath = videoUtils.getStorageSingleFilePath();
    contentSentinel = new riseContentSentinel.default( _handleEvents );

    // start watching the file
    contentSentinel.watchFiles( filePath );
  }

  function retry() {
    _handleFileProcessing();
  }

  return {
    "init": init,
    "retry": retry
  };
};

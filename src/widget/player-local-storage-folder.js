/* global localMessaging, playerLocalStorage, playerLocalStorageLicensing, config _ */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoRLS = RiseVision.VideoRLS || {};

RiseVision.VideoRLS.PlayerLocalStorageFolder = function() {
  "use strict";

  var INITIAL_PROCESSING_DELAY = 15000,
    videoUtils = RiseVision.VideoUtils,
    messaging = new localMessaging.default(),
    defaultFileFormat = "unknown",
    folderPath = "",
    licensing = null,
    storage = null,
    watchInitiated = false,
    files = [],
    filesInError = [],
    initialProcessingTimer = null,
    initialLoad = true;

  function _getFileInError( filePath ) {
    return _.find( filesInError, function( file ) {
      return file.filePath === filePath;
    } );
  }

  function _getFile( filePath ) {
    return _.find( files, function( file ) {
      return file.filePath === filePath;
    } );
  }

  function _manageFileInError( data, fixed ) {
    var filePath = data.filePath,
      fileInError = _.find( filesInError, function( file ) {
        return file.filePath === filePath;
      } );

    if ( !filePath ) {
      return;
    }

    if ( fixed && fileInError ) {
      // remove this file from files in error list
      filesInError = _.reject( filesInError, function( file ) {
        return file.filePath === filePath;
      } );
    } else if ( !fixed ) {
      if ( !fileInError ) {
        fileInError = {
          filePath: filePath,
          params: data.params
        };
        // add this file to list of files in error
        filesInError.push( fileInError );
      } else {
        fileInError.params = _.clone( data.params );
      }
    }
  }

  function _manageFile( data, state ) {
    var filePath = data.filePath,
      fileUrl = data.fileUrl,
      managedFile = _.find( files, function( file ) {
        return file.filePath === filePath;
      } );

    if ( state.toUpperCase() === "AVAILABLE" ) {
      if ( !managedFile ) {
        managedFile = {
          filePath: filePath,
          url: fileUrl,
          name: videoUtils.getStorageFileName( filePath )
        };

        // add this file to list
        files.push( managedFile );
      } else {
        // file has been updated
        managedFile.url = fileUrl
      }
    }

    if ( state.toUpperCase() === "DELETED" ) {
      if ( managedFile ) {
        files = _.reject( files, function( file ) {
          return file.filePath === filePath;
        } );
      }
    }

    files = _.sortBy( files, function( file ) {
      return file.name.toLowerCase();
    } );
  }

  function _onFileRemoved() {
    if ( files.length < 1 ) {
      // No files to show anymore, log and display a message
      videoUtils.logEvent( {
        "event": "error",
        "event_details": "No files to display",
        "file_url": folderPath,
        "file_format": "unknown"
      }, { severity: "error", errorCode: "E000000021", debugInfo: JSON.stringify( { file_url: folderPath, file_format: "unknown" } ) } );

      RiseVision.VideoRLS.onFolderFilesRemoved();
    } else {
      RiseVision.VideoRLS.onFileRefresh( files );
    }
  }

  function _clearInitialProcessingTimer() {
    clearTimeout( initialProcessingTimer );
    initialProcessingTimer = null;
  }

  function _startInitialProcessingTimer() {
    initialProcessingTimer = setTimeout( function() {
      // explicitly set to null for integration test purposes
      initialProcessingTimer = null;

      if ( files.length < 1 ) {
        if ( filesInError.length > 0 ) {
          // Some files during initial processing had a file error and no files became available
          videoUtils.logEvent( {
            "event": "warning",
            "event_details": "No files to display (startup)",
            "file_url": folderPath,
            "file_format": "unknown"
          }, { severity: "warning", debugInfo: JSON.stringify( { file_url: folderPath, file_format: "unknown" } ) } );

          RiseVision.VideoRLS.handleError();
          return;
        }

        // files are still processing/downloading
        RiseVision.VideoRLS.onFileUnavailable( "Files are downloading." );
        return;
      }

      initialLoad = false;
      RiseVision.VideoRLS.onFileInit( files );
    }, INITIAL_PROCESSING_DELAY );
  }

  function _handleNoConnection() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "no connection",
      "file_url": folderPath,
      "file_format": defaultFileFormat
    }, { severity: "error", errorCode: "E000000025", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );

    RiseVision.VideoRLS.handleError();
  }

  function _handleRequiredModulesUnavailable() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "required modules unavailable",
      "file_url": folderPath,
      "file_format": defaultFileFormat
    }, { severity: "error", errorCode: "E000000025", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );

    RiseVision.VideoRLS.handleError();
  }

  function _handleUnauthorized() {
    videoUtils.logEvent( {
      "event": "error",
      "event_details": "unauthorized",
      "file_url": folderPath,
      "file_format": defaultFileFormat
    }, { severity: "error", errorCode: "E000000016", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );

    RiseVision.VideoRLS.handleError();
  }

  function _handleAuthorized() {
    if ( !watchInitiated ) {
      // start watching the folder
      storage.watchFiles( folderPath, "video" );
      watchInitiated = true;
    }
  }

  function _handleAuthorizationError( data ) {
    var detail = data.detail || "";

    videoUtils.logEvent( {
      "event": "error",
      "event_details": "authorization error - " + ( ( typeof detail === "string" ) ? detail : JSON.stringify( detail ) ),
      "file_url": folderPath,
      "file_format": defaultFileFormat
    }, { severity: "error", errorCode: "E000000016", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );
  }

  function _handleFileProcessing() {
    if ( initialLoad && !initialProcessingTimer ) {
      _startInitialProcessingTimer();
    }
  }

  function _handleFileAvailable( data ) {
    _manageFile( data, "available" );
    _manageFileInError( data, true );

    function ready() {
      _clearInitialProcessingTimer();
      initialLoad = false;

      RiseVision.VideoRLS.onFileInit( files );
    }

    if ( initialLoad ) {
      if ( files.length > 1 ) {
        ready();
      } else if ( files.length === 1 ) {
        // delay 2 seconds to allow for potentially one more file that's available
        setTimeout( function() {
          if ( files.length === 1 && initialLoad ) {
            ready();
          }
        }, 2000 );
      }

      return;
    }

    RiseVision.VideoRLS.onFileRefresh( files );
  }

  function _handleFolderNoExist() {
    var params = {
      "event": "error",
      "event_details": "folder does not exist",
      "file_url": folderPath,
      "file_format": defaultFileFormat
    };

    videoUtils.logEvent( params, { severity: "error", errorCode: "E000000022", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );

    RiseVision.VideoRLS.onFolderUnavailable();
  }

  function _handleFolderEmpty() {
    var params = {
      "event": "error",
      "event_details": "folder empty",
      "file_url": folderPath,
      "file_format": defaultFileFormat
    };

    videoUtils.logEvent( params, { severity: "error", errorCode: "E000000021", debugInfo: JSON.stringify( { file_url: folderPath, file_format: defaultFileFormat } ) } );

    RiseVision.VideoRLS.onFolderUnavailable();
  }

  function _handleFileDeleted( data ) {
    var file = _getFile( data.filePath ),
      params = {
        "event": "info",
        "event_details": "file deleted",
        "file_url": data.filePath,
        "local_url": ( file && file.url ) ? file.url : ""
      };

    _manageFile( data, "deleted" );
    _manageFileInError( data, true );

    videoUtils.logEvent( params, { severity: "info", debugInfo: JSON.stringify( { file_url: params.file_url, local_url: params.local_url } ) } );

    if ( !initialLoad && !initialProcessingTimer ) {
      _onFileRemoved();
    }
  }

  function _handleFileError( data ) {
    var msg = data.msg || "",
      detail = data.detail || "",
      params = {
        "event": "error",
        "event_details": msg + ( detail ? " | " + detail : "" ),
        "file_url": data.filePath
      },
      fileInError = _getFileInError( data.filePath );

    // prevent repetitive logging when widget is receiving messages from other potential widget instances watching same file
    if ( fileInError && _.isEqual( params, fileInError.params ) ) {
      return;
    }

    _manageFileInError( {
      filePath: data.filePath,
      params: _.clone( params )
    } );

    /*** Possible error messages from Local Storage ***/
    /*
      "File's host server could not be reached"

      "File I/O Error"

      "Could not retrieve signed URL"

      "Insufficient disk space"

      "Invalid response with status code [CODE]"
     */

    videoUtils.logEvent( params, { severity: "error", errorCode: "E000000027", debugInfo: JSON.stringify( { file_url: params.file_url } ) } );

    if ( !initialLoad && !initialProcessingTimer ) {
      if ( _getFile( data.filePath ) ) {
        // remove this file from the file list since there was a problem with its new version being provided
        _manageFile( { filePath: data.filePath }, "deleted" );
        _onFileRemoved();
      }
    }
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
    case "FOLDER-NO-EXIST":
      _handleFolderNoExist();
      break;
    case "FOLDER-EMPTY":
      _handleFolderEmpty();
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

    folderPath = videoUtils.getStorageFolderPath();
    licensing = new playerLocalStorageLicensing.default( messaging, _handleEvents, companyId, config.STORAGE_ENV );
    storage = new playerLocalStorage.default( messaging, licensing, _handleEvents );
  }

  function retry() {
    if ( initialLoad && !initialProcessingTimer ) {
      _startInitialProcessingTimer();
    }
  }

  return {
    "init": init,
    "retry": retry
  };
};

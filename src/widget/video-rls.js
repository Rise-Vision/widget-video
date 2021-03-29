/* global gadgets, _ */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoRLS = {};

RiseVision.VideoRLS = ( function( window, gadgets ) {
  "use strict";

  var _prefs = new gadgets.Prefs(),
    _videoUtils = RiseVision.VideoUtils,
    _message = null,
    _player = null,
    _configurationLogged = false,
    _viewerPaused = true,
    _storage = null,
    _resume = true,
    _errorFlag = false,
    _unavailableFlag = false,
    _folderUnavailableFlag = false;

  /*
   *  Private Methods
   */
  function _logConfiguration( type ) {
    var configParams = {
        "event": "configuration",
        "event_details": type
      },
      mode = _videoUtils.getMode();

    if ( !_configurationLogged ) {
      if ( mode === "file" ) {
        configParams.file_url = _videoUtils.getStorageSingleFilePath();
      } else if ( mode === "folder" ) {
        configParams.file_url = _videoUtils.getStorageFolderPath();
        configParams.file_format = "WEBM|MP4|OGV|OGG";
      }

      _videoUtils.logEvent( configParams, { severity: "info", debugInfo: JSON.stringify( configParams ) } );
      _configurationLogged = true;
    }
  }

  function _init() {
    var params = _videoUtils.getParams();

    if ( params.video.hasOwnProperty( "resume" ) ) {
      _resume = params.video.resume;
    }

    _message = new RiseVision.Common.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    if ( RiseVision.Common.Utilities.isLegacy() ) {
      _videoUtils.logEvent( {
        event: "legacy rise player",
        event_details: "Video Widget is not supported on legacy rise player",
      }, { severity: "warning" } );

      _errorFlag = true;
    } else {
      // show wait message while Storage initializes
      _message.show( "Please wait while your video is downloaded." );

      if ( _videoUtils.getMode() === "file" ) {
        _videoUtils.setConfigurationType( "storage file (rls)" );

        // create and initialize the Storage file instance
        _storage = new RiseVision.VideoRLS.PlayerLocalStorageFile();
      } else if ( _videoUtils.getMode() === "folder" ) {
        _videoUtils.setConfigurationType( "storage folder (rls)" );

        // create and initialize the Storage folder instance
        _storage = new RiseVision.VideoRLS.PlayerLocalStorageFolder();
      }
      _storage.init();
    }

    _logConfiguration( _videoUtils.getConfigurationType() );
    _videoUtils.sendReadyToViewer();
  }

  function _resetErrorFlags() {
    _errorFlag = false;
    _unavailableFlag = false;
    _folderUnavailableFlag = false;
  }

  /*
   *  Public Methods
   */
  function onFileDeleted() {
    if ( _player ) {
      _player.dispose();
    }
  }

  function onFileInit( urls ) {
    _videoUtils.setCurrentFiles( urls );

    _resetErrorFlags();

    _message.hide();

    if ( !_viewerPaused ) {
      play();
    }
  }

  function onFileRefresh( urls ) {
    _videoUtils.setCurrentFiles( urls );

    if ( _player ) {
      _player.update( _videoUtils.getCurrentFiles() );
    }

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _resetErrorFlags();

    if ( !_viewerPaused && !_player && _videoUtils.getCurrentFiles().length > 0 ) {
      play();
    }
  }

  function onFileUnavailable( message ) {
    _unavailableFlag = true;

    _message.show( message );

    if ( !_viewerPaused ) {
      _videoUtils.sendDoneToViewer();
    }
  }

  function onFolderFilesRemoved() {
    if ( _player ) {
      _player.dispose();
    }
  }

  function onFolderUnavailable() {
    _folderUnavailableFlag = true;

    // set to a blank message so the image container gets hidden and nothing is displayed on screen
    _message.show( "" );

    if ( !_viewerPaused ) {
      _videoUtils.sendDoneToViewer();
    }
  }

  function pause() {
    _viewerPaused = true;

    if ( _player ) {
      if ( !_resume ) {
        _player.reset();
      } else {
        _player.pause();
      }
    }

  }

  function play() {
    var currentFiles;

    _viewerPaused = false;

    if ( _errorFlag ) {
      _videoUtils.sendDoneToViewer();
      return;
    }

    if ( _unavailableFlag && _storage ) {
      _storage.retry();

      return;
    }

    if ( _folderUnavailableFlag ) {
      _videoUtils.sendDoneToViewer();

      return;
    }

    if ( _player ) {
      // Ensures possible error messaging gets hidden and video gets shown
      _message.hide();

      _player.play();
    } else {
      currentFiles = _videoUtils.getCurrentFiles();

      if ( currentFiles && currentFiles.length > 0 ) {
        _player = new RiseVision.PlayerVJS( _videoUtils.getParams(), _videoUtils.getMode(), RiseVision.VideoRLS );
        _player.init( currentFiles );
      }
    }
  }

  function playerDisposed() {
    _player = null;
    _videoUtils.setCurrentFiles( [] );
    _videoUtils.resetVideoElement();

    if ( _videoUtils.getMode() === "file" ) {
      handleError();
    } else if ( _videoUtils.getMode() === "folder" ) {
      onFolderUnavailable();
    }
  }

  function playerError( error, localUrl, filePath ) {
    var mode = _videoUtils.getMode(),
      logParams = {},
      mediaErrorCode = error && error.code ? error.code : null,
      type = _videoUtils.getMediaErrorName( mediaErrorCode ),
      errorCode = _videoUtils.getRiseErrorCode( mediaErrorCode ),
      errorMessage = error && error.message ? error.message : "Sorry, there was a problem playing the video.";

    logParams.event = "player error";
    logParams.event_details = type + " - " + errorMessage;

    if ( mode === "file" ) {
      logParams.file_url = filePath || _videoUtils.getStorageSingleFilePath();
      logParams.local_url = localUrl || _videoUtils.getCurrentFiles()[ 0 ];
    } else if ( mode === "folder" ) {
      logParams.file_url = filePath;

      if ( !logParams.file_url ) {
        logParams.file_url = _videoUtils.getStorageFolderPath();
        logParams.file_format = "WEBM|MP4|OGV|OGG";
      }

      logParams.local_url = localUrl || "";
    }

    _videoUtils.logEvent( logParams, { severity: "error", errorCode: errorCode, debugInfo: JSON.stringify( {
      file_url: logParams.file_url,
      local_url: logParams.local_url,
      file_format: logParams.file_format
    } ) } );
    handleError();
  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if ( !_viewerPaused && _player ) {
      _player.play();
    }
  }

  function stop() {
    pause();
  }

  function setAdditionalParams( params, mode, displayId, companyId ) {
    var data = _.clone( params );

    _videoUtils.setMode( mode );
    _videoUtils.setUsingRLS();
    _videoUtils.setCompanyId( companyId );
    _videoUtils.setDisplayId( displayId );

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    data.width = _prefs.getInt( "rsW" );
    data.height = _prefs.getInt( "rsH" );

    _videoUtils.setParams( data );

    _init();
  }

  function handleError() {
    _errorFlag = true;

    // 30/10/2020 requirement to stop displaying error messages
    // set to a blank message so the video container gets hidden and nothing is displayed on screen
    _message.show( "" );

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _videoUtils.sendDoneToViewer();
    }

  }

  return {
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "onFileDeleted": onFileDeleted,
    "onFolderFilesRemoved": onFolderFilesRemoved,
    "onFolderUnavailable": onFolderUnavailable,
    "pause": pause,
    "play": play,
    "playerDisposed": playerDisposed,
    "playerError": playerError,
    "playerReady": playerReady,
    "setAdditionalParams": setAdditionalParams,
    "handleError": handleError,
    "stop": stop
  };

} )( window, gadgets );

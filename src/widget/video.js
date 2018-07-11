/* global gadgets, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = {};

RiseVision.Video = ( function( window, gadgets ) {
  "use strict";

  var _configurationLogged = false,
    _videoUtils = RiseVision.VideoUtils,
    _prefs = new gadgets.Prefs(),
    _storage = null,
    _nonStorage = null,
    _message = null,
    _player = null,
    _viewerPaused = true,
    _resume = true,
    _errorFlag = false,
    _storageErrorFlag = false,
    _playerErrorFlag = false,
    _unavailableFlag = false;

  /*
   *  Private Methods
   */
  function _resetErrorFlags() {
    _errorFlag = false;
    _playerErrorFlag = false;
    _storageErrorFlag = false;
    _unavailableFlag = false;
  }

  function _init() {
    var params = _videoUtils.getParams(),
      isStorageFile;

    if ( params.video.hasOwnProperty( "resume" ) ) {
      _resume = params.video.resume;
    }

    _message = new RiseVision.Common.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    if ( RiseVision.Common.Utilities.isLegacy() ) {
      showError( "This version of Video Widget is not supported on this version of Rise Player. " +
        "Please use the latest Rise Player version available at https://help.risevision.com/user/create-a-display" );
    } else {
      // show wait message while Storage initializes
      _message.show( "Please wait while your video is downloaded." );

      if ( _videoUtils.getMode() === "file" ) {
        isStorageFile = ( Object.keys( params.storage ).length !== 0 );

        if ( !isStorageFile ) {
          _videoUtils.setConfigurationType( "custom" );

          _nonStorage = new RiseVision.Video.NonStorage( params );
          _nonStorage.init();
        } else {
          _videoUtils.setConfigurationType( "storage file" );

          // create and initialize the Storage file instance
          _storage = new RiseVision.Video.StorageFile( params, _videoUtils.getDisplayId() );
          _storage.init();
        }
      } else if ( _videoUtils.getMode() === "folder" ) {
        _videoUtils.setConfigurationType( "storage folder" );

        // create and initialize the Storage folder instance
        _storage = new RiseVision.Video.StorageFolder( params, _videoUtils.getDisplayId() );
        _storage.init();
      }
    }

    _videoUtils.sendReadyToViewer();
  }

  /*
   *  Public Methods
   */
  function hasStorageError() {
    return _storageErrorFlag;
  }

  function hasPlayerError() {
    return _playerErrorFlag;
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
  }

  function onFileUnavailable( message ) {
    _unavailableFlag = true;

    _message.show( message );

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _videoUtils.startErrorTimer();
    }
  }

  function pause() {
    _viewerPaused = true;

    // in case error timer still running (no conditional check on errorFlag, it may have been reset in onFileRefresh)
    _videoUtils.clearErrorTimer();

    if ( _player ) {
      if ( !_resume ) {
        _player.reset();
      } else {
        _player.pause();
      }
    }

  }

  function play() {
    var params = _videoUtils.getParams(),
      configParams = {
        "event": "configuration",
        "event_details": _videoUtils.getConfigurationType()
      },
      mode = _videoUtils.getMode(),
      currentFiles;

    if ( !_configurationLogged ) {
      if ( mode === "file" ) {
        if ( _videoUtils.getConfigurationType() !== "custom" ) {
          configParams.file_url = _videoUtils.getStorageSingleFilePath();
        } else {
          configParams.file_url = ( params.url && params.url !== "" ) ? params.url : params.selector.url;
        }

      } else if ( mode === "folder" ) {
        configParams.file_url = _videoUtils.getStorageFolderPath();
        configParams.file_format = "WEBM|MP4|OGV|OGG";
      }

      _videoUtils.logEvent( configParams );
      _configurationLogged = true;
    }

    _viewerPaused = false;

    if ( _errorFlag ) {
      _videoUtils.startErrorTimer();
      return;
    }

    if ( _unavailableFlag ) {
      if ( _storage ) {
        _storage.retry();
      } else if ( _nonStorage ) {
        _nonStorage.retry();
      }

      return;
    }

    if ( _player ) {
      // Ensures possible error messaging gets hidden and video gets shown
      _message.hide();

      _player.play();
    } else {
      currentFiles = _videoUtils.getCurrentFiles();

      if ( currentFiles && currentFiles.length > 0 ) {
        _player = new RiseVision.PlayerVJS( params, _videoUtils.getMode(), RiseVision.Video );
        _player.init( currentFiles );
      }
    }

  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if ( !_viewerPaused && _player ) {
      _player.play();
    }
  }

  function setAdditionalParams( params, mode, displayId ) {
    var data = _.clone( params );

    _videoUtils.setMode( mode );
    _videoUtils.setDisplayId( displayId );

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    data.width = _prefs.getInt( "rsW" );
    data.height = _prefs.getInt( "rsH" );

    _videoUtils.setParams( data );

    _init();
  }

  // An error occurred with Player.
  function playerError( error ) {
    var params = _videoUtils.getParams(),
      mode = _videoUtils.getMode(),
      logParams = {},
      type = "MEDIA_ERR_UNKNOWN",
      errorMessage = "Sorry, there was a problem playing the video.",
      errorTypes = [
        "MEDIA_ERR_CUSTOM",
        "MEDIA_ERR_ABORTED",
        "MEDIA_ERR_NETWORK",
        "MEDIA_ERR_DECODE",
        "MEDIA_ERR_SRC_NOT_SUPPORTED",
        "MEDIA_ERR_ENCRYPTED"
      ];

    if ( error ) {
      type = errorTypes[ error.code ] || type;
      errorMessage = error.message || errorMessage;
    }

    logParams.event = "player error";
    logParams.event_details = type + " - " + errorMessage;

    if ( mode === "file" ) {
      if ( _videoUtils.getConfigurationType() !== "custom" ) {
        logParams.file_url = _videoUtils.getStorageSingleFilePath();
      } else {
        logParams.file_url = ( params.url && params.url !== "" ) ? params.url : params.selector.url;
      }

      logParams.local_url = _videoUtils.getCurrentFiles()[ 0 ];

    } else if ( mode === "folder" ) {
      logParams.file_url = _videoUtils.getStorageFolderPath();
      logParams.file_format = "WEBM|MP4|OGV|OGG";
    }

    _playerErrorFlag = true;

    _videoUtils.logEvent( logParams );
    showError( errorMessage );
  }

  function showError( message, isStorageError ) {
    _errorFlag = true;
    _storageErrorFlag = typeof isStorageError !== "undefined";

    _message.show( message );

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _videoUtils.startErrorTimer();
    }
  }


  function stop() {
    pause();
  }

  return {
    "hasPlayerError": hasPlayerError,
    "hasStorageError": hasStorageError,
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "playerReady": playerReady,
    "playerError": playerError,
    "showError": showError,
    "stop": stop
  };

} )( window, gadgets );

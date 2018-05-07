/* global gadgets, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = {};

RiseVision.Video = ( function( window, gadgets ) {
  "use strict";

  var _additionalParams,
    _mode,
    _displayId,
    _isLoading = true,
    _configDetails = null,
    _videoUtils = RiseVision.VideoUtils,
    _prefs = new gadgets.Prefs(),
    _storage = null,
    _nonStorage = null,
    _message = null,
    _player = null,
    _viewerPaused = true,
    _resume = true,
    _currentFiles = [],
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
    var isStorageFile;

    if ( _additionalParams.video.hasOwnProperty( "resume" ) ) {
      _resume = _additionalParams.video.resume;
    }

    _message = new RiseVision.Common.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    if ( RiseVision.Common.Utilities.isLegacy() ) {
      _videoUtils.showError( "This version of Video Widget is not supported on this version of Rise Player. " +
        "Please use the latest Rise Player version available at https://help.risevision.com/user/create-a-display" );
    } else {
      // show wait message while Storage initializes
      _message.show( "Please wait while your video is downloaded." );

      if ( _mode === "file" ) {
        isStorageFile = ( Object.keys( _additionalParams.storage ).length !== 0 );

        if ( !isStorageFile ) {
          _configDetails = "custom";

          _nonStorage = new RiseVision.Video.NonStorage( _additionalParams );
          _nonStorage.init();
        } else {
          _configDetails = "storage file";

          // create and initialize the Storage file instance
          _storage = new RiseVision.Video.StorageFile( _additionalParams, _displayId );
          _storage.init();
        }
      } else if ( _mode === "folder" ) {
        _configDetails = "storage folder";

        // create and initialize the Storage folder instance
        _storage = new RiseVision.Video.StorageFolder( _additionalParams, _displayId );
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
    if ( _mode === "file" ) {
      // urls value will be a string
      _currentFiles[ 0 ] = urls;
    } else if ( _mode === "folder" ) {
      // urls value will be an array
      _currentFiles = urls;
    }

    _resetErrorFlags();

    _message.hide();

    if ( !_viewerPaused ) {
      play();
    }
  }

  function onFileRefresh( urls ) {
    if ( _mode === "file" ) {
      // urls value will be a string of one url
      _currentFiles[ 0 ] = urls;
    } else if ( _mode === "folder" ) {
      // urls value will be an array of urls
      _currentFiles = urls;
    }

    if ( _player ) {
      _player.update( _currentFiles );
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
    if ( _isLoading ) {
      _isLoading = false;

      // Log configuration event.
      _videoUtils.logEvent( {
        event: "configuration",
        event_details: _configDetails
      }, false );
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
      if ( _currentFiles && _currentFiles.length > 0 ) {
        _player = new RiseVision.PlayerVJS( _additionalParams, _mode, RiseVision.Video );
        _player.init( _currentFiles );
      }
    }

  }

  function playerEnded() {
    _videoUtils.sendDoneToViewer();
  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if ( !_viewerPaused && _player ) {
      _player.play();
    }
  }

  function setAdditionalParams( params, mode, displayId ) {
    _additionalParams = _.clone( params );
    _mode = mode;
    _displayId = displayId;

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    _additionalParams.width = _prefs.getInt( "rsW" );
    _additionalParams.height = _prefs.getInt( "rsH" );

    _init();
  }

  // An error occurred with Player.
  function playerError( error ) {
    var params = {},
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

    params.event = "player error";
    params.event_details = type + " - " + errorMessage;
    _playerErrorFlag = true;

    _videoUtils.logEvent( params, true );
    _videoUtils.showError( errorMessage );
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
    "playerEnded": playerEnded,
    "playerReady": playerReady,
    "playerError": playerError,
    "stop": stop
  };

} )( window, gadgets );

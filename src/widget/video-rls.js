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
    _configurationType = null,
    _storage = null,
    _resume = true,
    _errorFlag = false,
    _unavailableFlag = false;

  /*
   *  Private Methods
   */
  function _init() {
    var params = _videoUtils.getParams();

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
        _configurationType = "storage file (rls)";

        // create and initialize the Storage file instance
        _storage = new RiseVision.VideoRLS.PlayerLocalStorageFile();
        _storage.init();
      } else if ( _videoUtils.getMode() === "folder" ) {
        // TODO: coming soon
      }
    }

    _videoUtils.sendReadyToViewer();
  }

  function _resetErrorFlags() {
    _errorFlag = false;
    _unavailableFlag = false;
  }

  /*
   *  Public Methods
   */
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

    if ( !_viewerPaused ) {
      _videoUtils.sendDoneToViewer();
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
      currentFiles;

    if ( !_configurationLogged ) {
      _configurationLogged = true;

      // Log configuration event.
      _videoUtils.logEvent( {
        event: "configuration",
        event_details: _configurationType
      }, false );
    }

    _viewerPaused = false;

    if ( _errorFlag ) {
      _videoUtils.startErrorTimer();
      return;
    }

    if ( _unavailableFlag && _storage ) {
      _storage.retry();

      return;
    }

    if ( _player ) {
      // Ensures possible error messaging gets hidden and video gets shown
      _message.hide();

      _player.play();
    } else {
      currentFiles = _videoUtils.getCurrentFiles();

      if ( currentFiles && currentFiles.length > 0 ) {
        _player = new RiseVision.PlayerVJS( params, _videoUtils.getMode(), RiseVision.VideoRLS );
        _player.init( currentFiles );
      }
    }
  }

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

    _videoUtils.logEvent( params, true );
    showError( errorMessage );
  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if ( !_viewerPaused ) {
      _player.play();
    }
  }

  function stop() {
    pause();
  }

  function setAdditionalParams( params, mode, displayId ) {
    var data = _.clone( params );

    _videoUtils.setMode( mode );
    _videoUtils.setDisplayId( displayId );
    _videoUtils.setUseRLSSingleFile();

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    data.width = _prefs.getInt( "rsW" );
    data.height = _prefs.getInt( "rsH" );

    _videoUtils.setParams( data );

    _init();
  }

  function showError( message ) {
    _errorFlag = true;

    _message.show( message );

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _videoUtils.startErrorTimer();
    }

  }

  return {
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "pause": pause,
    "play": play,
    "playerError": playerError,
    "playerReady": playerReady,
    "setAdditionalParams": setAdditionalParams,
    "showError": showError,
    "stop": stop
  };

} )( window, gadgets );

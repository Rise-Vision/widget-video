/* global videojs */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerVJS = function PlayerVJS( params ) {
  "use strict";

  var _autoPlay = false,
    _playerInstance = null,
    _files = null,
    _utils = RiseVision.Video.PlayerUtils,
    _updateWaiting = false,
    _isPaused = false,
    _pauseTimer,
    _pause;

  /*
   *  Private Methods
   */
  function _disableFullscreen() {
    var video = document.getElementById( "player" );

    if ( video ) {
      video.className += video.className ? " vjs-nofull" : "vjs-nofull";
    }
  }

  function _getOptions() {
    return {
      autoplay: _autoPlay,
      controls: params.video.controls,
      fluid: params.video.scaleToFit,
      height: params.height,
      width: params.width
    };
  }

  function _onPause() {
    if ( !_isPaused ) {
      clearTimeout( _pauseTimer );

      _pauseTimer = setTimeout( function restart() {
        if ( _playerInstance.paused() ) {
          _playerInstance.play();
        }
      }, _pause * 1000 );
    }
  }

  function _configureHandlers() {
    if ( params.video.controls && _pause > 1 ) {
      _playerInstance.on( "pause", _onPause );
    }

    _playerInstance.on( "ended", RiseVision.Video.playerEnded );
  }

  function _ready() {
    if ( _files && _files.length && _files.length > 0 ) {
      // set the source
      _playerInstance.src( { type: "video/" + _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );

      if ( params.video && ( typeof params.video.volume !== "undefined" )
        && Number.isInteger( params.video.volume ) ) {
        _playerInstance.volume( params.video.volume / 100 );
      }

      _configureHandlers();

      // notify that player is ready
      RiseVision.Video.playerReady();
    }
  }

  /*
   *  Public Methods
   */
  function init( files ) {
    _files = files;
    _autoPlay = ( !params.video.controls ) ? true : params.video.autoplay;

    _disableFullscreen();

    // Validate video.pause setting.
    if ( params.video.pause ) {
      params.video.pause = ( typeof params.video.pause === "string" ) ? parseInt( params.video.pause, 10 ) : params.video.pause;
      _pause = ( isNaN( params.video.pause ) ) ? 0 : params.video.pause;
    } else {
      _pause = 0;
    }

    _playerInstance = videojs( "player", _getOptions(), _ready );
  }

  function pause() {
    _isPaused = true;

    if ( !_playerInstance.paused() ) {
      _playerInstance.pause();
    }

    clearTimeout( _pauseTimer );
  }

  function play() {
    _isPaused = false;

    if ( _updateWaiting ) {
      _updateWaiting = false;
      // set a new source

      if ( _files && _files.length && _files.length > 0 ) {
        _playerInstance.src( { type: "video/" + _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );
      }
    }

    if ( _autoPlay ) {
      _playerInstance.play();
    }
  }

  function reset() {
    pause();

    // if video is at end, a future play call will start video over from beginning automatically
    if ( _playerInstance.remainingTime() > 0 ) {
      _playerInstance.currentTime( 0 );
    }
  }

  function update( files ) {
    _files = files;
    _updateWaiting = true;
  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "reset": reset,
    "update": update
  };
};

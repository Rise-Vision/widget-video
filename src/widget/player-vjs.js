/* global videojs */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerVJS = function( params ) {
  "use strict";

  var _playerInstance = null,
    _files = null,
    _utils = RiseVision.Video.PlayerUtils,
    _updateWaiting = false;

  /*
   *  Private Methods
   */

  function _getOptions() {
    return {
      controls: false,
      fluid: params.video.scaleToFit,
      height: params.height,
      width: params.width
    };
  }

  function _ready() {
    if ( _files && _files.length && _files.length > 0 ) {
      // set the source
      _playerInstance.src( { type: "video/" + _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );

      // handle when video completes
      _playerInstance.on( "ended", function() {
        RiseVision.Video.playerEnded();
      } );

      // notify that player is ready
      RiseVision.Video.playerReady();
    }
  }

  /*
   *  Public Methods
   */
  function init( files ) {
    _files = files;
    _playerInstance = videojs( "player", _getOptions(), function() {
      _ready();
    } );
  }

  function pause() {
    if ( !_playerInstance.paused() ) {
      _playerInstance.pause();
    }
  }

  function play() {
    if ( _updateWaiting ) {
      _updateWaiting = false;
      // set a new source

      if ( _files && _files.length && _files.length > 0 ) {
        _playerInstance.src( { type: "video/" + _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );
      }
    }

    _playerInstance.play();
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

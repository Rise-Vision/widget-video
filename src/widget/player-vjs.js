/* global videojs */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.PlayerVJS = function PlayerVJS( params, mode, videoRef ) {
  "use strict";

  var _autoPlay = false,
    _playerInstance = null,
    _files = null,
    _decodeRetryCount = 0,
    _utils = RiseVision.PlayerUtils,
    _videoUtils = RiseVision.VideoUtils,
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
      controls: params.video.controls,
      fluid: !params.video.scaleToFit,
      height: params.height,
      width: params.width
    };
  }

  function _getFilePathFromSrc( url ) {
    var filePath = "",
      i;

    if ( _videoUtils.getUsingWatch() && _files && _files.length && _files.length > 0 ) {
      for ( i = 0; i < _files.length; i++ ) {
        if ( _files[ i ].url === url ) {
          filePath = _files[ i ].filePath;
          break;
        }
      }
    }

    return filePath;
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

  function _onDispose() {
    _autoPlay = false;
    _playerInstance = null;
    _files = null;
    _utils = null;
    _videoUtils = null;
    _updateWaiting = false;
    _isPaused = false;
    _pauseTimer = null;
    _pause = null;

    videoRef.playerDisposed();
  }

  function _onEnded() {
    if ( mode === "file" ) {
      _videoUtils.playerEnded();
    } else if ( mode === "folder" ) {
      if ( _playerInstance.playlist.currentItem() >= ( _playerInstance.playlist().length - 1 ) ) {
        _playerInstance.playlist.currentItem( 0 );
        _videoUtils.playerEnded();
      } else {
        _playerInstance.playlist.next();
      }
    }
  }

  function _onError() {
    var error = _playerInstance.error();

    if ( mode === "file" && error && error.code === 3 ) {
      console.log( "DECODE error retry count", _decodeRetryCount );
      if ( _decodeRetryCount <= 5 ) {
        _decodeRetryCount += 1;
        _updateWaiting = true;

        // delay 1 second and then force a play()
        setTimeout( function() {
          if ( !_isPaused ) {
            console.log( "DECODE error, not paused, retry play() " );
            play();
          }
        }, 1000 );

        return;
      }
    }

    videoRef.playerError( _playerInstance.error(), _playerInstance.currentSrc(), _getFilePathFromSrc( _playerInstance.currentSrc() ) );
  }

  function _onPlay() {
    // reset count since this event is evidence of successful play
    _decodeRetryCount = 0;
  }

  function _onLoadedMetaData() {
    var data = {
      event: "aspect",
      event_details: JSON.stringify( {
        placeholderWidth: params.width,
        placeholderHeight: params.height,
        placeholderAspect: _utils.getAspectRatio( params.width, params.height ),
        videoWidth: _playerInstance.videoWidth(),
        videoHeight: _playerInstance.videoHeight(),
        videoAspect: _utils.getAspectRatio( _playerInstance.videoWidth(), _playerInstance.videoHeight() ),
        scaleToFit: params.video.scaleToFit
      } )
    };

    if ( mode === "file" ) {
      if ( _videoUtils.getConfigurationType() !== "custom" ) {
        data.file_url = _videoUtils.getStorageSingleFilePath();
      } else {
        data.file_url = ( params.url && params.url !== "" ) ? params.url : params.selector.url;
      }

    } else if ( mode === "folder" ) {
      data.file_url = _getFilePathFromSrc( _playerInstance.currentSrc() );

      if ( !data.file_url ) {
        data.file_url = _videoUtils.getStorageFolderPath();
        data.file_format = "WEBM|MP4|OGV|OGG";
      }
    }

    data.local_url = _playerInstance.currentSrc();

    // Log aspect event
    _videoUtils.logEvent( data, { severity: "info", debugInfo: JSON.stringify( { file_url: data.file_url, local_url: data.local_url } ) } );
  }

  function _initPlaylist() {
    var usingWatch = _videoUtils.getUsingWatch(),
      playlist = [],
      playlistItem,
      sources,
      source;

    _files.forEach( function addPlaylistItem( file ) {
      sources = [];
      source = {
        src: usingWatch ? file.url : file,
        type: _utils.getVideoFileType( ( usingWatch ? file.name : file ) )
      };

      sources.push( source );
      playlistItem = { sources: sources };
      playlist.push( playlistItem );
    } );

    if ( !_playerInstance.playlist ) {
      _videoUtils.logEvent( {
        "event": "error",
        "event_details": "Playlist plugin did not load"
      }, { severity: "error", errorCode: "E000000053" } );
    }

    _playerInstance.playlist( playlist );
  }

  function _configureHandlers() {
    if ( params.video.controls && _pause > 1 ) {
      _playerInstance.on( "pause", _onPause );
    }

    _playerInstance.on( "ended", _onEnded );
    _playerInstance.on( "error", _onError );
    _playerInstance.on( "play", _onPlay );
    _playerInstance.on( "loadedmetadata", _onLoadedMetaData );
  }

  function _muteVideo() {
    _playerInstance.volume( 0 );
    _playerInstance.muted( true );
  }

  function _setVolume() {
    if ( !_videoUtils.isValidDisplayId() ) {
      _muteVideo();
      return;
    }

    if ( params.video && ( typeof params.video.volume !== "undefined" )
      && Number.isInteger( params.video.volume ) ) {
      _playerInstance.volume( params.video.volume / 100 );

      if ( params.video.volume === 0 ) {
        _muteVideo();
      }
    }
  }

  function _ready() {
    var usingWatch = _videoUtils.getUsingWatch(),
      fileType,
      fileURl;

    if ( _files && _files.length && _files.length > 0 ) {
      if ( mode === "file" ) {
        fileType = _utils.getVideoFileType( ( usingWatch ? _files[ 0 ].name : _files[ 0 ] ) );
        fileURl = usingWatch ? _files[ 0 ].url : _files[ 0 ];

        _playerInstance.src( { type: fileType, src: fileURl } );
      } else if ( mode === "folder" ) {
        _initPlaylist();
      }

      _configureHandlers();
      _setVolume();

      // notify that player is ready
      videoRef.playerReady();
    }
  }

  /*
   *  Public Methods
   */
  function dispose() {
    clearTimeout( _pauseTimer );
    _playerInstance.dispose();

    setTimeout( function() {
      _onDispose();
    }, 500 );
  }

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

    _removeLoadingSpinner();

  }

  /*
    Remove the loading spinner using video js api
   */
  function _removeLoadingSpinner() {
    var loadingSpinnerComponent = _playerInstance.getChild( "loadingSpinner" );

    _playerInstance.removeChild( loadingSpinnerComponent );
  }

  function pause() {
    _isPaused = true;

    if ( !_playerInstance.paused() ) {
      _playerInstance.pause();
    }

    clearTimeout( _pauseTimer );
  }

  function play() {
    var usingWatch = _videoUtils.getUsingWatch(),
      fileType,
      fileURl;

    _isPaused = false;

    if ( _updateWaiting ) {
      _updateWaiting = false;

      // set a new source
      if ( _files && _files.length && _files.length > 0 ) {
        if ( mode === "file" ) {
          fileType = _utils.getVideoFileType( ( usingWatch ? _files[ 0 ].name : _files[ 0 ] ) );
          fileURl = usingWatch ? _files[ 0 ].url : _files[ 0 ];

          _playerInstance.src( { type: fileType, src: fileURl } );
        } else if ( mode === "folder" ) {
          _initPlaylist();
        }
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
    "dispose": dispose,
    "init": init,
    "pause": pause,
    "play": play,
    "reset": reset,
    "update": update
  };
};

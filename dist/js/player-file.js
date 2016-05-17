var controls, volume, autoPlay, stretching, pauseDuration;
var width, height;

var player = null;

var source = null,
  origin = null;

// OVERRIDE: method to distinguish configurations between file and folder
function configure(urls){}

function doneEvent() {
  source.postMessage({
    event: "playerEnded"
  }, origin);
}

function readyEvent() {
  source.postMessage({
    event: "playerReady"
  }, origin);

}

function errorEvent(data) {
  source.postMessage({
    event: "playerError",
    error: data
  }, origin);
}

function playlistItemEvent(index) {
  source.postMessage({
    event: "playerItemChange",
    index: index
  }, origin);
}

function init(params, urls) {
  window.oncontextmenu = function() {
    return false;
  };

  width = params.width;
  height = params.height;
  controls = params.video.controls;
  volume = params.video.volume;
  stretching = (params.video.scaleToFit) ? "uniform" : "none";

  // ensure autoPlay is true if controls value is false, otherwise use params value
  autoPlay = (!controls) ? true : params.video.autoplay;

  // check if this setting exists due to merge of file and folder
  if (params.video.pause) {
    // convert pause value to number if type is "string"
    params.video.pause = (typeof params.video.pause === "string") ? parseInt(params.video.pause, 10) : params.video.pause;

    // if not of type "number", set its value to 0 so a pause does not get applied
    pauseDuration = (isNaN(params.video.pause)) ? 0 : params.video.pause;
  } else {
    // ensure no pause duration occurs
    pauseDuration = 0;
  }

  configure(urls);
}

function load() {
  player.loadVideo();
}

function play() {
  player.play();
}

function pause() {
  // Only pause video if it's actually playing.
  if (player.getState().toUpperCase() === "PLAYING") {
    player.pause();
  }
}

function stop() {
  player.stop();
}

function remove() {
  player.remove();
}

function getVideoFileType (url) {
  var extensions = [".mp4", ".webm"],
    urlLowercase = url.toLowerCase(),
    type = null,
    i;

  for (i = 0; i <= extensions.length; i += 1) {
    if (urlLowercase.indexOf(extensions[i]) !== -1) {
      type = extensions[i].substr(extensions[i].lastIndexOf(".") + 1);
      break;
    }
  }

  return type;
}

// inherit from playerJW for a customized file or folder player
var playerJW = function (setupObj) {
  "use strict";

  var viewerPaused = false;
  var pauseTimer = null;

  function _onComplete() {
    doneEvent();
  }

  function _onPause() {
    if (!viewerPaused) {
      // user has paused, set a timer to play again
      clearTimeout(pauseTimer);

      pauseTimer = setTimeout(function () {
        // continue playing the current video
        jwplayer().play();

        // workaround for controls remaining visible, turn them off and on again
        jwplayer().setControls(false);
        jwplayer().setControls(true);

      }, pauseDuration * 1000);
    }
  }

  function _onPlaylistItem(index) {
    playlistItemEvent(index);
  }

  function onPlayerError(error) {
    if (error) {
      errorEvent({
        type: "video",
        message: error.message
      });
    }
  }

  function onSetupError(error) {
    if (error) {
      errorEvent({
        type: "setup",
        message: error.message
      });
    }
  }

  function loadVideo() {
    jwplayer("player").setup(setupObj);

    jwplayer().onSetupError(function (error) {
      onSetupError(error);
    });

    jwplayer().on("ready", function() {

      if (setupObj.hasOwnProperty("playlist")) {
        // folder, listen for playlist complete event
        jwplayer().on("playlistComplete", function () {
          _onComplete();
        });

        // folder, listen for when a playlist item changes
        jwplayer().on("playlistItem", function(data) {
          _onPlaylistItem(data.index);
        });
      }
      else if (setupObj.hasOwnProperty("file")) {
        // file, listen for single file complete event
        jwplayer().on("complete", function () {
          _onComplete();
        });
      }

      jwplayer().on("error", function (error) {
        onPlayerError(error);
      });

      if (controls && pauseDuration > 1) {
        jwplayer().on("pause", function () {
          _onPause();
        });
      }

      jwplayer().setVolume(volume);

      if (controls && !autoPlay) {
        jwplayer().setControls(true);
      }

      readyEvent();

    });
  }

  function play() {
    viewerPaused = false;

    if (autoPlay) {
      if (controls && !jwplayer().getControls()) {
        // Will be first time player is being told to play so doing this here and not in setup so that controls
        // aren't visible upon playing for the first time.
        jwplayer().setControls(true);
      }

      jwplayer().play();

      if (controls) {
        // workaround for controls remaining visible, turn them off and on again
        jwplayer().setControls(false);
        jwplayer().setControls(true);
      }
    }
  }

  function pause() {
    viewerPaused = true;
    clearTimeout(pauseTimer);
    jwplayer().pause();
  }

  function stop() {
    this.pause();
  }

  function remove() {
    viewerPaused = false;
    clearTimeout(pauseTimer);
    pauseTimer = null;
    jwplayer().remove();
  }

  function getDuration() {
    return jwplayer().getDuration();
  }

  function getPosition() {
    return jwplayer().getPosition();
  }

  function getState() {
    return jwplayer().getState();
  }

  return {
    getDuration: getDuration,
    getPosition: getPosition,
    getState: getState,
    loadVideo: loadVideo,
    play: play,
    pause: pause,
    onPlayerError: onPlayerError,
    onSetupError: onSetupError,
    stop: stop,
    remove: remove
  }
};

window.addEventListener("message", function(event) {
  origin = event.origin || event.originalEvent.origin;

  // ensure this message is coming from Amazon S3 (widget) or preview app (local widget)
  if (origin !== "http://s3.amazonaws.com" && origin !== "http://localhost:8000") {
    origin = null;
    return;
  }

  source = event.source;

  if (event.data && typeof event.data === "object" && event.data.event) {
    switch (event.data.event) {
      case "init" :
        init(event.data.params, event.data.files);
        load();

        break;
      case "play":
        play();
        break;
      case "pause":
        pause();
        break;
      case "stop":
        stop();
        break;
      case "remove":
        remove();
        break;
    }
  }
});

var file;

function configure(urls){
  file = urls;

  var filePlayer = function () {
    return playerJW({
      file: file,
      type: getVideoFileType(file),
      width : width,
      height : height,
      controls: false,
      skin: {
        name: "rise"
      },
      stretching : stretching
    });
  };

  player = filePlayer();
}

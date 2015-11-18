/* global gadgets, config */

var RiseVision = RiseVision || {};
RiseVision.Video = {};

RiseVision.Video = (function (gadgets) {
  "use strict";

  var _additionalParams;

  var _prefs = null,
    _storage = null,
    _nonStorage = null,
    _message = null,
    _frameController = null;

  var _playbackError = false,
    _viewerPaused = true;

  var _currentFrame = 0;

  var _currentFile = "";

  var _error = null,
    _errorTimer = null,
    _errorFlag = false;

  var _logger = RiseVision.Common.Logger;

  /*
   *  Private Methods
   */
  function _done() {
    gadgets.rpc.call("", "rsevent_done", null, _prefs.getString("id"));

    // Any errors need to be logged before the done event.
    if (_error !== null) {
      logEvent(_error, true);
    }

    logEvent({ "event": "done" }, false);
  }

  function _ready() {
    gadgets.rpc.call("", "rsevent_ready", null, _prefs.getString("id"),
      true, true, true, true, true);
  }

  function _clearErrorTimer() {
    clearTimeout(_errorTimer);
    _errorTimer = null;
  }

  function _startErrorTimer() {
    _clearErrorTimer();

    _errorTimer = setTimeout(function () {
      // notify Viewer widget is done
      _done();
    }, 5000);
  }

  // Get the parameters to pass to the event logger.
  function _getLoggerParams(params, cb) {
    var json = {},
      utils = RiseVision.Common.LoggerUtils,
      url = null;

    if (params.event) {
      json.event = params.event;
    }

    if (params.event_details) {
      json.event_details = params.event_details;
    }

    if (params.url) {
      url = params.url;
    }
    else if (_currentFile) {
      url = _currentFile;
    }

    json.file_url = url;
    json.file_format = utils.getFileFormat(url);

    utils.getIds(function(companyId, displayId) {
      json.company_id = companyId;
      json.display_id = displayId;

      cb(json);
    });
  }

  /*
   *  Public Methods
   */
  function showError(message) {
    _errorFlag = true;

    _message.show(message);

    _frameController.remove(_currentFrame, function () {
      // if Widget is playing right now, run the timer
      if (!_viewerPaused) {
        _startErrorTimer();
      }
    });
  }

  function logEvent(params, isError) {
    if (isError) {
      _error = params;
    }

    _getLoggerParams(params, function(json) {
      _logger.log("video_events", json);
    });
  }

  function onFileInit(url) {
    _currentFile = url;

    _message.hide();

    if (!_viewerPaused) {
      play();
    }
  }

  function onFileRefresh(url) {
    _currentFile = url;

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _playbackError = false;
    _error = null;
  }

  function pause() {
    var frameObj = _frameController.getFrameObject(_currentFrame);

    _viewerPaused = true;

    if (_errorFlag) {
      _clearErrorTimer();
      return;
    }

    if (frameObj) {
      frameObj.pause();
    }
  }

  function play() {
    var frameObj = _frameController.getFrameObject(_currentFrame);

    _viewerPaused = false;

    logEvent({ "event": "play" }, false);

    if (_errorFlag) {
      _startErrorTimer();
      return;
    }

    if (!_playbackError) {
      if (frameObj) {
        frameObj.play();
      } else {

        if (_currentFile && _currentFile !== "") {
          // add frame and create the player
          _frameController.add(0);
          _frameController.createFramePlayer(0, _additionalParams, _currentFile, config.SKIN, "player.html");
        }

      }
    }
  }

  function playerEnded() {
    _frameController.remove(_currentFrame, function () {
      _done();
    });
  }

  function playerReady() {
    var frameObj;

    // Ensures messaging is hidden for non-storage video file
    _message.hide();

    if (!_viewerPaused) {
      frameObj = _frameController.getFrameObject(_currentFrame);

      if (frameObj) {
        frameObj.play();
      }
    }
  }

  function setAdditionalParams(names, values) {
    var isStorageFile;

    if (Array.isArray(names) && names.length > 0 && names[0] === "additionalParams") {
      if (Array.isArray(values) && values.length > 0) {
        _additionalParams = JSON.parse(values[0]);
        _prefs = new gadgets.Prefs();

        document.getElementById("videoContainer").style.height = _prefs.getInt("rsH") + "px";

        _additionalParams.width = _prefs.getInt("rsW");
        _additionalParams.height = _prefs.getInt("rsH");

        _message = new RiseVision.Common.Message(document.getElementById("videoContainer"),
          document.getElementById("messageContainer"));

        // show wait message while Storage initializes
        _message.show("Please wait while your video is downloaded.");

        _frameController = new RiseVision.Common.Video.FrameController();

        isStorageFile = (Object.keys(_additionalParams.storage).length !== 0);

        if (!isStorageFile) {
          _nonStorage = new RiseVision.Video.NonStorage(_additionalParams);
          _nonStorage.init();
        } else {
          // create and initialize the Storage module instance
          _storage = new RiseVision.Video.Storage(_additionalParams);
          _storage.init();
        }

        _ready();
      }
    }
  }

  // An error occurred with JW Player.
  function playerError(error) {
    var details = null,
      params = {},
      message = "Sorry, there was a problem playing the video.";

    _playbackError = true;

    if (error) {
      if (error.type && error.message) {
        details = error.type + " - " + error.message;
      }
      else if (error.type) {
        details = error.type;
      }
      else if (error.message) {
        details = error.message;
      }

      // Check if there is an issue with the format.
      if (error.message && (error.message === "Error loading media: File could not be played")) {
        message = "There was a problem playing that video. It could be that we don't " +
        "support that format or it is not encoded correctly.";
      }
    }

    params.event = "error";
    params.event_details = details;

    logEvent(params, true);
    showError(message);
  }

  function stop() {
    pause();
  }

  return {
    "logEvent": logEvent,
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "showError": showError,
    "playerEnded": playerEnded,
    "playerReady": playerReady,
    "playerError": playerError,
    "stop": stop
  };

})(gadgets);

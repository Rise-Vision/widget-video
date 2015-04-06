/* global gadgets */

var RiseVision = RiseVision || {};
RiseVision.Video = {};

RiseVision.Video = (function (document, gadgets) {
  "use strict";

  var _prefs = null,
    _background = null,
    _initialPlay = true,
    _player, _additionalParams;

  /*
   *  Private Methods
   */
  function _done() {
    gadgets.rpc.call("", "rsevent_done", null, _prefs.getString("id"));

  }

  function _ready() {
    gadgets.rpc.call("", "rsevent_ready", null, _prefs.getString("id"),
      true, true, true, true, true);
  }

  function _backgroundReady() {
    // create and initialize the Player instance
    _player = RiseVision.Video.Player;
    _player.init(_additionalParams);
  }

  /*
   *  Public Methods
   */
  function pause() {
    _player.pause();
  }

  function play() {
    // "autoplay" was selected in settings
    if (_initialPlay) {
      _initialPlay = false;

      if (_additionalParams.video.autoplay) {
        _player.play();
      } else {
        _player.play(true);
      }
    } else {
      _player.play();
    }

  }

  function playerReady() {
    _ready();
  }

  function setAdditionalParams(names, values) {
    if (Array.isArray(names) && names.length > 0 && names[0] === "additionalParams") {
      if (Array.isArray(values) && values.length > 0) {
        _additionalParams = JSON.parse(values[0]);
        _prefs = new gadgets.Prefs();

        document.getElementById("videoContainer").style.height = _prefs.getInt("rsH") + "px";

        _additionalParams.width = _prefs.getInt("rsW");
        _additionalParams.height = _prefs.getInt("rsH");

        // create and initialize the Background instance
        _background = new RiseVision.Common.Background(_additionalParams);
        _background.init(_backgroundReady);
      }
    }

  }

  function stop() {
    // https://github.com/Rise-Vision/viewer/issues/30
    // Have to call pause() due to Viewer issue
    pause();
  }

  function videoEnded() {
    _done();
  }

  return {
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "playerReady": playerReady,
    "stop": stop,
    "videoEnded": videoEnded
  };

})(document, gadgets);

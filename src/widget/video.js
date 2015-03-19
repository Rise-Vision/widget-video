/* global gadgets */

var RiseVision = RiseVision || {};
RiseVision.Video = {};

RiseVision.Video = (function (document, gadgets) {
  "use strict";

  var _prefs = null,
    _additionalParams = {},
    _background = null,
    _player = null,
    _initialPlay = true,
    _previouslyPlaying = true;

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
    _player = new RiseVision.Video.Player(_additionalParams);
    _player.init();
  }

  /*
   *  Public Methods
   */
  function pause() {
    _previouslyPlaying = _player.isVideoPlaying();

    _player.pause();
  }

  function play() {
    if (_initialPlay) {
      _initialPlay = false;

      // "autoplay" was selected in settings
      if (_additionalParams.video.autoplay) {
        _player.play();
      }

    } else {
      if (_previouslyPlaying) {
        _player.play();
      }
    }
  }

  function playerReady() {
    _ready();
  }

  function setAdditionalParams(params) {
    _prefs = new gadgets.Prefs();
    _additionalParams = params;

    document.getElementById("videoContainer").style.height = _prefs.getInt("rsH") + "px";

    // create and initialize the Background instance
    _background = new RiseVision.Common.Background(_additionalParams);
    _background.init(_backgroundReady);
  }

  function stop() {
    // https://github.com/Rise-Vision/viewer/issues/30
    // Have to call pause() on the player due to Viewer issue
    _player.pause();
  }

  function videoEnded() {
    _previouslyPlaying = true;
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

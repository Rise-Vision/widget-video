/* global config: true */
/* exported config */
if (typeof config === "undefined") {
  var config = {
    // variables go here
  };

  if (typeof angular !== "undefined") {
    angular.module("risevision.common.i18n.config", [])
      .constant("LOCALES_PREFIX", "locales/translation_")
      .constant("LOCALES_SUFIX", ".json");
  }
}

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

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Background = function (data) {
  "use strict";

  var _callback = null,
    _ready = false,
    _background = null,
    _storage = null,
    _refreshDuration = 900000, // 15 minutes
    _isStorageFile = false,
    _separator = "";

  /*
   * Private Methods
   */
  function _refreshTimer() {
    setTimeout(function backgroundRefresh() {
      _background.style.backgroundImage = "url(" + data.background.image.url + _separator + "cb=" + new Date().getTime() + ")";
      _refreshTimer();
    }, _refreshDuration);
  }

  function _backgroundReady() {
    _ready = true;

    if (data.background.useImage && !_isStorageFile) {
      // start the refresh poll for non-storage background image
      _refreshTimer();
    }

    if (_callback && typeof _callback === "function") {
      _callback();
    }
  }

  function _storageResponse(e) {
    _storage.removeEventListener("rise-storage-response", _storageResponse);

    if (Array.isArray(e.detail)) {
      _background.style.backgroundImage = "url(" + e.detail[0] + ")";
    } else {
      _background.style.backgroundImage = "url(" + e.detail + ")";
    }
    _backgroundReady();
  }

  function _configure() {
    var str;

    _background = document.getElementById("background");
    _storage = document.getElementById("backgroundStorage");

    // set the document background
    document.body.style.background = data.background.color;

    if (_background) {
      if (data.background.useImage) {
        _background.className = data.background.image.position;
        _background.className = data.background.image.scale ? _background.className + " scale-to-fit"
          : _background.className;

        _isStorageFile = (Object.keys(data.backgroundStorage).length !== 0);

        if (!_isStorageFile) {
          str = data.background.image.url.split("?");

          // store this for the refresh timer
          _separator = (str.length === 1) ? "?" : "&";

          _background.style.backgroundImage = "url(" + data.background.image.url + ")";
          _backgroundReady();
        } else {
          if (_storage) {
            // Rise Storage
            _storage.addEventListener("rise-storage-response", _storageResponse);

            _storage.setAttribute("folder", data.backgroundStorage.folder);
            _storage.setAttribute("fileName", data.backgroundStorage.fileName);
            _storage.setAttribute("companyId", data.backgroundStorage.companyId);
            _storage.go();
          } else {
            console.log("Missing element with id value of 'backgroundStorage'");
          }
        }
      } else {
        _backgroundReady();
      }
    } else {
      console.log("Missing element with id value of 'background'");
    }
  }

  /*
   *  Public Methods
   */
  function init(cb) {
    if (!_ready) {
      if (cb) {
        _callback = cb;
      }

      _configure();

    } else if (cb && typeof cb === "function") {
      cb();
    }
  }

  return {
    "init": init
  };
};

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.Player = function (data) {
  "use strict";

  var _refreshDuration = 900000, // 15 minutes
    _isStorageFile = false,
    _refreshWaiting = false,
    _notifiedReady = false,
    _separator = "";

  /*
   * Private Methods
   */
  function _getVideoFileType() {
    var type = data.url.substr(data.url.lastIndexOf(".") + 1);

    if (type === "ogv") {
      type = "ogg";
    }

    return type;
  }

  function _onCanPlayThrough() {
    var video = document.getElementById("video");

    // remove this listener
    video.removeEventListener("canplaythrough", _onCanPlayThrough, false);

    // only call playerReady() once
    if (!_notifiedReady) {
      RiseVision.Video.playerReady();
      _notifiedReady = true;
    }

    if (!_isStorageFile) {
      if (_refreshWaiting) {
        // refresh happened after a video finished playing instead of immediately, notify viewer that video ended
        _refreshWaiting = false;

        RiseVision.Video.videoEnded();
      }

      // call the refresh timer function for a non-storage video
      _refreshTimer(_refreshDuration);
    }
  }

  function _onEnded() {
    if (!_isStorageFile && _refreshWaiting) {
      _refresh();
    } else {
      RiseVision.Video.videoEnded();
    }
  }

  function _onRiseStorageResponse(e) {
    var video = document.getElementById("video"),
      source;

    if (video) {
      source = video.getElementsByTagName("source")[0];
    }

    if (Array.isArray(e.detail)) {
      source.setAttribute("src", e.detail[0]);
    } else {
      source.setAttribute("src", e.detail);
    }

    video.load();
  }

  function _refresh() {
    var video = document.getElementById("video"),
      source;

    source = video.getElementsByTagName("source")[0];

    video.addEventListener("canplaythrough", _onCanPlayThrough, false);

    // set new src value with a cachebuster
    source.setAttribute("src", data.url + _separator + "cb=" + new Date().getTime());

    video.load();
  }

  function _refreshTimer(duration) {
    var video = document.getElementById("video");

    setTimeout(function () {

      if (video && video.paused && video.currentTime <= 0) {
        // Only refreshing immediately when in a paused state and the video is at the beginning
        _refresh(false);
      } else {
        _refreshWaiting = true;
      }

    }, duration);
  }

  /*
   *  Public Methods
   */
  function init() {
    var video = document.getElementById("video"),
      storage = document.getElementById("videoStorage"),
      fragment = document.createDocumentFragment(),
      source = document.createElement("source"),
      str;

    if (!video || !storage) {
      return;
    }

    // use default controls if not set to autoplay
    if (!data.video.autoplay) {
      video.setAttribute("controls", "");
    }

    // set appropriate sizing class based on scaleToFit value
    video.className = data.video.scaleToFit ? video.className + " scale-to-fit"
      : video.className + " no-scale";

    // set initial volume on <video>
    video.volume = data.video.volume / 100;

    // set the "type" attribute on <source>
    source.setAttribute("type", "video/" + _getVideoFileType());

    // video events
    video.addEventListener("canplaythrough", _onCanPlayThrough, false);
    video.addEventListener("ended", _onEnded, false);

    _isStorageFile = (Object.keys(data.videoStorage).length !== 0);

    if (!_isStorageFile) {
      str = data.url.split("?");

      // store this for the refresh timer
      _separator = (str.length === 1) ? "?" : "&";

      // Non storage URL
      source.setAttribute("src", data.url);

      fragment.appendChild(source);
      video.appendChild(fragment);

    } else {
      fragment.appendChild(source);
      video.appendChild(fragment);

      // Rise Storage
      storage.addEventListener("rise-storage-response", _onRiseStorageResponse);

      storage.setAttribute("folder", data.videoStorage.folder);
      storage.setAttribute("fileName", data.videoStorage.fileName);
      storage.setAttribute("companyId", data.videoStorage.companyId);
      storage.go();
    }
  }

  function isVideoPlaying() {
    var video = document.getElementById("video");

    return (video && typeof(video.pause) !== "undefined" && !video.paused && !video.ended) ? true : false;
  }

  function pause() {
    var video = document.getElementById("video");

    if (video && typeof(video.pause) !== "undefined") {
      video.pause();
    }

  }

  function play() {
    var video = document.getElementById("video");

    if (video && typeof(video.pause) !== "undefined") {
      video.play();
    }

  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "isVideoPlaying": isVideoPlaying
  };
};

/* global gadgets, RiseVision */

(function (window, gadgets) {
  "use strict";

  var prefs = new gadgets.Prefs(),
    id = prefs.getString("id");

  // Disable context menu (right click menu)
  window.oncontextmenu = function () {
    return false;
  };

  function play() {
    RiseVision.Video.play();
  }

  function pause() {
    RiseVision.Video.pause();
  }

  function stop() {
    RiseVision.Video.stop();
  }

  function additionalParams(names, values) {
    if (Array.isArray(names) && names.length > 0 && names[0] === "additionalParams") {
      if (Array.isArray(values) && values.length > 0) {
        RiseVision.Video.setAdditionalParams(JSON.parse(values[0]));
      }
    }
  }

  if (id && id !== "") {
    gadgets.rpc.register("rscmd_play_" + id, play);
    gadgets.rpc.register("rscmd_pause_" + id, pause);
    gadgets.rpc.register("rscmd_stop_" + id, stop);

    gadgets.rpc.register("rsparam_set_" + id, additionalParams);
    gadgets.rpc.call("", "rsparam_get", null, id, ["additionalParams"]);

  }

})(window, gadgets);



/* jshint ignore:start */
var _gaq = _gaq || [];

_gaq.push(['_setAccount', 'UA-57092159-2']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
/* jshint ignore:end */

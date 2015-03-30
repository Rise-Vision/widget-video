/* global config: true */
/* exported config */
if (typeof config === "undefined") {
  var config = {
    SKIN: "/rise-common/scripts/jw-player/skins/six.xml"
  };

  if (typeof angular !== "undefined") {
    angular.module("risevision.common.i18n.config", [])
      .constant("LOCALES_PREFIX", "locales/translation_")
      .constant("LOCALES_SUFIX", ".json");
  }
}

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.RiseCache = (function () {
  "use strict";

  function getUrl() {
    return "http://localhost:9494/?url=";
  }

  function ping(callback) {
    var r = new XMLHttpRequest();

    if (callback && typeof callback !== "function") {
      return;
    }

    r.open("GET", "http://localhost:9494/ping", true);
    r.onreadystatechange = function () {
      try {
        if (r.readyState === 4 ) {
          if(r.status === 200){
            callback(true, r.responseText);
          } else {
            console.debug("Rise Cache is not running");
            callback(false, null);
          }
        }
      }
      catch (e) {
        console.debug("Caught exception: ", e.description);
      }

    };
    r.send();
  }

  return {
    ping: ping,
    getUrl:  getUrl
  };

})();

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
            _storage.addEventListener("rise-storage-response", function (e) {
              if (e.detail && e.detail.files && e.detail.files.length > 0) {
                _background.style.backgroundImage = "url(" + e.detail.files[0].url + ")";
              }

              if (!_ready) {
                _backgroundReady();
              }
            });

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

/* global jwplayer, config */
var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};


RiseVision.Video.Player = (function (document, jwplayer, cache, config) {
  "use strict";

  var _autoPlay, _volume, _scaleToFit, _url, _storageUrl;
  var _width, _height;
  var _isStorageFile;

  var _isLoading = true,
    _playerError = false,
    _separator = "",
    _riseCacheRunning = false,
    _refreshWaiting = false,
    _refreshDuration = 900000; // 15 minutes

  /*
   *  Private Methods
   */
  function _getVideoFileType(url) {
    var extensions = [".mp4", ".webm", ".ogg", ".ogv"],
      urlLowercase = url.toLowerCase(),
      type = null,
      i;

    for (i = 0; i <= extensions.length; i += 1) {
      if (urlLowercase.indexOf(extensions[i]) !== -1) {
        type = extensions[i].substr(extensions[i].lastIndexOf(".") + 1);
        break;
      }
    }

    if (type === "ogv") {
      type = "ogg";
    }

    return type;
  }

  function _refreshTimer() {
    setTimeout(function () {
      // do not do any immediate action to avoid any unforeseen scenario
      // wait until viewer has told widget to pause
      _refreshWaiting = true;
    }, _refreshDuration);
  }

  function _refresh() {
    var fileType;

    if (_isStorageFile) {
      fileType = _getVideoFileType(_storageUrl);

      _refreshWaiting = false;

      console.debug("Refresh, JW Player load: ", [_storageUrl, fileType]);

      // load a new "playlist"
      jwplayer().load([{
        file: _storageUrl,
        type: fileType
      }]);

    } else {
      fileType = _getVideoFileType(_url);

      cache.ping(function (isRunning) {
        _riseCacheRunning = isRunning;

        _refreshWaiting = false;

        console.debug("Refresh, JW Player load: ",
          [_riseCacheRunning ? cache.getUrl() + encodeURIComponent(_url) : _url, fileType]);

        // load a new "playlist"
        jwplayer().load([{
          file: _riseCacheRunning ? cache.getUrl() + encodeURIComponent(_url) : _url,
          type: fileType
        }]);

        // start the refresh timer again for this non-storage video
        _refreshTimer();
      });
    }
  }

  function _onVideoComplete() {
    console.debug("JW Player video complete");
    RiseVision.Video.videoEnded();
  }

  function _onVideoPlay() {
    // JW Player fires onPlay twice when video is being played from initial position
    if (_isLoading) {
      _isLoading = false;

      if (!_isStorageFile) {
        _refreshTimer();
      }
    }

    _playerError = false;
  }

  function _onPlayerReady() {
    jwplayer().setMute(false);
    jwplayer().setVolume(_volume);

    // now notify Viewer that player is ready
    RiseVision.Video.playerReady();
  }

  function _onPlayerError(error) {
    console.debug("JW Player Error - ", error);

    _playerError = true;

    if (_isLoading) {
      _isLoading = false;

      if (!_isStorageFile) {
        _refreshTimer();
      }
    }

    RiseVision.Video.videoEnded();
  }

  function _load() {
    var file, fileType;

    document.getElementById("videoJW").style.visibility = "hidden";

    if (_isStorageFile) {
      file = _storageUrl;
      fileType = _getVideoFileType(_storageUrl);
    } else {
      file = _riseCacheRunning ? cache.getUrl() + encodeURIComponent(_url) : _url;
      fileType = _getVideoFileType(_url);
    }

    console.debug("JW Player setup: ", [file, fileType]);

    jwplayer("videoJW").setup({
      file : file,
      type: fileType,
      width : _width,
      height : _height,
      controls: !_autoPlay,
      mute: true,
      stretching : _scaleToFit ? "uniform" : "none",
      primary: "html5",
      skin: config.SKIN,
      events : {
        onReady : function (event) {
          _onPlayerReady(event);
        },
        onComplete : function (event) {
          _onVideoComplete(event);
        },
        onError : function (error) {
          _onPlayerError(error);
        },
        onPlay : function (event) {
          _onVideoPlay(event);
        }
      }
    });

  }

  function _onRiseStorageResponse(e) {
    console.debug("Rise Storage response - ", e);
    if (e.detail && e.detail.files && e.detail.files.length > 0) {
      _storageUrl = e.detail.files[0].url;

      if (_isLoading) {
        _load();
      } else {
        // do not do any immediate action to avoid any unforeseen scenario
        // wait until viewer has told widget to pause
        _refreshWaiting = true;
      }
    }
  }

  /*
   *  Public Methods
   */
  function init(data) {
    var video = document.getElementById("videoJW"),
      storage = document.getElementById("videoStorage"),
      str;

    if (!video || !storage) {
      return;
    }

    _autoPlay = data.video.autoplay;
    _volume = data.video.volume;
    _scaleToFit = data.video.scaleToFit;
    _url = data.url;

    _width = data.width;
    _height = data.height;

    _isStorageFile = (Object.keys(data.videoStorage).length !== 0);

    if (!_isStorageFile) {
      str = _url.split("?");
      // store this for the refresh timer
      _separator = (str.length === 1) ? "?" : "&";

      cache.ping(function (isRunning) {
        _riseCacheRunning = isRunning;
        _load();
      });

    } else {
      // Rise Storage
      storage.addEventListener("rise-storage-response", _onRiseStorageResponse);

      storage.setAttribute("folder", data.videoStorage.folder);
      storage.setAttribute("fileName", data.videoStorage.fileName);
      storage.setAttribute("companyId", data.videoStorage.companyId);
      storage.go();
    }
  }

  function pause() {
    var state = jwplayer().getState();

    if (state === "BUFFERING" || state === "PLAYING") {
      jwplayer().pause(true);
    }

    document.getElementById("videoJW").style.visibility = "hidden";

    if (_refreshWaiting) {
      _refresh();
    }
  }

  function play(showOnly) {
    document.getElementById("videoJW").style.visibility = "visible";

    if (!_playerError) {
      if (!showOnly) {
        if (jwplayer().getPosition() > 0) {
          jwplayer().seek(0);
          jwplayer().play(true);
        } else {
          jwplayer().play(true);
        }
      }

    } else {
      RiseVision.Video.videoEnded();
    }
  }

  function remove() {
    jwplayer().remove();
  }

  function stop() {
    pause();
  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "remove": remove,
    "stop": stop

  };

})(document, jwplayer, RiseVision.Common.RiseCache, config);

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

  window.addEventListener("polymer-ready", function() {
    if (id && id !== "") {
      gadgets.rpc.register("rscmd_play_" + id, play);
      gadgets.rpc.register("rscmd_pause_" + id, pause);
      gadgets.rpc.register("rscmd_stop_" + id, stop);

      gadgets.rpc.register("rsparam_set_" + id, RiseVision.Video.setAdditionalParams);
      gadgets.rpc.call("", "rsparam_get", null, id, ["additionalParams"]);
    }
  });

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

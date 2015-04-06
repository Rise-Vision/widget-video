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

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

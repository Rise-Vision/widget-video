var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.Player = (function (document, $) {
  "use strict";

  var _videoUrl = null,
    _riseCacheRunning = true,
    //_refreshDuration = 900000, // 15 minutes
    _isStorageFile = false,
    //_refreshWaiting = false,
    _notifiedReady = false;//,
    //_separator = "",
    //_newStorageFile = null;

  /*
   * Private Methods
   */
  /*function _getVideoFileType() {
    var type = _videoUrl.substr(_videoUrl.lastIndexOf(".") + 1);

    if (type === "ogv") {
      type = "ogg";
    }

    return type;
  }*/

  function _onCanPlayThrough() {
    console.log("player::_onCanPlayThrough");
    var video = document.getElementById("video");

    // remove this listener
    video.removeEventListener("canplaythrough", _onCanPlayThrough, false);

    // only call playerReady() once
    if (!_notifiedReady) {
      RiseVision.Video.playerReady();
      _notifiedReady = true;

      /*if (!_isStorageFile) {
        // call the refresh timer function for a non-storage video
        _refreshTimer(_refreshDuration);
      }*/
    }

    /*if (_refreshWaiting) {
      // refresh happened after a video finished playing instead of immediately, notify viewer that video ended
      _refreshWaiting = false;

      RiseVision.Video.videoEnded();

      if (!_isStorageFile) {
        // call the refresh timer function for a non-storage video
        _refreshTimer(_refreshDuration);
      }
    }*/

  }

  function _onEnded() {
    console.log("player::_onEnded");
    var video = document.getElementById("video"),
      startTime;/*,
      source = video.getElementsByTagName("source")[0];*/

    /*if (source.getAttribute("src") !== "") {
      source.setAttribute("src", "");
    }*/

    /*if (_refreshWaiting) {
      _refresh();
    } else {*/
    video.pause();
    startTime = video.seekable.start(0);
    console.debug(startTime);
    video.currentTime = startTime;
    video.pause();
      RiseVision.Video.videoEnded();
    //}
  }

  function _onRiseStorageResponse(e) {
    console.log("player::_onRiseStorageResponse");
    console.dir(e);
    var video = document.getElementById("video")/*,
      source*/;

    /*if (video) {
      source = video.getElementsByTagName("source")[0];
    }*/

    if (e.detail && e.detail.files && e.detail.files.length > 0) {
      /*if (_notifiedReady) {
        // this is a refresh, store the new file url
        _newStorageFile = e.detail.files[0].url;

        if (video && video.paused && video.currentTime <= 0) {
          // refresh immediately
          _refresh();
        } else {
          _refreshWaiting = true;
        }

      } else {*/
        // this is not a refresh as the widget has not notified Viewer that its ready yet
        //source.setAttribute("src", e.detail.files[0].url);
        video.setAttribute("src", e.detail.files[0].url);
        video.load();
      //}

    }

  }

  /*function _refresh() {
    var video = document.getElementById("video"),
      source = video.getElementsByTagName("source")[0];

    video.addEventListener("canplaythrough", _onCanPlayThrough, false);

    if (_isStorageFile) {
      source.setAttribute("src", _newStorageFile);
    } else {
      // set new src value with a cachebuster
      source.setAttribute("src", _videoUrl + _separator + "cb=" + new Date().getTime());
    }

    video.load();
  }*/

  /*function _refreshTimer(duration) {
    var video = document.getElementById("video");

    setTimeout(function () {

      if (video && video.paused && video.currentTime <= 0) {
        // Only refreshing immediately when in a paused state and the video is at the beginning
        _refresh(false);
      } else {
        _refreshWaiting = true;
      }

    }, duration);
  }*/

  /*
   *  Public Methods
   */
  function init(data) {
    console.log("player::init");
    var video = document.getElementById("video"),
      storage = document.getElementById("videoStorage");//,
    /*source, str*/

    if (!video || !storage) {
      return;
    }

    _videoUrl = (_riseCacheRunning) ? "http://localhost:9494/?url=" + encodeURIComponent(data.url) : data.url;

    // use default controls if not set to autoplay
    if (!data.video.autoplay) {
      video.setAttribute("controls", "");
    }

    // set appropriate sizing class based on scaleToFit value
    video.className = data.video.scaleToFit ? video.className + " scale-to-fit"
      : video.className + " no-scale";

    // set initial volume on <video>
    video.volume = data.video.volume / 100;

    //source = video.getElementsByTagName("source")[0];

    // set the "type" attribute on <source>
    //source.setAttribute("type", "video/" + _getVideoFileType());

    // video events
    video.addEventListener("canplaythrough", _onCanPlayThrough, false);

    _isStorageFile = (Object.keys(data.videoStorage).length !== 0);

    if (!_isStorageFile) {
      //str = _videoUrl.split("?");

      // store this for the refresh timer
      //_separator = (str.length === 1) ? "?" : "&";

      //video.setAttribute("preload", "auto");

      // Non storage URL
      //source.setAttribute("src", _videoUrl);
      video.setAttribute("src", _videoUrl);

      video.load();

    } else {
      //video.setAttribute("preload", "none");

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
    console.log("player::pause()");
    var video = document.getElementById("video");

    if (video && typeof(video.pause) !== "undefined") {
      video.removeEventListener("ended", _onEnded, false);
      if (isVideoPlaying()) {
        video.pause();
      }

    }

  }

  function ping(data){
    console.log("player::ping()");
    $.ajax({
      url: "http://localhost:9494/ping",
      cache: false,
      success: function(){
        init(data);
      },
      error: function(){
        // rise cache not running
        _riseCacheRunning = false;
        init(data);
      }
    });

  }

  function play() {
    console.log("player::play()");
    var video = document.getElementById("video");

    if (video && typeof(video.pause) !== "undefined") {
      video.addEventListener("ended", _onEnded, false);
      video.play();
    }
  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "isVideoPlaying": isVideoPlaying,
    "ping": ping
  };
})(document, jQuery);

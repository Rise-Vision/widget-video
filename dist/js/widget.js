var WIDGET_COMMON_CONFIG = {
  AUTH_PATH_URL: "v1/widget/auth",
  LOGGER_CLIENT_ID: "1088527147109-6q1o2vtihn34292pjt4ckhmhck0rk0o7.apps.googleusercontent.com",
  LOGGER_CLIENT_SECRET: "nlZyrcPLg6oEwO9f9Wfn29Wh",
  LOGGER_REFRESH_TOKEN: "1/xzt4kwzE1H7W9VnKB8cAaCx6zb4Es4nKEoqaYHdTD15IgOrJDtdun6zK6XiATCKT",
  STORAGE_ENV: "prod",
  STORE_URL: "https://store-dot-rvaserver2.appspot.com/"
};
/* global gadgets */

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.LoggerUtils = (function() {
  "use strict";

   var displayId = "",
    companyId = "";

  /*
   *  Private Methods
   */

  /* Retrieve parameters to pass to the event logger. */
  function getEventParams(params, cb) {
    var json = null;

    // event is required.
    if (params.event) {
      json = params;

      if (json.file_url) {
        json.file_format = getFileFormat(json.file_url);
      }

      json.company_id = companyId;
      json.display_id = displayId;

      cb(json);
    }
    else {
      cb(json);
    }
  }

  // Get suffix for BQ table name.
  function getSuffix() {
    var date = new Date(),
      year = date.getUTCFullYear(),
      month = date.getUTCMonth() + 1,
      day = date.getUTCDate();

    if (month < 10) {
      month = "0" + month;
    }

    if (day < 10) {
      day = "0" + day;
    }

    return year + month + day;
  }

  /*
   *  Public Methods
   */
  function getFileFormat(url) {
    var hasParams = /[?#&]/,
      str;

    if (!url || typeof url !== "string") {
      return null;
    }

    str = url.substr(url.lastIndexOf(".") + 1);

    // don't include any params after the filename
    if (hasParams.test(str)) {
      str = str.substr(0 ,(str.indexOf("?") !== -1) ? str.indexOf("?") : str.length);

      str = str.substr(0, (str.indexOf("#") !== -1) ? str.indexOf("#") : str.length);

      str = str.substr(0, (str.indexOf("&") !== -1) ? str.indexOf("&") : str.length);
    }

    return str.toLowerCase();
  }

  function getInsertData(params) {
    var BASE_INSERT_SCHEMA = {
      "kind": "bigquery#tableDataInsertAllRequest",
      "skipInvalidRows": false,
      "ignoreUnknownValues": false,
      "templateSuffix": getSuffix(),
      "rows": [{
        "insertId": ""
      }]
    },
    data = JSON.parse(JSON.stringify(BASE_INSERT_SCHEMA));

    data.rows[0].insertId = Math.random().toString(36).substr(2).toUpperCase();
    data.rows[0].json = JSON.parse(JSON.stringify(params));
    data.rows[0].json.ts = new Date().toISOString();

    return data;
  }

  function logEvent(table, params) {
    getEventParams(params, function(json) {
      if (json !== null) {
        RiseVision.Common.Logger.log(table, json);
      }
    });
  }

  /* Set the Company and Display IDs. */
  function setIds(company, display) {
    companyId = company;
    displayId = display;
  }

  return {
    "getInsertData": getInsertData,
    "getFileFormat": getFileFormat,
    "logEvent": logEvent,
    "setIds": setIds
  };
})();

RiseVision.Common.Logger = (function(utils) {
  "use strict";

  var REFRESH_URL = "https://www.googleapis.com/oauth2/v3/token?client_id=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_ID +
      "&client_secret=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_SECRET +
      "&refresh_token=" + WIDGET_COMMON_CONFIG.LOGGER_REFRESH_TOKEN +
      "&grant_type=refresh_token";

  var serviceUrl = "https://www.googleapis.com/bigquery/v2/projects/client-side-events/datasets/Widget_Events/tables/TABLE_ID/insertAll",
    throttle = false,
    throttleDelay = 1000,
    lastEvent = "",
    refreshDate = 0,
    token = "";

  /*
   *  Private Methods
   */
  function refreshToken(cb) {
    var xhr = new XMLHttpRequest();

    if (new Date() - refreshDate < 3580000) {
      return cb({});
    }

    xhr.open("POST", REFRESH_URL, true);
    xhr.onloadend = function() {
      var resp = JSON.parse(xhr.response);

      cb({ token: resp.access_token, refreshedAt: new Date() });
    };

    xhr.send();
  }

  function isThrottled(event) {
    return throttle && (lastEvent === event);
  }

  /*
   *  Public Methods
   */
  function log(tableName, params) {
    if (!tableName || !params || (params.hasOwnProperty("event") && !params.event) ||
      (params.hasOwnProperty("event") && isThrottled(params.event))) {
      return;
    }

    throttle = true;
    lastEvent = params.event;

    setTimeout(function () {
      throttle = false;
    }, throttleDelay);

    function insertWithToken(refreshData) {
      var xhr = new XMLHttpRequest(),
        insertData, url;

      url = serviceUrl.replace("TABLE_ID", tableName);
      refreshDate = refreshData.refreshedAt || refreshDate;
      token = refreshData.token || token;
      insertData = utils.getInsertData(params);

      // Insert the data.
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + token);

      if (params.cb && typeof params.cb === "function") {
        xhr.onloadend = function() {
          params.cb(xhr.response);
        };
      }

      xhr.send(JSON.stringify(insertData));
    }

    return refreshToken(insertWithToken);
  }

  return {
    "log": log
  };
})(RiseVision.Common.LoggerUtils);
var RiseVision = RiseVision || {};

RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Utilities = (function() {

  function getFontCssStyle(className, fontObj) {
    var family = "font-family:" + fontObj.font.family + "; ";
    var color = "color: " + (fontObj.color ? fontObj.color : fontObj.forecolor) + "; ";
    var size = "font-size: " + (fontObj.size.indexOf("px") === -1 ? fontObj.size + "px; " : fontObj.size + "; ");
    var weight = "font-weight: " + (fontObj.bold ? "bold" : "normal") + "; ";
    var italic = "font-style: " + (fontObj.italic ? "italic" : "normal") + "; ";
    var underline = "text-decoration: " + (fontObj.underline ? "underline" : "none") + "; ";
    var highlight = "background-color: " + (fontObj.highlightColor ? fontObj.highlightColor : fontObj.backcolor) + "; ";

    return "." + className + " {" + family + color + size + weight + italic + underline + highlight + "}";
  }

  function addCSSRules(rules) {
    var style = document.createElement("style");

    for (var i = 0, length = rules.length; i < length; i++) {
      style.appendChild(document.createTextNode(rules[i]));
    }

    document.head.appendChild(style);
  }

  /*
   * Loads Google or custom fonts, if applicable, and injects CSS styles
   * into the head of the document.
   *
   * @param    array    settings    Array of objects with the following form:
 *                                   [{
 *                                     "class": "date",
 *                                     "fontSetting": {
 *                                         bold: true,
 *                                         color: "black",
 *                                         font: {
 *                                           family: "Akronim",
 *                                           font: "Akronim",
 *                                           name: "Verdana",
 *                                           type: "google",
 *                                           url: "http://custom-font-url"
 *                                         },
 *                                         highlightColor: "transparent",
 *                                         italic: false,
 *                                         size: "20",
 *                                         underline: false
 *                                     }
 *                                   }]
   *
   *           object   contentDoc    Document object into which to inject styles
   *                                  and load fonts (optional).
   */
  function loadFonts(settings, contentDoc) {
    settings.forEach(function(item) {
      if (item.class && item.fontSetting) {
        addCSSRules([ getFontCssStyle(item.class, item.fontSetting) ]);
      }

      if (item.fontSetting.font.type) {
        if (item.fontSetting.font.type === "custom" && item.fontSetting.font.family &&
          item.fontSetting.font.url) {
          loadCustomFont(item.fontSetting.font.family, item.fontSetting.font.url,
            contentDoc);
        }
        else if (item.fontSetting.font.type === "google" && item.fontSetting.font.family) {
          loadGoogleFont(item.fontSetting.font.family, contentDoc);
        }
      }
    });
  }

  function loadCustomFont(family, url, contentDoc) {
    var sheet = null;
    var rule = "font-family: " + family + "; " + "src: url('" + url + "');";

    contentDoc = contentDoc || document;

    sheet = contentDoc.styleSheets[0];

    if (sheet !== null) {
      sheet.addRule("@font-face", rule);
    }
  }

  function loadGoogleFont(family, contentDoc) {
    var stylesheet = document.createElement("link"),
      familyVal;

    contentDoc = contentDoc || document;

    stylesheet.setAttribute("rel", "stylesheet");
    stylesheet.setAttribute("type", "text/css");

    // split to account for family value containing a fallback (eg. Aladin,sans-serif)
    familyVal = family.split(",")[0];

    // strip possible single quotes
    familyVal = familyVal.replace(/'/g, "");

    stylesheet.setAttribute("href", "https://fonts.googleapis.com/css?family=" + familyVal);

    if (stylesheet !== null) {
      contentDoc.getElementsByTagName("head")[0].appendChild(stylesheet);
    }
  }

  function preloadImages(urls) {
    var length = urls.length,
      images = [];

    for (var i = 0; i < length; i++) {
      images[i] = new Image();
      images[i].src = urls[i];
    }
  }

  function getQueryParameter(param) {
    var query = window.location.search.substring(1),
      vars = query.split("&"),
      pair;

    for (var i = 0; i < vars.length; i++) {
      pair = vars[i].split("=");

      if (pair[0] == param) {
        return decodeURIComponent(pair[1]);
      }
    }

    return "";
  }

  function getRiseCacheErrorMessage(statusCode) {
    var errorMessage = "";
    switch (statusCode) {
      case 404:
        errorMessage = "The file does not exist or cannot be accessed.";
        break;
      case 507:
        errorMessage = "There is not enough disk space to save the file on Rise Cache.";
        break;
      default:
        errorMessage = "There was a problem retrieving the file from Rise Cache.";
    }

    return errorMessage;
  }

  function unescapeHTML(html) {
    var div = document.createElement("div");

    div.innerHTML = html;

    return div.textContent;
  }

  return {
    getQueryParameter: getQueryParameter,
    getFontCssStyle:  getFontCssStyle,
    addCSSRules:      addCSSRules,
    loadFonts:        loadFonts,
    loadCustomFont:   loadCustomFont,
    loadGoogleFont:   loadGoogleFont,
    preloadImages:    preloadImages,
    getRiseCacheErrorMessage: getRiseCacheErrorMessage,
    unescapeHTML: unescapeHTML
  };
})();

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.RiseCache = (function () {
  "use strict";

  var BASE_CACHE_URL = "//localhost:9494/";

  var _pingReceived = false,
    _isCacheRunning = false;

  function ping(callback) {
    var r = new XMLHttpRequest();

    if (!callback || typeof callback !== "function") {
      return;
    }

    r.open("GET", BASE_CACHE_URL + "ping?callback=_", true);
    r.onreadystatechange = function () {
      try {
        if (r.readyState === 4 ) {
          // save this result for use in getFile()
          _pingReceived = true;

          if(r.status === 200){
            _isCacheRunning = true;

            callback(true, r.responseText);
          } else {
            console.debug("Rise Cache is not running");
            _isCacheRunning = false;

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

  function getFile(fileUrl, callback, nocachebuster) {
    if (!fileUrl || !callback || typeof callback !== "function") {
      return;
    }

    function fileRequest() {
      var url, str, separator;

      if (_isCacheRunning) {
        // configure url with cachebuster or not
        url = (nocachebuster) ? BASE_CACHE_URL + "?url=" + encodeURIComponent(fileUrl) :
        BASE_CACHE_URL + "cb=" + new Date().getTime() + "?url=" + encodeURIComponent(fileUrl);
      } else {
        if (nocachebuster) {
          url = fileUrl;
        } else {
          str = fileUrl.split("?");
          separator = (str.length === 1) ? "?" : "&";
          url = fileUrl + separator + "cb=" + new Date().getTime();
        }
      }

      makeRequest("HEAD", url);
    }

    function makeRequest(method, url) {
      var xhr = new XMLHttpRequest(),
        request = {
          xhr: xhr,
          url: url
        };

      if (_isCacheRunning) {
        xhr.open(method, url, true);

        xhr.addEventListener("loadend", function () {
          var status = xhr.status || 0;

          if (status >= 200 && status < 300) {
            callback(request);
          } else {
            // Server may not support HEAD request. Fallback to a GET request.
            if (method === "HEAD") {
              makeRequest("GET", url);
            } else {
              callback(request, new Error("The request failed with status code: " + status));
            }
          }
        });

        xhr.send();
      }
      else {
        // Rise Cache is not running (preview), skip HEAD request and execute callback immediately
        callback(request);
      }

    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(fileRequest);
    } else {
      return fileRequest();
    }

  }

  function isRiseCacheRunning(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isCacheRunning);
      });
    } else {
      callback(_isCacheRunning);
    }
  }

  return {
    getFile: getFile,
    isRiseCacheRunning: isRiseCacheRunning,
    ping: ping
  };

})();

/* exported config */
if (typeof angular !== "undefined") {
  angular.module("risevision.common.i18n.config", [])
    .constant("LOCALES_PREFIX", "locales/translation_")
    .constant("LOCALES_SUFIX", ".json");
}

var  config = {
  STORAGE_ENV: "prod"
};

/* global gadgets, _ */

var RiseVision = RiseVision || {};
RiseVision.Video = {};

RiseVision.Video = (function (window, gadgets) {
  "use strict";

  var _additionalParams, _mode;

  var _isLoading = true,
    _configDetails = null;

  var _prefs = null,
    _storage = null,
    _nonStorage = null,
    _message = null,
    _frameController = null,
    _windowController = null;

  var _viewerPaused = true;

  var _resume = true;

  var _currentFrame = 0;

  var _currentFiles = [];

  var _currentPlaylistIndex = null;

  var _errorLog = null,
    _errorTimer = null,
    _errorFlag = false;

  var _storageErrorFlag = false;

  /*
   *  Private Methods
   */
  function _done() {
    gadgets.rpc.call("", "rsevent_done", null, _prefs.getString("id"));

    // Any errors need to be logged before the done event.
    if (_errorLog !== null) {
      logEvent(_errorLog, true);
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

  function _getCurrentFile() {
    if (_currentFiles && _currentFiles.length > 0) {
      if (_mode === "file") {
        return _currentFiles[0];
      }
      else if (_mode === "folder") {
        // retrieve the currently played file
        if (_currentPlaylistIndex) {
          return _currentFiles[_currentPlaylistIndex];
        }
      }
    }

    return null;
  }

  /*
   *  Public Methods
   */
  function hasStorageError() {
    return _storageErrorFlag;
  }

  function showError(message, isStorageError) {
    _errorFlag = true;
    _storageErrorFlag = typeof isStorageError !== "undefined";

    _message.show(message);

    _currentPlaylistIndex = null;
    _frameController.remove(_currentFrame, _windowController.getFrameOrigin(), function () {
      // if Widget is playing right now, run the timer
      if (!_viewerPaused) {
        _startErrorTimer();
      }
    });
  }

  function logEvent(params, isError) {
    if (isError) {
      _errorLog = params;
    }

    if (!params.file_url) {
      params.file_url = _getCurrentFile();
    }

    RiseVision.Common.LoggerUtils.logEvent(getTableName(), params);
  }

  function onFileInit(urls) {
    if (_mode === "file") {
      // urls value will be a string
      _currentFiles[0] = urls;
    } else if (_mode === "folder") {
      // urls value will be an array
      _currentFiles = urls;
    }

    _message.hide();

    if (!_viewerPaused) {
      play();
    }
  }

  function onFileRefresh(urls) {
    if (_mode === "file") {
      // urls value will be a string of one url
      _currentFiles[0] = urls;
    } else if (_mode === "folder") {
      // urls value will be an array of urls
      _currentFiles = urls;
    }

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _errorFlag = false;
    _storageErrorFlag = false;
    _errorLog = null;
  }

  function pause() {
    var frameObj = _frameController.getFrameObject(_currentFrame);

    _viewerPaused = true;

    // in case error timer still running (no conditional check on errorFlag, it may have been reset in onFileRefresh)
    _clearErrorTimer();

    if (frameObj) {
      // Destroy player iframe.
      if (!_resume) {
        _currentPlaylistIndex = null;
        _frameController.remove(_currentFrame, _windowController.getFrameOrigin());
      }
      else {
        frameObj.postMessage({event: "pause"}, _windowController.getFrameOrigin());
      }
    }
  }

  function play() {
    var logParams = {},
      frameObj = _frameController.getFrameObject(_currentFrame),
      html;

    if (_isLoading) {
      _isLoading = false;

      // Log configuration event.
      logParams.event = "configuration";
      logParams.event_details = _configDetails;
      logEvent(logParams, false);
    }

    _viewerPaused = false;

    logEvent({ "event": "play" }, false);

    if (_errorFlag) {
      _startErrorTimer();
      return;
    }

    if (frameObj) {
      frameObj.postMessage({event: "play"}, _windowController.getFrameOrigin());
    } else {

      if (_currentFiles && _currentFiles.length > 0) {

        RiseVision.Common.RiseCache.isRiseCacheRunning(function (isRunning) {
          if (_mode === "file") {
            html = (isRunning) ? "//localhost:9494/?url=" +
            encodeURIComponent(_windowController.getBucketPath()) + "player-file-cache.html" : "player-file.html";

            // add frame and create the player
            _frameController.add(0);
            _frameController.createFramePlayer(0, _additionalParams, _currentFiles[0], html, _windowController.getFrameOrigin());
          }
          else if (_mode === "folder") {
            html = (isRunning) ? "//localhost:9494/?url=" +
            encodeURIComponent(_windowController.getBucketPath()) + "player-folder-cache.html" : "player-folder.html";

            _frameController.add(0);
            _frameController.createFramePlayer(0, _additionalParams, _currentFiles, html, _windowController.getFrameOrigin());
          }
        });
      }

    }
  }

  function getTableName() {
    return "video_events";
  }

  function playerEnded() {
    _currentPlaylistIndex = null;
    _frameController.remove(_currentFrame, _windowController.getFrameOrigin(), function () {
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
        frameObj.postMessage({event: "play"}, _windowController.getFrameOrigin());
      }
    }
  }

  function playerItemChange(index) {
    _currentPlaylistIndex = index;
  }

  function setAdditionalParams(params, mode) {
    var isStorageFile;

    _additionalParams = _.clone(params);
    _mode = mode;
    _prefs = new gadgets.Prefs();

    document.getElementById("videoContainer").style.height = _prefs.getInt("rsH") + "px";

    _additionalParams.width = _prefs.getInt("rsW");
    _additionalParams.height = _prefs.getInt("rsH");

    if (_additionalParams.video.hasOwnProperty("resume")) {
      _resume = _additionalParams.video.resume;
    }

    _message = new RiseVision.Common.Message(document.getElementById("videoContainer"),
      document.getElementById("messageContainer"));

    // show wait message while Storage initializes
    _message.show("Please wait while your video is downloaded.");

    _windowController = new RiseVision.Video.WindowController();
    _windowController.init();

    _frameController = new RiseVision.Video.FrameController();

    if (_mode === "file") {
      isStorageFile = (Object.keys(_additionalParams.storage).length !== 0);

      if (!isStorageFile) {
        _configDetails = "custom";

        _nonStorage = new RiseVision.Video.NonStorage(_additionalParams);
        _nonStorage.init();
      } else {
        _configDetails = "storage file";

        // create and initialize the Storage file instance
        _storage = new RiseVision.Video.StorageFile(_additionalParams);
        _storage.init();
      }
    }
    else if (_mode === "folder") {
      _configDetails = "storage folder";

      // create and initialize the Storage folder instance
      _storage = new RiseVision.Video.StorageFolder(_additionalParams);
      _storage.init();
    }

    _ready();
  }

  // An error occurred with JW Player.
  function playerError(error) {
    var details = null,
      params = {},
      message = "Sorry, there was a problem playing the video.",
      MEDIA_ERROR = "Error loading media: File could not be played",
      YOUTUBE_ERROR = "Error loading YouTube: Video could not be played",
      PLAYER_ERROR = "Error loading player: No playable sources found",
      ENCODING_MESSAGE = "There was a problem playing that video. It could be that we don't " +
        "support that format or it is not encoded correctly.",
      FORMAT_MESSAGE = "The format of that video is not supported";

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

      // Display appropriate on-screen error message.
      if (error.message) {
        if ((error.message === MEDIA_ERROR) || (error.message === YOUTUBE_ERROR)) {
          message = ENCODING_MESSAGE;
        }
        else if (error.message === PLAYER_ERROR) {
          message = FORMAT_MESSAGE;
        }
      }
    }

    params.event = "player error";
    params.event_details = details;

    logEvent(params, true);
    showError(message);
  }

  function stop() {
    pause();
  }

  return {
    "getTableName": getTableName,
    "hasStorageError": hasStorageError,
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
    "playerItemChange": playerItemChange,
    "stop": stop
  };

})(window, gadgets);

/* global config */

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFile = function (data) {
  "use strict";

  var _initialLoad = true;

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById("videoStorage");

    if (!storage) {
      return;
    }

    storage.addEventListener("rise-storage-response", function(e) {
      if (e.detail && e.detail.url) {

        if (_initialLoad) {
          _initialLoad = false;

          RiseVision.Video.onFileInit(e.detail.url);
        }
        else {
          // check for "changed" property
          if (e.detail.hasOwnProperty("changed")) {
            if (e.detail.changed) {
              RiseVision.Video.onFileRefresh(e.detail.url);
            }
            else {
              // in the event of a network failure and recovery, check if the Widget is in a state of storage error
              if (RiseVision.Video.hasStorageError()) {
                // proceed with refresh logic so the Widget can eventually play video again from a network recovery
                RiseVision.Video.onFileRefresh(e.detail.url);
              }
            }
          }
        }
      }
    });

    storage.addEventListener("rise-storage-api-error", function(e) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Sorry, there was a problem communicating with Rise Storage.");
    });

    storage.addEventListener("rise-storage-no-file", function(e) {
      var params = { "event": "storage file not found", "event_details": e.detail };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("The selected video does not exist or has been moved to Trash.");
    });

    storage.addEventListener("rise-storage-file-throttled", function(e) {
      var params = { "event": "storage file throttled", "file_url": e.detail };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("The selected video is temporarily unavailable.");
    });

    storage.addEventListener("rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired" };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Rise Storage subscription is not active.");
    });

    storage.addEventListener("rise-storage-error", function(e) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Sorry, there was a problem communicating with Rise Storage.", true);
    });

    storage.addEventListener("rise-cache-error", function(e) {
      var params = {
        "event": "rise cache error",
        "event_details": e.detail.error.message
      };

      RiseVision.Video.logEvent(params, true);

      var statusCode = 0;
      // Show a different message if there is a 404 coming from rise cache
      if(e.detail.error.message){
        statusCode = +e.detail.error.message.substring(e.detail.error.message.indexOf(":")+2);
      }

      var errorMessage = RiseVision.Common.Utilities.getRiseCacheErrorMessage(statusCode);
      RiseVision.Video.showError(errorMessage);
    });

    storage.addEventListener("rise-cache-not-running", function(e) {

      var params = {
        "event": "rise cache not running",
        "event_details": (e.detail && e.detail.error)? e.detail.error.message: ""
      };

      RiseVision.Video.logEvent(params, true);
    });


    storage.setAttribute("folder", data.storage.folder);
    storage.setAttribute("fileName", data.storage.fileName);
    storage.setAttribute("companyId", data.storage.companyId);
    storage.setAttribute("env", config.STORAGE_ENV);
    storage.go();
  }

  return {
    "init": init
  };
};

/* global config, _ */

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFolder = function (data) {
  "use strict";

  var _initialLoad = true;

  var _files = [];

  function _getUrls() {
    return _.pluck(_files, "url");
  }

  function _getExistingFile(file) {
    return _.find(_files, function (f) {
      return file.name === f.name;
    });
  }

  function _deleteFile(file) {
    var existing = _getExistingFile(file);

    if (existing) {
      _files.splice(_files.indexOf(existing), 1);
    }
  }

  function _changeFile(file) {
    var existing = _getExistingFile(file);

    if (existing) {
      existing.url = file.url;
    }
  }

  function _addFile(file) {
    var existing = _getExistingFile(file);

    if (!existing) {
      // extract the actual file name and store in new property on file object
      file.fileName = file.name.slice(file.name.lastIndexOf("/") + 1, file.name.lastIndexOf(".")).toLowerCase();

      // insert file to _files list at specific index based on alphabetical order of file name
      _files.splice(_.sortedIndex(_files, file, "fileName"), 0, file);
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById("videoStorage");

    if (!storage) {
      return;
    }

    storage.addEventListener("rise-storage-response", function(e) {
      var file = e.detail;

      // Added
      if(file.added) {
        _addFile(file);

        if (_initialLoad) {
          _initialLoad = false;
          RiseVision.Video.onFileInit(_getUrls());

          return;
        }
      }

      // Changed or unchanged
      if (file.hasOwnProperty("changed")) {
        if(file.changed) {
          _changeFile(file);
        }
        else {
          // in the event of a network failure and recovery, check if the Widget is in a state of storage error
          if (!RiseVision.Video.hasStorageError()) {
            // only proceed with refresh logic below if there's been a storage error, otherwise do nothing
            // this is so the Widget can eventually play video again from a network recovery
            return;
          }
        }
      }

      // Deleted
      if(file.deleted) {
        _deleteFile(file);
      }

      RiseVision.Video.onFileRefresh(_getUrls());

    });

    storage.addEventListener("rise-storage-api-error", function(e) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Sorry, there was a problem communicating with Rise Storage.");
    });

    storage.addEventListener("rise-storage-empty-folder", function () {
      var params = { "event": "storage folder empty" };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("The selected folder does not contain any videos.");
    });

    storage.addEventListener("rise-storage-no-folder", function (e) {
      var params = { "event": "storage folder doesn't exist", "event_details": e.detail };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("The selected folder does not exist or has been moved to Trash.");
    });

    storage.addEventListener("rise-storage-folder-invalid", function () {
      var params = { "event": "storage folder format(s) invalid" };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("The selected folder does not contain any supported video formats.");
    });

    storage.addEventListener("rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired" };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Rise Storage subscription is not active.");
    });

    storage.addEventListener("rise-storage-error", function(e) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent(params, true);
      RiseVision.Video.showError("Sorry, there was a problem communicating with Rise Storage.", true);
    });

    storage.addEventListener("rise-cache-error", function(e) {
      var params = {
        "event": "rise cache error",
        "event_details": e.detail.error.message
      };

      RiseVision.Video.logEvent(params, true);

      var statusCode = 0;
      // Show a different message if there is a 404 coming from rise cache
      if(e.detail.error.message){
        statusCode = +e.detail.error.message.substring(e.detail.error.message.indexOf(":")+2);
      }

      var errorMessage = RiseVision.Common.Utilities.getRiseCacheErrorMessage(statusCode);
      RiseVision.Video.showError(errorMessage);
    });

    storage.addEventListener("rise-cache-not-running", function(e) {

      var params = {
        "event": "rise cache not running",
        "event_details": (e.detail && e.detail.error)? e.detail.error.message: ""
      };

      RiseVision.Video.logEvent(params, true);
    });

    storage.setAttribute("fileType", "video");
    storage.setAttribute("companyId", data.storage.companyId);
    storage.setAttribute("folder", data.storage.folder);
    storage.setAttribute("env", config.STORAGE_ENV);

    storage.go();
  }

  return {
    "init": init
  };
};

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.NonStorage = function (data) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache;

  var _refreshDuration = 900000,  // 15 minutes
    _refreshIntervalId = null;

  var _isLoading = true;

  var _url = "";

  function _getFile(omitCacheBuster) {
    riseCache.getFile(_url, function (response, error) {
      if (!error) {

        if (_isLoading) {
          _isLoading = false;

          RiseVision.Video.onFileInit(response.url);

          // start the refresh interval
          _startRefreshInterval();

        } else {
          RiseVision.Video.onFileRefresh(response.url);
        }

      } else {
        // error occurred
        RiseVision.Video.logEvent({
          "event": "non-storage error",
          "event_details": error.message,
          "file_url": response.url
        }, true);

        var statusCode = 0;
        // Show a different message if there is a 404 coming from rise cache
        if(error.message){
          statusCode = +error.message.substring(error.message.indexOf(":")+2);
        }

        var errorMessage = RiseVision.Common.Utilities.getRiseCacheErrorMessage(statusCode);
        RiseVision.Video.showError(errorMessage);
      }
    }, omitCacheBuster);
  }

  function _startRefreshInterval() {
    if (_refreshIntervalId === null) {
      _refreshIntervalId = setInterval(function () {
        _getFile(false);
      }, _refreshDuration);
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    // Handle pre-merge use of "url" setting property
    _url = (data.url && data.url !== "") ? data.url : data.selector.url;

    _getFile(true);
  }

  return {
    "init": init
  };
};

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.WindowController = function () {
  "use strict";

  var _bucketPath = "",
    _frameOrigin = "";

  /*
   *  Private Methods
   */
  function _setBucketPath() {
    var pathArray = window.location.pathname.split( "/"),
      host = window.location.host,
      protocol = window.location.protocol;

    _bucketPath = protocol + "//" + host + "/";

    for (var i = 0; i < pathArray.length; i += 1) {
      if (pathArray[i] !== "") {
        _bucketPath += pathArray[i] + "/";

        if (pathArray[i] === "dist") {
          break;
        }
      }
    }
  }

  function _setFrameOrigin() {
    // widget-preview app (local)
    if (window.location.host === "localhost:8000") {
      _frameOrigin = "http://localhost:8000";
    }
    else if (window.location.host === "s3.amazonaws.com") {
      RiseVision.Common.RiseCache.isRiseCacheRunning(function (isRunning) {

        if (isRunning) {
          // running in player, origin should be Rise Cache
          _frameOrigin = "http://localhost:9494";

          // set the bucket path as Video module will need it when Rise Cache is running
          _setBucketPath();
        }
        else {
          // running in preview (browser)
          _frameOrigin = "http://s3.amazonaws.com";
        }
      });
    }
  }

  function _setMessageReceiver() {

    window.addEventListener("message", function (event) {
      var origin = event.origin || event.originalEvent.origin;

      // ensure this message is coming from either Rise Cache, Amazon S3 (preview), or preview app (local)
      if (origin !== "http://localhost:9494" && origin !== "http://s3.amazonaws.com" && origin !== "http://localhost:8000") {
        origin = null;
        return;
      }

      if (event.data && typeof event.data === "object" && event.data.event) {
        switch (event.data.event) {
          case "playerEnded":
            RiseVision.Video.playerEnded();
            break;
          case "playerError":
            RiseVision.Video.playerError(event.data.error);
            break;
          case "playerItemChange":
            RiseVision.Video.playerItemChange(event.data.index);
            break;
          case "playerReady":
            RiseVision.Video.playerReady();
            break;
        }
      }
    });

  }

  /*
   *  Public Methods
   */
  function getBucketPath() {
    return _bucketPath;
  }

  function getFrameOrigin() {
    return _frameOrigin;
  }

  function init() {
    _setFrameOrigin();
    _setMessageReceiver();
  }

  return {
    getBucketPath: getBucketPath,
    getFrameOrigin: getFrameOrigin,
    init: init
  };

};

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.FrameController = function () {
  "use strict";

  var PREFIX = "if_";

  function getFrameContainer(index) {
    return document.getElementById(PREFIX + index);
  }

  function getFrameObject(index) {
    var frameContainer = getFrameContainer(index),
      iframe;

    iframe = frameContainer.querySelector("iframe");

    if (iframe) {
      return (iframe.contentWindow) ? iframe.contentWindow :
        (iframe.contentDocument.document) ? iframe.contentDocument.document : iframe.contentDocument;
    }

    return null;
  }

  function _clear(index, origin) {
    var frameContainer = getFrameContainer(index),
      frameObj = getFrameObject(index),
      iframe;

    if (frameObj) {
      iframe = frameContainer.querySelector("iframe");
      frameObj.postMessage({event: "remove"}, origin);
      iframe.setAttribute("src", "about:blank");
    }
  }

  function add(index) {
    var frameContainer = getFrameContainer(index),
      iframe = document.createElement("iframe");

    iframe.setAttribute("allowTransparency", true);
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");

    frameContainer.appendChild(iframe);
  }

  function createFramePlayer(index, params, files, src, origin) {
    var frameContainer = getFrameContainer(index),
      frameObj = getFrameObject(index),
      iframe;

    if (frameObj) {
      iframe = frameContainer.querySelector("iframe");

      iframe.onload = function () {
        iframe.onload = null;

        // initialize and load the player inside the iframe
        frameObj.postMessage({event: "init", params: params, files: files}, origin);
      };

      iframe.setAttribute("src", src);
    }

  }

  function hide(index) {
    var frameContainer = getFrameContainer(index);

    frameContainer.style.visibility = "hidden";
  }

  function remove(index, origin, callback) {
    var frameContainer = document.getElementById(PREFIX + index);

    _clear(index, origin);

    setTimeout(function () {
      // remove the iframe by clearing all elements inside div container
      while (frameContainer.firstChild) {
        frameContainer.removeChild(frameContainer.firstChild);
      }

      if (callback && typeof callback === "function") {
        callback();
      }
    }, 200);
  }

  function show(index) {
    var frameContainer = getFrameContainer(index);

    frameContainer.style.visibility = "visible";
  }

  return {
    add: add,
    createFramePlayer: createFramePlayer,
    getFrameContainer: getFrameContainer,
    getFrameObject: getFrameObject,
    hide: hide,
    remove: remove,
    show: show
  };
};

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Message = function (mainContainer, messageContainer) {
  "use strict";

  var _active = false;

  function _init() {
    try {
      messageContainer.style.height = mainContainer.style.height;
    } catch (e) {
      console.warn("Can't initialize Message - ", e.message);
    }
  }

  /*
   *  Public Methods
   */
  function hide() {
    if (_active) {
      // clear content of message container
      while (messageContainer.firstChild) {
        messageContainer.removeChild(messageContainer.firstChild);
      }

      // hide message container
      messageContainer.style.display = "none";

      // show main container
      mainContainer.style.visibility = "visible";

      _active = false;
    }
  }

  function show(message) {
    var fragment = document.createDocumentFragment(),
      p;

    if (!_active) {
      // hide main container
      mainContainer.style.visibility = "hidden";

      messageContainer.style.display = "block";

      // create message element
      p = document.createElement("p");
      p.innerHTML = message;
      p.setAttribute("class", "message");

      fragment.appendChild(p);
      messageContainer.appendChild(fragment);

      _active = true;
    } else {
      // message already being shown, update message text
      p = messageContainer.querySelector(".message");
      p.innerHTML = message;
    }
  }

  _init();

  return {
    "hide": hide,
    "show": show
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

  function configure(names, values) {
    var additionalParams = null,
      mode = "",
      companyId = "",
      displayId = "";

    if (Array.isArray(names) && names.length > 0 && Array.isArray(values) && values.length > 0) {
      if (names[0] === "companyId") {
        companyId = values[0];
      }

      if (names[1] === "displayId") {
        if (values[1]) {
          displayId = values[1];
        }
        else {
          displayId = "preview";
        }
      }

      RiseVision.Common.LoggerUtils.setIds(companyId, displayId);

      if (names[2] === "additionalParams") {
        additionalParams = JSON.parse(values[2]);

        if (Object.keys(additionalParams.storage).length !== 0) {
          // storage file or folder selected
          if (!additionalParams.storage.fileName) {
            // folder was selected
            mode = "folder";
          } else {
            // file was selected
            mode = "file";
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }

        RiseVision.Video.setAdditionalParams(additionalParams, mode);
      }
    }
  }

  function play() {
    RiseVision.Video.play();
  }

  function pause() {
    RiseVision.Video.pause();
  }

  function stop() {
    RiseVision.Video.stop();
  }

  function polymerReady() {
    window.removeEventListener("WebComponentsReady", polymerReady);

    if (id && id !== "") {
      gadgets.rpc.register("rscmd_play_" + id, play);
      gadgets.rpc.register("rscmd_pause_" + id, pause);
      gadgets.rpc.register("rscmd_stop_" + id, stop);

      gadgets.rpc.register("rsparam_set_" + id, configure);
      gadgets.rpc.call("", "rsparam_get", null, id, ["companyId", "displayId", "additionalParams"]);
    }
  }

  window.addEventListener("WebComponentsReady", polymerReady);

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

/* exported WIDGET_COMMON_CONFIG */
var WIDGET_COMMON_CONFIG = {
  AUTH_PATH_URL: "v1/widget/auth",
  LOGGER_CLIENT_ID: "1088527147109-6q1o2vtihn34292pjt4ckhmhck0rk0o7.apps.googleusercontent.com",
  LOGGER_CLIENT_SECRET: "nlZyrcPLg6oEwO9f9Wfn29Wh",
  LOGGER_REFRESH_TOKEN: "1/xzt4kwzE1H7W9VnKB8cAaCx6zb4Es4nKEoqaYHdTD15IgOrJDtdun6zK6XiATCKT",
  STORE_URL: "https://store-dot-rvaserver2.appspot.com/"
};
/* global WIDGET_COMMON_CONFIG */

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.LoggerUtils = (function() {
  "use strict";

   var displayId = "",
     companyId = "",
     version = null;

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

      if (version) {
        json.version = version;
      }

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

  function setVersion(value) {
    version = value;
  }

  return {
    "getInsertData": getInsertData,
    "getFileFormat": getFileFormat,
    "logEvent": logEvent,
    "setIds": setIds,
    "setVersion": setVersion
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
/* global WebFont */

var RiseVision = RiseVision || {};

RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Utilities = (function() {

  function getFontCssStyle(className, fontObj) {
    var family = "font-family: " + decodeURIComponent(fontObj.font.family).replace(/'/g, "") + "; ";
    var color = "color: " + (fontObj.color ? fontObj.color : fontObj.forecolor) + "; ";
    var size = "font-size: " + (fontObj.size.indexOf("px") === -1 ? fontObj.size + "px; " : fontObj.size + "; ");
    var weight = "font-weight: " + (fontObj.bold ? "bold" : "normal") + "; ";
    var italic = "font-style: " + (fontObj.italic ? "italic" : "normal") + "; ";
    var underline = "text-decoration: " + (fontObj.underline ? "underline" : "none") + "; ";
    var highlight = "background-color: " + (fontObj.highlightColor ? fontObj.highlightColor : fontObj.backcolor) + ";";

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
  function loadFonts(settings, cb) {
    var families = null,
      googleFamilies = [],
      customFamilies = [],
      customUrls = [];

    function callback() {
      if (cb && typeof cb === "function") {
        cb();
      }
    }

    function onGoogleFontsLoaded() {
      callback();
    }

    if (!settings || settings.length === 0) {
      callback();
      return;
    }

    // Check for custom css class names and add rules if so
    settings.forEach(function(item) {
      if (item.class && item.fontStyle) {
        addCSSRules([ getFontCssStyle(item.class, item.fontStyle) ]);
      }
    });

    // Google fonts
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "google")) {
        // Remove fallback font.
        families = settings[i].fontStyle.font.family.split(",")[0];

        // strip possible single quotes
        families = families.replace(/'/g, "");

        googleFamilies.push(families);
      }
    }

    // Custom fonts
    for (i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "custom")) {
        // decode value and strip single quotes
        customFamilies.push(decodeURIComponent(settings[i].fontStyle.font.family).replace(/'/g, ""));
        // strip single quotes
        customUrls.push(settings[i].fontStyle.font.url.replace(/'/g, "\\'"));
      }
    }

    if (googleFamilies.length === 0 && customFamilies.length === 0) {
      callback();
    }
    else {
      // Load the fonts
      for (var j = 0; j < customFamilies.length; j += 1) {
        loadCustomFont(customFamilies[j], customUrls[j]);
      }

      if (googleFamilies.length > 0) {
        loadGoogleFonts(googleFamilies, onGoogleFontsLoaded);
      }
      else {
        callback();
      }
    }
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

  function loadGoogleFonts(families, cb) {
    WebFont.load({
      google: {
        families: families
      },
      active: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      inactive: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      timeout: 2000
    });
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

      if (pair[0] == param) { // jshint ignore:line
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

  function hasInternetConnection(filePath, callback) {
    var xhr = new XMLHttpRequest();

    if (!filePath || !callback || typeof callback !== "function") {
      return;
    }

    xhr.open("HEAD", filePath + "?cb=" + new Date().getTime(), false);

    try {
      xhr.send();

      callback((xhr.status >= 200 && xhr.status < 304));

    } catch (e) {
      callback(false);
    }
  }

  /**
   * Check if chrome version is under a certain version
   */
  function isLegacy() {
    var legacyVersion = 25;

    var match = navigator.userAgent.match(/Chrome\/(\S+)/);
    var version = match ? match[1] : 0;

    if (version) {
      version = parseInt(version.substring(0,version.indexOf(".")));

      if (version <= legacyVersion) {
        return true;
      }
    }

    return false;
  }

  return {
    getQueryParameter: getQueryParameter,
    getFontCssStyle:  getFontCssStyle,
    addCSSRules:      addCSSRules,
    loadFonts:        loadFonts,
    loadCustomFont:   loadCustomFont,
    loadGoogleFonts:   loadGoogleFonts,
    preloadImages:    preloadImages,
    getRiseCacheErrorMessage: getRiseCacheErrorMessage,
    unescapeHTML: unescapeHTML,
    hasInternetConnection: hasInternetConnection,
    isLegacy: isLegacy
  };
})();

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.RiseCache = (function () {
  "use strict";

  var BASE_CACHE_URL = "//localhost:9494/";

  var _pingReceived = false,
    _isCacheRunning = false,
    _isV2Running = false;

  function ping(callback) {
    var r = new XMLHttpRequest(),
      /* jshint validthis: true */
      self = this;

    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_isV2Running) {
      r.open("GET", BASE_CACHE_URL + "ping?callback=_", true);
    }
    else {
      r.open("GET", BASE_CACHE_URL, true);
    }

    r.onreadystatechange = function () {
      try {
        if (r.readyState === 4 ) {
          // save this result for use in getFile()
          _pingReceived = true;

          if(r.status === 200) {
            _isCacheRunning = true;

            callback(true, r.responseText);
          } else if (r.status === 404) {
            // Rise Cache V2 is running
            _isV2Running = true;

            // call ping again so correct ping URL is used for Rise Cache V2
            return self.ping(callback);
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

  function isV2Running(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isV2Running);
      });
    }
    else {
      callback(_isV2Running);
    }
  }

  return {
    getFile: getFile,
    isRiseCacheRunning: isRiseCacheRunning,
    isV2Running: isV2Running,
    ping: ping
  };

})();

/* exported version */
var version = "1.1.0";
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
    _player = null;

  var _viewerPaused = true;

  var _resume = true;

  var _currentFiles = [];

  var _currentPlaylistIndex = null;

  var _errorLog = null,
    _errorTimer = null,
    _errorFlag = false;

  var _storageErrorFlag = false,
    _playerErrorFlag = false;

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
        if (_currentPlaylistIndex) {
          // retrieve the currently played file
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

  function hasPlayerError() {
    return _playerErrorFlag;
  }

  function showError(message, isStorageError) {
    _errorFlag = true;
    _storageErrorFlag = typeof isStorageError !== "undefined";

    _message.show(message);

    _currentPlaylistIndex = null;

    // if Widget is playing right now, run the timer
    if (!_viewerPaused) {
      _startErrorTimer();
    }

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

    if (_player) {
      _player.update(_currentFiles);  
    }

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _errorFlag = false;
    _playerErrorFlag = false;
    _storageErrorFlag = false;
    _errorLog = null;
  }

  function pause() {

    _viewerPaused = true;

    // in case error timer still running (no conditional check on errorFlag, it may have been reset in onFileRefresh)
    _clearErrorTimer();

    if (_player) {
      if (!_resume) {
        _currentPlaylistIndex = null;
        _player.reset();
      }
      else {
        _player.pause();
      }
    }

  }

  function play() {
    if (_isLoading) {
      _isLoading = false;

      // Log configuration event.
      logEvent({
        event: "configuration",
        event_details: _configDetails
      }, false);
    }

    _viewerPaused = false;

    logEvent({ "event": "play" }, false);

    if (_errorFlag) {
      _startErrorTimer();
      return;
    }

    if (_player) {
      // Ensures possible error messaging gets hidden and video gets shown
      _message.hide();

      _player.play();
    }
    else {
      if (_currentFiles && _currentFiles.length > 0) {
        _player = new RiseVision.Video.Player(_additionalParams, _mode);
        _player.init(_currentFiles);
      }
    }

  }

  function getTableName() {
    return "video_v2_events";
  }

  function playerEnded() {
    _currentPlaylistIndex = null;

    _done();
  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if (!_viewerPaused && _player) {
      _player.play();
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

    document.getElementById("container").style.width = _prefs.getInt("rsW") + "px";
    document.getElementById("container").style.height = _prefs.getInt("rsH") + "px";

    _additionalParams.width = _prefs.getInt("rsW");
    _additionalParams.height = _prefs.getInt("rsH");

    if (_additionalParams.video.hasOwnProperty("resume")) {
      _resume = _additionalParams.video.resume;
    }

    _message = new RiseVision.Common.Message(document.getElementById("container"),
      document.getElementById("messageContainer"));

    if (RiseVision.Common.Utilities.isLegacy()) {
      showError("This version of Video Widget is not supported on this version of Rise Player. " +
        "Please use the latest Rise Player version available at https://help.risevision.com/user/create-a-display");
    } else {
      // show wait message while Storage initializes
      _message.show("Please wait while your video is downloaded.");

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
      PLAYER_ERROR = "Error loading player: No media sources found",
      PLAYLIST_ERROR = "Error loading playlist: No playable sources found",
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
        else if (error.message === PLAYER_ERROR || error.message === PLAYLIST_ERROR) {
          message = FORMAT_MESSAGE;
        }
      }
    }

    params.event = "player error";
    params.event_details = details;
    _playerErrorFlag = true;

    logEvent(params, true);
    showError(message);
  }

  function stop() {
    pause();
  }

  return {
    "getTableName": getTableName,
    "hasPlayerError": hasPlayerError,
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

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerUtils = (function () {
  "use strict";

  /*
   *  Public  Methods
   */
  function getPlaylist (list) {
    /*jshint validthis:true */
    
    var playlist = [];

    for (var i = 0; i < list.length; i += 1) {
      playlist.push({
        file: list[i],
        type: this.getVideoFileType(list[i])
      });
    }

    return playlist;
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

  return {
    "getPlaylist": getPlaylist,
    "getVideoFileType": getVideoFileType
  };

})();

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
              if (RiseVision.Video.hasStorageError() || RiseVision.Video.hasPlayerError()) {
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

    storage.addEventListener("rise-storage-subscription-error", function(e) {
      var params = { 
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent(params, true);
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
          if (!RiseVision.Video.hasStorageError() && !RiseVision.Video.hasPlayerError()) {
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

    storage.addEventListener("rise-storage-subscription-error", function(e) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent(params, true);
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

/* global jwplayer */

var RiseVision = RiseVision || {};
RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.Player = function (params) {
  "use strict";

  var _autoPlay, _stretching, _pauseDuration;

  var _playerInstance = null;

  var _utils = RiseVision.Video.PlayerUtils;

  var _viewerPaused = false,
    _pauseTimer = null;

  var _files = null,
    _updateWaiting = false;

  /*
   *  Private Methods
   */
  function _onComplete() {
    RiseVision.Video.playerEnded();
  }

  function _onPause() {
    if (!_viewerPaused) {
      // user has paused, set a timer to play again
      clearTimeout(_pauseTimer);

      _pauseTimer = setTimeout(function () {
        if (_playerInstance.getState().toUpperCase() !== "PLAYING") {
          // continue playing the current video
          _playerInstance.play();
        }
      }, _pauseDuration * 1000);
    }
  }

  function _onPlaylistItem(index) {
    RiseVision.Video.playerItemChange(index);
  }

  function _onPlayerError(error) {
    if (error) {
      RiseVision.Video.playerError({
        type: "video",
        message: error.message
      });
    }
  }

  function _onSetupError(error) {
    if (error) {
      RiseVision.Video.playerError({
        type: "setup",
        message: error.message
      });
    }
  }

  function _configureHandlers() {
    //var playFn = play;

    // handle a JWPlayer setup error
    _playerInstance.on("setupError", function (error) {
      _onSetupError(error);
    });

    // handle when JWPlayer is ready
    _playerInstance.on("ready", function() {

      _playerInstance.on("playlistComplete", function () {
        _onComplete();
      });

      _playerInstance.on("playlistItem", function(data) {
        _onPlaylistItem(data.index);
      });

      _playerInstance.on("error", function (error) {
        _onPlayerError(error);
      });

      _playerInstance.setVolume(params.video.volume);

      if (params.video.controls && _pauseDuration > 1) {
        _playerInstance.on("pause", function () {
          _onPause();
        });
      }

      // player is ready
      RiseVision.Video.playerReady();

    });
  }

  function _getSetupData(files) {
    return {
      controls: params.video.controls,
      height: params.height,
      playlist: _utils.getPlaylist(files),
      skin: {name: "rise"},
      stretching : _stretching,
      width: params.width
    };
  }

  /*
   *  Public Methods
   */
  function init(files) {
    _playerInstance = jwplayer("player");

    _files = files;

    _stretching = (params.video.scaleToFit) ? "uniform" : "none";

    // ensure autoPlay is true if controls value is false, otherwise use params value
    _autoPlay = (!params.video.controls) ? true : params.video.autoplay;

    // check if this setting exists due to merge of file and folder
    if (params.video.pause) {
      // convert pause value to number if type is "string"
      params.video.pause = (typeof params.video.pause === "string") ? parseInt(params.video.pause, 10) : params.video.pause;

      // if not of type "number", set its value to 0 so a pause does not get applied
      _pauseDuration = (isNaN(params.video.pause)) ? 0 : params.video.pause;
    } else {
      // ensure no pause duration occurs
      _pauseDuration = 0;
    }

    // setup JWPlayer
    _playerInstance.setup(_getSetupData(files));
    _configureHandlers();

  }

  function play() {
    _viewerPaused = false;

    if (_updateWaiting) {
      _updateWaiting = false;
      // load a new playlist
      _playerInstance.load(_utils.getPlaylist(_files));
    }

    if (_autoPlay) {
      _playerInstance.play();
    }

  }

  function pause() {
    _viewerPaused = true;
    clearTimeout(_pauseTimer);

    if (_playerInstance.getState().toUpperCase() === "PLAYING") {
      _playerInstance.pause();
    }
  }

  function reset() {

    pause();

    function onPlay() {
      // remove handling the play event
      _playerInstance.off("play", onPlay);

      // pause the video at the start
      _playerInstance.pause();
    }

    function onSeeked() {
      // remove handling the seeked event
      _playerInstance.off("seeked", onSeeked);

      // pause the video at the start
      _playerInstance.pause();
    }

    // if status is COMPLETE, a future play call will start playlist over from beginning automatically
    if (_playerInstance.getState().toUpperCase() !== "COMPLETE") {

      // avoid jwplayer promise error in console with setTimeout - http://goo.gl/L4gkTm
      setTimeout(function () {
        if (_playerInstance.getPlaylistIndex() !== 0) {
          _playerInstance.on("play", onPlay);

          // change to first video in list
          _playerInstance.playlistItem(0);
        }
        else {
          // handle when video continues playing after seeking to position
          _playerInstance.on("seeked", onSeeked);

          // move position back to start of video
          _playerInstance.seek(0);
        }
      },100);
      
    }

  }

  function update(files) {
    _files = files;
    _updateWaiting = true;
  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "reset": reset,
    "update": update
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
      mainContainer.style.display = "block";

      _active = false;
    }
  }

  function show(message) {
    var fragment = document.createDocumentFragment(),
      p;

    if (!_active) {
      // hide main container
      mainContainer.style.display = "none";

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
      RiseVision.Common.LoggerUtils.setVersion(version);

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

  // check which version of Rise Cache is running and dynamically add rise-storage dependencies
  RiseVision.Common.RiseCache.isV2Running(function (isV2) {
    var fragment = document.createDocumentFragment(),
      link = document.createElement("link"),
      href = "components/" + ((isV2) ? "rise-storage-v2" : "rise-storage") + "/rise-storage.html",
      storage = document.createElement("rise-storage");

    link.setAttribute("rel", "import");
    link.setAttribute("href", href);

    // add the rise-storage <link> element to document head
    document.getElementsByTagName("head")[0].appendChild(link);

    storage.setAttribute("id", "videoStorage");
    storage.setAttribute("refresh", 5);
    fragment.appendChild(storage);

    // add the <rise-storage> element to the body
    document.body.appendChild(fragment);

    var webcomponents = document.createElement("script");
    webcomponents.src = "components/webcomponentsjs/webcomponents-lite.min.js";

    // add the webcomponents polyfill source to the document head
    document.getElementsByTagName("head")[0].appendChild(webcomponents);
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

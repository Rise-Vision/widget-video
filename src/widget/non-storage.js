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
          "url": response.url
        }, true);

        // Show a different message if there is a 404 coming from rise cache
        var statusCode = error.message.substring(error.message.indexOf(":")+2);

        var errorMessage = "There was a problem retrieving the file from Rise Cache.";
        if(statusCode === "404"){
          errorMessage = "The image does not exist or cannot be accessed.";
        }
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

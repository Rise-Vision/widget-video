var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.NonStorage = function( data ) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache,
    utils = RiseVision.Common.Utilities,
    videoUtils = RiseVision.VideoUtils,
    // 15 minutes
    _refreshDuration = 900000,
    _refreshIntervalId = null,
    _isLoading = true,
    _url = "";

  function _getFile( omitCacheBuster ) {
    riseCache.getFile( _url, function( response, error ) {
      if ( !error ) {

        if ( _isLoading ) {
          _isLoading = false;

          RiseVision.Video.onFileInit( response.url );

          // start the refresh interval
          _startRefreshInterval();

        } else {
          RiseVision.Video.onFileRefresh( response.url );
        }

      } else {

        if ( error.message && error.message === "File is downloading" ) {

          RiseVision.Video.onFileUnavailable( error.message );

        } else {

          // error occurred
          videoUtils.logEvent( {
            "event": "non-storage error",
            "event_details": error.message,
            "file_url": response.url
          }, true );

          // handle the error
          RiseVision.Video.handleError();
        }
      }
    }, omitCacheBuster );
  }

  function _startRefreshInterval() {
    if ( _refreshIntervalId === null ) {
      _refreshIntervalId = setInterval( function() {
        _getFile( false );
      }, _refreshDuration );
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    // Handle pre-merge use of "url" setting property
    _url = ( data.url && data.url !== "" ) ? data.url : data.selector.url;

    _url = utils.addProtocol( _url );

    _getFile( true );
  }

  function retry() {
    _getFile( false );
  }

  return {
    "init": init,
    "retry": retry
  };
};

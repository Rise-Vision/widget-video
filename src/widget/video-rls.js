/* global gadgets, _ */
/* eslint-disable no-console */

var RiseVision = RiseVision || {};

RiseVision.VideoRLS = {};

RiseVision.VideoRLS = ( function( window, gadgets ) {
  "use strict";

  var _mode,
    _displayId,
    _prefs = new gadgets.Prefs(),
    _params = null;

  /*
   *  Private Methods
   */
  function _ready() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, true );
  }

  function _init() {
    console.log( "video-rls init!", _params, _mode, _displayId );
  }

  /*
   *  Public Methods
   */
  function onFileInit( urls ) {

  }

  function onFileRefresh( urls ) {

  }

  function onFileUnavailable( message ) {

  }

  function pause() {}

  function play() {}

  function stop() {
    pause();
  }

  function setAdditionalParams( params, mode, displayId ) {
    _params = _.clone( params );
    _mode = mode;
    _displayId = displayId;

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    _params.width = _prefs.getInt( "rsW" );
    _params.height = _prefs.getInt( "rsH" );

    _ready();
    _init();
  }

  function showError( message ) {

  }

  return {
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "showError": showError,
    "stop": stop
  };

} )( window, gadgets );

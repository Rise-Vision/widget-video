/* global top, RiseVision, sinon, messageHandlers, config */

/* eslint-disable func-names, no-global-assign */

var messageHandlers = [];

config.TEST_USE_RLS = true;

top.RiseVision = RiseVision || {};
top.RiseVision.Viewer = {};
top.RiseVision.Viewer.LocalMessaging = {
  write: function() {
    // console.log(message);
  },
  receiveMessages: function( action ) {
    messageHandlers.push( function( data ) {
      action( data );
    } );
  },
  canConnect: function() {
    return true;
  }
};

sinon.stub( RiseVision.VideoRLS, "setAdditionalParams", function( params, mode, displayId ) {
  ready = true; // eslint-disable-line no-undef
  // spy on log call
  logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" ); // eslint-disable-line no-undef

  RiseVision.VideoRLS.setAdditionalParams.restore();
  // override company id to be the same company from the test data to bypass making direct licensing authorization request
  RiseVision.VideoRLS.setAdditionalParams( params, mode, displayId, "b428b4e8-c8b9-41d5-8a10-b4193c789443" );
} );

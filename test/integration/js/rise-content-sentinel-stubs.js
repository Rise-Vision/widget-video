/* global RiseVision, sinon, config */

/* eslint-disable func-names, no-global-assign */

config.TEST_USE_SENTINEL = true;

sinon.stub( RiseVision.Common.Utilities, "isServiceWorkerRegistered", function() {
  return Promise.resolve();
} )

sinon.stub( RiseVision.VideoWatch, "setAdditionalParams", function( params, mode, displayId ) {
  ready = true; // eslint-disable-line no-undef
  // spy on log call
  logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" ); // eslint-disable-line no-undef

  RiseVision.VideoWatch.setAdditionalParams.restore();
  RiseVision.VideoWatch.setAdditionalParams( params, mode, displayId, "b428b4e8-c8b9-41d5-8a10-b4193c789443", "sentinel" );
} );

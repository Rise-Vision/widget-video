/* global describe, beforeEach, afterEach, it, expect, sinon, RiseVision */

/* eslint-disable func-names */

"use strict";

describe( "onFileRefresh", function() {
  var player;

  beforeEach( function() {
    player = {
      init: sinon.spy()
    };

    RiseVision.PlayerVJS = function() {
      return player;
    }

    sinon.stub( RiseVision.VideoUtils, "resetVideoElement" );
  } );

  afterEach( function() {
    RiseVision.VideoUtils.resetVideoElement.restore();
  } );

  it( "should not play if viewer is paused", function() {
    RiseVision.VideoWatch.onFileRefresh( [ "url1" ] );

    expect( player.init ).to.not.have.been.called;
  } );

  it( "should play if a file is added after player disposal if viewer is not paused", function() {
    RiseVision.VideoUtils.setCurrentFiles( [ "url1" ] );

    RiseVision.VideoWatch.play();
    expect( player.init ).to.have.been.calledWith( [ "url1" ] );
    expect( player.init ).to.have.been.called.once;

    // this is called after folder is emptied
    RiseVision.VideoWatch.playerDisposed();

    // notify the folder has files again
    RiseVision.VideoWatch.onFileRefresh( [ "url2" ] );
    expect( player.init ).to.have.been.calledWith( [ "url2" ] );
    expect( player.init ).to.have.been.called.twice;

    // Cleanup
    RiseVision.VideoWatch.playerDisposed();
  } );

  it( "should not play no files are added after player disposal even if viewer is not paused", function() {
    RiseVision.VideoUtils.setCurrentFiles( [ "url1" ] );

    RiseVision.VideoWatch.play();
    expect( player.init ).to.have.been.calledWith( [ "url1" ] );
    expect( player.init ).to.have.been.called.once;

    // this is called after folder is emptied
    RiseVision.VideoWatch.playerDisposed();

    // notify the folder still has no files
    RiseVision.VideoWatch.onFileRefresh( [] );
    expect( player.init ).to.have.been.called.once;
  } );

} );

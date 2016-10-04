var ready = false,
  isV2Running = false,
  table = "video_v2_events",
  params = {
    "event": "storage file not found",
    "file_url": null,
    "company_id": '"companyId"',
    "display_id": '"displayId"',
    "version": "1.1.0"
  },
  playStub, spy, clock, storage;

var check = function(done) {
  if (ready) {
    playStub = sinon.stub(RiseVision.Video, "play");
    clock = sinon.useFakeTimers();

    done();
  }
  else {
    setTimeout(function() {
      check(done)
    }, 1000);
  }
};

suiteSetup(function(done) {
  if (isV2Running) {
    requests[0].respond(404);
    requests[1].respond(200);
  }

  check(done);
});

teardown(function () {
  RiseVision.Common.LoggerUtils.logEvent.restore();
});

suite("configuration", function () {

  test("should log the configuration event", function () {

    assert(spy.calledWith(table, {
      "event": "configuration",
      "event_details": "storage file",
      "file_url": params.file_url,
      "company_id": params.company_id,
      "display_id": params.display_id,
      "version": params.version
    }));

  });
});

suite("storage file not found", function () {
  var spyCall;

  test("should log a storage file not found error", function () {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-storage-no-file", {
      "detail": "/Fish_Tank_Project.webm",
      "bubbles": true
    }));

    params.event_details = "/Fish_Tank_Project.webm";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a storage file not found error when done is fired", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-no-file", {
      "detail": "/Fish_Tank_Project.webm",
      "bubbles": true
    }));

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    clock.tick(5000);

    assert(spy.calledTwice); // player error + done
    assert(spy.calledWith(table, params));
  });

  test("should not log a storage file not found error when done is fired if the error has resolved itself on a refresh", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-no-file", {
      "detail": "/Fish_Tank_Project.webm",
      "bubbles": true
    }));

    // Resolve the error.
    RiseVision.Video.onFileRefresh(window.gadget.settings.additionalParams.selector.url);

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    params.event = "done";
    params.file_url = window.gadget.settings.additionalParams.selector.url;
    params.file_format = "webm";
    delete params.event_details;

    clock.tick(5000);

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });
});

suite("rise storage error", function () {
  var spyCall;

  test("should log a rise storage error", function () {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-storage-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    }));

    params.event = "rise storage error";
    params.event_details = "The request failed with status code: 0";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a rise storage error when done is fired", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    }));

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    clock.tick(5000);

    assert(spy.calledTwice); // rise storage error + done
    assert(spy.calledWith(table, params));
  });

  test("should not log a rise storage error when done is fired if the error has resolved itself on a refresh", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    }));

    // Resolve the error.
    RiseVision.Video.onFileRefresh(window.gadget.settings.additionalParams.selector.url);

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    params.event = "done";
    params.file_url = window.gadget.settings.additionalParams.selector.url;
    params.file_format = "webm";
    delete params.event_details;  // No event_details for a done event.

    clock.tick(5000);

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a rise cache not running when ping response is empty", function() {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-cache-not-running", null));

    params.event = "rise cache not running";
    params.event_details = "";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a rise cache not running when ping response is 404", function() {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-cache-not-running", {
      "detail": {
        "error": {
          "message": "The request failed with status code: 404"
        }},
      "bubbles": true
    }));

    params.event = "rise cache not running";
    params.event_details = "The request failed with status code: 404";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });
});

suite("storage file throttled or no storage subscription", function () {
  var spyCall;

  test("should log a storage file throttled error", function () {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-storage-file-throttled", {
      "detail": window.gadget.settings.additionalParams.selector.url,
      "bubbles": true
    }));

    params.event = "storage file throttled";
    delete params.event_details;

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a storage file throttled error when done is fired", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-file-throttled", {
      "detail": window.gadget.settings.additionalParams.selector.url,
      "bubbles": true
    }));

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    clock.tick(5000);

    assert(spy.calledTwice); // storage file throttled + done
    assert(spy.calledWith(table, params));
  });

  test("should not log a storage file unavailable error when done is fired if the error has resolved itself on a refresh", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-file-throttled", {
      "detail": window.gadget.settings.additionalParams.selector.url,
      "bubbles": true
    }));

    // Resolve the error.
    RiseVision.Video.onFileRefresh(window.gadget.settings.additionalParams.selector.url);

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    params.event = "done";
    params.file_url = window.gadget.settings.additionalParams.selector.url;
    params.file_format = "webm";

    clock.tick(5000);

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });
});

suite("storage subscription expired", function () {
  var spyCall;

  test("should log a storage subscription expired error", function () {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-storage-subscription-expired"));

    params.event = "storage subscription expired";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a storage subscription error", function () {
    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

    storage.dispatchEvent(new CustomEvent("rise-storage-subscription-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    }));

    params.event = "storage subscription error";
    params.event_details = "The request failed with status code: 0";

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  test("should log a storage subscription expired error when done is fired", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-subscription-expired"));

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    clock.tick(5000);

    delete params.event_details;
    params.event = "storage subscription expired";

    assert(spy.calledTwice); // storage subscription expired + done
    assert(spy.calledWith(table, params));
  });

  test("should not log a storage subscription expired error when done is fired if the error has resolved itself on a refresh", function () {
    storage.dispatchEvent(new CustomEvent("rise-storage-subscription-expired"));

    // Resolve the error.
    RiseVision.Video.onFileRefresh(window.gadget.settings.additionalParams.selector.url);

    spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
    params.event = "done";
    params.file_url = window.gadget.settings.additionalParams.selector.url;
    params.file_format = "webm";

    clock.tick(5000);

    assert(spy.calledOnce);
    assert(spy.calledWith(table, params));
  });

  suite("storage api error", function () {
    var spyCall;

    test("should log a storage api error", function () {
      spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");

      storage.dispatchEvent(new CustomEvent("rise-storage-api-error", {
        "detail": {
          "result": false,
          "code": 500,
          "message": "Could not retrieve Bucket Items"
        },
        "bubbles": true
      }));

      params.event = "storage api error";
      params.event_details = "Response code: 500, message: Could not retrieve Bucket Items";

      assert(spy.calledOnce);
      assert(spy.calledWith(table, params));
    });

    test("should log a storage api error when done is fired", function () {
      storage.dispatchEvent(new CustomEvent("rise-storage-api-error", {
        "detail": {
          "result": false,
          "code": 500,
          "message": "Could not retrieve Bucket Items"
        },
        "bubbles": true
      }));

      spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
      clock.tick(5000);

      assert(spy.calledTwice); // storage file not found + done
      assert(spy.calledWith(table, params));
    });

    test("should not log a storage api error when done is fired if the error has resolved itself on a refresh", function () {
      storage.dispatchEvent(new CustomEvent("rise-storage-api-error", {
        "detail": {
          "result": false,
          "code": 500,
          "message": "Could not retrieve Bucket Items"
        },
        "bubbles": true
      }));

      // Resolve the error.
      RiseVision.Video.onFileRefresh(window.gadget.settings.additionalParams.selector.url);

      spy = sinon.spy(RiseVision.Common.LoggerUtils, "logEvent");
      params.event = "done";
      params.file_url = window.gadget.settings.additionalParams.selector.url;
      params.file_format = "webm";
      delete params.event_details;

      clock.tick(5000);

      assert(spy.calledOnce);
      assert(spy.calledWith(table, params));
    });

  });

});

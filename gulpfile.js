/* jshint node: true */

(function (console) {
  "use strict";

  var gulp = require("gulp");
  var gutil = require("gulp-util");
  var concat = require("gulp-concat");
  var bump = require("gulp-bump");
  var jshint = require("gulp-jshint");
  var minifyCSS = require("gulp-minify-css");
  var usemin = require("gulp-usemin");
  var uglify = require("gulp-uglify");
  var runSequence = require("run-sequence");
  var path = require("path");
  var rename = require("gulp-rename");
  var factory = require("widget-tester").gulpTaskFactory;
  var sourcemaps = require("gulp-sourcemaps");
  var html2js = require("gulp-html2js");
  var bower = require("gulp-bower");
  var del = require("del");
  var colors = require("colors");
  var htmlreplace = require("gulp-html-replace");

  var appJSFiles = [
    "src/**/*.js",
    "!./src/components/**/*"
    ];

  gulp.task("clean-bower", function(cb){
    del(["./src/components/**"], cb);
  });

  gulp.task("clean", function (cb) {
    del(['./dist/**'], cb);
  });

  gulp.task("config", function() {
    var env = process.env.NODE_ENV || "dev";
    gutil.log("Environment is", env);

    return gulp.src(["./src/config/" + env + ".js"])
      .pipe(rename("config.js"))
      .pipe(gulp.dest("./src/config"));
  });

  gulp.task("bump", function(){
    return gulp.src(["./package.json", "./bower.json"])
      .pipe(bump({type:"patch"}))
      .pipe(gulp.dest("./"));
  });

  gulp.task("lint", function() {
    return gulp.src(appJSFiles)
      .pipe(jshint())
      .pipe(jshint.reporter("jshint-stylish"))
      .pipe(jshint.reporter("fail"));
  });

  gulp.task("source", ["lint"], function () {
    return gulp.src(['./src/settings.html', './src/widget.html'])
      .pipe(usemin({
        css: [minifyCSS()],
        js: [sourcemaps.init(), uglify(), sourcemaps.write()]
      }))
      .pipe(gulp.dest("dist/"));
  });

  gulp.task("unminify", function () {
    return gulp.src(['./src/settings.html', './src/widget.html'])
      .pipe(usemin({
        css: [rename(function (path) {
          path.basename = path.basename.substring(0, path.basename.indexOf(".min"))
        }), gulp.dest("dist")],
        js: [rename(function (path) {
          path.basename = path.basename.substring(0, path.basename.indexOf(".min"))
        }), gulp.dest("dist")]
      }))
  });

  gulp.task("fonts", function() {
    return gulp.src("src/components/common-style/dist/fonts/**/*")
      .pipe(gulp.dest("dist/fonts"));
  });

  gulp.task("images", function() {
    return gulp.src("src/components/rv-bootstrap-formhelpers/img/bootstrap-formhelpers-googlefonts.png")
      .pipe(gulp.dest("dist/img"));
  });

  gulp.task("i18n", function(cb) {
    return gulp.src(["src/components/rv-common-i18n/dist/locales/**/*"])
      .pipe(gulp.dest("dist/locales"));
  });

  gulp.task("rise-storage", function() {
    return gulp.src([
      "src/components/webcomponentsjs/webcomponents*.js",
      "src/components/web-component-rise-storage/rise-storage.html",
      "src/components/polymer/**/*.*{html,js}",
      "src/components/core-ajax/*.*{html,js}",
      "src/components/underscore/*.js"
    ], {base: "./src/"})
      .pipe(gulp.dest("dist/"));
  });

  gulp.task("webdriver_update", factory.webdriveUpdate());
  gulp.task("test:metrics", factory.metrics());

  // ***** e2e Testing ***** //

  gulp.task("e2e:server-close", factory.testServerClose());

  // ** Settings ** //
  gulp.task("html:e2e:settings", factory.htmlE2E({
    e2eMockData: "../test/data/url.js"
  }));

  gulp.task("e2e:server:settings", ["config", "html:e2e:settings"], factory.testServer());

  gulp.task("test:e2e:settings:run", ["webdriver_update"], factory.testE2EAngular({
      testFiles: "test/e2e/settings.js"}
  ));

  gulp.task("test:e2e:settings", function(cb) {
    runSequence(["e2e:server:settings"], "test:e2e:settings:run", "e2e:server-close", cb);
  });

  // ** Widget ** //
  gulp.task("html:e2e:widget:url", function () {
    return gulp.src("./src/widget.html")
      .pipe(htmlreplace({
        e2egadgets: "../node_modules/widget-tester/mocks/gadget-mocks.js",
        e2eMockData: "../test/data/url.js"
      }))
      .pipe(rename(function (path) {
        path.basename += "-url-e2e";
      }))
      .pipe(gulp.dest("./src/"));
  });

  gulp.task("html:e2e:widget:storage", function () {
    return gulp.src("./src/widget.html")
      .pipe(htmlreplace({
        e2egadgets: "../node_modules/widget-tester/mocks/gadget-mocks.js",
        e2eStorageMock: "../node_modules/widget-tester/mocks/rise-storage-mock.js",
        e2eMockData: "../test/data/storage.js",
        e2ePolymerReadyMock: "../test/e2e/polymer-ready-mock.js"
      }))
      .pipe(rename(function (path) {
        path.basename += "-storage-e2e";
      }))
      .pipe(gulp.dest("./src/"));
  });

  gulp.task("html:e2e:widget:undefined", function () {
    return gulp.src("./src/widget.html")
      .pipe(htmlreplace({
        e2egadgets: "../node_modules/widget-tester/mocks/gadget-mocks.js",
        e2eMockData: "../test/data/undefined.js"
      }))
      .pipe(rename(function (path) {
        path.basename += "-undefined-e2e";
      }))
      .pipe(gulp.dest("./src/"));
  });

  gulp.task("html:e2e:widget", function (cb) {
    runSequence("html:e2e:widget:url", "html:e2e:widget:storage", "html:e2e:widget:undefined", cb);
  });

  gulp.task("e2e:server:widget", ["config", "html:e2e:widget"], factory.testServer());

  gulp.task("test:e2e:widget:run", ["webdriver_update"], factory.testE2EAngular({
      testFiles: [
        "test/e2e/widget-url.js",
        "test/e2e/widget-storage.js",
        "test/e2e/widget-undefined.js"
      ]}
  ));

  gulp.task("test:e2e:widget", function(cb) {
    runSequence(["e2e:server:widget"], "test:e2e:widget:run", "e2e:server-close", cb);
  });

  gulp.task("test:e2e", function(cb) {
    runSequence("test:e2e:settings"/*, "test:e2e:widget"*/, cb);
  });

  // ***** Primary Tasks ***** //
  gulp.task("bower-clean-install", ["clean-bower"], function(cb){
    return bower().on("error", function(err) {
      console.log(err);
      cb();
    });
  });

  gulp.task("test", function(cb) {
    runSequence("test:e2e", "test:metrics", cb);
  });

  gulp.task("build", function (cb) {
    runSequence(["clean", "config"], ["source", "fonts", "images", "i18n", "rise-storage"], ["unminify"], cb);
  });

  gulp.task("default", [], function() {
    console.log("********************************************************************".yellow);
    console.log("  gulp bower-clean-install: delete and re-install bower components".yellow);
    console.log("  gulp test: run e2e and unit tests".yellow);
    console.log("  gulp build: build a distribution version".yellow);
    console.log("********************************************************************".yellow);
    return true;
  });

})(console);

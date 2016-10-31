(function (console) {
  "use strict";

  var bower = require("gulp-bower");
  var colors = require("colors");
  var del = require("del");
  const eslint = require("gulp-eslint");
  var gulp = require("gulp");
  var gulpif = require("gulp-if");
  var gutil = require("gulp-util");
  var concat = require("gulp-concat");
  var bump = require("gulp-bump");
  var file = require('gulp-file');
  var minifyCSS = require("gulp-minify-css");
  var usemin = require("gulp-usemin");
  var uglify = require("gulp-uglify");
  var runSequence = require("run-sequence");
  var path = require("path");
  var rename = require("gulp-rename");
  var factory = require("widget-tester").gulpTaskFactory;
  var sourcemaps = require("gulp-sourcemaps");
  var html2js = require("gulp-html2js");
  var wct = require("web-component-tester").gulp.init(gulp);
  var env = process.env.NODE_ENV || "prod";

  const htmlFiles = [
    "./src/settings.html",
    "./src/widget.html"
  ];

  gulp.task("clean-bower", function(cb){
    del(["./src/components/**"], cb);
  });

  gulp.task("clean", function (cb) {
    del(['./dist/**'], cb);
  });

  gulp.task("config", function() {
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

  gulp.task( "lint", function() {
    return gulp.src( [ "src/**/*.js" ] )
      .pipe( eslint() )
      .pipe( eslint.format() )
      .pipe( eslint.failAfterError() );
  } );

  gulp.task("source", ["lint"], function () {
    var isProd = (env === "prod");

    return gulp.src(htmlFiles)
      .pipe(gulpif(isProd,
        // Minify for production.
        usemin({
          css: [minifyCSS()],
          js: [sourcemaps.init(), uglify(), sourcemaps.write()]
        }),
        // Don't minify for staging.
        usemin({})
      ))
      .pipe(gulp.dest("dist/"));
  });

  gulp.task("unminify", function () {
    return gulp.src(htmlFiles)
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
      "src/components/rise-storage/rise-storage.html",
      "src/components/rise-storage-v2/rise-storage.html",
      "src/components/rise-logger/rise-logger.html",
      "src/components/rise-logger/rise-logger-utils.html",
      "src/components/polymer/*.*{html,js}",
      "src/components/promise-polyfill/*.*{html,js}",
      "src/components/iron-ajax/*.*{html,js}",
      "src/components/underscore/*.js"
    ], {base: "./src/"})
      .pipe(gulp.dest("dist/"));
  });

  gulp.task("version", function () {
    var pkg = require("./package.json"),
      str = '/* exported version */\n' +
        'var version = "' + pkg.version + '";';

    return file('version.js', str, {src: true})
      .pipe(gulp.dest('./src/config/'));
  });

  gulp.task("webdriver_update", factory.webdriveUpdate());

  // ***** e2e Testing ***** //

  gulp.task("e2e:server-close", factory.testServerClose());

  gulp.task("html:e2e:settings", factory.htmlE2E());

  gulp.task("e2e:server:settings", ["config", "html:e2e:settings"], factory.testServer());

  gulp.task("test:e2e:settings:run", ["webdriver_update"], factory.testE2EAngular({
      testFiles: "test/e2e/settings.js"}
  ));

  gulp.task("test:e2e:settings", function(cb) {
    runSequence(["e2e:server:settings"], "test:e2e:settings:run", "e2e:server-close", cb);
  });

  gulp.task("test:e2e", function(cb) {
    runSequence("test:e2e:settings", cb);
  });

  // ****** Unit Testing ***** //
  gulp.task("test:unit:settings", factory.testUnitAngular(
    {testFiles: [
      "src/components/jquery/dist/jquery.js",
      "src/components/angular/angular.js",
      "src/components/angular-mocks/angular-mocks.js",
      "src/components/angular-sanitize/angular-sanitize.js",
      "src/components/angular-translate/angular-translate.js",
      "src/components/angular-translate-loader-static-files/angular-translate-loader-static-files.js",
      "node_modules/widget-tester/mocks/common-mock.js",
      "src/components/bootstrap-sass-official/assets/javascripts/bootstrap.js",
      "src/components/angular-bootstrap/ui-bootstrap-tpls.js",
      "src/components/widget-settings-ui-components/dist/js/**/*.js",
      "src/components/widget-settings-ui-core/dist/*.js",
      "src/components/component-storage-selector/dist/storage-selector.js",
      "src/components/component-subscription-status/dist/js/subscription-status.js",
      "src/components/bootstrap-form-components/dist/js/**/*.js",
      "src/components/seiyria-bootstrap-slider/dist/bootstrap-slider.min.js",
      "src/components/angular-bootstrap-slider/slider.js",
      "src/config/test.js",
      "src/settings/settings-app.js",
      "src/settings/**/*.js",
      "test/unit/settings/**/*spec.js"]}
  ));

  gulp.task("test:unit:player-utils", factory.testUnitAngular(
    {testFiles: [
      "src/widget/player-utils.js",
      "test/unit/widget/player-utils-spec.js"
    ]}
  ));

  gulp.task("test:unit:player-main", factory.testUnitAngular(
    {testFiles: [
      "src/widget/player-utils.js",
      "src/widget/player-vjs.js",
      "test/unit/widget/player-vjs-spec.js"
    ]}
  ));

  gulp.task("test:unit:player", function(cb) {
    runSequence("test:unit:player-utils", "test:unit:player-main", cb);
  });

  gulp.task("test:unit:widget", factory.testUnitAngular(
    {testFiles: [
      "node_modules/widget-tester/mocks/gadget-mocks.js",
      "node_modules/widget-tester/mocks/logger-mock.js",
      "src/components/widget-common/dist/config.js",
      "src/config/version.js",
      "src/config/test.js",
      "src/widget/video.js",
      "test/unit/widget/video-spec.js"
    ]}
  ));

  gulp.task("test:unit", function(cb) {
    runSequence("test:unit:player", "test:unit:widget", "test:unit:settings",cb);
  });

  gulp.task("test:integration:rise-storage", function(cb) {
    // web component tester (wct)
    runSequence("test:local", cb);
  });

  gulp.task("test:integration", function (cb) {
    runSequence("test:integration:rise-storage", cb);
  });

  // ***** Primary Tasks ***** //
  gulp.task("bower-clean-install", ["clean-bower"], function(cb){
    return bower().on("error", function(err) {
      console.log(err);
      cb();
    });
  });

  gulp.task("bower-update", function (cb) {
    return bower({ cmd: "update"}).on("error", function(err) {
      console.log(err);
      cb();
    });
  });

  gulp.task("build-dev", function (cb) {
    runSequence(["clean", "config", "version"], ["source", "fonts", "images", "i18n", "rise-storage"], ["unminify"], cb);
  });

  gulp.task("test", function(cb) {
    runSequence("version", "test:unit", "test:integration", "test:e2e", cb);
  });

  gulp.task("build", function (cb) {
    runSequence(["clean", "config", "bower-update", "version"], ["source", "fonts", "images", "i18n", "rise-storage"], ["unminify"], cb);
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
